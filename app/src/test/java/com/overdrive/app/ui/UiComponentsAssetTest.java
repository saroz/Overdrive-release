package com.overdrive.app.ui;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/** The mockup's building blocks as ui- classes, with the mockup's own values. */
public class UiComponentsAssetTest {

    @Test
    public void panel() throws IOException {
        assertRule(".ui-panel", "border-radius:16px", "border:1px solid var(--ui-panel-line)",
                "background:var(--ui-surface)");
        assertRule(".ui-panel-head", "padding:22px 24px 0");
    }

    @Test
    public void buttons() throws IOException {
        assertRule(".ui-button", "min-height:44px", "border-radius:7px", "font-size:13px");
        assertRule(".ui-button-primary", "background:var(--ui-accent)", "color:var(--ui-on-accent)");
        assertRule(".ui-text-button", "color:var(--ui-accent-text)", "min-height:44px");
    }

    @Test
    public void rowsAndSwitches() throws IOException {
        assertRule(".ui-row", "min-height:64px", "border-bottom:1px solid var(--ui-line)");
        assertRule(".ui-switch", "width:38px", "height:24px");
        assertRule(".ui-switch:after", "width:18px", "height:18px");
    }

    @Test
    public void metrics() throws IOException {
        assertRule(".ui-metric-value", "font-size:29px", "letter-spacing:-.8px");
    }

    @Test
    public void shell() throws IOException {
        assertRule(".ui-topbar", "height:72px");
        assertRule(".ui-sidebar", "width:var(--ui-sidebar-width)");
        assertRule(".ui-nav-link", "min-height:44px", "border-radius:7px");
        assertRule(".ui-page-head h1", "font-size:28px", "letter-spacing:-1px");
    }

    @Test
    public void tabsListsDialogsToasts() throws IOException {
        assertRule(".ui-tab[aria-selected=true]", "border-bottom-color:var(--ui-accent)");
        assertRule(".ui-list-icon", "width:34px", "height:34px");
        assertRule(".ui-dialog", "border-radius:14px");
        assertRule(".ui-dialog::backdrop", "background:var(--ui-scrim)");
        assertRule(".ui-toast", "background:var(--ui-ink)", "color:var(--ui-surface)");
    }

    @Test
    public void heroCard() throws IOException {
        assertRule(".ui-hero", "background:var(--ui-hero-bg)");
        assertRule(".ui-reading", "font-size:29px");
    }

    @Test
    public void flatSurfacesNoBlur() throws IOException {
        assertFalse(UiCssBuildAssetTest.css().contains("backdrop-filter"));
        assertFalse(UiCssBuildAssetTest.css().contains("blur("));
    }

    @Test
    public void componentsUseTokensOnly() throws IOException {
        String c = UiCssBuildAssetTest.css();
        // Strip custom-property definitions; any hex left is a raw colour in a declaration.
        String decls = c.replaceAll("--[a-z0-9-]+:[^;}]+", "");
        Matcher hex = Pattern.compile("#[0-9a-fA-F]{3,8}\\b").matcher(decls);
        assertFalse("raw colour: " + (hex.find() ? hex.group() : ""), hex.find(0));
    }

    /** Every declaration must appear in some rule whose selector list contains {@code selector} exactly. */
    static void assertRule(String selector, String... declarations) throws IOException {
        String css = UiCssBuildAssetTest.css();
        StringBuilder body = new StringBuilder();
        Matcher m = Pattern.compile("([^{}]+)\\{([^{}]*)\\}").matcher(css);
        while (m.find()) {
            for (String s : m.group(1).split(",")) {
                if (s.trim().equals(selector)) body.append(m.group(2)).append(';');
            }
        }
        assertTrue("no rule for " + selector, body.length() > 0);
        for (String d : declarations) {
            assertTrue(selector + " missing " + d + " in {" + body + "}", body.toString().contains(d));
        }
    }
}
