package com.overdrive.app.byd.cloud.crypto;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.junit.Test;

/** F1: code that spots stored credentials by prefix must treat "ENC2:" values as encrypted too. */
public class CredentialPrefixContractTest {

    @Test
    public void backupSpotsBothEncryptedForms() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/config/ConfigBackupService.kt");
        String fn = between(src, "private fun sectionHasEncryptedSecret(", "private fun bundleSecretsDecrypt(");
        assertTrue(fn.contains("\\\"ENC2:"));
        assertTrue(fn.contains("\\\"ENC:"));
    }

    @Test
    public void safeKeepStagingStripsBothEncryptedForms() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/safekeep/Staging.java");
        String fn = between(src, "private static void stripEncrypted(", "static String appVersion()");
        assertTrue(fn.contains("CredentialCipher.isEncrypted("));
        assertFalse(fn.contains("startsWith(\"ENC:\")"));
    }

    @Test
    public void googleMapsKeyRefusesBothEncryptedForms() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/navmap/google/GoogleMapsConfig.kt");
        String fn = between(src, "fun saveKey(", "fun saveSettings(");
        assertTrue(fn.contains("CredentialCipher.isEncrypted(key)"));
        assertTrue(fn.contains("\"ENC2:\""));
    }

    @Test
    public void noOtherCodeTestsTheOldPrefixAlone() throws IOException {
        String[] files = {
                "app/src/main/java/com/overdrive/app/config/ConfigBackupService.kt",
                "app/src/main/java/com/overdrive/app/safekeep/Staging.java",
        };
        for (String f : files) {
            String src = read(f);
            assertFalse(f, src.contains("startsWith(\"ENC:\")"));
        }
    }

    static String between(String source, String startNeedle, String endNeedle) {
        int start = source.indexOf(startNeedle);
        assertTrue("Missing start: " + startNeedle, start >= 0);
        int end = source.indexOf(endNeedle, start);
        assertTrue("Missing end: " + endNeedle, end > start);
        return source.substring(start, end);
    }

    static String read(String relativePath) throws IOException {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            Path candidate = current.resolve(relativePath);
            if (Files.isRegularFile(candidate)) {
                return new String(Files.readAllBytes(candidate), StandardCharsets.UTF_8);
            }
            Path fromModule = current.resolve(relativePath.replaceFirst("^app/", ""));
            if (Files.isRegularFile(fromModule)) {
                return new String(Files.readAllBytes(fromModule), StandardCharsets.UTF_8);
            }
            current = current.getParent();
        }
        throw new AssertionError("Could not locate " + relativePath);
    }
}
