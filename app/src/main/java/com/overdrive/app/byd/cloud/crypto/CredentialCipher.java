package com.overdrive.app.byd.cloud.crypto;

import com.overdrive.app.logging.DaemonLogger;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Protects sensitive credential fields at rest.
 *
 * <p>Two stored forms:
 * <ul>
 *   <li>{@code "ENC2:" + base64(iv | AES-GCM ciphertext)} under a random 256-bit key from a {@link KeySource} (an
 *       owner-only file the daemons share, of which the app keeps a private copy). Every new write uses it whenever
 *       this process holds the key.</li>
 *   <li>{@code "ENC:" + base64(iv | AES-GCM ciphertext)} under SHA-256 of the device-id file (plus, for the oldest
 *       values, the firmware fingerprint). That file is world-readable, so any app on the head unit can rebuild this
 *       key. It is kept only to read older values, and as the fallback when the key isn't held (as before);
 *       {@link #upgradeToStableOrNull} moves such values to ENC2.</li>
 * </ul>
 */
public final class CredentialCipher {

    private static final String TAG = "CredentialCipher";
    private static final DaemonLogger logger = DaemonLogger.getInstance(TAG);

    private static final String ENC_PREFIX = "ENC:";
    private static final String ENC2_PREFIX = "ENC2:";
    private static final int KEY_LEN = 32;
    private static final String CIPHER_ALGO = "AES/GCM/NoPadding";
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;
    private static final String KD_SALT = "overdrive-byd-cred-v1";
    private static final String DID_PATH = com.overdrive.app.util.ScratchRoot.path(".byd_device_id");

    private CredentialCipher() {}

    // ==================== KEY SOURCE ====================

    /** Where the ENC2 key comes from in this process. */
    public interface KeySource {
        /** The 32-byte key, or null when this process doesn't hold it (yet). Must not block. */
        byte[] key();

        /** An ENC2 value could not be opened with what {@link #key()} gave (or it gave none): fetch it again. */
        default void keyRejected() {}

        /**
         * True where the key is the original (the daemons' own file), not a copy that may be stale: only there are
         * stored values moved to ENC2 by {@link #upgradeToStableOrNull}.
         */
        default boolean ownsKey() {
            return true;
        }
    }

    private static volatile KeySource keySource = null;
    // This process's key store, made on first use (every daemon process, not only the camera daemon, reads
    // credentials); the app also points it at its private copy at start-up.
    private static volatile KeySource defaultKeySource = null;
    private static volatile java.util.function.Supplier<String> deviceIdSource = null;

    /** Overrides the key source (tests); null goes back to this process's default. */
    public static void useKeySource(KeySource source) {
        keySource = source;
    }

    /** This process's own key store. */
    static void useDefaultKeySource(KeySource source) {
        defaultKeySource = source;
    }

    /** Tests: the device id the legacy key derives from (null: the device-id file). */
    static void useDeviceIdSource(java.util.function.Supplier<String> source) {
        deviceIdSource = source;
    }

    private static KeySource source() {
        KeySource s = keySource;
        if (s != null) return s;
        KeySource d = defaultKeySource;
        return d != null ? d : CredentialKeyStore.processStore();
    }

    private static byte[] currentKey() {
        try {
            byte[] k = source().key();
            return k != null && k.length == KEY_LEN ? k : null;
        } catch (Throwable t) {
            return null;
        }
    }

    /** True when this process holds the ENC2 key right now. */
    public static boolean hasKey() {
        return currentKey() != null;
    }

    private static void reportRejected() {
        try {
            source().keyRejected();
        } catch (Throwable ignored) {}
    }

    // ==================== FORMS ====================

    /** True for both stored forms ("ENC:" device-id key, "ENC2:" random key). */
    public static boolean isEncrypted(String value) {
        return value != null && (value.startsWith(ENC_PREFIX) || value.startsWith(ENC2_PREFIX));
    }

    /** True for a value in the random-key form. */
    public static boolean isEnc2(String value) {
        return value != null && value.startsWith(ENC2_PREFIX);
    }

    /**
     * True when {@code stored} is an encrypted value this process can't open right now (decrypt gives ""), e.g. an
     * ENC2 value read by the app before it holds the key. A caller that rewrites a credential it read must then keep
     * {@code stored} as it is instead of writing that "" back over it.
     */
    public static boolean isUndecryptable(String stored) {
        if (!isEncrypted(stored)) return false;
        String plain = decrypt(stored);
        return plain == null || plain.isEmpty();
    }

    // ==================== ENCRYPT ====================

    /**
     * Encrypt a plaintext credential for storage: ENC2 when this process holds the key, else ENC: (the device-id
     * key, as before). Returns the original value if encryption fails.
     */
    public static String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) return plaintext;
        if (isEncrypted(plaintext)) return plaintext;

        byte[] k2 = currentKey();
        if (k2 != null) {
            try {
                return ENC2_PREFIX + java.util.Base64.getEncoder().encodeToString(seal(k2, plaintext));
            } catch (Exception e) {
                logger.warn("Credential protection (ENC2) failed, using the device-id key: " + e.getMessage());
            }
        }

        try {
            // Always encrypt under the stable (fingerprint-free) key so a
            // later OTA can't strand this ciphertext. decrypt() still reads
            // legacy fingerprint-bound values via its fallback.
            return ENC_PREFIX + legacyBase64Encode(seal(deriveKey(/*includeFingerprint=*/false), plaintext));
        } catch (Exception e) {
            logger.warn("Credential protection failed: " + e.getMessage());
            return plaintext;
        }
    }

    private static byte[] seal(byte[] key, String plaintext) throws Exception {
        byte[] iv = new byte[IV_LEN];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
        cipher.init(Cipher.ENCRYPT_MODE,
                new SecretKeySpec(key, "AES"),
                new GCMParameterSpec(TAG_BITS, iv));

        byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        byte[] out = new byte[iv.length + ct.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(ct, 0, out, iv.length, ct.length);
        return out;
    }

    // ==================== DECRYPT ====================

    /**
     * Decrypt a stored credential.
     * Values without the encrypted marker are returned as-is (legacy support).
     * Returns empty string on decryption failure (forces re-setup).
     *
     * <p>ENC2 values open only with the key from the {@link KeySource}; without it (the app before it fetched it)
     * they give "" like any other failure, and the key source is told so it can fetch the key.
     *
     * <p>ENC: values: tries the stable (device-id-only) key first, then falls back to the
     * legacy (device-id + firmware-fingerprint) key. The GCM auth tag makes a
     * wrong-key attempt fail cleanly (AEADBadTagException), so trying both is
     * safe and unambiguous. This lets a credential written by the old
     * fingerprint-bound scheme still decrypt on the same firmware, while every
     * NEW write uses the stable key so a future OTA (which changes
     * {@code Build.FINGERPRINT}) no longer silently invalidates it.
     */
    public static String decrypt(String stored) {
        if (stored == null || stored.isEmpty()) return stored;
        if (!isEncrypted(stored)) return stored;
        if (isEnc2(stored)) return decryptEnc2(stored);

        final byte[] combined;
        try {
            combined = legacyBase64Decode(stored.substring(ENC_PREFIX.length()));
        } catch (Exception e) {
            logger.error("Credential recovery failed (base64): " + e.getMessage());
            return "";
        }
        // A blob too short to even hold IV(12)+GCM-tag(16) is structurally
        // undecryptable, never a legitimate plaintext. Fail CLOSED (return "")
        // like the base64-failure branch above, so botTokenPresentButUndecryptable()
        // sees it as broken and the daemon emits its park+diagnostic recovery
        // instead of building a bogus ".../botENC:.../getUpdates" URL that 404s
        // forever while logging a "configured" token.
        if (combined.length < IV_LEN + 1) return "";

        byte[] iv = new byte[IV_LEN];
        System.arraycopy(combined, 0, iv, 0, IV_LEN);
        byte[] ct = new byte[combined.length - IV_LEN];
        System.arraycopy(combined, IV_LEN, ct, 0, ct.length);

        // Stable key first (the going-forward scheme), then legacy fallback.
        String plain = tryDecrypt(iv, ct, /*includeFingerprint=*/false);
        if (plain != null) return plain;
        plain = tryDecrypt(iv, ct, /*includeFingerprint=*/true);
        if (plain != null) return plain;

        logger.error("Credential recovery failed: no key (stable or legacy) "
                + "could decrypt — device id missing or firmware changed before re-encrypt");
        return "";
    }

    // ENC2 values: "" when it can't be opened (no key, another key, malformed), like the ENC: failure path.
    private static String decryptEnc2(String stored) {
        final byte[] combined;
        try {
            combined = java.util.Base64.getDecoder().decode(stored.substring(ENC2_PREFIX.length()));
        } catch (Exception e) {
            logger.error("Credential recovery failed (ENC2 base64): " + e.getMessage());
            return "";
        }
        if (combined.length < IV_LEN + 1) return "";
        byte[] key = currentKey();
        if (key == null) {
            logger.warn("Credential recovery deferred: this process doesn't hold the credential key yet");
            reportRejected();
            return "";
        }
        byte[] iv = new byte[IV_LEN];
        System.arraycopy(combined, 0, iv, 0, IV_LEN);
        byte[] ct = new byte[combined.length - IV_LEN];
        System.arraycopy(combined, IV_LEN, ct, 0, ct.length);
        String plain = tryDecryptWith(key, iv, ct);
        if (plain != null) return plain;
        logger.error("Credential recovery failed: the credential key doesn't open this value");
        reportRejected();
        return "";
    }

    /** One decrypt attempt under a specific key derivation. Null on failure. */
    private static String tryDecrypt(byte[] iv, byte[] ct, boolean includeFingerprint) {
        final byte[] key;
        try {
            key = deriveKey(includeFingerprint);
        } catch (Exception e) {
            return null;  // no device id
        }
        return tryDecryptWith(key, iv, ct);
    }

    private static String tryDecryptWith(byte[] key, byte[] iv, byte[] ct) {
        try {
            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;  // wrong key (bad tag) or transient — caller tries next
        }
    }

    // The ENC: encoding: android.util.Base64 on the device; java.util.Base64 (same alphabet, no line wrap) where the
    // Android class is only a stub (JVM unit tests).
    private static String legacyBase64Encode(byte[] data) {
        String out = null;
        try {
            out = android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP);
        } catch (RuntimeException ignored) {
            // JVM unit-test stub
        }
        return out != null ? out : java.util.Base64.getEncoder().encodeToString(data);
    }

    private static byte[] legacyBase64Decode(String data) {
        byte[] out = null;
        try {
            out = android.util.Base64.decode(data, android.util.Base64.NO_WRAP);
        } catch (IllegalArgumentException e) {
            throw e;  // real decoder: bad input
        } catch (RuntimeException ignored) {
            // JVM unit-test stub
        }
        return out != null ? out : java.util.Base64.getDecoder().decode(data);
    }

    // ==================== UPGRADE ====================

    // Whether this process may move values to ENC2: it holds the key and it is the original, not a copy.
    private static boolean canMigrateToEnc2() {
        try {
            return currentKey() != null && source().ownsKey();
        } catch (Throwable t) {
            return false;
        }
    }

    /**
     * True when {@code stored} should be rewritten:
     * <ul>
     *   <li>any readable ENC: value, when this process holds the ENC2 key and owns it (the daemons): the device-id
     *       key anyone can rebuild no longer protects it once it moves to ENC2;</li>
     *   <li>otherwise, as before, an ENC: value only the LEGACY (fingerprint-bound) key can decrypt, which should
     *       move to the stable key before a future OTA strands it.</li>
     * </ul>
     * Returns false for plaintext, unset, ENC2, or already-stable values without the key, and for values that don't
     * decrypt at all (nothing we can do).
     */
    public static boolean needsStableReEncrypt(String stored) {
        if (!isEncrypted(stored) || isEnc2(stored)) return false;
        final byte[] combined;
        try {
            combined = legacyBase64Decode(stored.substring(ENC_PREFIX.length()));
        } catch (Exception e) {
            return false;
        }
        if (combined.length < IV_LEN + 1) return false;
        byte[] iv = new byte[IV_LEN];
        System.arraycopy(combined, 0, iv, 0, IV_LEN);
        byte[] ct = new byte[combined.length - IV_LEN];
        System.arraycopy(combined, IV_LEN, ct, 0, ct.length);
        boolean stable = tryDecrypt(iv, ct, false) != null;
        if (canMigrateToEnc2()) return stable || tryDecrypt(iv, ct, true) != null;
        // Stable can't, but legacy can → it's a legacy ciphertext.
        return !stable && tryDecrypt(iv, ct, true) != null;
    }

    /**
     * Upgrade a stored ENC: credential: to ENC2 where this process owns the key, else (as before) to the stable
     * device-id key if (and only if) it is a legacy fingerprint-bound ciphertext. Returns the re-encrypted value to
     * persist, or {@code null} when no rewrite should happen (not encrypted, already ENC2, already stable without
     * the key, unrecoverable, a transient encrypt failure that would otherwise downgrade it to plaintext, or a new
     * value that doesn't read back as the same plaintext). Callers persist the
     * returned value under the cross-process config lock.
     *
     * <p>Centralises the OTA-stability upgrade so every credential field
     * (telegram bot token, BYD-cloud password, NavMap key) gets the same
     * treatment instead of being stranded under the old fingerprint key.
     */
    public static String upgradeToStableOrNull(String stored) {
        if (!needsStableReEncrypt(stored)) return null;
        String plain = decrypt(stored);
        if (plain == null || plain.isEmpty()) return null;  // unrecoverable
        String reEncrypted = encrypt(plain);
        // encrypt() is fail-open (returns plaintext on JCE error). Never persist
        // a non-encrypted result over a working encrypted blob.
        if (!isEncrypted(reEncrypted)) return null;
        // A value the stable device-id key already reads is rewritten only to reach ENC2: if the key went away
        // between the check and the encrypt, rewriting it as ENC: again gains nothing.
        if (!isEnc2(reEncrypted) && readsUnderStableDeviceKey(stored)) return null;
        // Only the key's owner commits ENC2 values: a copy (the app's) may be stale.
        if (isEnc2(reEncrypted) && !canMigrateToEnc2()) return null;
        // Round-trip verify before committing: if the DID file flapped unreadable
        // between the decrypt above and this encrypt, deriveKey throws and the
        // isEncrypted() check above already catches that (encrypt() fails open
        // to plaintext). This verifies the rarer case of a readable-but-CHANGED
        // DID producing a validly-encrypted blob under the wrong key. Confirm it
        // actually round-trips back to the same plaintext; if not, leave the
        // working legacy blob untouched for the next run.
        if (!plain.equals(decrypt(reEncrypted))) return null;
        return reEncrypted;
    }

    private static boolean readsUnderStableDeviceKey(String stored) {
        try {
            byte[] combined = legacyBase64Decode(stored.substring(ENC_PREFIX.length()));
            if (combined.length < IV_LEN + 1) return false;
            byte[] iv = new byte[IV_LEN];
            System.arraycopy(combined, 0, iv, 0, IV_LEN);
            byte[] ct = new byte[combined.length - IV_LEN];
            System.arraycopy(combined, IV_LEN, ct, 0, ct.length);
            return tryDecrypt(iv, ct, false) != null;
        } catch (Exception e) {
            return false;
        }
    }

    // ==================== LEGACY KEY ====================

    /**
     * Device-bound AES key. The persisted device id ({@link #DID_PATH}) is the
     * sole device binding for the going-forward (stable) key. The legacy key
     * additionally mixes {@code Build.FINGERPRINT}, which is what made an OTA
     * silently invalidate every stored credential — the fingerprint adds no
     * real secrecy (it's world-readable) so the stable key drops it.
     */
    private static byte[] deriveKey(boolean includeFingerprint) throws Exception {
        String did = readDid();
        if (did == null) {
            // No fallback to a fixed sentinel here: this source is public, so a
            // constant key material would let anyone decrypt any credential
            // blob written while the DID was unreadable. Throwing forces
            // encrypt() to fail-open to plaintext (visibly unprotected, not
            // falsely "ENC:"-tagged) and decrypt() to fail-closed to "" —
            // both already-handled paths in the callers below.
            throw new IllegalStateException("device id unavailable at " + DID_PATH);
        }
        MessageDigest d = MessageDigest.getInstance("SHA-256");
        String material = KD_SALT + ":" + did;
        if (includeFingerprint) {
            String bp;
            try {
                bp = android.os.Build.FINGERPRINT;
            } catch (Throwable e) {
                bp = "unknown";
            }
            material = material + ":" + bp;
        }
        return d.digest(material.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Reads the cross-UID device id (app 10xxx + daemon 2000) that
     * {@link #deriveKey} binds the credential key to. Returns {@code null} if
     * the file doesn't exist or is empty/unreadable — callers must NOT
     * substitute a fixed string here (see {@link #deriveKey}). The daemon
     * ({@code CameraDaemon.generateDeviceId()}) is responsible for seeding
     * this file with a {@code SecureRandom} value on first boot; this method
     * only reads it.
     */
    private static String readDid() {
        java.util.function.Supplier<String> override = deviceIdSource;
        if (override != null) return override.get();
        try {
            File f = new File(DID_PATH);
            if (f.exists()) {
                BufferedReader r = new BufferedReader(new FileReader(f));
                String id = r.readLine();
                r.close();
                if (id != null && !id.trim().isEmpty()) return id.trim();
            }
        } catch (Exception ignored) {}
        return null;
    }
}
