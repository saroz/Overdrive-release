package com.overdrive.app.server;

import com.overdrive.app.config.UnifiedConfigManager;

import org.json.JSONObject;

import java.net.Inet4Address;
import java.net.InetAddress;

/**
 * Security G1: opt-in "local only" mode for the web server on port 8080.
 *
 * <p>When {@code webAccess.localOnly} is on, only these may connect:
 * <ul>
 *   <li>the head unit itself (loopback). Every remote tunnel (Cloudflared, Zrok, Tailscale
 *       serve, WireGuard expose) also arrives on 127.0.0.1, so tunnels keep working;</li>
 *   <li>devices on the car's own hotspot (same /24 as the live hotspot gateway, and only
 *       while the hotspot is on).</li>
 * </ul>
 * Devices on the home/office WiFi the car joined are refused. Off by default. The car screen
 * is always loopback, so the switch can always be turned off again there.
 */
public final class LanAccessPolicy {

    private static final long CACHE_MS = 2000L;
    private static volatile long cachedAt;
    private static volatile Settings cached = new Settings(false, false, "");

    private LanAccessPolicy() {}

    static final class Settings {
        final boolean localOnly;
        final boolean hotspotOn;
        final String gateway;

        Settings(boolean localOnly, boolean hotspotOn, String gateway) {
            this.localOnly = localOnly;
            this.hotspotOn = hotspotOn;
            this.gateway = gateway == null ? "" : gateway;
        }
    }

    /** Pure decision, unit-tested. */
    static boolean allowed(InetAddress remote, boolean localOnly, boolean hotspotOn, String gateway) {
        if (remote == null) return !localOnly;
        if (remote.isLoopbackAddress()) return true;
        if (!localOnly) return true;
        return hotspotOn && sameSlash24(remote, gateway);
    }

    static boolean sameSlash24(InetAddress remote, String gateway) {
        if (!(remote instanceof Inet4Address) || gateway == null || gateway.isEmpty()) return false;
        if (!gateway.matches("\\d{1,3}(\\.\\d{1,3}){3}")) return false;
        try {
            byte[] a = remote.getAddress();
            byte[] g = InetAddress.getByName(gateway).getAddress();
            return g.length == 4 && a[0] == g[0] && a[1] == g[1] && a[2] == g[2];
        } catch (Exception e) {
            return false;
        }
    }

    /** Forget the cached settings so the next check reads the config again (after a save). */
    public static void invalidate() {
        cachedAt = 0L;
    }

    /** True when the daemon config has local-only mode on. */
    public static boolean localOnlyEnabled() {
        return current().localOnly;
    }

    /** Decision for a live socket peer, using the config (cached for 2 s). */
    public static boolean allows(InetAddress remote) {
        if (remote != null && remote.isLoopbackAddress()) return true;
        Settings s = current();
        return allowed(remote, s.localOnly, s.hotspotOn, s.gateway);
    }

    private static Settings current() {
        long now = System.currentTimeMillis();
        if (now - cachedAt < CACHE_MS) return cached;
        Settings next;
        try {
            JSONObject root = UnifiedConfigManager.loadConfig();
            JSONObject web = root.optJSONObject("webAccess");
            JSONObject hs = root.optJSONObject("hotspotState");
            boolean localOnly = web != null && web.optBoolean("localOnly", false);
            boolean hotspotOn = hs != null && hs.optInt("apState", 11) == 13;
            String gateway = hs == null ? "" : hs.optString("gateway", "");
            if (gateway.isEmpty()) gateway = "192.168.43.1";
            next = new Settings(localOnly, hotspotOn, gateway);
        } catch (Throwable t) {
            // Config unreadable: keep the last known decision rather than flip open or shut.
            next = cached;
        }
        cached = next;
        cachedAt = now;
        return next;
    }

    /** Test hook: drop the cache. */
    static void resetCache() {
        cachedAt = 0L;
    }
}
