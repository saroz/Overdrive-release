package com.overdrive.app.mqtt;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

/**
 * Regression tests for ProxyConfiguration VLESS config generation, ABRP
 * fallback routing, and Tailscale log-path alignment.
 */
public class ProxyUpstreamHealthAndConfigTest {

    // F11: config generation for the built-in server is gone; see
    // daemon/proxy/BuiltInProxyServerRemovedTest for the replacement checks.

    @Test
    public void tailscaleDaemonHandlerAndAbrpUseProxyRoutingAndLogPaths() throws Exception {
        String handler = read(
                "app/src/main/java/com/overdrive/app/daemon/telegram/DaemonCommandHandler.java");
        assertFalse(handler.contains("tailscaled.log"));
        assertTrue(handler.contains("/data/local/tmp/.tailscale/tailscale.log"));
        assertTrue(handler.contains("socks5://127.0.0.1:8119"));

        String abrp = read(
                "app/src/main/java/com/overdrive/app/abrp/AbrpTelemetryService.java");
        assertTrue(abrp.contains(".proxySelector(com.overdrive.app.mqtt.ProxyHelper.chainProxySelector())"));
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
