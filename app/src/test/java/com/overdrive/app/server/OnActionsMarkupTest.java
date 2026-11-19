package com.overdrive.app.server;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/**
 * Security F9 step 4: inline on*= handlers became data-on-click/change/input, run by
 * shared/on-actions.js without eval. Every such attribute must be a single call the helper
 * accepts, and every page that uses them must load the helper.
 */
public class OnActionsMarkupTest {

    private static final String ARG =
            "(?:'(?:[^'\\\\]|\\\\.)*'|-?\\d+(?:\\.\\d+)?|true|false|null|event|this(?:\\.(?:value|checked|dataset\\.[A-Za-z]\\w*))?)";
    private static final Pattern CALL = Pattern.compile(
            "^\\s*([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)\\s*\\(\\s*(?:" + ARG + "\\s*(?:,\\s*" + ARG
                    + "\\s*)*)?\\)\\s*;?\\s*$");
    private static final Pattern DENY_ROOT = Pattern.compile(
            "^(eval|Function|setTimeout|setInterval|setImmediate|execScript|location|document|window|self|top|parent|frames|globalThis|open|fetch|XMLHttpRequest|WebSocket|Worker|importScripts|postMessage|navigator|localStorage|sessionStorage|indexedDB)$");
    private static final Pattern DATA_ON = Pattern.compile("\\sdata-on-(click|change|input)=\"([^\"]*)\"");

    @Test
    public void everyDataOnAttributeIsACallTheHelperAccepts() throws Exception {
        int seen = 0;
        try (java.util.stream.Stream<Path> files = Files.list(locate("app/src/main/assets/web/local"))) {
            for (Path f : (Iterable<Path>) files::iterator) {
                if (!f.toString().endsWith(".html")) continue;
                String html = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
                Matcher m = DATA_ON.matcher(html);
                boolean any = false;
                while (m.find()) {
                    any = true;
                    seen++;
                    Matcher call = CALL.matcher(m.group(2));
                    assertTrue(f.getFileName() + ": " + m.group(2), call.matches());
                    assertFalse(f.getFileName() + ": " + m.group(2),
                            DENY_ROOT.matcher(call.group(1).split("\\.")[0]).matches());
                }
                if (any) {
                    assertTrue(f.getFileName() + " must load on-actions.js",
                            html.contains("<script src=\"../shared/on-actions.js?v=1\"></script>"));
                }
            }
        }
        assertTrue(seen > 0);
    }

    /**
     * The helper looks callees up on window. A top-level const/let/class is visible to other
     * scripts (and to old inline handlers) but is NOT a window property, so each root must be a
     * var, a function declaration, or assigned to window.X somewhere.
     */
    @Test
    public void everyHandlerRootIsReachableFromWindow() throws Exception {
        StringBuilder all = new StringBuilder();
        for (String dir : new String[]{"app/src/main/assets/web/shared", "app/src/main/assets/web/shared/pages"}) {
            try (java.util.stream.Stream<Path> files = Files.list(locate(dir))) {
                for (Path f : (Iterable<Path>) files::iterator) {
                    if (f.toString().endsWith(".js")) {
                        all.append(new String(Files.readAllBytes(f), StandardCharsets.ISO_8859_1)).append('\n');
                    }
                }
            }
        }
        String js = all.toString();
        java.util.Set<String> roots = new java.util.TreeSet<>();
        try (java.util.stream.Stream<Path> files = Files.list(locate("app/src/main/assets/web/local"))) {
            for (Path f : (Iterable<Path>) files::iterator) {
                if (!f.toString().endsWith(".html")) continue;
                Matcher m = DATA_ON.matcher(new String(Files.readAllBytes(f), StandardCharsets.UTF_8));
                while (m.find()) roots.add(m.group(2).trim().split("[.(]")[0]);
            }
        }
        for (String root : roots) {
            Pattern exposed = Pattern.compile("(?m)(^(?:var|function|async function)\\s+" + Pattern.quote(root)
                    + "\\b|window\\." + Pattern.quote(root) + "\\s*=)");
            assertTrue(root + " is not reachable as window." + root, exposed.matcher(js).find());
        }
    }

    @Test
    public void helperListensInTheBubblePhaseWithoutEval() throws Exception {
        String js = new String(Files.readAllBytes(locate("app/src/main/assets/web/shared/on-actions.js")),
                StandardCharsets.UTF_8);
        // Bubble phase: capture guards such as settings-hydration.js still stop events first.
        assertTrue(js.contains("document.addEventListener(TYPES[t], handler(TYPES[t]), false);"));
        assertFalse(js.contains("eval("));
        assertFalse(js.contains("new Function"));
        assertTrue(js.contains("var DENY_ROOT = /^(eval|Function|setTimeout"));
        assertTrue(js.contains("/^\\/(?!\\/)/.test(url)"));
    }

    private static Path locate(String rel) {
        Path p = Paths.get(rel);
        return Files.exists(p) ? p : Paths.get(rel.replaceFirst("^app/", ""));
    }
}
