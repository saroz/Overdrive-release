package com.overdrive.app.auth;

/**
 * Security G1: when a 7-day browser sign-in may be renewed.
 *
 * <p>Pages call {@code POST /api/auth/sessions/refresh} when they load and every few hours. The
 * server re-issues the token only once it is a day old, so page loads don't rewrite the sessions
 * file. BYD head units sometimes boot with a wrong clock (far in the past) and fix it later from
 * the network; renewing then would issue a token that is already expired in real time, or one
 * that lives far too long. So nothing is renewed while the clock looks wrong; the old token stays
 * valid and the next attempt renews it.
 */
public final class SessionRefreshPolicy {

    public enum Decision { REFRESH, NOT_DUE, CLOCK_UNSAFE }

    /** 2026-01-01T00:00:00Z. A head-unit clock before this has not been set yet. */
    static final long MIN_SANE_EPOCH_S = 1767225600L;
    /** Renew once the token is this old. */
    static final long REFRESH_AFTER_S = 24L * 60 * 60;
    /** Small backwards clock steps (NTP corrections) are normal. */
    static final long BACKWARD_TOLERANCE_S = 5L * 60;

    private SessionRefreshPolicy() {}

    public static Decision decide(long iatSec, long nowSec) {
        if (nowSec < MIN_SANE_EPOCH_S) return Decision.CLOCK_UNSAFE;
        if (nowSec + BACKWARD_TOLERANCE_S < iatSec) return Decision.CLOCK_UNSAFE;
        if (nowSec - iatSec < REFRESH_AFTER_S) return Decision.NOT_DUE;
        return Decision.REFRESH;
    }
}
