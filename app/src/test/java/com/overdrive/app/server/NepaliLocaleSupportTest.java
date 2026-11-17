package com.overdrive.app.server;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.parsers.DocumentBuilderFactory;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/** Regression coverage for Nepali (ne) localization across app, desktop web, and server catalogs. */
public class NepaliLocaleSupportTest {

    @Test
    public void nepaliLocaleResolvesCorrectly() {
        assertTrue(LocaleManager.isSupported("ne"));
        assertEquals("ne", LocaleManager.resolve("ne-NP"));
        assertEquals("ne", LocaleManager.fromAcceptLanguage("ne-NP,ne;q=0.9,en;q=0.8"));
        assertNull(LocaleManager.resolveOrNull("../en"));
    }

    @Test
    public void catalogsCoverEveryEnglishKeyAndPreservePlaceholders() throws Exception {
        assertCatalogCoversEnglish(
                "app/src/main/assets/web/i18n/en.json",
                "app/src/main/assets/web/i18n/ne.json");
        assertCatalogCoversEnglish(
                "app/src/main/assets/server-i18n/en.json",
                "app/src/main/assets/server-i18n/ne.json");

        JSONObject webNe = readJson("app/src/main/assets/web/i18n/ne.json");
        JSONObject meta = webNe.getJSONObject("_meta");
        assertEquals("ne", meta.getString("lang"));
        assertEquals("नेपाली", meta.getString("name"));
    }

    @Test
    public void nativeAppBundleHasCompleteResourceKeyParity() throws Exception {
        Path englishDir = repositoryPath("app/src/main/res/values");
        Path nepaliDir = repositoryPath("app/src/main/res/values-ne");

        Set<String> englishStrings = translatableResourceKeys(englishDir, "string");
        Set<String> nepaliStrings = translatableResourceKeys(nepaliDir, "string");
        assertTrue(missingMessage("string", englishStrings, nepaliStrings),
                nepaliStrings.containsAll(englishStrings));

        Set<String> englishPlurals = translatableResourceKeys(englishDir, "plurals");
        Set<String> nepaliPlurals = translatableResourceKeys(nepaliDir, "plurals");
        assertTrue(missingMessage("plurals", englishPlurals, nepaliPlurals),
                nepaliPlurals.containsAll(englishPlurals));

        Set<String> englishArrays = translatableResourceKeys(englishDir, "string-array");
        Set<String> nepaliArrays = translatableResourceKeys(nepaliDir, "string-array");
        assertTrue(missingMessage("string-array", englishArrays, nepaliArrays),
                nepaliArrays.containsAll(englishArrays));
    }

    @Test
    public void appAndDesktopPickersAndLocaleConfigIncludeNepali() throws Exception {
        String core = read("app/src/main/assets/web/shared/core.js");
        assertTrue(core.contains("'he', 'ne'"));
        assertTrue(core.contains("'ne':    'नेपाली'"));
        assertFalse(core.contains("'ne': true"));

        String picker = read("app/src/main/assets/web/shared/lang-picker.js");
        assertTrue(picker.contains("'ne': 'ने'"));

        String kotlinPicker = read("app/src/main/java/com/overdrive/app/ui/dialog/LanguagePickerDialog.kt");
        assertTrue(kotlinPicker.contains("\"ne\" to \"नेपाली\""));

        String appLocaleConfig = read("app/src/main/res/xml/locales_config.xml");
        assertTrue(appLocaleConfig.contains("android:name=\"ne\""));
    }

    @Test
    public void nepaliCatalogsContainNoUpstreamOrPromoUrls() throws Exception {
        String[] paths = {
                "app/src/main/assets/web/i18n/ne.json",
                "app/src/main/assets/server-i18n/ne.json"
        };
        String[] forbidden = {
                "yash-srivastava",
                "overdrive-5lc",
                "overdrive.qd.je",
                "discord.gg",
                "whatsapp.com",
                "ko-fi.com"
        };
        for (String path : paths) {
            String lower = read(path).toLowerCase(Locale.ROOT);
            for (String token : forbidden) {
                assertFalse("Forbidden token '" + token + "' in " + path, lower.contains(token));
            }
        }
        JSONObject webNe = readJson("app/src/main/assets/web/i18n/ne.json");
        assertEquals("https://github.com/saroz/Overdrive-release/issues",
                webNe.getJSONObject("update").getString("report_github_url"));
        assertEquals("", webNe.getJSONObject("update").getString("report_discord_url"));
        assertEquals("", webNe.getJSONObject("update").getString("report_whatsapp_url"));
        assertEquals("https://github.com/saroz/Overdrive-release",
                webNe.getJSONObject("about").getJSONObject("support").getString("star_url"));
        assertEquals("", webNe.getJSONObject("about").getJSONObject("support").getString("youtube_url"));
        assertEquals("", webNe.getJSONObject("about").getJSONObject("support").getString("kofi_url"));
    }

    private static void assertCatalogCoversEnglish(String englishPath, String nepaliPath)
            throws Exception {
        JSONObject english = readJson(englishPath);
        JSONObject nepali = readJson(nepaliPath);
        Set<String> englishKeys = new HashSet<>();
        Set<String> nepaliKeys = new HashSet<>();
        collectKeys(english, "", englishKeys);
        collectKeys(nepali, "", nepaliKeys);
        assertTrue(missingMessage("json", englishKeys, nepaliKeys),
                nepaliKeys.containsAll(englishKeys));

        for (String key : englishKeys) {
            Object englishValue = valueAt(english, key);
            Object nepaliValue = valueAt(nepali, key);
            if (englishValue instanceof String && nepaliValue instanceof String) {
                assertEquals("placeholder mismatch at " + key,
                        placeholders((String) englishValue),
                        placeholders((String) nepaliValue));
            }
        }
    }

    private static void collectKeys(Object value, String prefix, Set<String> out) {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                collectKeys(object.opt(key),
                        prefix.isEmpty() ? key : prefix + "." + key, out);
            }
        } else if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value;
            for (int i = 0; i < array.length(); i++) {
                collectKeys(array.opt(i), prefix + "[" + i + "]", out);
            }
        } else {
            out.add(prefix);
        }
    }

    private static Object valueAt(JSONObject root, String dotted) {
        Object current = root;
        String[] parts = dotted.split("\\.");
        for (String part : parts) {
            if (!(current instanceof JSONObject)) return null;
            current = ((JSONObject) current).opt(part);
        }
        return current;
    }

    private static Set<String> placeholders(String value) {
        Set<String> found = new HashSet<>();
        Matcher matcher = Pattern.compile(
                "\\$?\\{[^{}]+\\}|%\\d+\\$[a-zA-Z]").matcher(value);
        while (matcher.find()) found.add(matcher.group());
        return found;
    }

    private static Set<String> translatableResourceKeys(Path directory, String tagName)
            throws Exception {
        Set<String> keys = new HashSet<>();
        try (java.util.stream.Stream<Path> files = Files.list(directory)) {
            for (Path file : (Iterable<Path>) files
                    .filter(path -> path.toString().endsWith(".xml"))::iterator) {
                NodeList nodes = DocumentBuilderFactory.newInstance()
                        .newDocumentBuilder().parse(file.toFile())
                        .getElementsByTagName(tagName);
                for (int i = 0; i < nodes.getLength(); i++) {
                    Node node = nodes.item(i);
                    if (!(node instanceof Element)) continue;
                    Element element = (Element) node;
                    if ("false".equals(element.getAttribute("translatable"))) continue;
                    String name = element.getAttribute("name");
                    if (!name.isEmpty()) keys.add(name);
                }
            }
        }
        return keys;
    }

    private static String missingMessage(String kind, Set<String> expected, Set<String> actual) {
        Set<String> missing = new HashSet<>(expected);
        missing.removeAll(actual);
        return "Missing translated " + kind + " keys (" + missing.size() + "): " + missing;
    }

    private static JSONObject readJson(String relativePath) throws Exception {
        return new JSONObject(read(relativePath));
    }

    private static String read(String relativePath) throws Exception {
        return new String(
                Files.readAllBytes(repositoryPath(relativePath)),
                StandardCharsets.UTF_8);
    }

    private static Path repositoryPath(String relativePath) {
        Path current = Paths.get(System.getProperty("user.dir"))
                .toAbsolutePath().normalize();
        while (current != null) {
            Path candidate = current.resolve(relativePath);
            if (Files.exists(candidate)) return candidate;
            Path fromModule = current.resolve(relativePath.replaceFirst("^app/", ""));
            if (Files.exists(fromModule)) return fromModule;
            current = current.getParent();
        }
        throw new AssertionError("Could not locate repository path: " + relativePath);
    }
}
