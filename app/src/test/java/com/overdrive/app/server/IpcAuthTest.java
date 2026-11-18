package com.overdrive.app.server;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.json.JSONObject;
import org.junit.Test;

/**
 * Security fix F14 stage A: loopback IPC port 19877 asks writes and secret reads for a token.
 *
 * Any app on the head unit can connect to 127.0.0.1:19877. Commands that change settings or
 * state, and reads that return credentials, must carry a short-lived IPC token that only the
 * OverDrive app and daemons can mint. Stage A only logs a missing token (ENFORCE=false).
 */
public class IpcAuthTest {

    private static final String[] GUARDED = {
            "START", "STOP", "ENABLE_SURVEILLANCE", "DISABLE_SURVEILLANCE", "POWER_NOTICE",
            "SET_CONFIG", "UPDATE_SECTION", "UPDATE_VALUES", "REPLACE_CONFIG", "SET_ROI",
            "SET_TELEMETRY_OVERLAY", "ADD_SAFE_LOCATION", "UPDATE_SAFE_LOCATION",
            "DELETE_SAFE_LOCATION", "TOGGLE_SAFE_LOCATIONS", "SET_ABRP_CONFIG",
            "DELETE_ABRP_TOKEN", "ADD_MQTT_CONNECTION", "UPDATE_MQTT_CONNECTION",
            "DELETE_MQTT_CONNECTION", "SET_CHANNEL", "INSTALL_UPDATE", "UPLOAD_LOG",
            "GET_CONFIG", "EXPORT_CONFIG", "GET_MQTT_CONNECTIONS", "GET_ABRP_CONFIG",
            "GET_VEHICLE_IDENTITY",
    };

    /** High-rate telemetry, plain status reads and the already-signed DiLink5 ingress stay open. */
    private static final String[] OPEN = {
            "UPDATE_GPS", "STATUS", "GET_STATUS", "GET_VEHICLE_DATA", "GET_BATTERY_SOC",
            "GET_MQTT_STATUS", "GET_ABRP_STATUS", "PARKING_STATUS", "CHECK_UPDATE",
            "DILINK5_HELLO", "DILINK5_TELEMETRY", "DILINK5_VEHICLE_EVENT", "",
    };

    @Test
    public void writesAndSecretReadsNeedAToken() {
        for (String command : GUARDED) {
            assertTrue(command + " must need a token", IpcAuth.requiresToken(command));
        }
        assertEquals(GUARDED.length, IpcAuth.GUARDED.size());
    }

    @Test
    public void telemetryStatusAndSignedIngressStayOpen() {
        for (String command : OPEN) {
            assertFalse(command + " must not need a token", IpcAuth.requiresToken(command));
            assertNull(IpcAuth.rejectionReason(command, new JSONObject()));
        }
        assertFalse(IpcAuth.requiresToken(null));
    }

    @Test
    public void guardedCommandWithoutTokenIsReported() throws Exception {
        JSONObject request = new JSONObject().put("command", "ADD_MQTT_CONNECTION");
        assertEquals("no token", IpcAuth.rejectionReason("ADD_MQTT_CONNECTION", request));
        assertEquals("no token", IpcAuth.rejectionReason("GET_CONFIG", null));
        assertEquals("no token",
                IpcAuth.rejectionReason("EXPORT_CONFIG", new JSONObject().put("jwt", "")));
    }

    @Test
    public void stageAOnlyLogs() {
        assertFalse("flip ENFORCE only after a car run shows no unauthenticated callers",
                IpcAuth.ENFORCE);
    }

    @Test
    public void logIsRateLimitedPerCommand() {
        String command = "TEST_RATE_LIMIT_" + System.nanoTime();
        assertTrue(IpcAuth.shouldLog(command, 1_000L));
        assertFalse(IpcAuth.shouldLog(command, 30_000L));
        assertTrue(IpcAuth.shouldLog(command, 61_001L));
        assertTrue(IpcAuth.shouldLog(command + "_OTHER", 30_000L));
    }

    @Test
    public void attachKeepsAnExistingToken() throws Exception {
        JSONObject request = new JSONObject().put("command", "GET_CONFIG").put("jwt", "given");
        assertEquals("given", IpcAuth.attach(request).getString("jwt"));
        assertNull(IpcAuth.attach(null));
    }

    @Test
    public void serverChecksEveryCommandBeforeDispatch() throws IOException {
        String server = read("app/src/main/java/com/overdrive/app/server/SurveillanceIpcServer.java");
        int check = server.indexOf("IpcAuth.rejectionReason(command, request)");
        int dispatch = server.indexOf("switch (command) {", check);
        assertTrue("handleCommand must check the caller", check > 0);
        assertTrue("the check must come before the command switch", dispatch > check);
        assertTrue(server.contains("if (IpcAuth.ENFORCE)"));
        // backup export/restore: the login code only for an IPC-token holder
        assertFalse(server.contains(".validateJwt(request.optString(\"jwt\""));
        assertTrue(server.contains(".validateIpcJwt(request.optString(\"jwt\""));
    }

    @Test
    public void ipcTokensAreShortLivedAndRefusedByTheWebApi() throws IOException {
        String auth = read("app/src/main/java/com/overdrive/app/auth/AuthManager.java");
        assertTrue(auth.contains("static final String IPC_AUDIENCE = \"ipc\";"));
        assertTrue(auth.contains("private static final long IPC_JWT_TTL_S = 120;"));
        assertTrue(auth.contains("return validate(jwt, false);"));
        assertTrue(auth.contains("return validate(jwt, true);"));
        assertTrue(auth.contains(
                "if (IPC_AUDIENCE.equals(payload.optString(\"aud\", \"\")) && !allowIpcAudience)"));
        assertTrue(read("app/src/main/java/com/overdrive/app/server/IpcAuth.java")
                .contains("AuthManager.validateIpcJwt(token)"));
    }

    @Test
    public void everySharedSenderAttachesAToken() throws IOException {
        String[] senders = {
                "app/src/main/java/com/overdrive/app/server/DaemonIpcClient.java",
                "app/src/main/java/com/overdrive/app/server/AbrpApiHandler.java",
                "app/src/main/java/com/overdrive/app/server/MqttApiHandler.java",
                "app/src/main/java/com/overdrive/app/config/UnifiedConfigManager.kt",
                "app/src/main/java/com/overdrive/app/daemon/AccSentryDaemon.java",
                "app/src/main/java/com/overdrive/app/daemon/TelegramBotDaemon.java",
                "app/src/main/java/com/overdrive/app/power/PowerNotice.java",
        };
        for (String path : senders) {
            assertTrue(path + " must attach an IPC token", read(path).contains("IpcAuth.attach("));
        }
    }

    @Test
    public void noThirtyDaySessionTokenIsSentOverIpc() throws IOException {
        String[] callers = {
                "app/src/main/java/com/overdrive/app/daemon/telegram/BackupCommandHandler.java",
                "app/src/main/java/com/overdrive/app/ui/fragment/settings/SettingsAboutFragment.kt",
        };
        for (String path : callers) {
            String text = read(path);
            assertFalse(path + " must not send generateJwt() over IPC",
                    text.contains("AuthManager.generateJwt()"));
            assertTrue(text.contains("AuthManager.generateIpcJwt()"));
        }
    }

    // ---------- port 19876 (camera daemon TcpCommandServer) ----------

    private static final String[] CAMERA_GUARDED = {
            "start", "stop", "shutdown", "getFrame", "startStream", "stopStream", "setStreamMode",
            "enableSurveillance", "disableSurveillance", "setAccState", "setRecordingMode",
            "setBitrate", "setCodec", "setRecordingsStorageType", "setRecordingsLimitMb",
    };

    private static final String[] CAMERA_OPEN = {
            "status", "ping", "setOutput", "streamStatus", "getStreamMode", "surveillanceStatus",
            "getRecordingMode", "getQualitySettings", "setRtmpUrl", "auth_invalidate",
            "telenavUse", "",
    };

    @Test
    public void cameraPortGuardsStateChangesAndFrames() throws Exception {
        for (String cmd : CAMERA_GUARDED) {
            assertTrue(cmd + " must need a token", IpcAuth.cameraTcpRequiresToken(cmd));
            assertEquals("no token",
                    IpcAuth.cameraTcpRejectionReason(cmd, new JSONObject().put("cmd", cmd)));
        }
        assertEquals(CAMERA_GUARDED.length, IpcAuth.CAMERA_TCP_GUARDED.size());
        for (String cmd : CAMERA_OPEN) {
            assertFalse(cmd + " must stay open", IpcAuth.cameraTcpRequiresToken(cmd));
            assertNull(IpcAuth.cameraTcpRejectionReason(cmd, new JSONObject()));
        }
    }

    @Test
    public void logLinesMaskTheToken() throws Exception {
        JSONObject request = new JSONObject().put("cmd", "stop").put("jwt", "secret.token.value");
        String logged = IpcAuth.redactedForLog(request);
        assertFalse(logged.contains("secret.token.value"));
        assertTrue(logged.contains("\"cmd\":\"stop\""));
        assertEquals("secret.token.value", request.getString("jwt"));
        assertEquals("{\"cmd\":\"ping\"}", IpcAuth.redactedForLog(new JSONObject().put("cmd", "ping")));
    }

    @Test
    public void cameraServerChecksBeforeDispatchAndNeverLogsTheRawLine() throws IOException {
        String server = read("app/src/main/java/com/overdrive/app/server/TcpCommandServer.java");
        int check = server.indexOf("IpcAuth.cameraTcpRejectionReason(action, cmd)");
        int dispatch = server.indexOf("switch (action) {", check);
        assertTrue(check > 0);
        assertTrue(dispatch > check);
        assertFalse(server.contains("\"TCP received: \" + line"));
        assertTrue(server.contains("IpcAuth.redactedForLog(cmd)"));
    }

    @Test
    public void cameraPortSendersAttachAToken() throws IOException {
        String[] senders = {
                "app/src/main/java/com/overdrive/app/client/CameraDaemonClient.java",
                "app/src/main/java/com/overdrive/app/overlay/StatusOverlayService.java",
                "app/src/main/java/com/overdrive/app/ui/daemon/CameraDaemonController.kt",
        };
        for (String path : senders) {
            assertTrue(path + " must attach an IPC token", read(path).contains("IpcAuth.attach("));
        }
        String controller = read("app/src/main/java/com/overdrive/app/ui/daemon/CameraDaemonController.kt");
        assertFalse(controller.contains("writer.write(\"$command\\n\")"));
        assertFalse(controller.contains("writer.write(\"{\\\"cmd\\\":\\\"shutdown\\\"}\\n\")"));
    }

    // ---------- port 19880 (Telegram bot daemon) and 19879 (SentryDaemon control) ----------

    @Test
    public void telegramPortNeedsATokenForEverythingButPing() throws Exception {
        for (String cmd : new String[] {"sendMessage", "sendVideo", "notifyTunnel", "notifyMotion",
                "notifyMotionFinalized", "notifyParking", "notifyCritical", "", "anythingNew"}) {
            assertEquals(cmd, "no token",
                    IpcAuth.telegramRejectionReason(cmd, new JSONObject().put("cmd", cmd)));
        }
        assertNull(IpcAuth.telegramRejectionReason("ping", new JSONObject()));
    }

    @Test
    public void telegramBotOnlyEverSendsToTheOwner() throws IOException {
        String daemon = read("app/src/main/java/com/overdrive/app/daemon/TelegramBotDaemon.java");
        assertFalse("a caller-chosen chatId let any app send through the bot to its own chat",
                daemon.contains("optLong(\"chatId\""));
        assertTrue(daemon.contains("long chatId = ownerChatId;"));
        assertTrue(daemon.contains("long videoChatId = ownerChatId;"));
        assertFalse(daemon.contains("log(\"IPC received: \" + line)"));
        int check = daemon.indexOf("IpcAuth.telegramRejectionReason(action, cmd)");
        int dispatch = daemon.indexOf("lane.execute(", check);
        assertTrue(check > 0);
        assertTrue("the check must come before the command is queued", dispatch > check);
        assertTrue(read("app/src/main/java/com/overdrive/app/telegram/TelegramNotifier.java")
                .contains("IpcAuth.attach(command)"));
    }

    @Test
    public void sentryPortGuardsStopAndLocationControl() {
        for (String cmd : new String[] {"STOP", "KILL", "EXIT",
                "LOCATION_MONITOR_ON", "LOCATION_MONITOR_OFF", "LOCATION_RESTART"}) {
            assertEquals(cmd, "no token", IpcAuth.sentryRejectionReason(cmd, ""));
            assertEquals(cmd, "no token", IpcAuth.sentryRejectionReason(cmd, null));
        }
        assertNull(IpcAuth.sentryRejectionReason("PING", ""));
        assertNull(IpcAuth.sentryRejectionReason("STATUS", ""));
        assertNull(IpcAuth.sentryRejectionReason(null, ""));
    }

    @Test
    public void sentryReadsTheTokenBeforeUpperCasing() throws IOException {
        String daemon = read("app/src/main/java/com/overdrive/app/daemon/SentryDaemon.java");
        int split = daemon.indexOf("command.trim().split(\"\\\\s+\", 2)");
        int check = daemon.indexOf("IpcAuth\n                                    .sentryRejectionReason(command, token)");
        int dispatch = daemon.indexOf("switch (command) {", check);
        assertTrue(split > 0);
        assertFalse(daemon.contains("command = command.trim().toUpperCase();"));
        assertTrue(check > split);
        assertTrue(dispatch > check);
        assertTrue(daemon.contains("\"STOP \" + token"));
    }

    @Test
    public void attachNeverMutatesTheCallersRequest() throws IOException {
        String auth = read("app/src/main/java/com/overdrive/app/server/IpcAuth.java");
        assertTrue("a spooled request must not keep an old token",
                auth.contains("JSONObject copy = new JSONObject(request.toString());"));
        assertFalse(auth.contains("request.has(FIELD)) return request;"));
    }

    private static String read(String relativePath) throws IOException {
        return new String(Files.readAllBytes(locate(relativePath)), StandardCharsets.UTF_8);
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
