package com.overdrive.app.server;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

/**
 * Security fix F2: AuthMiddleware no longer trusts loopback callers without a JWT.
 * Every in-app caller of the 127.0.0.1:8080 API that used to rely on that bypass must
 * now send the session cookie, or its feature breaks silently on the car.
 */
public class LoopbackCallersSendSessionTest {

    private static final String ROOT = "app/src/main/java/com/overdrive/app/";

    @Test
    public void authMiddlewareHasNoLoopbackBypass() throws Exception {
        String auth = read(ROOT + "server/AuthMiddleware.java");
        assertFalse("loopback Tier 2 must be gone", auth.contains("isLoopback"));
    }

    @Test
    public void okHttpLoopbackClientsUseSessionInterceptor() throws Exception {
        String[] clients = {
                "navmap/RoadSenseHazardApiClient.kt",
                "navmap/google/GoogleUsageReporter.kt",
                "roadsense/overlay/BlindSpotControl.kt",
                "ui/util/RecordingsApiClient.kt",
        };
        for (String client : clients) {
            assertTrue(client + " must add DaemonHttpClient.sessionInterceptor",
                    read(ROOT + client).contains("DaemonHttpClient.sessionInterceptor"));
        }
    }

    @Test
    public void urlConnectionCallersAttachAuth() throws Exception {
        String onboarding = read(ROOT + "onboarding/OnboardingHost.kt");
        assertTrue("OnboardingHost: all 3 surveillance/config calls need attachAuth",
                count(onboarding, "DaemonHttpClient.attachAuth(") >= 3);
        assertTrue(read(ROOT + "overlay/GlassWidgetsOverlayService.kt")
                .contains("DaemonHttpClient.attachAuth("));
    }

    @Test
    public void libraryVideoPlaybackSendsSessionCookie() throws Exception {
        assertTrue(read(ROOT + "ui/VideoPlaybackActivity.java")
                .contains("DaemonHttpClient.sessionCookie()"));
        assertTrue(read(ROOT + "ui/view/ZoomableVideoView.kt")
                .contains("setDataSource(context, uri, headers)"));
    }

    private static int count(String text, String needle) {
        int n = 0;
        for (int i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) n++;
        return n;
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
