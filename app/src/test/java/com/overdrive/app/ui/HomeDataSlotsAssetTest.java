package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import org.junit.Test;

/** Live data reaches the new home layout; nothing is invented when data is missing. */
public class HomeDataSlotsAssetTest {

    private static final String PAGE = "app/src/main/assets/web/local/index.html";

    @Test
    public void summaryPrefersTheBriefThenTheDriveState() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        assertTrue(page.contains("renderHomeSummary: function(brief, stateLine)"));
        assertTrue("AI brief feeds the summary", page.contains("this.renderHomeSummary(text, null);"));
        assertTrue("drive state feeds the summary", page.contains("this.renderHomeSummary(null, stateLine);"));
        assertTrue("brief wins over the state line",
                page.contains("var line = this.homeBrief || this.homeStateLine;"));
    }

    @Test
    public void summaryKeepsTheTranslatedDefaultWithoutData() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        assertTrue(page.contains("if (!line) return;"));
    }

    @Test
    public void optionalSlotsStartHidden() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        assertTrue(page.contains("id=\"dashFuelMetric\" style=\"display:none\""));
        assertTrue(page.contains("id=\"dashOdoMetric\" style=\"display:none\""));
        assertTrue(page.contains("id=\"dashGlanceCharge\" hidden"));
        assertTrue(page.contains("id=\"dashGlanceFuel\" hidden"));
        assertTrue(page.contains("id=\"dashRangeIntel\" hidden"));
    }

    @Test
    public void noInventedValues() throws IOException {
        String markup = WebThemeTokensAssetTest.read(PAGE);
        markup = markup.substring(0, markup.indexOf("<style>"));
        for (String sample : new String[]{"341 km", "82%", "2.5 bar", "24°C", "48 km"}) {
            assertFalse("sample value in markup: " + sample, markup.contains(sample));
        }
    }
}
