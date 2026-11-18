package com.overdrive.app.ui;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.Test;

/** Accessibility floor for the web UI served to the car WebView and to phone browsers (U1). */
public class WebAccessibilityAssetTest {

    private static final String LOCAL = "app/src/main/assets/web/local";
    private static final String SHARED = "app/src/main/assets/web/shared";

    @Test
    public void developmentTestPageIsNotShipped() {
        Path local = WebThemeTokensAssetTest.locate(LOCAL);
        assertFalse("vehicle-control-3d-test.html is a dev fixture and must not ship in the APK",
                Files.exists(local.resolve("vehicle-control-3d-test.html")));
    }

    /**
     * Pages that keep the zoom lock because a pinch there belongs to the page, not the browser:
     * live-view drags camera overlay chips with document-level touch/pointer handlers over a
     * full-screen camera grid, and vehicle-control's 3D car (OrbitControls) uses pinch to dolly.
     */
    private static final Set<String> ZOOM_LOCKED = new HashSet<>(Arrays.asList(
            "live-view.html", "vehicle-control.html"));

    private static final Pattern VIEWPORT = Pattern.compile("<meta\\s+name=\"viewport\"\\s+content=\"([^\"]*)\"");

    @Test
    public void pagesLetPhoneUsersPinchZoom() throws IOException {
        List<String> locked = new ArrayList<>();
        for (Path page : pages()) {
            String name = page.getFileName().toString();
            Matcher m = VIEWPORT.matcher(read(page));
            assertTrue(name + " has no viewport meta", m.find());
            String content = m.group(1).replace(" ", "");
            if (content.contains("user-scalable=no") || content.contains("user-scalable=0")
                    || content.matches(".*maximum-scale=1(\\.0)?(,.*|$)")) {
                locked.add(name);
            }
        }
        assertEquals("only gesture-owning pages may block pinch-zoom",
                new TreeSet<>(ZOOM_LOCKED), new TreeSet<>(locked));
    }

    /**
     * Rules that may still say `outline: none` because the same focus state draws its own visible
     * indicator (accent border/ring, ::after ring, wrapper ring), or because the element is a
     * dialog container that only takes programmatic focus while its controls carry the ring.
     * Selectors containing `:not(:focus-visible)` (pointer-focus suppression) are always allowed.
     */
    private static final Set<String> CUSTOM_FOCUS = new HashSet<>(Arrays.asList(
            "pages/abrp.css body[data-page=\"abrp\"] .token-input-row input:focus",
            "pages/assistant.css body[data-page=\"assistant\"] .ai-composer textarea:focus",
            "pages/charging.css body[data-page=\"charging\"] .ch-field:focus-within input:focus",
            "pages/charging.css body[data-page=\"charging\"] .ch-text-field:focus",
            "pages/events.css body[data-page=\"events\"] .place-search input:focus",
            "pages/login.css body[data-page=\"login\"] .form-input",
            "pages/network.css body[data-page=\"network\"] .hs-field input:focus",
            "pages/notifications.css body[data-page=\"notifications\"] .notif-num:focus",
            "pages/recording.css body[data-page=\"recording\"] .rec-hero-today > .link-value:focus",
            "pages/trips.css body[data-page=\"trips\"] .trip-open:focus",
            "pages/trips.css body[data-page=\"trips\"] .range-cal-card:focus",
            "automations.css .automations-sort-select:focus",
            "automations.css .form-grid select:focus",
            "automations.css .form-grid input.time:focus",
            "communicate.css .ptt-button",
            "community-automations.css .community-search-input:focus",
            "community-automations.css .community-sort-select:focus",
            "community-automations.css .community-publish-input:focus",
            "remote-access.css .ra-number-wrap input:focus",
            "styles.css .text-input",
            "styles.css .slider",
            "styles.css .select-control",
            "styles.css .lang-sheet-search input:focus",
            "timeline-view.css .tlv-menu:focus, .tlv-menu:focus-visible",
            "vehicle-control.css .vc-ambient-slider",
            "vehicle-control.css .vc-time",
            "vehicle-control.css .vc-color-hex",
            "widget-builder/builder.css .wb-select:focus"));

    private static final Pattern OUTLINE_OFF =
            Pattern.compile("(?<![-\\w])outline\\s*:\\s*(?:none|0)(?![\\w.%])");

    @Test
    public void outlineIsOnlyRemovedWhereAnotherFocusStyleShows() throws IOException {
        Path shared = WebThemeTokensAssetTest.locate(SHARED);
        List<Path> sheets;
        try (Stream<Path> files = Files.walk(shared)) {
            sheets = files.filter(p -> p.toString().endsWith(".css"))
                    .filter(p -> !p.toString().contains("vendor"))
                    .filter(p -> !p.getFileName().toString().equals("leaflet.css"))
                    .collect(Collectors.toList());
        }
        Set<String> offenders = new TreeSet<>();
        for (Path sheet : sheets) {
            String rel = shared.relativize(sheet).toString().replace('\\', '/');
            for (String selector : outlineOffSelectors(read(sheet))) {
                if (selector.contains(":not(:focus-visible)")) continue;
                String key = rel + " " + selector;
                if (!CUSTOM_FOCUS.contains(key)) offenders.add(key);
            }
        }
        for (Path page : pages()) {
            for (String selector : outlineOffSelectors(read(page))) {
                if (!selector.contains(":not(:focus-visible)")) offenders.add(page.getFileName() + " " + selector);
            }
        }
        assertTrue("outline removed with no visible replacement focus style: " + offenders, offenders.isEmpty());
    }

    @Test
    public void focusRingsReachChrome58() throws IOException {
        // :focus-visible alone is dropped by the head-unit WebView, so these rings use :focus.
        String ptt = WebThemeTokensAssetTest.read(SHARED + "/communicate.css");
        assertTrue(ptt.contains(".ptt-button:focus {"));
        assertFalse(ptt.contains(".ptt-button:focus-visible {"));
        String vc = WebThemeTokensAssetTest.read(SHARED + "/vehicle-control.css");
        assertTrue(vc.contains(".vc-ambient-slider:focus { outline: 2px solid var(--primary);"));
        String base = WebThemeTokensAssetTest.read(SHARED + "/styles.css");
        assertTrue(base.contains("button:focus,\na:focus,\ninput:focus,"));
    }

    /** Selector of every rule that turns the outline off. */
    static List<String> outlineOffSelectors(String css) {
        String text = css.replaceAll("(?s)/\\*.*?\\*/", " ");
        List<String> selectors = new ArrayList<>();
        Matcher m = OUTLINE_OFF.matcher(text);
        while (m.find()) {
            int open = text.lastIndexOf('{', m.start());
            int start = Math.max(Math.max(text.lastIndexOf('}', open - 1), text.lastIndexOf('{', open - 1)),
                    text.lastIndexOf(';', open - 1));
            String selector = text.substring(start + 1, open).trim().replaceAll("\\s+", " ");
            int styleTag = selector.lastIndexOf("<style>");
            if (styleTag >= 0) selector = selector.substring(styleTag + 7).trim();
            selectors.add(selector);
        }
        return selectors;
    }

    private static List<Path> pages() throws IOException {
        try (Stream<Path> files = Files.list(WebThemeTokensAssetTest.locate(LOCAL))) {
            return files.filter(p -> p.toString().endsWith(".html")).sorted().collect(Collectors.toList());
        }
    }

    private static String read(Path path) throws IOException {
        return new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
    }
}
