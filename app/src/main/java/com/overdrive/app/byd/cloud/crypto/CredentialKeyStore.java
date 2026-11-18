package com.overdrive.app.byd.cloud.crypto;

import com.overdrive.app.logging.DaemonLogger;

import java.io.File;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;

/**
 * Where the ENC2 credential key lives, mirroring how {@code AuthManager} keeps the login secret:
 * <ul>
 *   <li>Daemons (shell/root UID): an owner-only (0600) file {@code .overdrive_cred_key} in the scratch root, made
 *       once under a lock the daemons share (whole, then renamed in), and never replaced: a file that exists but
 *       can't be read gives no key rather than a new one, which would strand every value under the old key.</li>
 *   <li>App: a private copy in its files dir. When it has none (first run, cleared data) or a value doesn't open with
 *       it (the key was restored from a backup), it reads the daemons' file over its shell link, off the caller's
 *       thread, and keeps that. It never writes the daemons' file.</li>
 * </ul>
 * File content: the 32-byte key as 64 lowercase hex characters.
 */
public final class CredentialKeyStore implements CredentialCipher.KeySource {

    private static final String TAG = "CredentialKeyStore";
    private static final DaemonLogger logger = DaemonLogger.getInstance(TAG);

    public static final String KEY_FILE_NAME = ".overdrive_cred_key";
    private static final String APP_COPY_NAME = "cred_key";
    private static final int KEY_LEN = 32;
    private static final long FETCH_RETRY_MS = 10_000L;

    /** The daemons' key file. */
    public static String daemonKeyPath() {
        return com.overdrive.app.util.ScratchRoot.path(KEY_FILE_NAME);
    }

    /** Makes a just-created, still-empty file readable by its owner only. */
    interface OwnerOnly {
        void apply(File file) throws Exception;
    }

    private final boolean daemonSide;
    private final File daemonFile;
    private volatile File appFile;
    private volatile Function<String, String> daemonReader;
    private final Executor executor;
    private final OwnerOnly ownerOnly;

    private volatile byte[] cached;
    private volatile long cachedMtime;
    private volatile long cachedLength;
    private final AtomicBoolean fetching = new AtomicBoolean(false);
    private volatile long fetchAt;

    CredentialKeyStore(boolean daemonSide, File daemonFile, File appFile, Function<String, String> daemonReader,
                       Executor executor, OwnerOnly ownerOnly) {
        this.daemonSide = daemonSide;
        this.daemonFile = daemonFile;
        this.appFile = appFile;
        this.daemonReader = daemonReader;
        this.executor = executor;
        this.ownerOnly = ownerOnly;
    }

    // ==================== PROCESS WIRING ====================

    private static volatile CredentialKeyStore process;

    /** This process's store, made on first use and installed as {@link CredentialCipher}'s key source. */
    static synchronized CredentialKeyStore processStore() {
        CredentialKeyStore s = process;
        if (s == null) {
            s = new CredentialKeyStore(daemonSide(), new File(daemonKeyPath()), null, null,
                    Executors.newSingleThreadExecutor(r -> {
                        Thread t = new Thread(r, "cred-key");
                        t.setDaemon(true);
                        return t;
                    }),
                    f -> android.system.Os.chmod(f.getPath(), 0600));
            process = s;
            CredentialCipher.useDefaultKeySource(s);
        }
        return s;
    }

    /** Daemon start-up: the key file exists from here on (made now if this is the first daemon to run). */
    public static void installForDaemon() {
        CredentialKeyStore s = processStore();
        if (!s.daemonSide) return;
        if (s.key() == null) logger.warn("No credential key: credentials keep the device-id form for now");
    }

    /**
     * App start-up: its private copy lives in {@code filesDir}; {@code reader} reads a shell-owned file over the
     * app's ADB link (null when it can't). Starts a background fetch so the copy is normally there before anything
     * reads a credential.
     */
    public static void installForApp(File filesDir, Function<String, String> reader) {
        CredentialKeyStore s = processStore();
        if (s.daemonSide) return;
        s.appFile = filesDir == null ? null : new File(filesDir, APP_COPY_NAME);
        s.daemonReader = reader;
        s.fetchFromDaemon();
    }

    /** The key may have changed on disk (a backup restore): read it again on next use. */
    public static void invalidateProcessCache() {
        CredentialKeyStore s = process;
        if (s != null) s.invalidate();
    }

    private static boolean daemonSide() {
        try {
            return android.os.Process.myUid() < android.os.Process.FIRST_APPLICATION_UID;
        } catch (Throwable t) {
            return false;
        }
    }

    // ==================== KEY SOURCE ====================

    @Override
    public byte[] key() {
        if (daemonSide) return daemonKey();
        File f = appFile;
        if (f == null) return null;
        byte[] k = readCached(f);
        if (k == null) requestFetch(false);
        return k;
    }

    @Override
    public void keyRejected() {
        invalidate();
        if (!daemonSide) requestFetch(false);
    }

    /** The daemons hold the original; the app's copy may lag a restored key, so it doesn't migrate values. */
    @Override
    public boolean ownsKey() {
        return daemonSide;
    }

    void invalidate() {
        cached = null;
        cachedMtime = 0;
        cachedLength = 0;
    }

    /** App: fetch the daemons' key now (in the background), replacing a copy that differs. */
    void fetchFromDaemon() {
        requestFetch(true);
    }

    // ==================== DAEMON ====================

    private byte[] daemonKey() {
        if (daemonFile.exists()) return readCached(daemonFile);  // never replaced, even when unreadable
        return createDaemonKey();
    }

    // Only if no daemon made it first (several start at boot): the one on disk then.
    private byte[] createDaemonKey() {
        File lock = new File(daemonFile.getPath() + ".lock");
        try (RandomAccessFile raf = new RandomAccessFile(lock, "rw");
             FileLock ignored = raf.getChannel().lock()) {
            if (daemonFile.exists()) return readCached(daemonFile);
            byte[] k = new byte[KEY_LEN];
            new SecureRandom().nextBytes(k);
            if (!writeOwnerOnly(daemonFile, toHex(k))) return null;
            logger.info("Created the credential key");
            return readCached(daemonFile);
        } catch (Exception e) {
            logger.warn("Could not create the credential key: " + e.getMessage());
            return null;
        }
    }

    // ==================== APP ====================

    private void requestFetch(boolean force) {
        if (daemonSide || daemonReader == null || appFile == null) return;
        long now = System.currentTimeMillis();
        if (!force && now - fetchAt < FETCH_RETRY_MS) return;
        if (!fetching.compareAndSet(false, true)) return;
        fetchAt = now;
        try {
            executor.execute(() -> {
                try {
                    fetchNow();
                } catch (Throwable t) {
                    logger.warn("Reading the daemons' credential key failed: " + t.getClass().getSimpleName());
                } finally {
                    fetching.set(false);
                }
            });
        } catch (Throwable t) {
            fetching.set(false);
        }
    }

    private void fetchNow() throws Exception {
        Function<String, String> reader = daemonReader;
        File own = appFile;
        if (reader == null || own == null) return;
        String raw = reader.apply(daemonFile.getPath());
        byte[] k = parse(raw);
        if (k == null) return;
        byte[] mine = parse(readText(own));
        if (mine != null && Arrays.equals(mine, k)) return;
        if (writeOwnerOnly(own, toHex(k))) {
            invalidate();
            logger.info(mine == null ? "Took the credential key into the app's copy"
                    : "Replaced the app's credential key with the daemons' one");
        }
    }

    // ==================== FILES ====================

    private byte[] readCached(File f) {
        long m = f.lastModified();
        long len = f.length();
        byte[] c = cached;
        if (c != null && m != 0 && m == cachedMtime && len == cachedLength) return c.clone();
        byte[] k = parse(readText(f));
        if (k != null) {
            cached = k;
            cachedMtime = m;
            cachedLength = len;
            return k.clone();
        }
        return null;
    }

    // Owner-only from creation (chmod before the key goes in), written whole, then renamed in.
    private boolean writeOwnerOnly(File file, String content) {
        File tmp = new File(file.getPath() + ".tmp");
        try {
            tmp.delete();
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                ownerOnly.apply(tmp);
                out.write(content.getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            }
            if (!tmp.renameTo(file)) {
                tmp.delete();
                return false;
            }
            return true;
        } catch (Exception e) {
            logger.warn("Could not write the credential key: " + e.getMessage());
            tmp.delete();
            return false;
        }
    }

    private static String readText(File f) {
        try {
            if (f == null || !f.isFile()) return null;
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /** True for text in the key file's format (64 hex characters, surrounding whitespace ignored). */
    public static boolean isValidKeyText(String text) {
        return parse(text) != null;
    }

    static byte[] parse(String text) {
        if (text == null) return null;
        String t = text.trim();
        if (t.length() != KEY_LEN * 2) return null;
        byte[] out = new byte[KEY_LEN];
        for (int i = 0; i < KEY_LEN; i++) {
            int hi = Character.digit(t.charAt(2 * i), 16);
            int lo = Character.digit(t.charAt(2 * i + 1), 16);
            if (hi < 0 || lo < 0) return null;
            out[i] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    static String toHex(byte[] k) {
        StringBuilder sb = new StringBuilder(k.length * 2);
        for (byte b : k) sb.append(Character.forDigit((b >> 4) & 0xf, 16)).append(Character.forDigit(b & 0xf, 16));
        return sb.toString();
    }
}
