package com.overdrive.app.server;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import org.junit.Test;

/** G2: warn when network ADB needs no RSA prompt; never turn network ADB on ourselves. */
public class AdbExposureTest {

    @Test
    public void onlyAnExplicitZeroCountsAsAuthDisabled() {
        assertTrue(AdbExposure.authDisabled("0"));
        assertTrue(AdbExposure.authDisabled(" 0\n"));
        assertFalse(AdbExposure.authDisabled("1"));
        assertFalse(AdbExposure.authDisabled(""));
        assertFalse(AdbExposure.authDisabled(null));
        assertFalse(AdbExposure.authDisabled("false"));
    }

    @Test
    public void hotspotStatusReportsTheFlag() throws Exception {
        String src = read("src/main/java/com/overdrive/app/server/HotspotApiHandler.java");
        assertTrue(src.contains("status.put(\"adbAuthDisabled\", AdbExposure.authDisabled(readProp(\"ro.adb.secure\")))"));
    }

    @Test
    public void networkPageShowsTheWarning() throws Exception {
        String js = read("src/main/assets/web/shared/network.js");
        assertTrue(js.contains("s.adbAuthDisabled"));
        String html = read("src/main/assets/web/local/network.html");
        assertTrue(html.contains("id=\"adbInsecureWarning\""));
        assertTrue(html.contains("data-i18n=\"network.adb_insecure_warning\""));
    }

    @Test
    public void diagnosticsNoLongerTurnsOnNetworkAdb() throws Exception {
        String src = read("src/main/java/com/overdrive/app/daemon/sentry/DiLink5PowerDiagnostics.java");
        assertFalse(src.contains("persist.adb.tcp.port"));
        assertFalse(src.contains("service.adb.tcp.port"));
        assertFalse(src.contains("development_settings_enabled"));
        assertFalse(src.contains("\"adb_enabled\""));
    }

    private static String read(String path) throws Exception {
        java.nio.file.Path p = Paths.get(path);
        if (!Files.exists(p)) p = Paths.get("app").resolve(path);
        return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
    }
}
