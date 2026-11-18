package com.overdrive.app.server;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/**
 * Security fix F10: the extracted web tree (pages and JS served with the login
 * cookie) must not be writable by other apps. Directories end up 0755 and files
 * 0644, and a planted symlink is never followed.
 */
public class WebRootPermissionsTest {

    @Rule public TemporaryFolder tmp = new TemporaryFolder();

    private static boolean posix() {
        return FileSystems.getDefault().supportedFileAttributeViews().contains("posix");
    }

    private static String mode(Path p) throws Exception {
        return PosixFilePermissions.toString(
                Files.getPosixFilePermissions(p, LinkOption.NOFOLLOW_LINKS));
    }

    @Test
    public void treeEndsUp755And644() throws Exception {
        assumeTrue("POSIX permissions only (runs on Linux/macOS CI)", posix());
        Path root = tmp.newFolder("web").toPath();
        Path dir = Files.createDirectories(root.resolve("local/shared"));
        Path page = Files.write(dir.resolve("index.html"), "<p>".getBytes(StandardCharsets.UTF_8));
        Set<PosixFilePermission> open = PosixFilePermissions.fromString("rwxrwxrwx");
        Files.setPosixFilePermissions(root, open);
        Files.setPosixFilePermissions(dir, open);
        Files.setPosixFilePermissions(page, open);

        assertEquals(0, WebRootPermissions.restrict(root.toFile()));

        assertEquals("rwxr-xr-x", mode(root));
        assertEquals("rwxr-xr-x", mode(dir));
        assertEquals("rw-r--r--", mode(page));
    }

    @Test
    public void symlinksAreNotFollowed() throws Exception {
        assumeTrue("POSIX permissions only (runs on Linux/macOS CI)", posix());
        Path secret = tmp.newFile("secret").toPath();
        Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
        Path root = tmp.newFolder("web2").toPath();
        Files.createSymbolicLink(root.resolve("planted"), secret);

        WebRootPermissions.restrict(root.toFile());

        assertEquals("rw-------", mode(secret));
    }

    @Test
    public void extractionAppliesPermissionsOnEveryStart() throws Exception {
        String s = new String(Files.readAllBytes(new File(
                "src/main/java/com/overdrive/app/server/HttpServer.java").toPath()),
                StandardCharsets.UTF_8);
        int restrictWeb = s.indexOf("WebRootPermissions.restrict(webRoot)");
        int restrictOverlay = s.indexOf(
                "WebRootPermissions.restrict(new File(com.overdrive.app.util.ScratchRoot.path(\"overlay\")))");
        int stamp = s.indexOf("writeWebAssetStamp(webRoot, expectedStamp, manifest);");
        assertTrue("web root must be chmodded", restrictWeb > 0);
        assertTrue("overlay icons must be chmodded", restrictOverlay > 0);
        // After extraction (also on a cache hit), before the stamp is published.
        assertTrue(restrictWeb < stamp && restrictOverlay < stamp);
        // Outside the cache-hit/extract branch, so an old tree is fixed too.
        assertTrue(s.indexOf("extractAssetDir(assetManager, \"overlay\"") < restrictWeb);
    }
}
