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

    private static Set<String> forbiddenClasses(String page) throws IOException {
        Set<String> out = new HashSet<>(words(WebThemeTokensAssetTest.read("web-ui/legacy-classes.txt")));
        out.addAll(words(header(snapshot(page), "old-classes")));
        return out;
    }

    private static String withoutScripts(String html) {
        return html.replaceAll("(?s)<script[^>]*>.*?</script>", "").replaceAll("(?s)<style[^>]*>.*?</style>", "");
    }

    @Test
    public void idsSurvive() throws IOException {
        for (String page : migrated()) {
            String html = WebThemeTokensAssetTest.read(LOCAL + page);
            String js = scripts(page, html);
            for (String line : snapshot(page).split("\n")) {
                String id = line.trim();
                if (id.isEmpty() || id.startsWith("#")) continue;
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
            assertTrue(page + " has no ui-page-head", html.contains("ui-page-head"));
            assertTrue(page + " has no ui-panel", html.contains("ui-panel"));
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
        List<Pattern> patterns = Arrays.asList(
                Pattern.compile("class=\\\\?\"([^\"\\\\]*)\\\\?\""),
                Pattern.compile("className\\s*=\\s*'([^']*)'"),
                Pattern.compile("className\\s*=\\s*\"([^\"]*)\""),
                Pattern.compile("classList\\.(?:add|toggle)\\(\\s*'([^']*)'"));
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
