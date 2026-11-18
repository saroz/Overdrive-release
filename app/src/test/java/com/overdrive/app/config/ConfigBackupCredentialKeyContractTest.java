package com.overdrive.app.config;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.junit.Test;

/**
 * F1: ENC2 credentials are bound to the credential key file, not the device id, so a backup carries that key beside
 * the device id, restores it inside the same journaled transition before the imported secrets are verified, and
 * rolls it back with the device id.
 */
public class ConfigBackupCredentialKeyContractTest {

    @Test
    public void keyFileNameMatchesTheKeyStore() throws IOException {
        assertTrue(source().contains("ScratchRoot.path(\".overdrive_cred_key\")"));
        assertTrue(read("app/src/main/java/com/overdrive/app/byd/cloud/crypto/CredentialKeyStore.java")
                .contains("KEY_FILE_NAME = \".overdrive_cred_key\""));
    }

    @Test
    public void exportCarriesTheKeyFromTheSameLockedSnapshot() throws IOException {
        String build = between(source(), "fun buildBundle(", "// ==================== IMPORT");
        assertOrdered(build,
                "UnifiedConfigManager.runUnderConfigLock {",
                "readDidSnapshotStrict()",
                "bundle.put(\"did\", it)",
                "bundle.put(\"credKey\", it)");
        String snapshot = between(source(), "private fun readDidSnapshotStrict(", "private fun didValue(");
        assertTrue(snapshot.contains("readCredKeySnapshot()"));
    }

    @Test
    public void restoreWritesTheKeyBeforeVerifyingImportedSecrets() throws IOException {
        String apply = between(source(), "fun applyBundle(", "// ==================== helpers");
        assertOrdered(apply,
                "readDidSnapshotStrict()",
                "bundle.optString(\"credKey\", \"\")",
                "beginBundledDidTransition(",
                "bundleSecretsDecrypt(incoming)");
    }

    @Test
    public void keyIsJournaledAndWrittenOwnerOnlyInsideTheTransition() throws IOException {
        String source = source();
        String transition = between(source, "private fun beginBundledDidTransition(", "private fun credentialFreeBridge(");
        assertOrdered(transition,
                "writeRestoreJournal(priorDid, priorConfig)",
                "credentialFreeBridge(priorConfig)",
                "writeDidBytesAtomic(bytes)",
                "writeCredKeyAtomic(",
                "CredentialKeyStore.invalidateProcessCache()");
        assertTrue(between(source, "private fun writeRestoreJournal(", "private fun didSnapshotFromJournal(")
                .contains("\"priorCredKeyBytes\""));
        String fromJournal = between(source, "private fun didSnapshotFromJournal(", "private fun clearRestoreJournal(");
        assertTrue(fromJournal.contains("\"priorCredKeyBytes\""));
        assertTrue("journals from before the key existed leave it alone",
                fromJournal.contains("journal.has(\"priorCredKeyExisted\")"));
        String writeKey = between(source, "private fun writeCredKeyAtomic(", "private fun writeAtomicFile(");
        assertTrue(writeKey.contains("worldAccessible = false"));
        String write = between(source, "private fun writeAtomicFile(", "private fun syncDidDirectory(");
        assertOrdered(write, "FileOutputStream(tmp).use", "Os.chmod(tmp.path, OWNER_ONLY_MODE)", "output.write(bytes)");
    }

    @Test
    public void rollbackRestoresTheKeyWithTheDid() throws IOException {
        String source = source();
        String rollback = between(source, "private fun restoreDidSnapshot(", "private fun writeDidBytesAtomic(");
        assertOrdered(rollback, "writeDidBytesAtomic(snapshot.bytes)", "restoreCredKeySnapshot(");
        String recovery = between(source, "fun recoverInterruptedRestoreUnderConfigLock()",
                "private fun beginBundledDidTransition(");
        assertOrdered(recovery, "restoreDidSnapshot(priorDid)", "CredentialKeyStore.invalidateProcessCache()");
    }

    @Test
    public void unreadableKeyIsNeitherExportedNorReplaced() throws IOException {
        String source = source();
        String read = between(source, "private fun readCredKeySnapshot(", "private fun didValue(");
        assertFalse(read.contains("throw "));
        String transition = between(source, "private fun beginBundledDidTransition(", "private fun credentialFreeBridge(");
        assertTrue(transition.contains("priorDid.key != null"));
    }

    private static void assertOrdered(String source, String... needles) {
        int previous = -1;
        for (String needle : needles) {
            int position = source.indexOf(needle, previous + 1);
            assertTrue("Missing or out of order: " + needle, position > previous);
            previous = position;
        }
    }

    private static String between(String source, String startNeedle, String endNeedle) {
        int start = source.indexOf(startNeedle);
        assertTrue("Missing start: " + startNeedle, start >= 0);
        int end = source.indexOf(endNeedle, start);
        assertTrue("Missing end: " + endNeedle, end > start);
        return source.substring(start, end);
    }

    private static String source() throws IOException {
        return read("app/src/main/java/com/overdrive/app/config/ConfigBackupService.kt");
    }

    private static String read(String relativePath) throws IOException {
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
