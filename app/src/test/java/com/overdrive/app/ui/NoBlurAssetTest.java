package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.Test;

/** Owner rule: "clean, pixel perfect, no blurry" — no frosted or translucent surfaces. */
public class NoBlurAssetTest {

    @Test
    public void noSurfaceUsesBackdropBlur() throws IOException {
        Path web = WebThemeTokensAssetTest.locate("app/src/main/assets/web");
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> files = Files.walk(web)) {
            for (Path path : files.filter(Files::isRegularFile).collect(Collectors.toList())) {
                String name = path.toString().replace('\\', '/');
                if (!(name.endsWith(".css") || name.endsWith(".html") || name.endsWith(".js"))) continue;
                if (name.contains("/vendor/") || name.contains("/leaflet")) continue;
                String text = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                if (text.contains("backdrop-filter")) offenders.add(web.relativize(path).toString());
            }
        }
        assertTrue("blurred surfaces in: " + offenders, offenders.isEmpty());
    }

    @Test
    public void glassColourIsSolid() throws IOException {
        String styles = WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/styles.css");
        assertFalse(styles.contains("--bg-glass: rgba("));
    }
}
