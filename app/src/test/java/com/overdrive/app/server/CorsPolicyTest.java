package com.overdrive.app.server;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import org.junit.Test;

/**
 * Security fix F4: the daemon must not hand out "Access-Control-Allow-Origin: *",
 * and a preflight may only echo an Origin that is the server itself (same Host,
 * or a loopback origin on the server port). Every page is served by the daemon,
 * so normal responses need no CORS headers at all.
 */
public class CorsPolicyTest {

    private static final int PORT = 8080;

    private static String preflight(String origin, String host, String forwardedHost)
            throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        HttpResponse.sendCorsPreflightResponse(out, origin, host, forwardedHost, PORT);
        return out.toString(StandardCharsets.UTF_8.name());
    }

    @Test
    public void jsonResponsesCarryNoAllowOrigin() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        HttpResponse.sendJson(out, "{\"ok\":true}");
        HttpResponse.sendJson(out, 404, "{\"ok\":false}");
        HttpResponse.sendJsonError(out, "nope");
        HttpResponse.sendUnauthorized(out, "{\"error\":\"auth\"}");
        HttpResponse.sendJsonWithCookie(out, "{}", "byd_session", "jwt", 60);
        assertFalse(out.toString(StandardCharsets.UTF_8.name())
                .contains("Access-Control-Allow-Origin"));
    }

    @Test
    public void preflightFromForeignOriginGetsNoAllowOrigin() throws Exception {
        String resp = preflight("https://evil.example", "192.168.1.20:8080", null);
        assertTrue(resp.startsWith("HTTP/1.1 204"));
        assertFalse(resp.contains("Access-Control-Allow-Origin"));
        assertFalse(resp.contains("Access-Control-Allow-Credentials"));
    }

    @Test
    public void preflightWithoutOrOpaqueOriginGetsNoAllowOrigin() throws Exception {
        assertFalse(preflight(null, "127.0.0.1:8080", null)
                .contains("Access-Control-Allow-Origin"));
        assertFalse(preflight("null", "127.0.0.1:8080", null)
                .contains("Access-Control-Allow-Origin"));
        assertFalse(preflight("file://", "127.0.0.1:8080", null)
                .contains("Access-Control-Allow-Origin"));
    }

    @Test
    public void preflightSameOriginAsHostIsReflectedWithoutCredentials() throws Exception {
        String resp = preflight("http://192.168.1.20:8080", "192.168.1.20:8080", null);
        assertTrue(resp.contains("Access-Control-Allow-Origin: http://192.168.1.20:8080\r\n"));
        assertTrue(resp.contains("Vary: Origin\r\n"));
        assertFalse(resp.contains("Access-Control-Allow-Credentials"));
    }

    @Test
    public void preflightThroughTunnelUsesForwardedHost() throws Exception {
        String resp = preflight("https://car.example.org", "localhost:8080", "car.example.org");
        assertTrue(resp.contains("Access-Control-Allow-Origin: https://car.example.org\r\n"));
    }

    @Test
    public void preflightLoopbackOriginOnlyOnServerPort() throws Exception {
        assertTrue(preflight("http://localhost:8080", "127.0.0.1:8080", null)
                .contains("Access-Control-Allow-Origin: http://localhost:8080\r\n"));
        assertFalse(preflight("http://127.0.0.1:3000", "127.0.0.1:8080", null)
                .contains("Access-Control-Allow-Origin"));
        assertFalse(preflight("http://localhost.evil.example:8080", "127.0.0.1:8080", null)
                .contains("Access-Control-Allow-Origin"));
    }

    @Test
    public void preflightNeverReflectsHeaderInjection() throws Exception {
        String resp = preflight("http://127.0.0.1:8080\r\nSet-Cookie: x=1",
                "127.0.0.1:8080", null);
        assertFalse(resp.contains("Set-Cookie"));
        assertFalse(resp.contains("Access-Control-Allow-Origin"));
    }

    @Test
    public void noServerSourceSendsWildcardAllowOrigin() throws Exception {
        File dir = new File("src/main/java/com/overdrive/app/server");
        File[] files = dir.listFiles((d, name) -> name.endsWith(".java"));
        assertTrue(files != null && files.length > 0);
        for (File f : files) {
            String s = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
            assertFalse(f.getName() + " still sends Access-Control-Allow-Origin: *",
                    s.contains("Access-Control-Allow-Origin: *"));
        }
    }
}
