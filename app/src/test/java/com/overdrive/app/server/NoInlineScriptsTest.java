package com.overdrive.app.server;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/**
 * Security F9 step 3: every page's inline {@code <script>} blocks moved to
 * shared/pages/*.page.js. MIGRATED lists them; {@link #noPageAnywhereHasAnInlineScript} also
 * covers pages added later, so step 5 can enforce {@code script-src 'self'}.
 */
public class NoInlineScriptsTest {

    @Test
    public void noPageAnywhereHasAnInlineScript() throws Exception {
        Path dir = locate("app/src/main/assets/web/local");
        int pages = 0;
        try (java.util.stream.Stream<Path> files = Files.list(dir)) {
            for (Path f : (Iterable<Path>) files::iterator) {
                if (!f.toString().endsWith(".html")) continue;
                pages++;
                String html = new String(Files.readAllBytes(f), StandardCharsets.UTF_8)
                        .replaceAll("(?s)<!--.*?-->", "");
                assertFalse(f.getFileName() + " has an inline <script>", INLINE.matcher(html).find());
            }
        }
        assertTrue(pages >= 35);
    }

    static final String[] MIGRATED = {
        "about", "daemons", "login", "sessions", "module-faults", "factory-dvr",
        "storage", "wireguard", "widgets", "remote-dev-view",
        "seat-positions", "remote-access", "communicate", "index",
        "safekeep", "widget-builder", "parking", "telegram", "abrp", "byd-cloud",
        "events", "key-mapping", "mqtt", "recording",
        "assistant", "automations", "charging", "network", "performance", "road-sense",
        "trips", "notifications",
        "live-view", "surveillance", "vehicle-control",
    };

    private static final Pattern INLINE = Pattern.compile("<script(?![^>]*\\ssrc=)[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAGE_JS = Pattern.compile("src=\"\\.\\./(shared/pages/[\\w-]+\\.page\\.js)\\?v=\\d+\"");

    @Test
    public void migratedPagesHaveNoInlineScriptAndTheirFilesExist() throws Exception {
        for (String page : MIGRATED) {
            String html = read("app/src/main/assets/web/local/" + page + ".html")
                    .replaceAll("(?s)<!--.*?-->", "");
            assertFalse(page + " still has an inline <script>", INLINE.matcher(html).find());
            Matcher m = PAGE_JS.matcher(html);
            boolean any = false;
            while (m.find()) {
                any = true;
                assertTrue(page + " -> " + m.group(1),
                        Files.exists(locate("app/src/main/assets/web/" + m.group(1))));
            }
            assertTrue(page + " loads its moved script", any);
        }
    }

    private static String read(String rel) throws Exception {
        return new String(Files.readAllBytes(locate(rel)), StandardCharsets.UTF_8);
    }

    private static Path locate(String rel) {
        Path p = Paths.get(rel);
        return Files.exists(p) ? p : Paths.get(rel.replaceFirst("^app/", ""));
    }
}
