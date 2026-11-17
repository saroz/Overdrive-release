package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import org.junit.Test;

/** Page tabs, toasts and the shared confirm/alert dialog render as mockup ui- components. */
public class SharedWidgetsAssetTest {

    private static String shared(String name) throws IOException {
        return WebThemeTokensAssetTest.read("app/src/main/assets/web/shared/" + name);
    }

    @Test
    public void pageTabsAreMockupFilters() throws IOException {
        String tabs = shared("app-tabs.js");
        assertTrue(tabs.contains("nav.className = 'ui-page-tabs';"));
        assertTrue(tabs.contains("' class=\"ui-tab"));
        assertTrue(tabs.contains("role=\"tab\""));
        assertTrue(tabs.contains("aria-selected"));
        assertFalse("old fixed bottom bar class", tabs.contains("nav.className = 'bottom-tabs';"));
        assertFalse("tabs are text only, like the mockup", tabs.contains("bottom-tab-icon"));
    }

    @Test
    public void tabActionUsesUiButtons() throws IOException {
        String tabs = shared("app-tabs.js");
        assertTrue(tabs.contains("slot.className = 'ui-tabs-action';"));
        assertTrue(tabs.contains("'ui-button ui-button-primary"));
    }

    @Test
    public void pagesFindTabsByTheirDataHook() throws IOException {
        for (String page : new String[]{"assistant", "automations", "key-mapping", "mqtt", "safekeep"}) {
            String html = WebThemeTokensAssetTest.read("app/src/main/assets/web/local/" + page + ".html");
            assertFalse(page + " still queries .bottom-tab", html.contains(".bottom-tab["));
        }
        assertFalse(shared("charging.js").contains("classList.contains('bottom-tab')"));
        assertFalse(shared("charging.js").contains("'.bottom-tab.is-active'"));
        assertFalse(shared("automations.js").contains("closest('.bottom-tabs')"));
    }

    @Test
    public void toastsAreMockupToasts() throws IOException {
        String core = shared("core.js");
        assertTrue(core.contains("toast.className = 'ui-toast ui-toast-' + type;"));
        assertTrue(core.contains("container.classList.add('ui-toast-stack');"));
        UiComponentsAssetTest.assertRule(".ui-toast-stack", "position:fixed");
    }

    @Test
    public void confirmDialogIsAMockupDialog() throws IOException {
        String core = shared("core.js");
        String modal = core.substring(core.indexOf("BYD.utils._showModal = function"));
        assertTrue(modal.contains("backdrop.className = 'ui-modal-backdrop';"));
        assertTrue(modal.contains("card.className = 'ui-dialog';"));
        assertTrue(modal.contains("actions.className = 'ui-dialog-actions';"));
        assertTrue(modal.contains("input.className = 'ui-input';"));
        assertFalse("no inline colours on the prompt input", modal.contains("input.style.background"));
        UiComponentsAssetTest.assertRule(".ui-modal-backdrop", "background:var(--ui-scrim)", "position:fixed");
    }
}
