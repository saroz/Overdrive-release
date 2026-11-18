package com.overdrive.app.daemon.proxy;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.Test;

/**
 * Security fix F11: the fork ships no built-in VLESS proxy server.
 *
 * Upstream hardcoded a third-party server (plain text in SingboxLauncher, AES-obfuscated in
 * Enc / GlobalProxyDaemon). When the "Sing-box Proxy" toggle, the Telegram start_singbox
 * command or the hotspot client tunnel ran, car traffic went through a server the owner
 * does not control. Every start path must now refuse while no server is configured.
 */
public class BuiltInProxyServerRemovedTest {

    /** Server values from upstream, plain and as encrypted Safe.s() blobs. */
    private static final String[] UPSTREAM_SERVER_MARKERS = {
            "80.225.224.92",
            "ce8591be-9fa8-4361-90f3-427e9b5e8b85",
            "fxNUGiLzVwAk89RgogDrMq2u4pzyWAe_wx8D2frOPAQ",
            "3ca47a3f8fb71e13",
            "Z1e89edb4BHkcdq18ZwS4g==",
            "Y4LjDZ/o19unOrs5FoJBf5MjCDMSI/PGZXX9WqDp2Y4JJPBSUh2sYkt1ymAV0v2L",
            "o/bXp+lFk608hy8OWTfuELQgU4pZxSk/2VDwpg+KW/o=",
            "A37D/HxqBdi7vuJ5cyw8gh2VvwTgbS9cbhEaDv78GqpZznF3x5JiRMDj9WJpQ7Gm",
    };

    @Test
    public void noProxyServerIsConfiguredInThisBuild() {
        assertFalse(ProxyConfiguration.isServerConfigured());
    }

    @Test
    public void createConfigRefusesWithoutAServer() {
        assertThrows(IllegalStateException.class, () -> ProxyConfiguration.createConfig());
    }

    @Test
    public void upstreamServerCredentialsAreGoneFromAllSources() throws IOException {
        Path main = locate("app/src/main");
        List<Path> sources;
        try (Stream<Path> walk = Files.walk(main)) {
            sources = walk.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".java") || p.toString().endsWith(".kt"))
                    .collect(Collectors.toList());
        }
        for (Path source : sources) {
            String text = new String(Files.readAllBytes(source), StandardCharsets.UTF_8);
            for (String marker : UPSTREAM_SERVER_MARKERS) {
                assertFalse(source + " still contains upstream proxy server value " + marker,
                        text.contains(marker));
            }
        }
    }

    @Test
    public void everyStartPathChecksForAConfiguredServer() throws IOException {
        String[] startPaths = {
                "app/src/main/java/com/overdrive/app/daemon/GlobalProxyDaemon.java",
                "app/src/main/java/com/overdrive/app/launcher/SingboxLauncher.kt",
                "app/src/main/java/com/overdrive/app/daemon/telegram/DaemonCommandHandler.java",
        };
        for (String path : startPaths) {
            String text = new String(Files.readAllBytes(locate(path)), StandardCharsets.UTF_8);
            assertTrue(path + " must refuse to start sing-box without a configured server",
                    text.contains("isServerConfigured()"));
        }
    }

    private static Path locate(String relativePath) {
        Path current = Paths.get("").toAbsolutePath();
        while (current != null) {
            Path candidate = current.resolve(relativePath);
            if (Files.exists(candidate)) return candidate;
            Path fromModule = current.resolve(relativePath.replaceFirst("^app/", ""));
            if (Files.exists(fromModule)) return fromModule;
            current = current.getParent();
        }
        throw new AssertionError("Could not locate repository path: " + relativePath);
    }
}
