package com.overdrive.app.byd.cloud.crypto;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * F1: the ENC2 key lives in an owner-only file the daemons create once; the app keeps a private copy fetched from it
 * (over its shell link), never writing the daemons' file.
 */
public class CredentialKeyStoreTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private final List<File> madeOwnerOnly = new ArrayList<>();

    private CredentialKeyStore daemon(File daemonFile) {
        return new CredentialKeyStore(true, daemonFile, null, null, Runnable::run, madeOwnerOnly::add);
    }

    private CredentialKeyStore app(File daemonFile, File appFile, java.util.function.Function<String, String> reader) {
        return new CredentialKeyStore(false, daemonFile, appFile, reader, Runnable::run, madeOwnerOnly::add);
    }

    private static String text(File f) throws Exception {
        return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
    }

    @Test
    public void daemonCreatesTheKeyOnceOwnerOnly() throws Exception {
        File f = new File(tmp.getRoot(), ".overdrive_cred_key");
        byte[] k = daemon(f).key();
        assertNotNull(k);
        assertEquals(32, k.length);
        assertTrue(f.isFile());
        assertEquals(64, text(f).trim().length());
        assertFalse("written via a temp file, chmod'ed before the key goes in", madeOwnerOnly.isEmpty());
        assertFalse(madeOwnerOnly.contains(f));

        // another daemon (or a restart) reads the same key
        assertArrayEquals(k, daemon(f).key());
    }

    @Test
    public void daemonNeverReplacesAnExistingKeyFile() throws Exception {
        File f = new File(tmp.getRoot(), ".overdrive_cred_key");
        Files.write(f.toPath(), "not-a-key".getBytes(StandardCharsets.UTF_8));
        assertNull(daemon(f).key());
        assertEquals("not-a-key", text(f));
    }

    @Test
    public void appFetchesTheDaemonKeyIntoItsPrivateCopy() throws Exception {
        File daemonFile = new File(tmp.getRoot(), ".overdrive_cred_key");
        byte[] k = daemon(daemonFile).key();
        String daemonText = text(daemonFile);
        File appFile = new File(tmp.newFolder("files"), "cred_key");
        AtomicReference<String> asked = new AtomicReference<>();

        CredentialKeyStore app = app(daemonFile, appFile, path -> {
            asked.set(path);
            return daemonText + "\n";
        });
        app.fetchFromDaemon();

        assertEquals(daemonFile.getPath(), asked.get());
        assertTrue(appFile.isFile());
        assertArrayEquals(k, app.key());
        assertEquals(daemonText, text(daemonFile));
    }

    @Test
    public void appWithoutLinkHasNoKeyAndWritesNothing() throws Exception {
        File daemonFile = new File(tmp.getRoot(), ".overdrive_cred_key");
        daemon(daemonFile).key();
        File appFile = new File(tmp.newFolder("files"), "cred_key");
        CredentialKeyStore app = app(daemonFile, appFile, path -> null);
        assertNull(app.key());
        assertFalse(appFile.exists());
    }

    @Test
    public void appRejectsMalformedKeyText() throws Exception {
        File daemonFile = new File(tmp.getRoot(), ".overdrive_cred_key");
        File appFile = new File(tmp.newFolder("files"), "cred_key");
        CredentialKeyStore app = app(daemonFile, appFile, path -> "cat: permission denied");
        app.fetchFromDaemon();
        assertNull(app.key());
        assertFalse(appFile.exists());
    }

    @Test
    public void appReplacesAStaleCopyWhenAValueIsRejected() throws Exception {
        File daemonFile = new File(tmp.getRoot(), ".overdrive_cred_key");
        byte[] k = daemon(daemonFile).key();
        String daemonText = text(daemonFile);
        File appFile = new File(tmp.newFolder("files"), "cred_key");
        Files.write(appFile.toPath(), ("00000000000000000000000000000000"
                + "00000000000000000000000000000000").getBytes(StandardCharsets.UTF_8));

        CredentialKeyStore app = app(daemonFile, appFile, path -> daemonText);
        assertEquals(0, app.key()[0] | app.key()[31]);
        app.keyRejected();
        assertArrayEquals(k, app.key());
    }

    @Test
    public void appCopyNeverTouchesTheDaemonFile() throws Exception {
        File daemonFile = new File(tmp.getRoot(), ".overdrive_cred_key");
        File appFile = new File(tmp.newFolder("files"), "cred_key");
        CredentialKeyStore app = app(daemonFile, appFile, path -> null);
        assertNull(app.key());
        assertFalse("the app never creates the daemons' key", daemonFile.exists());
    }

    @Test
    public void onlyTheDaemonsOwnTheKey() {
        File f = new File(tmp.getRoot(), ".overdrive_cred_key");
        assertTrue(daemon(f).ownsKey());
        assertFalse(app(f, new File(tmp.getRoot(), "cred_key"), path -> null).ownsKey());
    }

    @Test
    public void cipherUsesTheStoreForEnc2() throws Exception {
        File f = new File(tmp.getRoot(), ".overdrive_cred_key");
        CredentialCipher.useKeySource(daemon(f));
        try {
            String enc = CredentialCipher.encrypt("tg-token");
            assertTrue(enc.startsWith("ENC2:"));
            assertEquals("tg-token", CredentialCipher.decrypt(enc));
        } finally {
            CredentialCipher.useKeySource(null);
        }
    }
}
