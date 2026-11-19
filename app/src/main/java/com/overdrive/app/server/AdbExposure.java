package com.overdrive.app.server;

/**
 * Whether network ADB on this head unit lets any device in without the on-screen RSA prompt.
 *
 * <p>OverDrive keeps ADB over TCP (port 5555) on because its daemons live in the adbd process
 * group, so ADB cannot simply be turned off. That is only safe while {@code ro.adb.secure=1}:
 * a new computer must then be accepted on the car screen. With {@code ro.adb.secure=0} anyone on
 * the car's WiFi or hotspot gets a shell without a prompt, and the web UI warns about it.
 */
public final class AdbExposure {

    private AdbExposure() {}

    /** True only when the firmware explicitly turned ADB authentication off. Unknown = not flagged. */
    public static boolean authDisabled(String roAdbSecure) {
        return roAdbSecure != null && "0".equals(roAdbSecure.trim());
    }
}
