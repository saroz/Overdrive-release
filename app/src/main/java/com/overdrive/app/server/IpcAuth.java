package com.overdrive.app.server;

import com.overdrive.app.auth.AuthManager;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caller check for the loopback IPC port 19877 (security finding F14).
 *
 * <p>Any app on the head unit can open 127.0.0.1:19877, so commands that change settings or
 * state, and reads that return credentials, must carry a session token in the {@code "jwt"}
 * field (a 2-minute {@code aud=ipc} token the web API refuses, so a process squatting on the
 * port can't replay it as a sign-in). Only the OverDrive app (its copy of the auth secret) and
 * the daemons (the owner-only secret file) can mint one.
 *
 * <p>The camera daemon's command port 19876 ({@code TcpCommandServer}, key {@code "cmd"}) gets
 * the same check through {@link #cameraTcpRejectionReason}.
 *
 * <p>Stage A: {@link #ENFORCE} is false, so the server only logs a command that arrives without
 * a valid token. After a car run shows no such log lines, flip it to true.
 */
public final class IpcAuth {

    /** F14 stage A = log only. Set to true once the car log shows every caller sends a token. */
    public static final boolean ENFORCE = false;

    public static final String FIELD = "jwt";

    /** Commands that change settings or state, plus reads that return credentials or the VIN. */
    static final Set<String> GUARDED = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
            // surveillance state
            "START", "STOP", "ENABLE_SURVEILLANCE", "DISABLE_SURVEILLANCE", "POWER_NOTICE",
            // config
            "SET_CONFIG", "UPDATE_SECTION", "UPDATE_VALUES", "REPLACE_CONFIG", "SET_ROI",
            "SET_TELEMETRY_OVERLAY",
            // safe zones
            "ADD_SAFE_LOCATION", "UPDATE_SAFE_LOCATION", "DELETE_SAFE_LOCATION",
            "TOGGLE_SAFE_LOCATIONS",
            // integrations
            "SET_ABRP_CONFIG", "DELETE_ABRP_TOKEN",
            "ADD_MQTT_CONNECTION", "UPDATE_MQTT_CONNECTION", "DELETE_MQTT_CONNECTION",
            // updates and logs
            "SET_CHANNEL", "INSTALL_UPDATE", "UPLOAD_LOG",
            // reads that return secrets or identity
            "GET_CONFIG", "EXPORT_CONFIG", "GET_MQTT_CONNECTIONS", "GET_ABRP_CONFIG",
            "GET_VEHICLE_IDENTITY")));

    /**
     * Port 19876 commands that change recording, streaming or surveillance, stop the daemon, or
     * return a live camera frame. Status reads, ping, telenavUse and auth_invalidate stay open.
     */
    static final Set<String> CAMERA_TCP_GUARDED = Collections.unmodifiableSet(new HashSet<>(
            Arrays.asList(
                    "start", "stop", "shutdown", "getFrame",
                    "startStream", "stopStream", "setStreamMode",
                    "enableSurveillance", "disableSurveillance", "setAccState",
                    "setRecordingMode", "setBitrate", "setCodec",
                    "setRecordingsStorageType", "setRecordingsLimitMb")));

    private static final long LOG_INTERVAL_MS = 60_000L;
    private static final Map<String, Long> lastLogged = new ConcurrentHashMap<>();

    private IpcAuth() {}

    public static boolean requiresToken(String command) {
        return command != null && GUARDED.contains(command);
    }

    /**
     * Client side: add a freshly minted token to {@code request} unless it already has one.
     * A caller that can't mint (no secret yet) sends the request unchanged.
     */
    public static JSONObject attach(JSONObject request) {
        if (request == null || request.has(FIELD)) return request;
        try {
            String token = AuthManager.generateIpcJwt();
            if (token != null && !token.isEmpty()) request.put(FIELD, token);
        } catch (Throwable ignored) {
            // no secret available in this process: the server logs the missing token
        }
        return request;
    }

    /**
     * Server side: why {@code command} is not authorised, or null when it is (or needs no token).
     */
    public static String rejectionReason(String command, JSONObject request) {
        if (!requiresToken(command)) return null;
        return tokenProblem(request);
    }

    public static boolean cameraTcpRequiresToken(String cmd) {
        return cmd != null && CAMERA_TCP_GUARDED.contains(cmd);
    }

    /** Port 19876: why {@code cmd} is not authorised, or null when it is (or needs no token). */
    public static String cameraTcpRejectionReason(String cmd, JSONObject request) {
        if (!cameraTcpRequiresToken(cmd)) return null;
        return tokenProblem(request);
    }

    /** {@code request} as text for a log line, with the token masked. */
    public static String redactedForLog(JSONObject request) {
        if (request == null) return "null";
        if (!request.has(FIELD)) return request.toString();
        try {
            JSONObject copy = new JSONObject(request.toString());
            copy.put(FIELD, "***");
            return copy.toString();
        } catch (Exception e) {
            return "(unprintable request)";
        }
    }

    private static String tokenProblem(JSONObject request) {
        String token = request == null ? "" : request.optString(FIELD, "");
        if (token.isEmpty()) return "no token";
        try {
            AuthManager.JwtValidation v = AuthManager.validateIpcJwt(token);
            if (v != null && v.valid) return null;
            return v == null || v.error == null ? "invalid token" : v.error;
        } catch (Throwable t) {
            return "token check failed";
        }
    }

    /** At most one log line per command per minute, so a missed caller can't flood the log. */
    static boolean shouldLog(String command, long nowMs) {
        Long last = lastLogged.get(command);
        if (last != null && nowMs - last < LOG_INTERVAL_MS) return false;
        lastLogged.put(command, nowMs);
        return true;
    }
}
