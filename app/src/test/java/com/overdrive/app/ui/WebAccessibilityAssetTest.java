package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;

import java.nio.file.Files;
import java.nio.file.Path;
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
}
