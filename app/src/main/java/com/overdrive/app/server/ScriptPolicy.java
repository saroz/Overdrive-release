package com.overdrive.app.server;

import com.overdrive.app.config.UnifiedConfigManager;

import org.json.JSONObject;

/**
 * Security F9, step 5: whether pages get the script policy ENFORCED (default) or only reported.
 *
 * <p>{@code webAccess.scriptPolicyReportOnly=true} (Network page > Behaviour) is the way back if
 * something on a head unit still needs an inline script or eval: pages then behave as before
 * step 5 and violations are only reported to /api/csp-report. Read from the daemon config,
 * cached for 5 s; an unreadable config keeps the last answer (enforce at start).
 */
public final class ScriptPolicy {

    private static final long CACHE_MS = 5000L;
    private static volatile long cachedAt;
    private static volatile boolean reportOnly;

    private ScriptPolicy() {}

    public static boolean reportOnly() {
        long now = System.currentTimeMillis();
        if (now - cachedAt < CACHE_MS) return reportOnly;
        try {
            JSONObject web = UnifiedConfigManager.loadConfig().optJSONObject("webAccess");
            reportOnly = web != null && web.optBoolean("scriptPolicyReportOnly", false);
        } catch (Throwable ignored) {
            // keep the last answer
        }
        cachedAt = now;
        return reportOnly;
    }
}
