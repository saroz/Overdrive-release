package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import org.junit.Test;

/** Browser shell (sidebar + top bar) follows the approved mockup. */
public class WebShellAssetTest {

    private static final String SHELL_CSS = "app/src/main/assets/web/shared/app-shell.css";
    private static final String SHELL_JS = "app/src/main/assets/web/shared/app-shell.js";

    @Test
    public void sidebarMatchesMockup() throws IOException {
        String shell = WebThemeTokensAssetTest.read(SHELL_CSS);
        assertTrue(shell.contains("--sidebar-width: 208px"));
        assertFalse("gradient accent stripe is gone", shell.contains(".sidebar::before"));
        assertTrue(shell.contains("background: var(--primary-container)"));
        assertTrue(shell.contains("color: var(--primary-text)"));
        assertTrue(shell.contains("border-radius: var(--radius-control)"));
    }

    @Test
    public void topbarHasBreadcrumbAndThemeSwitch() throws IOException {
        String shell = WebThemeTokensAssetTest.read(SHELL_CSS);
        String js = WebThemeTokensAssetTest.read(SHELL_JS);
        assertTrue(js.contains("function renderTopbar("));
        assertTrue(js.contains("shell-breadcrumb"));
        assertTrue(js.contains("shell-theme-switch"));
        assertTrue(js.contains("aria-pressed"));
        assertTrue(shell.contains(".shell-topbar {"));
        assertTrue(shell.contains("height: 72px"));
    }

    @Test
    public void breakpointsMatchMockup() throws IOException {
        String shell = WebThemeTokensAssetTest.read(SHELL_CSS);
        assertTrue(shell.contains("(max-width: 1150px)"));
        assertTrue(shell.contains("(max-width: 850px)"));
        assertTrue(WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/app-tabs.css")
                .contains("(max-width: 540px)"));
    }

    @Test
    public void shellUsesLogicalProperties() throws IOException {
        String shell = WebThemeTokensAssetTest.read(SHELL_CSS);
        assertTrue(shell.contains("border-inline-end: 1px solid var(--outline-variant)"));
        String redesign = shell.substring(shell.indexOf("REDESIGN 2026-11-16"));
        assertFalse("sidebar edge must mirror in RTL", redesign.contains("border-right:"));
    }

    @Test
    public void shellChromeSkipsTheNativeApp() throws IOException {
        String js = WebThemeTokensAssetTest.read(SHELL_JS);
        assertTrue(js.contains("if (!embeddedInNativeApp) renderTopbar("));
    }
}
