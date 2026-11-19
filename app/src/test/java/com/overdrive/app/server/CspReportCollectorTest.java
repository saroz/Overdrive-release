package com.overdrive.app.server;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

/** F9 stage 1: report-only script policy and the public report endpoint. */
public class CspReportCollectorTest {

    @Before
    public void reset() {
        CspReportCollector.clear();
    }

    private static String report(String directive, String blocked, String source, int line, String page) {
        return "{\"csp-report\":{\"document-uri\":\"" + page + "\",\"violated-directive\":\"" + directive
                + "\",\"effective-directive\":\"" + directive + "\",\"blocked-uri\":\"" + blocked
                + "\",\"source-file\":\"" + source + "\",\"line-number\":" + line + "}}";
    }

    @Test
    public void logsANewReportOnceAndCountsRepeats() throws Exception {
        String r = report("script-src", "inline", "http://127.0.0.1:8080/road-sense.html", 42,
                "http://127.0.0.1:8080/road-sense.html?t=secret#x");
        String line = CspReportCollector.record(r, 1000L);
        assertNotNull(line);
        assertTrue(line.contains("script-src"));
        assertTrue(line.contains("on /road-sense.html"));
        assertFalse("query tokens never reach the log", line.contains("secret"));
        assertNull(CspReportCollector.record(r, 2000L));
        JSONObject first = CspReportCollector.list().getJSONObject(0);
        assertEquals(2, first.getInt("count"));
        assertEquals("/road-sense.html", first.getString("page"));
    }

    @Test
    public void rejectsJunkAndOversizedBodies() {
        assertNull(CspReportCollector.record(null, 0L));
        assertNull(CspReportCollector.record("not json", 0L));
        assertNull(CspReportCollector.record("{\"other\":{}}", 0L));
        StringBuilder big = new StringBuilder("{\"csp-report\":{\"violated-directive\":\"script-src\",\"blocked-uri\":\"");
        while (big.length() <= CspReportCollector.MAX_BODY_BYTES) big.append('a');
        big.append("\"}}");
        assertNull(CspReportCollector.record(big.toString(), 0L));
        assertEquals(0, CspReportCollector.list().length());
    }

    @Test
    public void stripsControlCharactersAndCapsTheTable() {
        String r = "{\"csp-report\":{\"violated-directive\":\"script-src\",\"blocked-uri\":\"inline\\nFAKE LOG LINE\"}}";
        String line = CspReportCollector.record(r, 0L);
        assertNotNull(line);
        assertFalse(line.contains("\n"));
        for (int i = 0; i < CspReportCollector.MAX_UNIQUE + 50; i++) {
            CspReportCollector.record(report("script-src", "inline", "/p.html", i, "/p.html"), 120_000L * i);
        }
        assertEquals(CspReportCollector.MAX_UNIQUE, CspReportCollector.list().length());
    }

    @Test
    public void logLinesAreRateLimited() {
        int logged = 0;
        for (int i = 0; i < 50; i++) {
            if (CspReportCollector.record(report("script-src", "inline", "/p.html", i, "/p.html"), 5000L) != null) logged++;
        }
        assertEquals(CspReportCollector.MAX_NEW_LOGS_PER_MINUTE, logged);
    }

    @Test
    public void reportOnlyFallbackKeepsTheStageOnePolicy() throws Exception {
        // Step 5 enforces by default; the owner's report-only switch sends the stage-1 headers.
        assertTrue(HttpResponse.SECURITY_HEADERS_REPORT_ONLY.contains(
                "Content-Security-Policy-Report-Only: script-src 'self'; child-src 'self' blob:; report-uri /api/csp-report\r\n"));
        assertFalse(HttpResponse.CSP_BASE.contains("script-src"));
        // Enforced policy still reports what it blocks.
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        HttpResponse.sendHtml(out, "<html></html>");
        assertTrue(out.toString(StandardCharsets.UTF_8.name()).contains("report-uri /api/csp-report"));
    }

    @Test
    public void endpointIsPublicPostOnlyAndBodyCapped() throws Exception {
        assertTrue(AuthMiddleware.isPublicPath("/api/csp-report"));
        assertFalse(AuthMiddleware.isPublicPath("/api/csp-reports"));
        assertEquals(CspReportCollector.MAX_BODY_BYTES,
                HttpServer.maxBodyBytesForRequestLine("POST /api/csp-report HTTP/1.1"));
        String server = read("app/src/main/java/com/overdrive/app/server/HttpServer.java");
        assertTrue(server.contains("if (!\"POST\".equals(method)) {\n                HttpResponse.sendError(out, 405"));
    }

    private static String read(String rel) throws Exception {
        Path p = Paths.get(rel);
        if (!Files.exists(p)) p = Paths.get(rel.replaceFirst("^app/", ""));
        return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
    }
}
