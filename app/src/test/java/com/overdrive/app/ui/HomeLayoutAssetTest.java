package com.overdrive.app.ui;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/** Browser home page follows the approved mockup layout with every live widget merged in. */
public class HomeLayoutAssetTest {

    private static final String PAGE = "app/src/main/assets/web/local/index.html";

    @Test
    public void mockupSectionsInOrder() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        String[] order = {"homeHeading", "homeVehicle", "homeControls", "homeStats",
                "homeEnergy", "homeActivity", "homeLocationStrip"};
        int last = -1;
        for (String id : order) {
            int at = page.indexOf("id=\"" + id + "\"");
            assertTrue(id + " missing", at >= 0);
            assertTrue(id + " out of order", at > last);
            last = at;
        }
    }

    @Test
    public void everyScriptedIdSurvives() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        for (String id : new String[]{"dashDriveState", "dashDrivePower", "dashDriveMode",
                "dashDriveGear", "dashDriveSpeed", "dashHeroSoc", "dashHeroRange", "dashSoc",
                "dashRange", "dashFuelMetric", "dash12v", "dashAcc", "dashNetwork",
                "dashBluetoothMetric", "dashLock", "dashOdoMetric", "dashGlance", "glLockText",
                "glTyresText", "dashGlanceCharge", "dashAiInsight", "dashHeroSubtitle",
                "dashPills", "dashChargeChip", "dashChargePower", "dashChargeKwh",
                "dashChargeTtf", "mapContainer"}) {
            assertEquals(id + " must appear exactly once", 1, count(page, "id=\"" + id + "\""));
        }
    }

    @Test
    public void mergedSlotsLiveInTheirSections() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        assertInside(page, "homeVehicle", "dashDriveState");
        assertInside(page, "homeVehicle", "dashHeroSoc");
        assertInside(page, "homeVehicle", "glTyresText");
        assertInside(page, "homeControls", "dashPills");
        assertInside(page, "homeStats", "dashInfoGrid");
        assertInside(page, "homeEnergy", "dashChargeChip");
        assertInside(page, "homeLocationStrip", "mapContainer");
        assertInside(page, "homeHeading", "dashHeroSubtitle");
    }

    @Test
    public void noDragReorderOnHome() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        assertFalse(page.contains("dash-card-grip"));
        assertFalse(page.contains("overdrive.dashboard.cardOrder"));
    }

    @Test
    public void layoutUsesTokensOnly() throws IOException {
        String page = WebThemeTokensAssetTest.read(PAGE);
        // The page keeps one small <style> block (2026-11-17 rebuild on ui- components).
        int start = page.indexOf("<style>");
        assertTrue("home layout styles missing", start >= 0);
        assertTrue("only one style block", page.indexOf("<style>", start + 1) < 0);
        String css = page.substring(start, page.indexOf("</style>", start));
        Matcher hex = Pattern.compile("#[0-9a-fA-F]{3,8}\\b").matcher(css);
        assertFalse("raw colour in home layout: " + (hex.find() ? hex.group() : ""), hex.find(0));
    }

    private static void assertInside(String page, String sectionId, String childId) {
        int open = page.indexOf("id=\"" + sectionId + "\"");
        assertTrue(sectionId + " missing", open >= 0);
        int tagStart = page.lastIndexOf("<section", open);
        int depth = 0;
        int i = tagStart;
        int end = -1;
        while (i < page.length()) {
            int nextOpen = page.indexOf("<section", i + 1);
            int nextClose = page.indexOf("</section>", i + 1);
            if (nextClose < 0) break;
            if (nextOpen >= 0 && nextOpen < nextClose) {
                depth++;
                i = nextOpen;
            } else {
                if (depth == 0) { end = nextClose; break; }
                depth--;
                i = nextClose;
            }
        }
        assertTrue(sectionId + " not closed", end > 0);
        String body = page.substring(tagStart, end);
        assertTrue(childId + " must sit inside " + sectionId, body.contains("id=\"" + childId + "\""));
    }

    private static int count(String text, String needle) {
        int n = 0;
        for (int i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) n++;
        return n;
    }
}
