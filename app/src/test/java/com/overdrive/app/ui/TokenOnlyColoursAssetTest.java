package com.overdrive.app.ui;

import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/** Page styles take colours from design tokens; raw hex is allowed only as a var() fallback. */
public class TokenOnlyColoursAssetTest {

    private static final Pattern HEX = Pattern.compile("#[0-9a-fA-F]{3,8}\\b");
    private static final Pattern VAR_FALLBACK_OPEN = Pattern.compile("var\\(\\s*--[\\w-]+\\s*,\\s*[^()]*$");
    private static final Pattern STYLE = Pattern.compile("(?s)<style[^>]*>(.*?)</style>");

    @Test
    public void heavyPagesUseTokens() throws IOException {
        List<String> offenders = new ArrayList<>();
        for (String page : new String[]{"trips.html", "events.html", "charging.html",
                "live-view.html", "notifications.html", "performance.html"}) {
            String html = WebThemeTokensAssetTest.read("app/src/main/assets/web/local/" + page);
            for (String hex : rawHexOutsideVarFallback(styles(html))) offenders.add(page + " " + hex);
        }
        assertTrue("raw colours: " + offenders, offenders.isEmpty());
    }

    /** Content colours (colour-wheel/paint swatches, a test page, the dev screen mirror) are not theme. */
    private static final java.util.Set<String> EXEMPT = new java.util.HashSet<>(java.util.Arrays.asList(
            "design-tokens.css", "leaflet.css", "vehicle-control.css",
            "vehicle-control-3d-test.html", "remote-dev-view.html"));

    @Test
    public void allWebStylesUseTokens() throws IOException {
        java.nio.file.Path web = WebThemeTokensAssetTest.locate("app/src/main/assets/web");
        List<String> offenders = new ArrayList<>();
        for (String dir : new String[]{"local", "shared"}) {
            try (java.util.stream.Stream<java.nio.file.Path> files = java.nio.file.Files.list(web.resolve(dir))) {
                for (java.nio.file.Path path : (Iterable<java.nio.file.Path>) files::iterator) {
                    String name = path.getFileName().toString();
                    boolean html = name.endsWith(".html");
                    if (!(html || name.endsWith(".css")) || EXEMPT.contains(name)) continue;
                    String text = new String(java.nio.file.Files.readAllBytes(path),
                            java.nio.charset.StandardCharsets.UTF_8);
                    String css = (html ? styles(text) : text).replaceAll("(?s)/\\*.*?\\*/", "");
                    for (String hex : rawHexInDeclarations(css)) offenders.add(dir + "/" + name + " " + hex);
                }
            }
        }
        assertTrue("raw colours outside token definitions: " + offenders, offenders.isEmpty());
    }

    /** Raw hex used in an ordinary declaration: not a var() fallback and not a --custom-property definition. */
    static List<String> rawHexInDeclarations(String css) {
        List<String> found = new ArrayList<>();
        Matcher m = HEX.matcher(css);
        while (m.find()) {
            String before = css.substring(Math.max(0, m.start() - 200), m.start());
            if (VAR_FALLBACK_OPEN.matcher(before).find()) continue;
            int declStart = Math.max(css.lastIndexOf(';', m.start()), css.lastIndexOf('{', m.start())) + 1;
            if (css.substring(declStart, m.start()).trim().startsWith("--")) continue;
            found.add(m.group());
        }
        return found;
    }

    @Test
    public void performanceChartSeriesFollowTheLegendTokens() throws IOException {
        String js = WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/performance.js");
        assertTrue(js.contains("this.colors.system = pick('--primary', this.colors.system);"));
        assertTrue(js.contains("this.colors.app = pick('--tertiary', this.colors.app);"));
        assertTrue(js.contains("this.colors.gpu = pick('--chart-2', this.colors.gpu);"));
        assertTrue(js.contains("this.colors.soc = pick('--status-success', this.colors.soc);"));
        assertTrue(js.contains("this.colors.charging = pick('--status-info', this.colors.charging);"));
    }

    static String styles(String html) {
        StringBuilder out = new StringBuilder();
        Matcher m = STYLE.matcher(html);
        while (m.find()) out.append(m.group(1)).append('\n');
        return out.toString();
    }

    /** Each #rgb / #rrggbb / #rrggbbaa that is not inside a var(--name, …) fallback. */
    static List<String> rawHexOutsideVarFallback(String css) {
        List<String> found = new ArrayList<>();
        Matcher m = HEX.matcher(css);
        while (m.find()) {
            String before = css.substring(Math.max(0, m.start() - 200), m.start());
            if (VAR_FALLBACK_OPEN.matcher(before).find()) continue;
            found.add(m.group());
        }
        return found;
    }
}
