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

    private static List<Path> pages() throws IOException {
        try (Stream<Path> files = Files.list(WebThemeTokensAssetTest.locate(LOCAL))) {
            return files.filter(p -> p.toString().endsWith(".html")).sorted().collect(Collectors.toList());
        }
    }

    private static String read(Path path) throws IOException {
        return new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
    }
}
