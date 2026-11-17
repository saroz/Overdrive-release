package com.overdrive.app.ui;

import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/**
 * Shared scripts must not look elements up by an old class name that no page or script writes
 * any more (2026-11-17 rebuild renamed them): such a lookup silently finds nothing — dead
 * settings search, unnamed switches, misplaced tabs.
 */
public class ScriptSelectorsAssetTest {

    private static final String WEB = "app/src/main/assets/web/";
    private static final Pattern WRITTEN = Pattern.compile(
            "class=\\\\?\"([^\"\\\\]*)\\\\?\"|className\\s*=\\s*'([^']*)'|className\\s*=\\s*\"([^\"]*)\""
                    + "|classList\\.(?:add|toggle)\\(\\s*'([\\w-]+)'");
    private static final Pattern LOOKUP = Pattern.compile(
            "(?:querySelector(?:All)?|closest|matches)\\(\\s*'([^']*)'");

    private static List<File> files(String dir, String ext) {
        List<File> out = new ArrayList<>();
        File[] list = WebThemeTokensAssetTest.locate(WEB + dir).toFile().listFiles();
        if (list != null) for (File f : list) if (f.getName().endsWith(ext)) out.add(f);
        return out;
    }

    private static String text(File f) throws IOException {
        return new String(java.nio.file.Files.readAllBytes(f.toPath()), java.nio.charset.StandardCharsets.UTF_8);
    }

    @Test
    public void lookupsOnlyUseClassesThatAreStillWritten() throws IOException {
        Set<String> written = new HashSet<>();
        List<File> sources = files("local", ".html");
        sources.addAll(files("shared", ".js"));
        for (File f : sources) {
            Matcher m = WRITTEN.matcher(text(f));
            while (m.find()) {
                for (int g = 1; g <= 4; g++) {
                    if (m.group(g) == null) continue;
                    for (String c : m.group(g).replaceAll("'\\s*\\+.*", "").split("\\s+")) written.add(c);
                }
            }
        }
        Set<String> legacy = new HashSet<>();
        for (String c : WebThemeTokensAssetTest.read("web-ui/legacy-classes.txt").split("\\s+")) legacy.add(c);

        List<String> dead = new ArrayList<>();
        for (File f : files("shared", ".js")) {
            Matcher m = LOOKUP.matcher(text(f));
            while (m.find()) {
                Matcher c = Pattern.compile("\\.(-?[_a-zA-Z][\\w-]*)").matcher(m.group(1));
                while (c.find()) {
                    String cls = c.group(1);
                    if (legacy.contains(cls) && !written.contains(cls)) dead.add(f.getName() + ": " + m.group(1));
                }
            }
        }
        assertTrue(dead.size() + " lookups of classes nothing writes: " + dead, dead.isEmpty());
    }
}
