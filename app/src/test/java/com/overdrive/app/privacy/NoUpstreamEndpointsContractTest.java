package com.overdrive.app.privacy;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.Test;

/**
 * Privacy G3: "zero data leaving the car" unless the user opts in. The fork must not
 * ship any default endpoint that belongs to the upstream project. These are the exact
 * upstream-owned hosts that used to be compiled into the app:
 *
 * <ul>
 *   <li>{@code roadsense-edge.yash321sri.workers.dev} — RoadSense crowd hazard sync</li>
 *   <li>{@code community-edge.yash321sri.workers.dev} — Community automations / widgets</li>
 *   <li>{@code analytics-edge.yash321sri.workers.dev} — daily active-install ping</li>
 *   <li>{@code 35.211.235.83} — upstream VPS device API / RTMP relay (dead comments)</li>
 * </ul>
 *
 * Self-hosted endpoints come only from a gitignored {@code .env} / Gradle property
 * at build time, or from the user typing one into the settings page.
 */
public class NoUpstreamEndpointsContractTest {

    /** Exact upstream-owned host strings that must never reappear in app/src/main. */
    static final List<String> UPSTREAM_HOSTS = Arrays.asList(
            "roadsense-edge.yash321sri.workers.dev",
            "community-edge.yash321sri.workers.dev",
            "analytics-edge.yash321sri.workers.dev",
            "yash321sri.workers.dev",
            "35.211.235.83");

    /** No Cloudflare *.workers.dev host at all — not even as an input placeholder — so a
     *  future upstream sync that re-adds one is caught here. */
    private static final String ANY_WORKERS_DEV = "workers.dev";

    /** Code files must not point at the upstream repository either (i18n link text and
     *  Android string resources are user-tap links, tracked separately). */
    private static final String UPSTREAM_REPO = "yash-srivastava";

    private static final List<String> TEXT_EXTENSIONS = Arrays.asList(
            ".java", ".kt", ".js", ".mjs", ".html", ".htm", ".css", ".json", ".xml",
            ".txt", ".md", ".properties", ".yaml", ".yml", ".conf", ".sh");
    private static final List<String> CODE_EXTENSIONS = Arrays.asList(
            ".java", ".kt", ".js", ".mjs", ".html", ".htm");

    @Test
    public void appSourcesContainNoUpstreamOwnedEndpoints() throws IOException {
        Path main = repositoryRoot().resolve("app/src/main");
        assertTrue("app/src/main missing", Files.isDirectory(main));
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> files = Files.walk(main)) {
            for (Path path : (Iterable<Path>) files.filter(Files::isRegularFile)::iterator) {
                String rel = main.relativize(path).toString().replace('\\', '/');
                if (rel.startsWith("jniLibs/")) continue;
                String name = rel.toLowerCase(Locale.ROOT);
                if (!hasExtension(name, TEXT_EXTENSIONS)) continue;
                String text = new String(Files.readAllBytes(path), StandardCharsets.UTF_8)
                        .toLowerCase(Locale.ROOT);
                for (String host : UPSTREAM_HOSTS) {
                    if (text.contains(host)) offenders.add(rel + " -> " + host);
                }
                if (text.contains(ANY_WORKERS_DEV)) offenders.add(rel + " -> " + ANY_WORKERS_DEV);
                if (hasExtension(name, CODE_EXTENSIONS) && text.contains(UPSTREAM_REPO)) {
                    offenders.add(rel + " -> " + UPSTREAM_REPO);
                }
            }
        }
        assertTrue("upstream-owned endpoints still shipped: " + offenders, offenders.isEmpty());
    }

    @Test
    public void cloudBackendDefaultsAreBuildTimeOnlyAndEmptyWhenUnset() throws IOException {
        Path root = repositoryRoot();
        String gradle = read(root.resolve("app/build.gradle.kts"));

        // envOrProp falls back to "" — never to a baked-in host.
        assertTrue("envOrProp must fall back to an empty string",
                Pattern.compile("\\?:\\s*System\\.getenv\\(envKey\\)\\s*\\?:\\s*\"\"").matcher(gradle).find());

        for (String field : Arrays.asList(
                "ANALYTICS_WORKER_URL", "COMMUNITY_WORKER_URL", "ROADSENSE_WORKER_URL")) {
            Matcher m = Pattern.compile("buildConfigField\\(\"String\",\\s*\"" + field + "\",\\s*([^\\n]+)")
                    .matcher(gradle);
            assertTrue(field + " buildConfigField missing", m.find());
            assertTrue(field + " must come from envOrProp (no literal default)",
                    m.group(1).contains("envOrProp(\"" + field + "\""));
        }
        // LOG_UPLOAD_URL: literal "" in defaultConfig; only braveheart reads it from env.
        assertTrue("LOG_UPLOAD_URL default must be empty",
                gradle.contains("buildConfigField(\"String\", \"LOG_UPLOAD_URL\", \"\\\"\\\"\")"));

        // The committed template ships blank values.
        String env = read(root.resolve(".env.example"));
        for (String key : Arrays.asList(
                "ANALYTICS_WORKER_URL", "COMMUNITY_WORKER_URL", "ROADSENSE_WORKER_URL", "LOG_UPLOAD_URL")) {
            assertTrue(key + " must be blank in .env.example",
                    Pattern.compile("(?m)^" + key + "=\\s*$").matcher(env).find());
        }
    }

    @Test
    public void roadSenseSettingsShowNotConfiguredWhenNoWorkerUrl() throws IOException {
        Path root = repositoryRoot();
        String html = read(root.resolve("app/src/main/assets/web/local/road-sense.html"));
        String js = read(root.resolve("app/src/main/assets/web/shared/road-sense.js"));
        String en = read(root.resolve("app/src/main/assets/web/i18n/en.json"));
        assertTrue("status line element missing", html.contains("id=\"rsSyncWorkerStatus\""));
        assertTrue("road-sense.js must render the status line", js.contains("rsSyncWorkerStatus"));
        assertTrue("en.json needs the not-configured copy",
                en.contains("\"crowd_worker_not_configured\""));
        assertFalse("desc must not promise a default endpoint",
                en.contains("instead of the default endpoint"));
    }

    private static boolean hasExtension(String name, List<String> exts) {
        for (String ext : exts) if (name.endsWith(ext)) return true;
        return false;
    }

    private static String read(Path p) throws IOException {
        return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
    }

    private static Path repositoryRoot() {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isDirectory(current.resolve("app/src/main"))) return current;
            current = current.getParent();
        }
        throw new AssertionError("repository root not found");
    }
}
