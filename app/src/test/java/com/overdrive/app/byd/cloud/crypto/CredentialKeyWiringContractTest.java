package com.overdrive.app.byd.cloud.crypto;

import static com.overdrive.app.byd.cloud.crypto.CredentialPrefixContractTest.between;
import static com.overdrive.app.byd.cloud.crypto.CredentialPrefixContractTest.read;
import static org.junit.Assert.assertTrue;

import java.io.IOException;

import org.junit.Test;

/** F1: where the key store is installed, and the save paths that must not write a failed decrypt back. */
public class CredentialKeyWiringContractTest {

    @Test
    public void appInstallsTheKeyStoreWithTheShellReaderAtStart() throws IOException {
        String app = read("app/src/main/java/com/overdrive/app/OverdriveApplication.kt");
        int auth = app.indexOf("AuthManager.useDaemonSecretReader(");
        int keys = app.indexOf("CredentialKeyStore.installForApp(filesDir");
        assertTrue(auth > 0);
        assertTrue("installed after the auth reader, before the UI", keys > auth);
        assertTrue(app.contains("val credKeyReader = com.overdrive.app.auth.DaemonSecretShellReader(this)"));
        assertTrue(app.substring(keys, app.indexOf('\n', keys)).contains("credKeyReader.read(path)"));
    }

    @Test
    public void daemonCreatesTheKeyAtStartup() throws IOException {
        String daemon = read("app/src/main/java/com/overdrive/app/daemon/CameraDaemon.java");
        int did = daemon.indexOf("        generateDeviceId();");
        int keys = daemon.indexOf("CredentialKeyStore.installForDaemon()");
        assertTrue(did > 0);
        assertTrue(keys > did);
    }

    @Test
    public void bydCloudSaveKeepsAnUnreadablePassword() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/byd/cloud/BydCloudConfig.java");
        String save = between(src, "String region, String energyType,", "public static void clearCredentials()");
        assertTrue(save.contains("CredentialCipher.isUndecryptable("));
    }

    @Test
    public void cloudflaredDialogKeepsAnUnreadableToken() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/config/CloudflaredPaidConfig.kt");
        String dialog = between(src, "fun showSettingsDialog(", "UnifiedConfigManager.setCloudflared(newConfig)");
        assertTrue(dialog.contains("CredentialCipher.isUndecryptable("));
    }
}
