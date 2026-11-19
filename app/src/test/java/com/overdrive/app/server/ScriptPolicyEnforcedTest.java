package com.overdrive.app.server;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import com.overdrive.app.ui.fragment.WebViewFragment;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

/** Security F9 step 5: script-src 'self' enforced; the app WebView's own injected scripts carry a nonce. */
public class ScriptPolicyEnforcedTest {

    @Test
    public void enforcedHeadersByDefault() {
        assertTrue(HttpResponse.SECURITY_HEADERS.contains("Content-Security-Policy: " + HttpResponse.CSP + "\r\n"));
        assertFalse(HttpResponse.SECURITY_HEADERS.contains("Report-Only"));
    }

    @Test
    public void nonceIsAddedToScriptSrcOnly() {
        String p = WebViewFragment.withScriptNonce(HttpResponse.CSP, "abc123");
        assertTrue(p.contains("script-src 'nonce-abc123' 'self';"));
        assertEquals("object-src 'none'", WebViewFragment.withScriptNonce("object-src 'none'", "x"));
        assertNotEquals(WebViewFragment.newScriptNonce(), WebViewFragment.newScriptNonce());
        assertTrue(WebViewFragment.newScriptNonce().matches("[A-Za-z0-9+/]{22}=="));
    }

    @Test
    public void everyInjectedScriptCarriesTheNonce() {
        String html = "<!doctype html><html><head><title>x</title></head><body></body></html>";
        String out = WebViewFragment.spliceEmbedChrome(html, "N0nce");
        assertFalse("no bare <script> may be injected", out.contains("<script>"));
        int scripts = out.split("<script nonce=\"N0nce\">", -1).length - 1;
        assertTrue("embed chrome, page-ready and inject scripts: " + scripts, scripts >= 3);
        // Without a nonce (tests, other callers) the old markup is unchanged.
        assertTrue(WebViewFragment.spliceEmbedChrome(html).contains("<script>"));
    }

    @Test
    public void webViewRewritesThePolicyHeaderForSplicedPages() throws Exception {
        String src = read("app/src/main/java/com/overdrive/app/ui/fragment/WebViewFragment.kt");
        assertTrue(src.contains("String(stream.readBytes(), Charsets.UTF_8), scriptNonce)"));
        assertTrue(src.contains("headers[key] = withScriptNonce(headers[key] ?: \"\", scriptNonce)"));
    }

    @Test
    public void ownerCanSwitchBackToReportOnly() throws Exception {
        String api = read("app/src/main/java/com/overdrive/app/server/HotspotApiHandler.java");
        assertTrue(api.contains("status.put(\"scriptPolicyReportOnly\", ScriptPolicy.reportOnly());"));
        assertTrue(api.contains("web.put(\"scriptPolicyReportOnly\""));
        String html = read("app/src/main/assets/web/local/network.html");
        assertTrue(html.contains("id=\"hsScriptReportOnly\""));
        String resp = read("app/src/main/java/com/overdrive/app/server/HttpResponse.java");
        assertTrue(resp.contains("return ScriptPolicy.reportOnly() ? SECURITY_HEADERS_REPORT_ONLY : SECURITY_HEADERS;"));
    }

    private static String read(String rel) throws Exception {
        Path p = Paths.get(rel);
        if (!Files.exists(p)) p = Paths.get(rel.replaceFirst("^app/", ""));
        return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
    }
    @Test
    public void savingTheSwitchDropsTheCachesSoItDoesNotSnapBack() throws Exception {
        String api = read("app/src/main/java/com/overdrive/app/server/HotspotApiHandler.java");
        int save = api.indexOf("UnifiedConfigManager.updateValues(\"webAccess\", web)");
        assertTrue(save > 0);
        assertTrue(api.indexOf("ScriptPolicy.invalidate();", save) > save);
        assertTrue(api.indexOf("LanAccessPolicy.invalidate();", save) > save);
    }

    @Test
    public void networkPageWarnsWhileTheCheckIsRelaxed() throws Exception {
        String html = read("app/src/main/assets/web/local/network.html");
        assertTrue(html.contains("id=\"scriptRelaxedWarning\" role=\"alert\" hidden"));
        assertTrue(html.contains("data-i18n=\"network.script_relaxed_warning\""));
        String js = read("app/src/main/assets/web/shared/network.js");
        assertTrue(js.contains("relaxedWarn.hidden = s.scriptPolicyReportOnly !== true;"));
        for (String lang : new String[] {"en", "ne", "he"}) {
            assertTrue(lang, read("app/src/main/assets/web/i18n/" + lang + ".json")
                    .contains("\"script_relaxed_warning\""));
        }
    }

    @Test
    public void liveViewDoesNotCompileWebAssemblyOnThePage() throws Exception {
        // Chrome 58 refuses WebAssembly under script-src without 'unsafe-eval'; the Broadway
        // decoder runs only inside shared/broadway-worker.js.
        assertFalse(read("app/src/main/assets/web/local/live-view.html").contains("Decoder.js"));
    }
}
