package com.overdrive.app.mqtt;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.json.JSONObject;
import org.junit.Test;

/**
 * Security finding F8: "trust all certificates" disables TLS verification for an MQTT
 * connection. The option stays (default off), but the user must see a persistent
 * warning while it is on and the daemon must log a WARN on every such connect.
 */
public class MqttTrustAllWarningTest {

    @Test
    public void trustAllStaysOffByDefault() throws Exception {
        assertTrue(!new MqttConnectionConfig().trustAllCerts);
        assertTrue(!MqttConnectionConfig.fromJson(new JSONObject()).trustAllCerts);
    }

    @Test
    public void daemonWarnsOnlyForTlsConnectsWithTrustAll() {
        String warning = MqttPublisherService.trustAllWarning(true, true, "ssl://broker:8883");
        assertNotNull(warning);
        assertTrue(warning.contains("ssl://broker:8883"));
        assertTrue(warning.toLowerCase().contains("certificate"));
        assertNull(MqttPublisherService.trustAllWarning(false, true, "ssl://broker:8883"));
        // Plain tcp/ws never uses the trust-all factory, so there is nothing to warn about.
        assertNull(MqttPublisherService.trustAllWarning(true, false, "tcp://broker:1883"));
    }

    @Test
    public void daemonLogsTheWarningAfterEachSuccessfulConnect() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/mqtt/MqttPublisherService.java");
        int connected = src.indexOf("connected = true;");
        int warn = src.indexOf("trustAllWarning(config.trustAllCerts, isSsl, brokerUri)");
        assertTrue("WARN must be logged in connect()", warn > 0);
        assertTrue("WARN must follow the successful connect", warn > connected);
        assertTrue(src.contains("if (tlsWarning != null) logger.warn(tlsWarning);"));
    }

    @Test
    public void mqttFormExposesToggleWithPersistentWarning() throws IOException {
        String html = read("app/src/main/assets/web/local/mqtt.html");
        assertTrue(html.contains("id=\"formTrustAllCerts\""));
        assertTrue(html.contains("data-i18n=\"mqtt.trust_all_desc\""));
        assertTrue(html.contains("id=\"formTrustAllWarning\""));
        assertTrue(html.contains("data-i18n=\"mqtt.trust_all_warning\""));
        assertTrue(html.contains("../shared/mqtt.js?v=7"));
    }

    @Test
    public void mqttScriptRoundTripsTheFlagAndWarnsOnTheConnectionCard() throws IOException {
        String js = read("app/src/main/assets/web/shared/mqtt.js");
        assertTrue(js.contains("trustAllCerts: document.getElementById('formTrustAllCerts').checked"));
        assertTrue(js.contains("onTrustAllToggle()"));
        assertTrue(js.contains("conn.trustAllCerts"));
        assertTrue(js.contains("mqtt.trust_all_card_warning"));
    }

    @Test
    public void englishCatalogHasTheStrings() throws Exception {
        JSONObject mqtt = new JSONObject(read("app/src/main/assets/web/i18n/en.json"))
                .getJSONObject("mqtt");
        for (String key : new String[]{"trust_all", "trust_all_desc",
                "trust_all_warning", "trust_all_card_warning"}) {
            assertTrue(key, mqtt.optString(key).length() > 0);
        }
    }

    private static String read(String relativePath) throws IOException {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            Path candidate = current.resolve(relativePath);
            if (Files.isRegularFile(candidate)) {
                return new String(Files.readAllBytes(candidate), StandardCharsets.UTF_8);
            }
            Path fromModule = current.resolve(relativePath.replaceFirst("^app/", ""));
            if (Files.isRegularFile(fromModule)) {
                return new String(Files.readAllBytes(fromModule), StandardCharsets.UTF_8);
            }
            current = current.getParent();
        }
        throw new AssertionError("Could not locate repository file: " + relativePath);
    }
}
