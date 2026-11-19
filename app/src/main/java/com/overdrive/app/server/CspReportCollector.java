package com.overdrive.app.server;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Security fix F9: collects Content-Security-Policy violation reports.
 *
 * <p>Pages carry an ENFORCED {@code script-src 'self'} policy (see {@link HttpResponse#CSP}), so a
 * listed report is something the browser BLOCKED. With the owner's "Relax the script safety
 * check" switch on ({@link ScriptPolicy}), the same policy is report-only and listed items ran. The browser
 * posts reports without any sign-in header, so {@code POST /api/csp-report} is public: the body
 * is capped, every field is truncated and stripped to printable ASCII, unique reports are kept
 * in a small in-memory table, and at most a few new ones a minute reach the daemon log.
 * {@code GET /api/csp-reports} (signed in) lists them.
 */
public final class CspReportCollector {

    static final int MAX_BODY_BYTES = 16 * 1024;
    static final int MAX_UNIQUE = 200;
    static final int MAX_FIELD = 160;
    static final int MAX_NEW_LOGS_PER_MINUTE = 10;

    private static final Map<String, Entry> entries = new LinkedHashMap<>();
    private static long logWindowStart;
    private static int logsInWindow;

    private CspReportCollector() {}

    static final class Entry {
        final String directive;
        final String blocked;
        final String source;
        final String page;
        final String sample;
        int count;
        long lastSeenMs;

        Entry(String directive, String blocked, String source, String page, String sample) {
            this.directive = directive;
            this.blocked = blocked;
            this.source = source;
            this.page = page;
            this.sample = sample;
        }
    }

    /**
     * Record one report body. Returns the log line to write for a new unique report (rate
     * limited), or null when nothing should be logged (duplicate, malformed or over the limit).
     */
    static synchronized String record(String body, long nowMs) {
        if (body == null || body.isEmpty() || body.length() > MAX_BODY_BYTES) return null;
        JSONObject report;
        try {
            JSONObject root = new JSONObject(body);
            report = root.optJSONObject("csp-report");
            if (report == null) return null;
        } catch (Exception e) {
            return null;
        }
        String directive = clean(report.optString("effective-directive",
                report.optString("violated-directive", "")));
        if (directive.isEmpty()) return null;
        int space = directive.indexOf(' ');
        if (space > 0) directive = directive.substring(0, space);
        String blocked = clean(report.optString("blocked-uri", ""));
        String source = clean(report.optString("source-file", ""));
        int line = report.optInt("line-number", 0);
        if (line > 0) source = source + ":" + line;
        String page = pathOnly(clean(report.optString("document-uri", "")));
        String sample = clean(report.optString("script-sample", ""));

        String key = directive + "|" + blocked + "|" + source + "|" + page;
        Entry e = entries.get(key);
        if (e != null) {
            e.count++;
            e.lastSeenMs = nowMs;
            return null;
        }
        if (entries.size() >= MAX_UNIQUE) {
            Iterator<String> it = entries.keySet().iterator();
            it.next();
            it.remove();
        }
        e = new Entry(directive, blocked, source, page, sample);
        e.count = 1;
        e.lastSeenMs = nowMs;
        entries.put(key, e);

        if (nowMs - logWindowStart >= 60_000L) {
            logWindowStart = nowMs;
            logsInWindow = 0;
        }
        if (logsInWindow >= MAX_NEW_LOGS_PER_MINUTE) return null;
        logsInWindow++;
        return "CSP report-only: " + directive + " blocked=" + (blocked.isEmpty() ? "-" : blocked)
                + " at " + (source.isEmpty() ? "-" : source) + " on " + (page.isEmpty() ? "-" : page);
    }

    static synchronized JSONArray list() {
        JSONArray out = new JSONArray();
        for (Entry e : entries.values()) {
            try {
                out.put(new JSONObject()
                        .put("directive", e.directive)
                        .put("blocked", e.blocked)
                        .put("source", e.source)
                        .put("page", e.page)
                        .put("sample", e.sample)
                        .put("count", e.count)
                        .put("lastSeen", e.lastSeenMs));
            } catch (Exception ignored) {}
        }
        return out;
    }

    static synchronized void clear() {
        entries.clear();
        logWindowStart = 0L;
        logsInWindow = 0;
    }

    /** Printable ASCII only (no control chars, so no log-line injection), truncated. */
    static String clean(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder(Math.min(s.length(), MAX_FIELD));
        for (int i = 0; i < s.length() && b.length() < MAX_FIELD; i++) {
            char c = s.charAt(i);
            if (c >= 0x20 && c < 0x7f) b.append(c);
        }
        return b.toString();
    }

    /** Drop scheme, host and query: only the page path is kept (no tokens from ?t= or #). */
    static String pathOnly(String uri) {
        String s = uri;
        int scheme = s.indexOf("://");
        if (scheme >= 0) {
            int slash = s.indexOf('/', scheme + 3);
            s = slash >= 0 ? s.substring(slash) : "/";
        }
        int q = s.indexOf('?');
        if (q >= 0) s = s.substring(0, q);
        int h = s.indexOf('#');
        if (h >= 0) s = s.substring(0, h);
        return s;
    }
}
