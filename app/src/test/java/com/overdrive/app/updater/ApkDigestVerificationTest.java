package com.overdrive.app.updater;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

/**
 * Security fix F12: the downloaded update APK must match GitHub's published
 * sha256 asset digest before `pm install` runs (the signature check alone lets
 * a tampered-but-same-key or truncated download through to install attempts).
 */
public class ApkDigestVerificationTest {

    private static final String SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

    @Test
    public void matchingDigestPasses() {
        assertNull(AppUpdater.apkDigestError("sha256:" + SHA,
                SHA + "  /data/local/tmp/overdrive_update.apk"));
        assertNull(AppUpdater.apkDigestError("SHA256:" + SHA.toUpperCase(), SHA));
    }

    @Test
    public void mismatchFails() {
        String other = SHA.replace('9', '8');
        assertNotNull(AppUpdater.apkDigestError("sha256:" + SHA, other + "  /x.apk"));
    }

    @Test
    public void missingDigestOrHashFailsClosed() {
        assertNotNull(AppUpdater.apkDigestError("", SHA));
        assertNotNull(AppUpdater.apkDigestError(null, SHA));
        assertNotNull(AppUpdater.apkDigestError("md5:abc", SHA));
        assertNotNull(AppUpdater.apkDigestError("sha256:" + SHA, ""));
        assertNotNull(AppUpdater.apkDigestError("sha256:" + SHA, null));
    }

    @Test
    public void installFlowChecksDigestBeforeInstalling() throws Exception {
        String src = read("app/src/main/java/com/overdrive/app/updater/AppUpdater.java");
        int check = src.indexOf("apkDigestError(latestApkDigest");
        int detached = src.indexOf("detachedStarted = runDetachedInstall(");
        int direct = src.indexOf("String installCmd = \"pm install -r -d \"");
        assertTrue("digest check missing", check > 0);
        assertTrue("digest check must come before both install paths",
                check < detached && check < direct);
    }

    private static String read(String relativePath) throws Exception {
        Path current = Paths.get("").toAbsolutePath();
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
        throw new AssertionError("Could not locate repository file: " + relativePath);
    }
}
