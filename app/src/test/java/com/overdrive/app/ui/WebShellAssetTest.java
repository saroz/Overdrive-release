package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import org.junit.Test;

/** Browser shell (sidebar + top bar) follows the owner's mockup, built from ui- components. */
public class WebShellAssetTest {

    private static final String SHELL_JS = "app/src/main/assets/web/shared/app-shell.js";
    private static final String SHELL_CSS_SRC = "web-ui/src/components/shell.css";

    private static String js() throws IOException {
        return WebThemeTokensAssetTest.read(SHELL_JS);
    }

    @Test
    public void sidebarIs240pxAndRendersUiClasses() throws IOException {
        assertTrue(UiCssBuildAssetTest.css().contains("--ui-sidebar-width:240px"));
        assertTrue(js().contains("aside.className = 'ui-sidebar';"));
        assertTrue(js().contains("class=\"ui-nav\""));
    }

    @Test
    public void legacyShellClassesAreGoneFromTheMarkup() throws IOException {
        // The old sheets carry ~290 rules for these names; the new shell must not match them.
        String js = js();
        assertFalse(js.contains("aside.className = 'sidebar'"));
        assertFalse(js.contains("'<div class=\"sidebar-footer\">'"));
        assertFalse(js.contains("var cls = 'nav-link'"));
        assertFalse(js.contains("class=\"nav-group-header\""));
    }

    @Test
    public void navUsesPhosphor() throws IOException {
        String js = js();
        String items = js.substring(js.indexOf("var NAV_ITEMS = ["), js.indexOf("function activeBasename"));
        assertFalse("NAV_ITEMS still carry inline SVG", items.contains("svg: '<"));
        assertTrue(items.contains("icon: 'dashboard'"));
        assertTrue(js.contains("navIcon(item.icon)"));
        assertTrue(js.contains("window.phIcon(name, cls)"));
    }

    @Test
    public void topbarHasBreadcrumbThemeSwitchAndSearch() throws IOException {
        String js = js();
        assertTrue(js.contains("function renderTopbar("));
        assertTrue(js.contains("ui-topbar"));
        assertTrue(js.contains("ui-breadcrumb"));
        assertTrue(js.contains("ui-theme-switch"));
        assertTrue(js.contains("aria-pressed"));
        assertTrue(js.contains("od-search-open"));
    }

    @Test
    public void shellKeepsEveryIdOtherScriptsWrite() throws IOException {
        String js = js();
        for (String id : new String[]{"deviceId", "connDot", "accValue", "batteryValue", "survStatus",
                "networkValue", "networkIcon", "appVersion", "evCard", "evPercentValue", "evRange", "evPower",
                "evSohRow", "evSohValue", "evPersonalizedRow", "evPersonalizedRange", "evCombinedRow",
                "evCombinedRange", "evBatteryBar", "evBatteryFill", "fuelCard", "fuelPercentValue",
                "fuelBarFill", "fuelPersonalizedRow", "fuelPersonalizedRange"}) {
            assertTrue(id + " missing from the shell", js.contains("id=\"" + id + "\""));
        }
    }

    @Test
    public void breakpointsMatchMockup() throws IOException {
        String css = UiCssBuildAssetTest.css();
        assertTrue(css.contains("(max-width:1150px)"));
        assertTrue(css.contains("(max-width:850px)"));
        assertTrue(css.contains("(max-width:540px)"));
    }

    @Test
    public void phonesGetABottomBarWithMore() throws IOException {
        assertTrue(js().contains("ui-bottom-nav"));
        UiComponentsAssetTest.assertRule(".ui-bottom-nav", "position:fixed");
    }

    @Test
    public void embeddedHidesShellChrome() throws IOException {
        String css = UiCssBuildAssetTest.css();
        assertTrue(css.contains("html[data-android-embed=\"1\"] .ui-sidebar"));
        assertTrue(css.contains("html[data-android-embed=\"1\"] .ui-topbar"));
        assertTrue(css.contains("html[data-android-embed=\"1\"] .ui-bottom-nav"));
    }

    @Test
    public void embeddedHidesThePageHeadingTheNativeBarAlreadyShows() throws IOException {
        // WebViewFragment hid .page-header ("kills the duplicate title"); the heading is ui-page-head now.
        UiComponentsAssetTest.assertRule("html[data-android-embed=\"1\"] .ui-page-head", "display:none!important");
    }

    @Test
    public void shellHelpersTargetTheNewVocabulary() throws IOException {
        String js = js();
        assertTrue("switch names", js.contains("root.querySelectorAll('.ui-toggle input')"));
        assertFalse(js.contains("querySelectorAll('.toggle-switch input')"));
        String tabs = WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/app-tabs.js");
        assertTrue("tabs sit above the page body, under the summary tile",
                tabs.contains("main.querySelector('.ui-page-body, .page-body')"));
    }

    @Test
    public void collapsedGroupsLeaveTheLayout() throws IOException {
        UiComponentsAssetTest.assertRule(".ui-nav [hidden]", "display:none!important");
    }

    @Test
    public void shellUsesLogicalProperties() throws IOException {
        String shell = WebThemeTokensAssetTest.read(SHELL_CSS_SRC);
        assertTrue(shell.contains("border-inline-end: 1px solid var(--ui-line)"));
        assertFalse("sidebar edge must mirror in RTL", shell.contains("border-right:"));
    }

    @Test
    public void shellChromeSkipsTheNativeApp() throws IOException {
        assertTrue(js().contains("if (!embeddedInNativeApp) renderTopbar("));
    }

    @Test
    public void everyPageLoadsUiCssAndIcons() throws IOException {
        File dir = WebThemeTokensAssetTest.locate("app/src/main/assets/web/local").toFile();
        for (File page : dir.listFiles()) {
            String name = page.getName();
            if (!name.endsWith(".html")) continue;
            String html = WebThemeTokensAssetTest.read("app/src/main/assets/web/local/" + name);
            assertTrue(name + " lacks ui.css", html.contains("href=\"../shared/ui.css?v="));
            assertTrue(name + " lacks ph-icons.js", html.contains("src=\"../shared/ph-icons.js?v="));
        }
    }

    @Test
    public void otherScriptsUseTheNewShellHooks() throws IOException {
        String update = WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/update-flow.js");
        assertTrue(update.contains("document.querySelector('[data-sidebar-nav]')"));
        String lang = WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/lang-picker.js");
        assertTrue(lang.contains("document.querySelector('.ui-sidebar-foot')"));
    }
    @Test
    public void sidebarNeverScrollsSidewaysAndOnlyTheMenuScrolls() throws IOException {
        UiComponentsAssetTest.assertRule(".ui-sidebar", "overflow:hidden");
        UiComponentsAssetTest.assertRule(".ui-nav", "overflow-x:hidden", "overflow-y:auto");
        // Long values such as the device id wrap instead of widening the block.
        UiComponentsAssetTest.assertRule(".ui-sidebar-status dd", "min-width:0", "word-break:break-all");
    }

    @Test
    public void menuScrollbarIsThinAndShowsOnlyOnHoverOrScroll() throws IOException {
        UiComponentsAssetTest.assertRule(".ui-nav::-webkit-scrollbar-thumb", "background:0 0"); // minified "transparent"
        UiComponentsAssetTest.assertRule(".ui-nav.is-scrolling::-webkit-scrollbar-thumb", "background:var(--ui-line)");
        assertTrue(js().contains("nav.classList.add('is-scrolling');"));
    }

    @Test
    public void everyGroupFoldsAndLabelsAreUppercase() throws IOException {
        String js = js();
        assertFalse("Overview and Vehicle fold too", js.contains("var PLAIN = {"));
        assertTrue(js.contains("var OPEN_BY_DEFAULT = { 'nav.overview_group': 1, 'nav.vehicle_group': 1 };"));
        UiComponentsAssetTest.assertRule(".ui-nav-label", "text-transform:uppercase", "color:var(--ui-ink)");
    }

    @Test
    public void languageAndVehicleMenuSitInTheTopBarAfterTheThemeSwitch() throws IOException {
        String js = js();
        int theme = js.indexOf("data-theme-choice=\"dark\"");
        int lang = js.indexOf("data-lang-slot");
        int car = js.indexOf("id=\"vehicleMenuButton\"");
        assertTrue(theme > 0 && lang > theme && car > lang);
        assertTrue(js.contains("'<div class=\"ui-vehicle-panel\" id=\"vehicleMenuPanel\" hidden>' + buildVehicleStatus()"));
        // Inside the native app there is no top bar: the status ids still exist in the sidebar.
        assertTrue(js.contains("foot.insertAdjacentHTML('afterbegin', buildVehicleStatus());"));
        String lang2 = WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/lang-picker.js");
        assertTrue(lang2.contains("document.querySelector('[data-lang-slot]')"));
    }
}
