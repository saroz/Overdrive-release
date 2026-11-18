package com.overdrive.app.server;

import java.io.File;
import java.nio.file.Files;

/**
 * Security fix F10: the extracted web tree (pages and JS that run with the
 * login cookie) must be writable only by the daemon that extracts it.
 *
 * <p>Directories become 0755 and files 0644, whatever the daemon's umask was
 * or whatever an older build left behind. Everyone may still read and traverse,
 * so nothing that reads the tree breaks. Symlinks are skipped and never
 * followed, so a planted link cannot make the daemon chmod a file elsewhere
 * (for example a 0600 secret in the same scratch root).
 *
 * <p>Uses java.io.File only, so it works in the daemon and on a plain JVM.
 */
final class WebRootPermissions {

    private WebRootPermissions() {
    }

    /** @return how many entries could not be fully restricted (0 = all done). */
    static int restrict(File root) {
        if (root == null || Files.isSymbolicLink(root.toPath())) return 0;
        int failures = 0;
        if (root.isDirectory()) {
            File[] children = root.listFiles();
            if (children != null) {
                for (File child : children) failures += restrict(child);
            }
            // rwxr-xr-x. Owner-only write is set after clearing write for all.
            boolean ok = root.setReadable(true, false);
            ok &= root.setExecutable(true, false);
            ok &= root.setWritable(false, false);
            ok &= root.setWritable(true, true);
            if (!ok) failures++;
        } else if (root.isFile()) {
            // rw-r--r--
            boolean ok = root.setReadable(true, false);
            ok &= root.setExecutable(false, false);
            ok &= root.setWritable(false, false);
            ok &= root.setWritable(true, true);
            if (!ok) failures++;
        }
        return failures;
    }
}
