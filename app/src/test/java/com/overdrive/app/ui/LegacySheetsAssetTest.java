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
 * After every page moved to the ui- components (2026-11-17), the old shared sheets may only keep
 * rules that can still match: a rule whose selectors each name a class no page or script writes
 * any more is dead weight and must be gone.
 */
public class LegacySheetsAssetTest {

    private static final String WEB = "app/src/main/assets/web/";
    private static final String[] SHEETS = {"shared/styles.css", "shared/revamp.css", "shared/app-shell.css",
            "shared/app-tabs.css", "shared/app-collapse.css"};

    /** Every word that appears in a page or a script: a class can only be applied if its name does. */
    static Set<String> wordsInUse() throws IOException {
        Set<String> words = new HashSet<>();
        Pattern word = Pattern.compile("[A-Za-z_][\\w-]*");
        List<File> files = new ArrayList<>();
        collect(WebThemeTokensAssetTest.locate(WEB + "local").toFile(), files);
        collect(WebThemeTokensAssetTest.locate(WEB + "shared").toFile(), files);
        for (File f : files) {
            String n = f.getName();
            if (!n.endsWith(".html") && !n.endsWith(".js")) continue;
            Matcher m = word.matcher(new String(java.nio.file.Files.readAllBytes(f.toPath()),
                    java.nio.charset.StandardCharsets.UTF_8));
            while (m.find()) {
                String w = m.group();
                words.add(w);
                // 'sev-' + level style concatenations keep every 'sev-…' class alive.
                if (w.endsWith("-")) words.add(w);
            }
        }
        return words;
    }

    private static void collect(File dir, List<File> out) {
        File[] list = dir.listFiles();
        if (list == null) return;
        for (File f : list) {
            if (f.isDirectory()) {
                if (!f.getName().equals("vendor")) collect(f, out);
            } else {
                out.add(f);
            }
        }
    }

    static boolean classInUse(String cls, Set<String> words) {
        if (words.contains(cls)) return true;
        for (int i = cls.indexOf('-'); i > 0; i = cls.indexOf('-', i + 1)) {
            if (words.contains(cls.substring(0, i + 1))) return true;
        }
        return false;
    }

    /** True when the selector can still match: every class it names is still written somewhere. */
    static boolean selectorAlive(String selector, Set<String> words) {
        Matcher c = Pattern.compile("\\.(-?[_a-zA-Z][\\w-]*)").matcher(selector);
        while (c.find()) {
            if (!classInUse(c.group(1), words)) return false;
        }
        return true;
    }

    @Test
    public void oldSheetsOnlyKeepRulesThatCanStillMatch() throws IOException {
        Set<String> words = wordsInUse();
        List<String> dead = new ArrayList<>();
        Pattern rule = Pattern.compile("([^{}@;]+)\\{[^{}]*\\}");
        for (String sheet : SHEETS) {
            String css = WebThemeTokensAssetTest.read(WEB + sheet).replaceAll("(?s)/\\*.*?\\*/", "");
            Matcher r = rule.matcher(css);
            while (r.find()) {
                String head = r.group(1).trim();
                if (head.isEmpty() || head.matches("(?s)(from|to|[\\d.%\\s,]+)")) continue; // keyframe steps
                boolean anyAlive = false;
                for (String sel : head.split(",")) anyAlive |= selectorAlive(sel, words);
                if (!anyAlive) dead.add(sheet + ": " + head.replaceAll("\\s+", " "));
            }
        }
        assertTrue(dead.size() + " dead rules, e.g. " + (dead.isEmpty() ? "" : dead.subList(0, Math.min(5, dead.size()))),
                dead.isEmpty());
    }
}
