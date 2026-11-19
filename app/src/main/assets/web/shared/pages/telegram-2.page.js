/* Moved out of local/telegram.html (security fix F9: no inline scripts). */
// ES5-only — Chrome 58 / Android 7.1 head-unit floor.
window.TG = (function () {
    'use strict';

    var pinTimer = null;

    function $(id) { return document.getElementById(id); }
    function toast(msg, kind) {
        if (window.BYD && BYD.utils && BYD.utils.toast) BYD.utils.toast(msg, kind || 'info');
    }
    function tr(key, vars) {
        return (window.BYD && BYD.i18n) ? (BYD.i18n.t(key, vars) || key) : key;
    }
    function setStatus(el, kind, text) {
        if (!el) return;
        el.style.display = '';
        el.style.color = kind === 'error' ? 'var(--danger)' :
                         kind === 'success' ? 'var(--brand-primary)' : 'var(--text-secondary)';
        el.textContent = text;
    }

    // ───────────────────────── Status load ─────────────────────────

    function load() {
        fetch('/api/telegram/status', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (s) { paint(s); })
            .catch(function () {
                setStatus($('tgBotStatus'), 'error', tr('telegram.load_failed'));
            });
    }

    function paint(s) {
        // Header badge
        var badge = $('tgStatusBadge');
        if (badge) {
            if (s.enabled) {
                badge.textContent = tr('telegram.badge_paired');
                badge.className = 'ui-badge active';
            } else if (s.configured) {
                badge.textContent = tr('telegram.badge_pending');
                badge.className = 'ui-badge inactive';
            } else {
                badge.textContent = tr('telegram.badge_not_set');
                badge.className = 'ui-badge inactive';
            }
        }

        // Bot tab
        if (s.configured) {
            $('tgClearTokenBtn').style.display = '';
            if (s.botUsername || s.botFirstName) {
                $('tgBotInfo').style.display = '';
                $('tgBotName').textContent = s.botFirstName || s.botUsername || tr('telegram.bot_name_default');
                $('tgBotHandle').textContent = s.botUsername ? '@' + s.botUsername : '';
            }
            // Mask the token field — never expose the real token in
            // the UI after first save. Empty placeholder reads as
            // "leave blank to keep the existing token".
            $('tgToken').placeholder = tr('telegram.token_keep');
        } else {
            $('tgClearTokenBtn').style.display = 'none';
            $('tgBotInfo').style.display = 'none';
        }

        // Pair tab — three-state: empty / PIN / paired
        $('tgPairEmptyCard').style.display = s.configured ? 'none' : '';
        if (s.configured && !s.paired) {
            $('tgPinCard').style.display = '';
            $('tgOwnerCard').style.display = 'none';
            if (s.pendingPin && s.pendingPinExpiresAt) {
                showPin(s.pendingPin, s.pendingPinExpiresAt);
            }
        } else if (s.paired) {
            $('tgPinCard').style.display = 'none';
            $('tgOwnerCard').style.display = '';
            $('tgOwnerName').textContent = s.ownerFirstName || tr('common.unknown');
            $('tgOwnerHandle').textContent = s.ownerUsername ? '@' + s.ownerUsername : '—';
            $('tgOwnerChatId').textContent = s.ownerChatId != null ? String(s.ownerChatId) : '—';
            stopPinCountdown();
        } else {
            $('tgPinCard').style.display = 'none';
            $('tgOwnerCard').style.display = 'none';
        }

        // Preferences tab on this page only owns the daemon
        // auto-start toggle. Delivery prefs (criticalAlerts /
        // connectivity / motionText / videoUploads) are painted by
        // notifications.html via the same /api/telegram/status
        // payload, so we don't paint them here.
        if ($('tgAutoStartAccOff')) $('tgAutoStartAccOff').checked = !!s.autoStartAccOff;
        // Explain the always-on case (see tgAlwaysOnNote): the native
        // switch keeps the bot running regardless of this toggle.
        if ($('tgAlwaysOnNote')) {
            $('tgAlwaysOnNote').style.display = s.daemonAlwaysOn ? '' : 'none';
        }
    }

    // ───────────────────────── Bot token ─────────────────────────

    function connect() {
        var btn = $('tgConnectBtn');
        var token = $('tgToken').value.trim();
        if (!token) {
            setStatus($('tgBotStatus'), 'error', tr('telegram.token_required'));
            return;
        }
        btn.disabled = true;
        setStatus($('tgBotStatus'), 'info', tr('telegram.testing'));
        fetch('/api/telegram/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        }).then(function (r) { return r.json(); }).then(function (data) {
            btn.disabled = false;
            if (data.success) {
                $('tgToken').value = '';
                setStatus($('tgBotStatus'), 'success', tr('telegram.connected'));
                toast(tr('telegram.connected'), 'success');
                load();
            } else {
                setStatus($('tgBotStatus'), 'error', data.error || tr('telegram.connect_failed'));
            }
        }).catch(function (e) {
            btn.disabled = false;
            setStatus($('tgBotStatus'), 'error', (e && e.message) || tr('telegram.connect_failed'));
        });
    }

    function clearAll() {
        if (!window.confirm(tr('telegram.confirm_clear'))) return;
        fetch('/api/telegram/clear', { method: 'POST' })
            .then(function () {
                $('tgToken').value = '';
                toast(tr('telegram.cleared'), 'success');
                load();
            });
    }

    function toggleTokenVisibility(btn) {
        var input = $('tgToken');
        input.type = input.type === 'password' ? 'text' : 'password';
    }

    // ───────────────────────── Pairing ─────────────────────────

    function generatePin() {
        var btn = $('tgGenPinBtn');
        btn.disabled = true;
        fetch('/api/telegram/pin', { method: 'POST' })
            .then(function (r) { return r.json(); }).then(function (data) {
                btn.disabled = false;
                if (!data.success) {
                    setStatus($('tgPairStatus'), 'error', data.error || tr('telegram.pin_failed'));
                    return;
                }
                showPin(data.pin, data.expiresAt);
                // Start polling /status so the moment the user sends
                // /pair <PIN> in Telegram and the daemon writes
                // owner_chat_id, the UI flips to the paired-owner card.
                startPairPolling();
            }).catch(function () {
                btn.disabled = false;
                setStatus($('tgPairStatus'), 'error', tr('telegram.pin_failed'));
            });
    }

    function showPin(pin, expiresAt) {
        $('tgPinDisplay').style.display = '';
        $('tgPinValue').textContent = pin;
        stopPinCountdown();
        pinTimer = setInterval(function () {
            var remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            var mm = Math.floor(remaining / 60);
            var ss = remaining % 60;
            var label = mm + ':' + (ss < 10 ? '0' + ss : ss);
            $('tgPinCountdown').textContent = remaining > 0
                ? tr('telegram.pin_expires_in', { time: label })
                : tr('telegram.pin_expired');
            if (remaining <= 0) stopPinCountdown();
        }, 1000);
    }
    function stopPinCountdown() {
        if (pinTimer) { clearInterval(pinTimer); pinTimer = null; }
    }

    var pairPollTimer = null;
    function startPairPolling() {
        if (pairPollTimer) clearInterval(pairPollTimer);
        pairPollTimer = setInterval(function () {
            fetch('/api/telegram/status', { cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (s) {
                    if (s.paired) {
                        clearInterval(pairPollTimer); pairPollTimer = null;
                        paint(s);
                        toast(tr('telegram.pair_success'), 'success');
                    }
                });
        }, 3000);
    }

    function unpair() {
        if (!window.confirm(tr('telegram.confirm_unpair'))) return;
        fetch('/api/telegram/owner/clear', { method: 'POST' })
            .then(function () {
                toast(tr('telegram.unpaired'), 'success');
                load();
            });
    }

    // ───────────────────────── Preferences ─────────────────────────

    function savePrefs() {
        // This page only owns autoStartAccOff. Delivery prefs are
        // saved from notifications.html. The handler accepts a
        // partial body so other keys are left alone.
        var body = {
            autoStartAccOff: $('tgAutoStartAccOff').checked
        };
        fetch('/api/telegram/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data && data.success) {
                toast(tr('telegram.prefs_saved'), 'success');
            } else {
                toast(tr('telegram.prefs_save_failed'), 'error');
            }
        }).catch(function () {
            toast(tr('telegram.prefs_save_failed'), 'error');
        });
    }

    return {
        load: load,
        connect: connect,
        clearAll: clearAll,
        toggleTokenVisibility: toggleTokenVisibility,
        generatePin: generatePin,
        unpair: unpair,
        savePrefs: savePrefs
    };
}());

document.addEventListener('DOMContentLoaded', function () {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        TG.load();
    });
});
