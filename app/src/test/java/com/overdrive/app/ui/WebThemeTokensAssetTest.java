package com.overdrive.app.ui;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/** Contract for the owner-approved web palette (docs/superpowers/specs/2026-11-16-web-theme-redesign-design.md). */
public class WebThemeTokensAssetTest {

    private static final String TOKENS = "app/src/main/assets/web/shared/design-tokens.css";
    private static final Pattern TOKEN = Pattern.compile("(--[a-z0-9-]+)\\s*:\\s*([^;]+);");

    @Test
    public void lightAndDarkPalettesMatchTheMockup() throws IOException {
        Map<String, String> light = tokens(block(read(TOKENS), ":root[data-theme=\"light\"] {"));
        Map<String, String> dark = tokens(block(read(TOKENS), ":root {"));
        expect(light, dark, "--surface-container", "#ffffff", "#242627");
        expect(light, dark, "--background", "#f4f6f8", "#191a1b");
        expect(light, dark, "--on-surface", "#182431", "#f5f3f0");
        expect(light, dark, "--on-surface-variant", "#667180", "#b7b7b4");
        expect(light, dark, "--outline-variant", "#e5e9ef", "#3c3e40");
        expect(light, dark, "--primary", "#db4f1c", "#ff8068");
        expect(light, dark, "--primary-text", "#c2410c", "#ff8068");
        expect(light, dark, "--primary-container", "#fff0e9", "#3c2b28");
        expect(light, dark, "--status-success", "#257355", "#89c9aa");
        expect(light, dark, "--status-danger", "#bd3e37", "#ffa49a");
        expect(light, dark, "--hero", "#edf1f5", "#2b2e2f");
        expect(light, dark, "--chart-2", "#a4b3c4", "#a1a5a5");
        expect(light, dark, "--chart-3", "#d7dfe8", "#626767");
    }

    @Test
    public void everyLightTokenHasADarkValue() throws IOException {
        Map<String, String> light = tokens(block(read(TOKENS), ":root[data-theme=\"light\"] {"));
        Map<String, String> dark = tokens(block(read(TOKENS), ":root {"));
        for (String name : light.keySet()) {
            assertTrue(name + " is themed for light but has no dark value", dark.containsKey(name));
        }
    }

    @Test
    public void interIsBundledAndLocal() throws IOException {
        String tokens = read(TOKENS);
        assertTrue(tokens.contains("--family-sans: 'Inter', system-ui"));
        assertTrue(tokens.contains("src: url(\"fonts/InterVariable.woff2\") format(\"woff2\")"));
        assertTrue(Files.isRegularFile(locate("app/src/main/assets/web/shared/fonts/InterVariable.woff2")));
        assertTrue(Files.isRegularFile(locate("app/src/main/assets/web/shared/fonts/OFL.txt")));
    }

    @Test
    public void embedSizesKept() throws IOException {
        Map<String, String> embed = tokens(block(read(TOKENS), ":root[data-android-embed=\"1\"] {"));
        assertEquals("56px", embed.get("--target"));
    }

    @Test
    public void smallAccentTextUsesPrimaryText() throws IOException {
        Map<String, String> light = tokens(block(read(TOKENS), ":root[data-theme=\"light\"] {"));
        String text = light.get("--primary-text");
        assertNotNull(text);
        assertTrue("small orange text needs 4.5:1 on white",
                contrast(text.substring(1), "ffffff") >= 4.5);
    }

    @Test
    public void cardsAreSolid() throws IOException {
        String tokens = read(TOKENS);
        assertFalse(tokens.contains("backdrop-filter"));
        for (String block : new String[]{":root {", ":root[data-theme=\"light\"] {"}) {
            Map<String, String> values = tokens(block(tokens, block));
            for (String name : new String[]{"--tile", "--tile-raised", "--surface",
                    "--surface-container", "--surface-container-high", "--background"}) {
                String value = values.get(name);
                assertNotNull(name + " missing in " + block, value);
                assertFalse(name + " must be solid in " + block, value.contains("rgba("));
            }
        }
    }

    private static void expect(Map<String, String> light, Map<String, String> dark,
                               String name, String lightValue, String darkValue) {
        assertEquals("light " + name, lightValue, lower(light.get(name)));
        assertEquals("dark " + name, darkValue, lower(dark.get(name)));
    }

    private static String lower(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }

    /** Body of the first rule whose selector text is exactly {@code opener}. */
    static String block(String css, String opener) {
        int start = css.indexOf(opener);
        if (start < 0) throw new AssertionError("Missing block " + opener);
        int open = css.indexOf('{', start);
        int depth = 0;
        for (int i = open; i < css.length(); i++) {
            char c = css.charAt(i);
            if (c == '{') depth++;
            if (c == '}' && --depth == 0) return css.substring(open + 1, i);
        }
        throw new AssertionError("Unbalanced block " + opener);
    }

    static Map<String, String> tokens(String body) {
        Map<String, String> out = new LinkedHashMap<>();
        Matcher m = TOKEN.matcher(body);
        while (m.find()) out.put(m.group(1), m.group(2).trim());
        return out;
    }

    private static double contrast(String first, String second) {
        double a = luminance(first);
        double b = luminance(second);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }

    private static double luminance(String hex) {
        int value = Integer.parseInt(hex, 16);
        return 0.2126 * channel((value >> 16) & 0xff)
                + 0.7152 * channel((value >> 8) & 0xff)
                + 0.0722 * channel(value & 0xff);
    }

    private static double channel(int value) {
        double n = value / 255.0;
        return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }

    static String read(String relativePath) throws IOException {
        return new String(Files.readAllBytes(locate(relativePath)), StandardCharsets.UTF_8);
    }

    static Path locate(String relativePath) {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            Path direct = current.resolve(relativePath);
            if (Files.exists(direct)) return direct;
            Path fromModule = current.resolve(relativePath.replaceFirst("^app/", ""));
            if (Files.exists(fromModule)) return fromModule;
            current = current.getParent();
        }
        throw new AssertionError("Could not locate repository path: " + relativePath);
    }
}
