package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/**
 * Guard rails for pages rebuilt on the mockup's ui- components (plan Task 6). Every page listed in
 * web-ui/migrated-pages.txt must keep the ids its scripts use (snapshot in web-ui/ids/), use the
 * ui shell, keep its own CSS small, and drop the old classes — in its markup and in the markup its
 * scripts build.
 */
public class MigratedPagesAssetTest {

    private static final String LOCAL = "app/src/main/assets/web/local/";
    private static final String SHARED = "app/src/main/assets/web/shared/";
    private static final int MAX_INLINE_CSS_LINES = 60;

    static List<String> migrated() throws IOException {
        List<String> pages = new ArrayList<>();
        for (String line : WebThemeTokensAssetTest.read("web-ui/migrated-pages.txt").split("\n")) {
            String page = line.trim();
            if (!page.isEmpty() && !page.startsWith("#")) pages.add(page);
        }
        return pages;
    }

    private static String snapshot(String page) throws IOException {
        return WebThemeTokensAssetTest.read("web-ui/ids/" + page.replace(".html", ".txt"));
    }

    private static String header(String snapshot, String key) {
        for (String line : snapshot.split("\n")) {
            if (line.startsWith("# " + key + ":")) return line.substring(key.length() + 3).trim();
        }
        return "";
    }

    private static List<String> words(String s) {
        List<String> out = new ArrayList<>();
        for (String w : s.trim().split("\\s+")) if (!w.isEmpty()) out.add(w);
        return out;
    }

    /** The page's own scripts as they are now (inline + its shared scripts). */
    private static String scripts(String page, String html) throws IOException {
        StringBuilder js = new StringBuilder();
        Matcher inline = Pattern.compile("(?s)<script(?![^>]*\\bsrc=)[^>]*>(.*?)</script>").matcher(html);
        while (inline.find()) js.append(inline.group(1)).append('\n');
        for (String f : words(header(snapshot(page), "scripts"))) {
            js.append(WebThemeTokensAssetTest.read(SHARED + f)).append('\n');
        }
        return js.toString();
    }

    /**
     * Old class names the rebuilt page may not use — unless the new styling (the page's remaining
     * inline CSS or ui.css) defines that class again, in which case it is part of the new look.
     */
    private static Set<String> forbiddenClasses(String page) throws IOException {
        // Only the old global sheets still carry old styling; a page's own old classes lost theirs
        // when its inline CSS was rewritten, so on their own they are plain script hooks.
        Set<String> out = new HashSet<>(words(WebThemeTokensAssetTest.read("web-ui/legacy-classes.txt")));
        String html = WebThemeTokensAssetTest.read(LOCAL + page);
        StringBuilder css = new StringBuilder(UiCssBuildAssetTest.css());
        String pageCss = SHARED + "pages/" + page.replace(".html", ".css");
        if (pageCssExists(pageCss)) {
            css.append(WebThemeTokensAssetTest.read(pageCss));
        }
        Matcher style = Pattern.compile("(?s)<style[^>]*>(.*?)</style>").matcher(html);
        while (style.find()) css.append(style.group(1));
        Matcher sel = Pattern.compile("\\.(-?[_a-zA-Z][\\w-]*)").matcher(
                css.toString().replaceAll("(?s)\\{[^{}]*\\}", "{}"));
        while (sel.find()) out.remove(sel.group(1));
        return out;
    }

    private static boolean pageCssExists(String path) {
        try {
            WebThemeTokensAssetTest.locate(path);
            return true;
        } catch (AssertionError missing) {
            return false;
        }
    }

    private static String withoutScripts(String html) {
        return html.replaceAll("(?s)<script[^>]*>.*?</script>", "").replaceAll("(?s)<style[^>]*>.*?</style>", "");
    }

    /** Every shared script as it is now, so an id only has to survive while something still reads it. */
    private static String allSharedScripts() throws IOException {
        StringBuilder js = new StringBuilder();
        java.io.File[] files = WebThemeTokensAssetTest.locate(SHARED).toFile().listFiles();
        if (files != null) {
            for (java.io.File f : files) {
                if (f.getName().endsWith(".js")) js.append(WebThemeTokensAssetTest.read(SHARED + f.getName())).append('\n');
            }
        }
        return js.toString();
    }

    private static boolean lookedUp(String js, String id) {
        return js.contains("getElementById('" + id + "')") || js.contains("getElementById(\"" + id + "\")")
                || js.contains("'#" + id) || js.contains("\"#" + id) || js.contains("$('" + id + "')");
    }

    @Test
    public void idsSurvive() throws IOException {
        String shared = allSharedScripts();
        for (String page : migrated()) {
            String html = WebThemeTokensAssetTest.read(LOCAL + page);
            String js = scripts(page, html);
            String readers = js + shared;
            for (String line : snapshot(page).split("\n")) {
                String id = line.trim();
                if (id.isEmpty() || id.startsWith("#")) continue;
                if (!lookedUp(readers, id)) continue; // nothing reads it any more
                boolean inHtml = html.contains("id=\"" + id + "\"");
                boolean builtByScript = js.contains("id=\"" + id + "\"") || js.contains("id=\\\"" + id + "\\\"")
                        || js.contains(".id = '" + id + "'") || js.contains(".id = \"" + id + "\"");
                assertTrue(page + " lost #" + id, inHtml || builtByScript);
            }
        }
    }

    @Test
    public void usesTheUiPageLayout() throws IOException {
        for (String page : migrated()) {
            String html = WebThemeTokensAssetTest.read(LOCAL + page);
            // Full-window workspaces (live video) have no page heading or settings panels.
            if (html.contains(" data-ui-workspace")) continue;
            assertTrue(page + " has no ui-page-head", html.contains("ui-page-head"));
            // Panels may be built by the page's own script (e.g. module fault cards).
            assertTrue(page + " has no ui-panel",
                    html.contains("ui-panel") || scripts(page, html).contains("ui-panel"));
        }
    }

    @Test
    public void inlineCssIsSmall() throws IOException {
        for (String page : migrated()) {
            Matcher style = Pattern.compile("(?s)<style[^>]*>(.*?)</style>")
                    .matcher(WebThemeTokensAssetTest.read(LOCAL + page));
            int lines = 0;
            while (style.find()) {
                for (String l : style.group(1).split("\n")) if (!l.trim().isEmpty()) lines++;
            }
            assertTrue(page + " keeps " + lines + " lines of inline CSS", lines <= MAX_INLINE_CSS_LINES);
        }
    }

    @Test
    public void noLegacyClassesInMarkup() throws IOException {
        Pattern cls = Pattern.compile("class=\"([^\"]*)\"");
        for (String page : migrated()) {
            Set<String> forbidden = forbiddenClasses(page);
            Matcher m = cls.matcher(withoutScripts(WebThemeTokensAssetTest.read(LOCAL + page)));
            while (m.find()) {
                for (String c : words(m.group(1))) {
                    assertFalse(page + " still uses ." + c, forbidden.contains(c));
                }
            }
        }
    }

    @Test
    public void pageScriptsUseNoLegacyClasses() throws IOException {
        // Built markup only: class="…" strings and className assignments. classList toggles are
        // state flags (good / warn / soc-low …) and stay out of this check.
        List<Pattern> patterns = Arrays.asList(
                Pattern.compile("class=\\\\?\"([^\"\\\\]*)\\\\?\""),
                Pattern.compile("className\\s*=\\s*'([^']*)'"),
                Pattern.compile("className\\s*=\\s*\"([^\"]*)\""));
        for (String page : migrated()) {
            Set<String> forbidden = forbiddenClasses(page);
            String js = scripts(page, WebThemeTokensAssetTest.read(LOCAL + page));
            for (Pattern p : patterns) {
                Matcher m = p.matcher(js);
                while (m.find()) {
                    for (String c : words(m.group(1).replaceAll("'\\s*\\+.*", ""))) {
                        assertFalse(page + " script still builds ." + c, forbidden.contains(c));
                    }
                }
            }
        }
    }
}
