package com.overdrive.app.server;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

/** G1: opt-in local-only mode keeps the car, tunnels and the car's own hotspot. */
public class LanAccessPolicyTest {

    private static InetAddress ip(String s) throws Exception {
        return InetAddress.getByName(s);
    }

    @Test
    public void offByDefaultAllowsEveryone() throws Exception {
        assertTrue(LanAccessPolicy.allowed(ip("192.168.1.20"), false, false, "192.168.43.1"));
        assertTrue(LanAccessPolicy.allowed(ip("10.0.0.5"), false, true, "192.168.43.1"));
    }

    @Test
    public void loopbackAndTunnelsAlwaysAllowed() throws Exception {
        assertTrue(LanAccessPolicy.allowed(ip("127.0.0.1"), true, false, ""));
        assertTrue(LanAccessPolicy.allowed(ip("::1"), true, false, ""));
    }

    @Test
    public void localOnlyKeepsTheCarsHotspotWhileItIsOn() throws Exception {
        assertTrue(LanAccessPolicy.allowed(ip("192.168.43.17"), true, true, "192.168.43.1"));
        assertFalse(LanAccessPolicy.allowed(ip("192.168.43.17"), true, false, "192.168.43.1"));
        assertTrue(LanAccessPolicy.allowed(ip("10.42.0.9"), true, true, "10.42.0.1"));
    }

    @Test
    public void localOnlyRefusesTheHomeWifi() throws Exception {
        assertFalse(LanAccessPolicy.allowed(ip("192.168.1.20"), true, true, "192.168.43.1"));
        assertFalse(LanAccessPolicy.allowed(ip("192.168.44.2"), true, true, "192.168.43.1"));
        assertFalse(LanAccessPolicy.allowed(ip("fe80::1"), true, true, "192.168.43.1"));
        assertFalse(LanAccessPolicy.allowed(ip("192.168.43.17"), true, true, "not-an-ip"));
        assertFalse(LanAccessPolicy.allowed(null, true, true, "192.168.43.1"));
    }

    @Test
    public void serverChecksThePeerBeforeReadingTheRequest() throws Exception {
        String src = read("app/src/main/java/com/overdrive/app/server/HttpServer.java");
        int handle = src.indexOf("private void handleClient(Socket client)");
        int check = src.indexOf("LanAccessPolicy.allows(client.getInetAddress())", handle);
        int read = src.indexOf("head.readRequestLine()", handle);
        assertTrue(handle > 0 && check > handle && check < read);
    }

    @Test
    public void networkPageOffersTheSwitch() throws Exception {
        String api = read("app/src/main/java/com/overdrive/app/server/HotspotApiHandler.java");
        assertTrue(api.contains("status.put(\"localOnly\", LanAccessPolicy.localOnlyEnabled())"));
        assertTrue(api.contains("UnifiedConfigManager.updateValues(\"webAccess\""));
        String html = read("app/src/main/assets/web/local/network.html");
        assertTrue(html.contains("id=\"hsLocalOnly\""));
    }

    private static String read(String rel) throws Exception {
        Path p = Paths.get(rel);
        if (!Files.exists(p)) p = Paths.get(rel.replaceFirst("^app/", ""));
        return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
    }
}
