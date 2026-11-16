package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import org.junit.Test;

/** Owner rule: no data to anybody — pages load their code from the car, never from a CDN. */
public class WebAssetsStayLocalAssetTest {

    @Test
    public void liveViewLoadsJmuxerFromTheApp() throws IOException {
        String page = WebThemeTokensAssetTest.read("app/src/main/assets/web/local/live-view.html");
        assertFalse(page.contains("cdn.jsdelivr.net"));
        assertTrue(page.contains("src=\"../shared/vendor/jmuxer.min.js\""));
        assertTrue(Files.isRegularFile(
                WebThemeTokensAssetTest.locate("app/src/main/assets/web/shared/vendor/jmuxer.min.js")));
    }
}
