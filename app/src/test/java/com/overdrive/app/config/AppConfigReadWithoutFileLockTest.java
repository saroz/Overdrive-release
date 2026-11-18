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
 * Security fix F14 stage B: the app process reads the shared config without the cross-process
 * file lock, so that lock can become owner-only (stage D) and no other app can hold it to stall
 * the daemons. (UnifiedConfigManager needs android.os.Process, so these are source contracts.)
 */
public class AppConfigReadWithoutFileLockTest {

    private static final String UCM = "app/src/main/java/com/overdrive/app/config/UnifiedConfigManager.kt";

    @Test
    public void appLoadsSkipTheFileLockAndDaemonsKeepIt() throws IOException {
        String src = read(UCM);
        String loadConfig = between(src, "fun loadConfig(): JSONObject {", "private fun loadConfigInAppWithoutFileLock");
        int appBranch = loadConfig.indexOf("if (android.os.Process.myUid() != SHELL_DAEMON_UID) {\n            loadConfigInAppWithoutFileLock(configFile)");
        int daemonBranch = loadConfig.indexOf("withConfigFileLock {\n                loadConfigUnderFileLock(configFile)");
        assertTrue("the app must take the lock-free path", appBranch > 0);
        assertTrue("the daemon keeps the stable file lock", daemonBranch > appBranch);
    }

    @Test
    public void lockFreeReadDropsTheStampWhenTheFileIsReplacedMidRead() throws IOException {
        String body = between(read(UCM),
                "private fun loadConfigInAppWithoutFileLock(configFile: File): JSONObject {",
                "private data class ConfigFileIdentity");
        assertFalse("no file lock on the app read path", body.contains("withConfigFileLock"));
        assertTrue(body.contains("acquireConfigLock(deadline)"));
        assertTrue(body.contains("configLock.unlock()"));
        int before = body.indexOf("val before = configFileIdentity(configFile)");
        int load = body.indexOf("loaded = loadConfigUnderFileLock(configFile)");
        int after = body.indexOf("val after = configFileIdentity(configFile)");
        assertTrue(before > 0 && load > before && after > load);
        assertTrue(body.contains("if (before != null && before == after) return loaded"));
        assertTrue("a replaced file must not keep its stamp", body.contains("stampFreshness(0)"));
        assertTrue("a missing file is the daemon's to create",
                body.contains("if (!configFile.exists()) return loadConfigWithoutStableLock(configFile)"));
    }

    @Test
    public void identityIncludesInodeMtimeAndSize() throws IOException {
        String src = read(UCM);
        assertTrue(src.contains(
                "private data class ConfigFileIdentity(val inode: Long, val mtime: Long, val size: Long)"));
        assertTrue(src.contains("android.system.Os.stat(file.path).st_ino"));
    }

    @Test
    public void strictReadsUseTheReadLock() throws IOException {
        String src = read(UCM);
        assertTrue(src.contains("fun readDurableConfigStrict(): JSONObject = withConfigReadLock {"));
        assertTrue(src.contains("fun readDurableConfigForRestore(): JSONObject = withConfigReadLock {"));
        String readLock = between(src, "private fun <T> withConfigReadLock(body: () -> T): T {",
                "private fun withConfigMutationLock(");
        assertTrue("the daemon keeps the file lock",
                readLock.contains("if (android.os.Process.myUid() == SHELL_DAEMON_UID) return withConfigFileLock(body)"));
        assertTrue(readLock.contains("configLock.unlock()"));
    }

    @Test
    public void liveFileIsOnlyEverReplacedByRename() throws IOException {
        // The lock-free read is safe only while no writer truncates the live file in place.
        String save = between(read(UCM), "private fun saveConfigInternal(config: JSONObject): ConfigWriteResult {",
                "// ==================== SECTION GETTERS");
        assertTrue(save.contains("tmpFile.renameTo(configFile)"));
        assertFalse(save.contains("writeFileAndSync(configFile"));
        assertFalse(save.contains("configFile.writeText("));
    }

    // ---------- stage D: no world-writable config, owner-only lock ----------

    @Test
    public void configIsWorldReadableButDaemonWrittenAndLockIsOwnerOnly() throws IOException {
        String src = read(UCM);
        assertTrue(src.contains("private const val CONFIG_FILE_MODE = 420 // 0644"));
        assertTrue(src.contains("private const val LOCK_FILE_MODE = 384 // 0600"));
        assertFalse("nothing in the config manager may make a file world-writable",
                src.contains("setWritable(true, false)"));
        assertTrue(src.contains("android.system.Os.chmod(file.path, mode)"));
    }

    @Test
    public void everyPermissionPathUsesTheNewModes() throws IOException {
        String src = read(UCM);
        String provision = between(src, "private fun provisionLockFile() {", "private fun chmodQuietly(");
        assertTrue(provision.contains("chmodQuietly(lf, LOCK_FILE_MODE)"));
        String writer = between(src, "private fun writeFileAndSync(", "output.fd.sync()");
        assertTrue(writer.contains("chmodQuietly(file, CONFIG_FILE_MODE)"));
        String init = between(src, "fun init() {", "private fun provisionLockFile()");
        assertTrue("init tightens a config left 0666 by an older build",
                init.contains("chmodQuietly(configFile, CONFIG_FILE_MODE)"));
        assertTrue(init.contains("chmodQuietly(File(configFile.parentFile, configFile.name + \".bak\"), CONFIG_FILE_MODE)"));
        String lock = between(src, "private fun <T> withConfigFileLock(body: () -> T): T {",
                "private fun <T> withConfigReadLock(");
        assertTrue(lock.contains("chmodQuietly(lockFile, LOCK_FILE_MODE)"));
    }

    @Test
    public void appFailsFastOnTheOwnerOnlyLock() throws IOException {
        String lock = between(read(UCM), "private fun <T> withConfigFileLock(body: () -> T): T {",
                "private fun <T> withConfigReadLock(");
        int check = lock.indexOf("!lockFile.canWrite()");
        int open = lock.indexOf("RandomAccessFile(lockFile, \"rw\")");
        assertTrue(check > 0);
        assertTrue("the app must not try to open the daemon-only lock", open > check);
    }

    private static String between(String text, String start, String end) {
        int s = text.indexOf(start);
        assertTrue("missing: " + start, s >= 0);
        int e = text.indexOf(end, s + start.length());
        assertTrue("missing: " + end, e > s);
        return text.substring(s, e);
    }

    private static String read(String relativePath) throws IOException {
        Path current = Paths.get("").toAbsolutePath();
        while (current != null) {
            Path candidate = current.resolve(relativePath);
            if (Files.exists(candidate)) return new String(Files.readAllBytes(candidate), StandardCharsets.UTF_8);
            Path fromModule = current.resolve(relativePath.replaceFirst("^app/", ""));
            if (Files.exists(fromModule)) return new String(Files.readAllBytes(fromModule), StandardCharsets.UTF_8);
            current = current.getParent();
        }
        throw new AssertionError("Could not locate repository path: " + relativePath);
    }
}
