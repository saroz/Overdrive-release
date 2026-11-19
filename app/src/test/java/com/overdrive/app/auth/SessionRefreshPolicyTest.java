package com.overdrive.app.auth;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import com.overdrive.app.auth.SessionRefreshPolicy.Decision;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

/** G1: 7-day sign-ins renewed while in use, never on a wrong head-unit clock. */
public class SessionRefreshPolicyTest {

    private static final long NOW = 1795000000L; // 2026-11-19
    private static final long DAY = 24L * 60 * 60;

    @Test
    public void renewsOnceTheTokenIsADayOld() {
        assertEquals(Decision.NOT_DUE, SessionRefreshPolicy.decide(NOW - 60, NOW));
        assertEquals(Decision.NOT_DUE, SessionRefreshPolicy.decide(NOW - DAY + 1, NOW));
        assertEquals(Decision.REFRESH, SessionRefreshPolicy.decide(NOW - DAY, NOW));
        assertEquals(Decision.REFRESH, SessionRefreshPolicy.decide(NOW - 6 * DAY, NOW));
    }

    @Test
    public void unsetClockAfterBootRenewsNothing() {
        assertEquals(Decision.CLOCK_UNSAFE, SessionRefreshPolicy.decide(NOW - 2 * DAY, 1262304000L)); // 2010
        assertEquals(Decision.CLOCK_UNSAFE, SessionRefreshPolicy.decide(0L, 86400L));
    }

    @Test
    public void clockBehindTheTokensMintRenewsNothing() {
        assertEquals(Decision.CLOCK_UNSAFE, SessionRefreshPolicy.decide(NOW + 3600, NOW));
        assertEquals(Decision.NOT_DUE, SessionRefreshPolicy.decide(NOW + 120, NOW)); // small NTP step is fine
    }

    @Test
    public void lifetimeIsSevenDaysAndEveryPieceIsWired() throws Exception {
        String mgr = read("app/src/main/java/com/overdrive/app/auth/AuthManager.java");
        assertTrue(mgr.contains("JWT_EXPIRY_MS = 7L * 24 * 60 * 60 * 1000L"));
        assertTrue(mgr.contains("SessionRefreshPolicy.decide(payload.optLong(\"iat\", 0L), now)"));
        assertTrue(mgr.contains("AuthSessions.extend(jti, exp, state.deviceSecret)"));
        String api = read("app/src/main/java/com/overdrive/app/server/AuthApiHandler.java");
        assertTrue(api.contains("path.equals(\"/api/auth/sessions/refresh\") && \"POST\".equals(method)"));
        // Under /api/auth/sessions/: a real session and same-site origin for POST (HttpServer gate).
        String server = read("app/src/main/java/com/overdrive/app/server/HttpServer.java");
        assertTrue(server.contains("pathOnly.startsWith(\"/api/auth/sessions/\")"));
        String js = read("app/src/main/assets/web/shared/auth.js");
        assertTrue(js.contains("fetch('/api/auth/sessions/refresh', { method: 'POST'"));
        assertTrue(js.contains("BYDAuth.setToken(d.jwt)"));
    }

    private static String read(String rel) throws Exception {
        Path p = Paths.get(rel);
        if (!Files.exists(p)) p = Paths.get(rel.replaceFirst("^app/", ""));
        return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
    }
}
