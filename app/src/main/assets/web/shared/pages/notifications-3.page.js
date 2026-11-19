/* Moved out of local/notifications.html (security fix F9: no inline scripts). */
// Preview-mode escape hatch: when the page is loaded off a local dev
// server (no real auth backend), the requireAuth() bounce to
// /login.html would 404 and create a redirect loop. PREVIEW_MODE
// covers both:
//   - port 8000 static server (no API at all → loads PREVIEW_REGISTRY)
//   - file:// (no server at all)
// ?devPwa=1 hits dev/preview-server.py on port 8443 which DOES
// implement the API, so we want fetches to go through but still
// need to skip the auth redirect.
var DEV_PWA_MODE = /[?&]devPwa=1\b/.test(window.location.search);
var PREVIEW_MODE =
    window.location.protocol === 'file:' ||
    (window.location.port === '8000' &&
     (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'));
// PREVIEW_MODE drives the in-memory registry fallback. DEV_PWA_MODE
// hits real endpoints. Auth redirect must be skipped in either case.
var SKIP_AUTH_REDIRECT = PREVIEW_MODE || DEV_PWA_MODE;

if (!SKIP_AUTH_REDIRECT && typeof BYDAuth !== 'undefined' && BYDAuth.requireAuth) {
    BYDAuth.requireAuth();
}
if (typeof BYD !== 'undefined' && BYD.core) {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        // Hydrate the Telegram tab — paints toggle states from
        // /api/surveillance/config + queries telegram pairing state.
        if (window.SurvSettings && SurvSettings.initTelegramOnly) {
            SurvSettings.initTelegramOnly();
        }
        // Telegram delivery preferences (critical / connectivity /
        // motion text / videos) — persisted via /api/telegram/preferences.
        if (window.TelegramPrefs) TelegramPrefs.load();
        // Vehicle layout (LHD / RHD). Lives in the same vehicle
        // config section as model + body color, so it goes through
        // /api/models/selected.
        if (window.DriveSidePicker) DriveSidePicker.load();
        // Tyre pressure limits — own section of the unified config,
        // read by the notification path and Vehicle Control alike.
        if (window.TyreLimits) TyreLimits.load();
        // Paint-drop guard for the toggle sliders is now done inside
        // each save handler (TelegramPrefs.save and SurvSettings._
        // persistTelegramFields), where the authoritative state is
        // known. Hooking onchange globally would race those repaints.
    });
}

// ===== Telegram delivery preferences module =====
// Lives here (not in shared/surveillance.js?v=survtoggle20) because the four toggles
// are notification-page-local — they don't bind to surveillance config
// and don't need the heavier SurvSettings init flow. Load + save go
// through /api/telegram/preferences (same endpoint telegram.html
// uses for autoStartAccOff, partial-merge body).
window.TelegramPrefs = (function () {
    'use strict';
    function $(id) { return document.getElementById(id); }
    // Resolve an i18n key with a sane English fallback. Falling back
    // to the raw key (the previous default) showed "telegram.prefs_
    // saved" as the toast text inside the WebView whenever the
    // catalog hadn't finished loading, which is worse UX than just
    // showing the English string.
    function tr(k, fb) {
        var v = (window.BYD && BYD.i18n && BYD.i18n.t) ? BYD.i18n.t(k) : null;
        return v || fb || k;
    }
    function toast(msg, kind) {
        if (window.BYD && BYD.utils && BYD.utils.toast) BYD.utils.toast(msg, kind || 'info');
    }
    // Re-paint the four delivery checkboxes from the in-memory state
    // — same Chrome-58-WebView paint-drop guard the surveillance
    // tier toggles use. Called after every save attempt so the
    // visual state always matches what we just sent / what we're
    // reverting to.
    function _repaint(state) {
        var ids = ['tgPrefCriticalAlerts','tgPrefConnectivity','tgPrefMotionText','tgPrefVideoUploads','tgPrefTyreAlerts','tgPrefLoginAlerts','tgPrefParkingMessages'];
        ids.forEach(function (id) {
            if (!(id in state)) return;
            var el = $(id); if (!el) return;
            var slider = el.parentNode && el.parentNode.querySelector('.ui-toggle-track');
            var want = !!state[id];
            el.checked = !want;
            if (slider) { void slider.offsetHeight; }
            el.checked = want;
        });
    }
    function load() {
        fetch('/api/telegram/status', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (s) {
                // Paint via _repaint so the slider visually updates
                // on Chrome 58 WebView. Plain `.checked = true` on
                // a freshly-rendered checkbox doesn't re-evaluate
                // the `:checked + .ui-toggle-track` rule until the
                // element is interacted with — slider stays in the
                // OFF position even though .checked is true. The
                // flip-reflow-restore inside _repaint forces the
                // style recompute.
                _repaint({
                    tgPrefCriticalAlerts: s.criticalAlerts !== false,
                    tgPrefConnectivity:   !!s.connectivityUpdates,
                    tgPrefMotionText:     s.motionText !== false,
                    tgPrefVideoUploads:   !!s.videoUploads,
                    // Default ON (matches UnifiedTelegramConfig), so an
                    // older daemon that omits the field doesn't paint
                    // the toggle off and imply alerts are disabled.
                    tgPrefTyreAlerts:     s.tyreAlerts !== false,
                    tgPrefLoginAlerts:    s.loginAlerts !== false,
                    tgPrefParkingMessages: s.parkingMessages !== false
                });
            })
            .catch(function () { /* status endpoint unreachable — leave defaults */ });
    }
    function save() {
        // Snapshot the visual state we're about to send so we can
        // both replay it on success (paint-drop guard) and revert
        // on failure.
        var pending = {
            tgPrefCriticalAlerts: $('tgPrefCriticalAlerts') && $('tgPrefCriticalAlerts').checked,
            tgPrefConnectivity:   $('tgPrefConnectivity')   && $('tgPrefConnectivity').checked,
            tgPrefMotionText:     $('tgPrefMotionText')     && $('tgPrefMotionText').checked,
            tgPrefVideoUploads:   $('tgPrefVideoUploads')   && $('tgPrefVideoUploads').checked,
            tgPrefTyreAlerts:     $('tgPrefTyreAlerts')     && $('tgPrefTyreAlerts').checked,
            tgPrefLoginAlerts:    $('tgPrefLoginAlerts')    && $('tgPrefLoginAlerts').checked,
            tgPrefParkingMessages: $('tgPrefParkingMessages') && $('tgPrefParkingMessages').checked
        };
        var body = {
            criticalAlerts:      pending.tgPrefCriticalAlerts,
            connectivityUpdates: pending.tgPrefConnectivity,
            motionText:          pending.tgPrefMotionText,
            videoUploads:        pending.tgPrefVideoUploads,
            tyreAlerts:          pending.tgPrefTyreAlerts,
            loginAlerts:         pending.tgPrefLoginAlerts,
            parkingMessages:     pending.tgPrefParkingMessages
        };
        fetch('/api/telegram/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data && data.success) {
                _repaint(pending);
                toast(tr('telegram.prefs_saved', 'Preferences saved'), 'success');
            } else {
                toast(tr('telegram.prefs_save_failed', 'Could not save preferences'), 'error');
            }
        }).catch(function () {
            toast(tr('telegram.prefs_save_failed', 'Could not save preferences'), 'error');
        });
    }
    return { load: load, save: save };
}());

// ===== Vehicle layout (LHD / RHD) =====
// Pure-JS radio control over /api/models/selected. The vehicle
// section already round-trips modelId + color; we piggy-back the
// driveSide field on the same endpoint so users have a single
// place to think about the car's persisted properties.
//
// Why a custom radio instead of <input type="radio"> — the page is
// ES5 + Chrome 58 in the WebView, where the native radio's
// appearance can't be themed reliably without a wrapper, and the
// existing notif-toggle vocabulary is binary. A two-pill picker
// matches "you'll only ever pick one" while still painting from
// theme tokens. The current selection is mirrored to aria-checked
// on every render.
window.DriveSidePicker = (function () {
    'use strict';
    // null until the first /api/models/selected response — keeps
    // both radios visually unselected during the load window so a
    // transient network failure can't paint RHD on top of an LHD-
    // configured car. The server's getVehicle() backfills "rhd"
    // for never-saved configs, so a successful GET always returns
    // a concrete "lhd"/"rhd"; null on the client therefore means
    // "we haven't talked to the server yet" rather than "no
    // preference exists". paint() handles null by leaving both
    // radios off + aria-checked=false (an indeterminate radiogroup,
    // permitted by WAI-ARIA).
    var current = null;
    var inFlight = false;
    // Set true the moment the user clicks a radio. Late /api/models/
    // selected responses (slow tunnel, retry, etc.) will then NOT
    // clobber the just-saved value — load() respects the user's
    // intent. Cleared only when the picker is unmounted, which
    // doesn't happen on this page.
    var userActed = false;
    function tr(k, fb) {
        var v = (window.BYD && BYD.i18n && BYD.i18n.t) ? BYD.i18n.t(k) : null;
        return v || fb || k;
    }
    function toast(msg, kind) {
        if (window.BYD && BYD.utils && BYD.utils.toast) BYD.utils.toast(msg, kind || 'info');
    }
    function paint() {
        var radios = document.querySelectorAll('#driveSideCard .notif-radio');
        // Roving tabindex per WAI-ARIA radiogroup pattern: only ONE
        // radio in the group is reachable via Tab. The 0 lives on
        // the selected radio; if nothing is selected (current=null
        // during load or after a failed load), it parks on the
        // first radio so keyboard users can still reach the group.
        var firstFocusableIdx = 0;
        for (var k = 0; k < radios.length; k++) {
            if (radios[k].getAttribute('data-side') === current) {
                firstFocusableIdx = k;
                break;
            }
        }
        for (var i = 0; i < radios.length; i++) {
            var r = radios[i];
            var on = (current !== null) && (r.getAttribute('data-side') === current);
            r.classList.toggle('on', on);
            r.setAttribute('aria-checked', on ? 'true' : 'false');
            r.classList.toggle('disabled', inFlight);
            r.setAttribute('tabindex', i === firstFocusableIdx ? '0' : '-1');
        }
    }
    function load() {
        var url = '/api/models/selected';
        var fetcher = (typeof BYDAuth !== 'undefined' && BYDAuth.fetch)
            ? BYDAuth.fetch.bind(BYDAuth) : fetch;
        fetcher(url, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                // Race guard: if the user clicked a radio while the
                // GET was in flight (or the GET completed after a
                // pick() POST already updated state), don't clobber
                // the user's value with the older server snapshot.
                if (userActed) { paint(); return; }
                if (j && (j.driveSide === 'lhd' || j.driveSide === 'rhd')) {
                    current = j.driveSide;
                }
                // No else-branch for 200-without-driveSide:
                // handleGetSelected (ModelsApiHandler.java) always
                // emits driveSide via vehicle.optString(..,"rhd"),
                // so the only path here is the network error one
                // below.
                paint();
            })
            .catch(function () {
                if (userActed) { paint(); return; }
                // Surface the failure so the user knows the picker
                // isn't reflecting persisted state. Without this
                // the picker would render two unselected radios
                // with zero indication that anything went wrong.
                toast(tr('notif.drive_load_failed', 'Could not load vehicle layout'), 'error');
                paint();
            });
    }
    function pick(side) {
        if (inFlight) return;
        if (side !== 'lhd' && side !== 'rhd') return;
        if (side === current) return;
        var prev = current;
        current = side;
        inFlight = true;
        // Latch BEFORE the network call so a concurrently-resolving
        // load() can't clobber the in-flight optimistic paint.
        userActed = true;
        paint();
        // Watchdog: if BYDAuth.fetch chains through auth-redirect logic
        // that never resolves (rare, but possible with a half-dead
        // tunnel), the picker would otherwise stay disabled forever.
        // 10s is generous for the head unit's slow tunnel; matches
        // the page's notif-status banners showing tunnel issues.
        var settled = false;
        var watchdog = setTimeout(function () {
            if (settled) return;
            settled = true;
            inFlight = false;
            current = prev;
            paint();
            toast(tr('notif.drive_save_failed', 'Could not save vehicle layout'), 'error');
        }, 10000);
        var fetcher = (typeof BYDAuth !== 'undefined' && BYDAuth.fetch)
            ? BYDAuth.fetch.bind(BYDAuth) : fetch;
        fetcher('/api/models/selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driveSide: side })
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        }).then(function (data) {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            inFlight = false;
            // Server uses two response shapes today: success returns
            // {"ok":true} (handleSetSelected line 343) and errors
            // return {"success":false,"error":...} (HttpResponse.
            // sendJsonError). Treat anything that's not an explicit
            // failure marker as success — survives a future server-
            // side envelope change without breaking the picker.
            var isFailure = !data || data.ok === false || data.success === false;
            if (!isFailure) {
                toast(tr('notif.drive_saved', 'Vehicle layout saved'), 'success');
            } else {
                current = prev;
                toast(tr('notif.drive_save_failed', 'Could not save vehicle layout'), 'error');
            }
            paint();
        }).catch(function () {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            inFlight = false;
            current = prev;
            paint();
            toast(tr('notif.drive_save_failed', 'Could not save vehicle layout'), 'error');
        });
    }
    // Resolve any node inside the card to its side ("lhd" or "rhd").
    // Walks up to the nearest ancestor carrying data-side so users
    // can click anywhere on the row (label, sub-text, radio dot)
    // and still trigger pick(). Returns null when the click landed
    // on the section header or padding outside any row.
    function sideFor(node, card) {
        var el = node;
        while (el && el !== card) {
            if (el.getAttribute && el.getAttribute('data-side')) {
                return el.getAttribute('data-side');
            }
            el = el.parentNode;
        }
        return null;
    }
    // Delegate from the card so we don't bind per-row listeners and
    // race the i18n hydration (which may swap nodes' text content).
    document.addEventListener('DOMContentLoaded', function () {
        var card = document.getElementById('driveSideCard');
        if (!card) return;
        card.addEventListener('click', function (e) {
            var side = sideFor(e.target, card);
            if (side) pick(side);
        });
        // Keyboard support — space / enter on the focused radio.
        // Arrow keys cycle the selection; that's the WAI-ARIA radio
        // pattern and what users coming from native form radios
        // expect. Tab moves out of the group as a whole.
        card.addEventListener('keydown', function (e) {
            // All keyboard interactions require a radio to actually
            // hold focus — without that idx>=0 gate, a focused
            // descendant (impossible today since only the radios
            // carry tabindex, but defensive) could trigger pick()
            // on Space/Enter via sideFor's row-walk.
            var radios = card.querySelectorAll('.notif-radio');
            var focused = document.activeElement;
            var idx = -1;
            for (var i = 0; i < radios.length; i++) {
                if (radios[i] === focused) { idx = i; break; }
            }
            if (idx < 0) return;
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                pick(focused.getAttribute('data-side'));
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                radios[(idx + 1) % radios.length].focus();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                radios[(idx - 1 + radios.length) % radios.length].focus();
            }
        });
    });
    return { load: load, pick: pick };
}());

// ===== Tyre pressure limits =====
// Five kPa integers (per-axle min/max + a shared critical floor) over
// /api/tyres/limits. Explicit Save rather than save-on-change: these
// are four interdependent numbers, and persisting a half-typed value
// would briefly arm a nonsense threshold on the notification path.
// The server clamps and enforces the invariants too — this module
// validates locally only to give immediate feedback.
window.TyreLimits = (function () {
    'use strict';
    var MIN = 80, MAX = 600;
    var DEFAULTS = {
        frontLow: 234, frontHigh: 310,
        rearLow: 234, rearHigh: 310,
        criticalLow: 152
    };
    var FIELDS = {
        frontLow: 'tyreFrontLow', frontHigh: 'tyreFrontHigh',
        rearLow: 'tyreRearLow', rearHigh: 'tyreRearHigh',
        criticalLow: 'tyreCriticalLow'
    };
    var inFlight = false;
    function $(id) { return document.getElementById(id); }
    // vars are passed through to BYD.i18n.t for {name} interpolation, and
    // applied to the fallback too so the English text stays correct when
    // the catalog hasn't loaded.
    function tr(k, fb, vars) {
        var v = (window.BYD && BYD.i18n && BYD.i18n.t) ? BYD.i18n.t(k, vars) : null;
        var s = v || fb || k;
        if (vars) {
            for (var name in vars) {
                if (!vars.hasOwnProperty(name)) continue;
                s = s.replace('{' + name + '}', vars[name]);
            }
        }
        return s;
    }
    function toast(msg, kind) {
        if (window.BYD && BYD.utils && BYD.utils.toast) BYD.utils.toast(msg, kind || 'info');
    }
    // The user's display unit ('kpa' | 'psi' | 'bar'). Kept in sync
    // with BYD.units.pressureMode so the rest of the page (and every
    // other page, via /status polling) renders pressure identically.
    var displayUnit = (window.BYD && BYD.units && BYD.units.pressureMode)
        ? BYD.units.pressureMode : 'psi';

    // Format a kPa value in the conversion-echo unit. The echo's job
    // is a cross-check against the kPa inputs, so when the display
    // unit IS kPa it echoes PSI (the historical behaviour) rather
    // than repeating the same number.
    function echoUnit() { return displayUnit === 'kpa' ? 'psi' : displayUnit; }
    function conv(kPa) {
        if (echoUnit() === 'bar') return (kPa / 100).toFixed(2);
        return (kPa * 0.1450377).toFixed(1);
    }
    function convLabel() { return echoUnit() === 'bar' ? 'bar' : 'PSI'; }

    function paint(vals) {
        for (var key in FIELDS) {
            if (!FIELDS.hasOwnProperty(key)) continue;
            var el = $(FIELDS[key]);
            if (el && typeof vals[key] === 'number') el.value = vals[key];
        }
        paintConversions();
    }

    // Echo the entered kPa in the display unit so a user working
    // from a PSI/bar placard can verify the numbers without
    // converting by hand. Reads the live inputs (not the saved
    // state) so it tracks typing.
    function paintConversions() {
        var v = readInputs();
        var f = $('tyreFrontConv'), r = $('tyreRearConv'), c = $('tyreCriticalConv');
        if (f) f.textContent = (v.frontLow !== null && v.frontHigh !== null)
            ? conv(v.frontLow) + ' – ' + conv(v.frontHigh) + ' ' + convLabel() : ' ';
        if (r) r.textContent = (v.rearLow !== null && v.rearHigh !== null)
            ? conv(v.rearLow) + ' – ' + conv(v.rearHigh) + ' ' + convLabel() : ' ';
        if (c) c.textContent = (v.criticalLow !== null)
            ? conv(v.criticalLow) + ' ' + convLabel() : ' ';
    }

    function paintUnitSeg() {
        var seg = $('tyreUnitSeg');
        if (!seg) return;
        var btns = seg.querySelectorAll('.notif-seg-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].setAttribute('aria-checked',
                btns[i].getAttribute('data-unit') === displayUnit ? 'true' : 'false');
        }
    }

    function applyUnit(unit, persist) {
        var previous = displayUnit;
        displayUnit = unit;
        if (window.BYD && BYD.units) BYD.units.pressureMode = unit;
        paintUnitSeg();
        paintConversions();
        if (!persist) return;
        // Revert the optimistic repaint if the POST fails — otherwise
        // this page renders a unit the server never accepted and the
        // next /status poll fights it back anyway.
        function revert() {
            applyUnit(previous, false);
            toast(tr('notif.tyre_unit_save_failed', 'Could not save display unit'), 'error');
        }
        // Persist immediately (no Save press) -- the segments behave
        // like the min-severity control, and the unit is independent
        // of the (validated, Save-gated) numeric limits.
        var fetcher = (typeof BYDAuth !== 'undefined' && BYDAuth.fetch)
            ? BYDAuth.fetch.bind(BYDAuth) : fetch;
        fetcher('/api/tyres/limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pressureUnit: unit })
        }).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (!j || j.success === false) {
                revert();
                return;
            }
            toast(tr('notif.tyre_unit_saved', 'Display unit saved'), 'success');
        }).catch(revert);
    }

    // null for a blank / non-integer field so validate() can tell
    // "empty" from a real 0.
    function readInputs() {
        var out = {};
        for (var key in FIELDS) {
            if (!FIELDS.hasOwnProperty(key)) continue;
            var el = $(FIELDS[key]);
            var raw = el ? el.value.trim() : '';
            var n = /^-?\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
            out[key] = isNaN(n) ? null : n;
        }
        return out;
    }

    function mark(key, bad) {
        var el = $(FIELDS[key]);
        if (!el) return;
        if (bad) el.classList.add('invalid');
        else el.classList.remove('invalid');
    }

    /** @return an error string, or null when the values are usable. */
    function validate(v) {
        var err = null;
        for (var key in FIELDS) {
            if (!FIELDS.hasOwnProperty(key)) continue;
            var bad = v[key] === null || v[key] < MIN || v[key] > MAX;
            mark(key, bad);
            if (bad && !err) {
                // Bounds are interpolated, not baked into the string, so
                // retuning MIN/MAX can't leave every locale quoting stale
                // numbers (the server's equivalent message is already
                // placeholder-driven).
                err = tr('notif.tyre_err_range',
                         'Enter a whole number between {min} and {max} kPa.',
                         { min: MIN, max: MAX });
            }
        }
        if (err) return err;
        // Crossed pairs would invert the comparison and either alert
        // constantly or never.
        if (v.frontHigh <= v.frontLow) {
            mark('frontLow', true); mark('frontHigh', true);
            return tr('notif.tyre_err_order', 'The maximum must be higher than the minimum.');
        }
        if (v.rearHigh <= v.rearLow) {
            mark('rearLow', true); mark('rearHigh', true);
            return tr('notif.tyre_err_order', 'The maximum must be higher than the minimum.');
        }
        // A critical floor above an axle minimum makes the warning band
        // unreachable for that axle.
        if (v.criticalLow > Math.min(v.frontLow, v.rearLow)) {
            mark('criticalLow', true);
            return tr('notif.tyre_err_critical', 'The critical value must not exceed either axle minimum.');
        }
        return null;
    }

    // Re-run validation on every keystroke and repaint ALL five rings from
    // the result. Clearing only the edited field's ring (the previous
    // approach) left its partner stuck red after a cross-field failure:
    // "max must be higher than min" marks BOTH inputs, so fixing the min
    // cleared the min but left a now-perfectly-valid max ringed until the
    // next Save. Rings are only ever CLEARED here, never newly shown —
    // showing errors mid-typing would flag every half-entered number.
    function reflectValidity() {
        var v = readInputs();
        var before = {};
        var key;
        for (key in FIELDS) {
            if (!FIELDS.hasOwnProperty(key)) continue;
            var el = $(FIELDS[key]);
            before[key] = !!(el && el.className.indexOf('invalid') >= 0);
        }
        // validate() repaints every ring as a side effect; capture whether
        // anything was already flagged so we can avoid introducing new
        // rings for fields the user hasn't finished typing.
        validate(v);
        for (key in FIELDS) {
            if (!FIELDS.hasOwnProperty(key)) continue;
            if (!before[key]) mark(key, false);
        }
    }

    function setBusy(busy) {
        inFlight = busy;
        var save = $('tyreLimitsSave'), reset = $('tyreLimitsReset');
        if (save) save.classList.toggle('disabled', busy);
        if (reset) reset.classList.toggle('disabled', busy);
    }

    function load() {
        // Paint the defaults first so the fields are never empty during
        // the fetch — an empty numeric field reads as "unset", which
        // would be wrong (a limit is always in force).
        paint(DEFAULTS);
        var fetcher = (typeof BYDAuth !== 'undefined' && BYDAuth.fetch)
            ? BYDAuth.fetch.bind(BYDAuth) : fetch;
        fetcher('/api/tyres/limits', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                // Unit first, then limits: paint(limits) repaints the
                // conversion echoes, which must use the loaded unit.
                if (j && (j.pressureUnit === 'kpa' || j.pressureUnit === 'psi'
                        || j.pressureUnit === 'bar')) {
                    applyUnit(j.pressureUnit, false);
                }
                if (j && j.limits) paint(j.limits);
            })
            .catch(function () {
                // Leave the defaults painted and say so, rather than
                // implying these are the persisted values.
                var hint = $('tyreLimitsHint');
                if (hint) hint.textContent =
                    tr('notif.tyre_load_failed', 'Could not load saved limits — showing defaults.');
            });
    }

    function save() {
        if (inFlight) return;
        var v = readInputs();
        var err = validate(v);
        var hint = $('tyreLimitsHint');
        if (err) {
            if (hint) hint.textContent = err;
            toast(err, 'error');
            return;
        }
        if (hint) hint.textContent = '';
        setBusy(true);
        var fetcher = (typeof BYDAuth !== 'undefined' && BYDAuth.fetch)
            ? BYDAuth.fetch.bind(BYDAuth) : fetch;
        fetcher('/api/tyres/limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(v)
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        }).then(function (data) {
            setBusy(false);
            if (!data || data.success === false || data.ok === false) {
                var m = (data && data.error)
                    ? data.error
                    : tr('notif.tyre_save_failed', 'Could not save tyre limits');
                if (hint) hint.textContent = m;
                toast(m, 'error');
                return;
            }
            // Repaint from the server's echo: it clamps, so the stored
            // value can legitimately differ from what was typed and the
            // user should see what actually took effect.
            if (data.limits) paint(data.limits);
            toast(tr('notif.tyre_saved', 'Tyre limits saved'), 'success');
        }).catch(function () {
            setBusy(false);
            var m = tr('notif.tyre_save_failed', 'Could not save tyre limits');
            if (hint) hint.textContent = m;
            toast(m, 'error');
        });
    }

    // Repopulate the fields with the shipped defaults. Deliberately
    // does NOT persist — the user still has to press Save, so a
    // mis-tap is recoverable by navigating away.
    function reset() {
        if (inFlight) return;
        paint(DEFAULTS);
        for (var key in FIELDS) {
            if (FIELDS.hasOwnProperty(key)) mark(key, false);
        }
        var hint = $('tyreLimitsHint');
        if (hint) hint.textContent =
            tr('notif.tyre_reset_hint', 'Defaults restored — press Save to apply.');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var save_ = $('tyreLimitsSave'), reset_ = $('tyreLimitsReset');
        if (save_) save_.addEventListener('click', save);
        if (reset_) reset_.addEventListener('click', reset);
        for (var key in FIELDS) {
            if (!FIELDS.hasOwnProperty(key)) continue;
            var el = $(FIELDS[key]);
            if (!el) continue;
            el.addEventListener('input', paintConversions);
            el.addEventListener('input', reflectValidity);
        }
        // Unit segments: delegated click, tap = apply + persist.
        var seg = $('tyreUnitSeg');
        if (seg) {
            seg.addEventListener('click', function (e) {
                var btn = e.target && e.target.closest
                    ? e.target.closest('.notif-seg-btn') : null;
                if (!btn) return;
                var unit = btn.getAttribute('data-unit');
                if (unit && unit !== displayUnit) applyUnit(unit, true);
            });
        }
        paintUnitSeg();
    });

    return { load: load, save: save, reset: reset };
}());

// ==================== ORIGIN GATE ====================
// Dev escape hatch: ?devPwa=1 lets the page run its full flow against
// a localhost preview server (dev/preview-server.py). Chrome treats
// localhost as a secure context for SW + push, so the install +
// subscribe + UI flow all behave like production.
var DEV_PWA = /[?&]devPwa=1\b/.test(window.location.search);
var ORIGIN_OK = (function () {
    if (DEV_PWA) return true;
    var host = window.location.hostname || '';
    var loopback = host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0';
    var insecure = !window.isSecureContext;
    var cloudflare = /[a-z0-9-]*\.trycloudflare\.com/i.test(host);
    return !(loopback || insecure || cloudflare);
})();
var notZrok  = !/\.share\.zrok\.io$/i.test(window.location.hostname);

if (notZrok) {
    var b = document.getElementById('originBanner');
    if (b) b.style.display = '';
}
if (!ORIGIN_OK) {
    ['enableBtn', 'testBtn', 'disableBtn'].forEach(function (id) {
        var x = document.getElementById(id);
        if (x) { x.classList.add('disabled'); x.disabled = true; }
    });
}

var state = {
    categories: [],
    currentSubscriptionId: null,
    muted: new Set(),
    // Whether state.muted reflects this device's SAVED preferences
    // (loadSubscriptions found our row) vs. is still the empty
    // pre-load default. Until prefs are loaded, renderCategories falls
    // back to each category's registry `defaultEnabled` so a
    // default-off category (surveillance notice, doors) doesn't flash
    // ON before the saved prefs arrive. Mirrors the server, which now
    // seeds a new subscription's mutes from defaultEnabled.
    mutedLoaded: false,
    minSeverity: 'info',
    backendReady: false
};

function showStatus(kind, message) {
    var el = document.getElementById('status');
    if (!el) return;
    el.className = 'notif-status ' + kind;
    el.textContent = message;
    el.style.display = '';
}
function hideStatus() {
    var el = document.getElementById('status');
    if (el) el.style.display = 'none';
}

// TypeError is what fetch() throws on DNS failure / connection
// refused / ERR_NAME_NOT_RESOLVED. Distinguish that from HTTP-level
// failures so we can surface "tunnel unreachable" once instead of
// letting every caller spam its own generic "could not load" toast
// when the zrok host stops resolving.
function isNetworkError(e) {
    return e && (e.name === 'TypeError' || /Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED/i.test(e.message || ''));
}
var _tunnelBannerShown = false;
function showTunnelUnreachable() {
    if (_tunnelBannerShown) return;
    _tunnelBannerShown = true;
    showStatus('error', BYD.i18n.t('notif.tunnel_unreachable'));
}

// ES5-safe property walks. Optional chaining (`?.`) is ES2020 and
// throws SyntaxError on the BYD head-unit's Chrome 58 WebView; a
// single `?.` anywhere in this <script> block aborts the ENTIRE
// block at parse time, which is what kept SurvSettings.initTelegram
// Only() and TelegramPrefs.load() from ever running inside the
// shell — the toggles rendered in their HTML default state (OFF)
// because nothing painted them from the server response.
function isPwaInstalled() {
    var standaloneMq = (typeof window !== 'undefined' && window.matchMedia)
        ? window.matchMedia('(display-mode: standalone)') : null;
    if (standaloneMq && standaloneMq.matches) return true;
    return !!(window && window.navigator && window.navigator.standalone === true);
}

async function getPushSubscription() {
    var sw = (typeof navigator !== 'undefined' && navigator.serviceWorker) || null;
    var reg = sw ? await sw.getRegistration() : null;
    var pm = (reg && reg.pushManager) || null;
    var sub = pm ? await pm.getSubscription() : null;
    return { reg: reg, sub: sub };
}

async function permissionLabel() {
    if (!ORIGIN_OK) {
        return BYD.i18n.t('notif.perm_zrok_required');
    }
    if (typeof Notification === 'undefined') {
        if (!isPwaInstalled()) return BYD.i18n.t('notif.perm_unsupported_install');
        return BYD.i18n.t('notif.perm_unsupported');
    }
    const { sub } = await getPushSubscription();
    const perm = Notification.permission;
    if (perm === 'denied') return BYD.i18n.t('notif.perm_denied');
    // Notification.permission can be granted even when subscription has been removed
    if (sub) return BYD.i18n.t('notif.perm_granted');
    return BYD.i18n.t('notif.perm_default');
}

async function refreshPermissionUI() {
    var stateEl = document.getElementById('permissionState');
    var rowEl = document.getElementById('permissionRow');
    if (stateEl) stateEl.textContent = await permissionLabel();
    if (rowEl) {
        rowEl.classList.remove('granted', 'denied', 'default');
        if (!ORIGIN_OK) {
            rowEl.classList.add('denied');
        } else if (typeof Notification !== 'undefined') {
            rowEl.classList.add(Notification.permission);
        }
    }
    // When origin can't host a service worker, every action button stays
    // disabled. The earlier ORIGIN_OK block already added the disabled
    // class — don't undo it here.
    if (!ORIGIN_OK) return;

    const { sub } = await getPushSubscription();
    var enableBtn = document.getElementById('enableBtn');
    var disableBtn = document.getElementById('disableBtn');
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
        if (enableBtn) { enableBtn.classList.add('disabled'); enableBtn.disabled = true; }
    } else if (sub) {
        if (enableBtn) enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = '';
    } else {
        if (enableBtn) enableBtn.style.display = '';
        if (disableBtn) disableBtn.style.display = 'none';
    }
}

// Static preview registry — used only in PREVIEW_MODE so the layout
// can be reviewed off a plain static server (no /api routes available).
// Production reads the real JSON via /api/notifications/categories
// which is itself fed from app/src/main/assets/notifications-categories.json.
var PREVIEW_REGISTRY = {
    version: 1,
    categories: [
        { id: 'surveillance.motion', label: 'Motion detected (legacy)', group: 'Surveillance',
          defaultEnabled: false, severity: 'auto',
          defaultClickUrl: '/events.html?filter=sentry',
          note: 'Legacy single-stream category, kept for backwards compatibility. Prefer the three Notice / Alert / Critical tiers below.' },
        { id: 'surveillance.motion.notice', label: 'Surveillance — Notice', group: 'Surveillance',
          defaultEnabled: false, severity: 'info',
          defaultClickUrl: '/events.html?filter=sentry',
          note: 'Routine motion or passing-by. Off by default — turn on if you want a record of every event.' },
        { id: 'surveillance.motion.alert', label: 'Surveillance — Alert', group: 'Surveillance',
          defaultEnabled: true, severity: 'warn',
          defaultClickUrl: '/events.html?filter=sentry',
          note: 'Person near the vehicle, vehicle approaching, or close-range activity.' },
        { id: 'surveillance.motion.critical', label: 'Surveillance — Critical', group: 'Surveillance',
          defaultEnabled: true, severity: 'critical',
          defaultClickUrl: '/events.html?filter=sentry',
          note: 'Person at very close range or sustained dwell at the vehicle. Drop-everything alert.' },
        { id: 'surveillance.proximity', label: 'Proximity alert', group: 'Surveillance',
          defaultEnabled: true, severity: 'auto',
          defaultClickUrl: '/events.html?filter=proximity',
          note: 'Range and trigger depend on Recording settings' },
        { id: 'vehicle.health.tyre.pressure', label: 'Tyre pressure alarm', group: 'Vehicle',
          defaultEnabled: true, severity: 'warn',
          defaultClickUrl: '/vehicle-control.html',
          note: 'Underpressure or overpressure detected by TPMS' },
        { id: 'vehicle.health.tyre.leak', label: 'Tyre leak detected', group: 'Vehicle',
          defaultEnabled: true, severity: 'auto',
          defaultClickUrl: '/vehicle-control.html',
          note: 'Slow or fast leak detected by TPMS sensor' },
        { id: 'vehicle.security.login.success', label: 'New sign-in', group: 'Security',
          defaultEnabled: true, severity: 'warn',
          defaultClickUrl: '/sessions.html',
          note: 'A browser signed in to the web app with the access code (shows the browser and address)' },
        { id: 'vehicle.security.login.failed', label: 'Failed sign-in', group: 'Security',
          defaultEnabled: true, severity: 'auto',
          defaultClickUrl: '/notifications.html',
          note: 'Wrong access code or too many attempts. At most one alert a minute; 10 or more attempts send a critical alert' },
        { id: 'vehicle.security.door.opened', label: 'Door opened', group: 'Security',
          defaultEnabled: false, severity: 'warn',
          defaultClickUrl: '/vehicle-control.html',
          note: 'Fires when any door, hood, or trunk is opened while parked (ACC OFF)' },
        { id: 'vehicle.security.door.closed', label: 'Door closed', group: 'Security',
          defaultEnabled: false, severity: 'info',
          defaultClickUrl: '/vehicle-control.html',
          note: 'Fires when any door, hood, or trunk is closed while parked (ACC OFF)' },
        { id: 'vehicle.charging.started', label: 'Charging started', group: 'Charging',
          defaultEnabled: true, severity: 'info',
          defaultClickUrl: '/vehicle-control.html',
          note: 'Fires when the BMS reports a charging session has begun' },
        { id: 'vehicle.charging.stopped', label: 'Charging stopped', group: 'Charging',
          defaultEnabled: true, severity: 'info',
          defaultClickUrl: '/vehicle-control.html',
          note: 'Debounced 10s to ride out brief gaps during plug-in or DC charger handshakes' },
        { id: 'vehicle.charging.full', label: 'Charging complete', group: 'Charging',
          defaultEnabled: true, severity: 'warn', bypassQuietHours: true,
          defaultClickUrl: '/vehicle-control.html',
          note: 'Fires once per session when the pack reaches near-full or the BMS marks the session FINISHED. Suppressed if you plug in an already-full car. Bypasses quiet hours so you wake up to an unplug reminder.' },
        { id: 'vehicle.charging.fault', label: 'Charging fault', group: 'Charging',
          defaultEnabled: true, severity: 'critical',
          defaultClickUrl: '/vehicle-control.html',
          note: 'AC, DC charger, charging gun, or C10 breakdown reported by BMS' }
    ]
};

async function loadCategories() {
    var container = document.getElementById('categoriesContainer');

    // In preview mode, skip the network call and render the static
    // registry directly so the layout populates without a backend.
    if (PREVIEW_MODE) {
        state.categories = PREVIEW_REGISTRY.categories;
        state.backendReady = false;
        renderCategories();
        return;
    }

    try {
        var r = await BYDAuth.fetch('/api/notifications/categories');
        if (r.status === 503) {
            state.backendReady = false;
            var bb = document.getElementById('backendBanner');
            if (bb) bb.style.display = '';
            if (container) container.innerHTML = '<div class="ui-panel notif-card"><div class="ui-empty">' + escapeHtml(BYD.i18n.t('notif.backend_not_ready')) + '</div></div>';
            return;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var meta = await r.json();
        state.categories = meta.categories || [];
        state.backendReady = true;
        renderCategories();
    } catch (e) {
        if (container) container.innerHTML = '<div class="ui-panel notif-card"><div class="ui-empty">' + escapeHtml(BYD.i18n.t('notif.categories_load_failed')) + '</div></div>';
        if (isNetworkError(e)) {
            showTunnelUnreachable();
        } else {
            showStatus('error', BYD.i18n.t('notif.categories_load_error', {error: (e && e.message ? e.message : e)}));
        }
    }
}

function severityClass(sev) {
    if (sev === 'critical') return 'critical';
    if (sev === 'warn') return 'warn';
    if (sev === 'auto') return 'auto';
    return '';
}

function severityTooltip(sev) {
    switch (sev) {
        case 'critical': return BYD.i18n.t('notif.sev_critical');
        case 'warn':     return BYD.i18n.t('notif.sev_warn');
        case 'auto':     return BYD.i18n.t('notif.sev_auto');
        default:         return BYD.i18n.t('notif.sev_info');
    }
}


// Used when the registry doesn't ship a `note` for a category.
// Keep the wording short and concrete — describes what triggers it
// (the head unit's detection logic), not what it does (push it).
function categoryDescription(id) {
    var fallbacks = {
        'surveillance.motion': 'Fires when the surveillance engine detects motion near the parked car. Severity scales with detection confidence.',
        'surveillance.proximity': 'Fires when proximity radar detects an object close to the vehicle. RED (<0.5 m) is critical, YELLOW (<0.8 m) is warn.',
        'surveillance.recording.finalized': 'Fires after a recording is written to disk and is ready to view. Off by default.',
        'vehicle.health.tyre.pressure': 'Fires when the TPMS reports underpressure or overpressure on any wheel.',
        'vehicle.health.tyre.leak': 'Fires when the TPMS detects a slow or fast leak. Fast leaks are pushed as critical.',
        'vehicle.security.login.success': 'Fires when a browser signs in to the web app with the access code.',
        'vehicle.security.login.failed': 'Fires when a sign-in uses the wrong access code or is paused for too many attempts. At most one alert a minute, plus a critical one for 10 or more attempts.',
        'vehicle.security.door.opened': 'Fires when a door, hood, or trunk is opened while the car is parked (ACC OFF).',
        'vehicle.security.door.closed': 'Fires when a door, hood, or trunk is closed while the car is parked (ACC OFF).'
    };
    if (!fallbacks[id]) return '';
    return categoryText('descriptions', id, fallbacks[id]);
}

// The registry (/api/notifications/categories) ships English label,
// group and note text. Translate them on the client by category id so
// the page follows the web UI language; unknown ids keep the raw text.
function i18nOr(key, fallback) {
    var v = (window.BYD && BYD.i18n && BYD.i18n.t) ? BYD.i18n.t(key) : null;
    return v && v !== key ? v : fallback;
}
function categorySlug(id) {
    return String(id || '').replace(/[^A-Za-z0-9]+/g, '_');
}
function categoryText(kind, id, fallback) {
    if (!id) return fallback;
    return i18nOr('notif.category_' + kind + '.' + categorySlug(id), fallback);
}
function categoryGroupLabel(group) {
    var raw = group || 'Other';
    return i18nOr('notif.category_groups.' + categorySlug(raw).toLowerCase(), raw);
}
function severityName(sev) {
    var raw = sev || 'info';
    return i18nOr('notif.severity_names.' + categorySlug(raw), raw);
}

function renderCategories() {
    var container = document.getElementById('categoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    // Hide categories that are kept in the registry for backwards-
    // compatibility but shouldn't be user-visible. The legacy
    // "surveillance.motion" single-stream category is superseded
    // by the Notice / Alert / Critical tier set below it.
    var HIDDEN_IDS = { 'surveillance.motion': true };
    var visible = state.categories.filter(function (c) {
        return !HIDDEN_IDS[c.id];
    });

    if (visible.length === 0) {
        container.innerHTML = '<div class="ui-panel notif-card"><div class="ui-empty">' + escapeHtml(BYD.i18n.t('notif.no_categories')) + '</div></div>';
        return;
    }

    // Group by 'group'
    var groups = {};
    var order = [];
    visible.forEach(function (c) {
        var g = categoryGroupLabel(c.group);
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(c);
    });

    order.forEach(function (g) {
        var section = document.createElement('div');
        section.className = 'notif-section';
        section.innerHTML = '<h2>' + escapeHtml(g) + '</h2>';
        var card = document.createElement('div');
        card.className = 'notif-card';

        // Toggles are interactive only when this device actually has
        // a registered push subscription. Otherwise the per-category
        // preference has nowhere to apply, so render them inactive.
        var hasSubscription = !!state.currentSubscriptionId;
        groups[g].forEach(function (c) {
            // Enabled = subscribed AND not muted. Before this device's
            // saved prefs have loaded (mutedLoaded=false), fall back to
            // the registry's defaultEnabled so a default-off category
            // doesn't briefly render ON — matching the server, which
            // seeds a new subscription's mutes from defaultEnabled.
            var muted = state.mutedLoaded
                ? state.muted.has(c.id)
                : (c.defaultEnabled === false);
            var enabled = hasSubscription && !muted;
            var row = document.createElement('div');
            row.className = 'notif-row';
            var description = categoryText('notes', c.id, c.note) || categoryDescription(c.id);
            var toggleClasses = ['notif-toggle'];
            if (enabled) toggleClasses.push('on');
            if (!hasSubscription) toggleClasses.push('inactive');
            row.innerHTML =
                '<div class="notif-row-text ui-row ui-row-stack">' +
                    '<div class="notif-row-label">' + escapeHtml(categoryText('labels', c.id, c.label || c.id)) +
                        '<span class="notif-sev-pill ' + severityClass(c.severity) + '" tabindex="0">' +
                            escapeHtml(severityName(c.severity)) +
                            '<span class="notif-sev-tooltip">' +
                                escapeHtml(severityTooltip(c.severity)) +
                            '</span>' +
                        '</span>' +
                    '</div>' +
                    (description ? '<div class="notif-row-note ui-row-desc">' + escapeHtml(description) + '</div>' : '') +
                '</div>' +
                '<div class="' + toggleClasses.join(' ') + '" data-cat="' + escapeAttr(c.id) + '" role="switch" aria-checked="' + enabled + '" aria-disabled="' + (!hasSubscription) + '" tabindex="0"></div>';
            card.appendChild(row);
        });
        section.appendChild(card);
        container.appendChild(section);
    });

    container.querySelectorAll('.notif-toggle').forEach(function (t) {
        t.addEventListener('click', function () { onToggle(t.dataset.cat, t); });
    });
}

async function onToggle(catId, el) {
    if (!state.currentSubscriptionId) {
        showStatus('warn', BYD.i18n.t('notif.enable_first'));
        return;
    }
    if (state.muted.has(catId)) state.muted.delete(catId);
    else state.muted.add(catId);
    el.classList.toggle('on');

    var muted = Array.from(state.muted);
    try {
        await BYDAuth.fetch('/api/push/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: state.currentSubscriptionId,
                mutedCategories: muted
            })
        });
    } catch (e) {
        if (isNetworkError(e)) showTunnelUnreachable();
        else showStatus('error', BYD.i18n.t('notif.save_pref_failed'));
    }
}

// Paint the minimum-importance segmented control from state. Disabled
// (and shows the "enable first" hint) until this device is subscribed,
// mirroring the category toggles.
function renderMinSeverity() {
    var seg = document.getElementById('minSeveritySeg');
    var hint = document.getElementById('minSeverityHint');
    if (!seg) return;
    var hasSubscription = !!state.currentSubscriptionId;
    var current = (state.minSeverity || 'info').toLowerCase();
    var btns = seg.querySelectorAll('.notif-seg-btn');
    for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-sev') === current;
        btns[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
    if (hasSubscription) seg.classList.remove('disabled');
    else seg.classList.add('disabled');
    if (hint) hint.style.display = hasSubscription ? 'none' : '';
}

async function setMinSeverity(sev) {
    if (!state.currentSubscriptionId) {
        showStatus('warn', BYD.i18n.t('notif.enable_first'));
        return;
    }
    sev = (sev || 'info').toLowerCase();
    if (sev !== 'info' && sev !== 'warn' && sev !== 'critical') return;
    if (sev === (state.minSeverity || 'info').toLowerCase()) return;
    var prev = state.minSeverity;
    state.minSeverity = sev;      // optimistic
    renderMinSeverity();
    function revert() {
        // Only revert if nothing newer superseded this request. A rapid
        // second tap (info→warn→critical) launches concurrent POSTs;
        // without this guard a failed EARLIER request would clobber a
        // later value the UI already moved to. We only own the revert
        // when the displayed value is still the one WE set.
        if ((state.minSeverity || 'info').toLowerCase() !== sev) return;
        state.minSeverity = prev;
        renderMinSeverity();
    }
    try {
        var r = await BYDAuth.fetch('/api/push/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: state.currentSubscriptionId,
                minSeverity: sev
            })
        });
        // BYDAuth.fetch only throws on 401/network — a 400/404/500
        // (e.g. the sub row was removed on another device) resolves
        // normally, so check r.ok explicitly or the UI would keep
        // claiming a floor the server never accepted.
        if (!r || !r.ok) {
            revert();
            showStatus('error', BYD.i18n.t('notif.save_pref_failed'));
        }
    } catch (e) {
        // Revert so the UI never claims a floor the server didn't take.
        revert();
        if (isNetworkError(e)) showTunnelUnreachable();
        else showStatus('error', BYD.i18n.t('notif.save_pref_failed'));
    }
}

(function wireMinSeverity() {
    var seg = document.getElementById('minSeveritySeg');
    if (!seg) return;
    seg.addEventListener('click', function (ev) {
        var btn = ev.target;
        while (btn && btn !== seg && !btn.getAttribute('data-sev')) {
            btn = btn.parentNode;
        }
        if (btn && btn.getAttribute && btn.getAttribute('data-sev')) {
            setMinSeverity(btn.getAttribute('data-sev'));
        }
    });
})();

// SHA-256 first 12 bytes of endpoint, base64url no-padding — matches
// SubscriptionStore.idForEndpoint on the server.
async function localIdForEndpoint(endpoint) {
    try {
        if (!window.crypto || !window.crypto.subtle) return null;
        var enc = new TextEncoder().encode(endpoint);
        var hash = await crypto.subtle.digest('SHA-256', enc);
        var bytes = new Uint8Array(hash).slice(0, 12);
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) { return null; }
}

async function loadSubscriptions() {
    try {
        var r = await BYDAuth.fetch('/api/push/subscriptions');
        if (r.status === 503) return;
        if (!r.ok) return;
        var data = await r.json();
        var subs = data.subscriptions || [];

        // Resolve which row corresponds to THIS browser BEFORE rendering
        // so the row UI can flag it. Without that flag the user has no
        // way to tell which row is theirs and may click "Remove" on a
        // peer device when they meant to disable here.
        var localId = null;
        if ('serviceWorker' in navigator) {
            try {
                const { reg, sub } = await getPushSubscription();
                if (sub) localId = await localIdForEndpoint(sub.endpoint);
            } catch (_) { /* localId stays null */ }
        }

        // Fall back to the id the /subscribe call returned (stored as
        // currentSubscriptionId) when the service worker isn't
        // controlling yet and getPushSubscription() couldn't derive the
        // endpoint hash. Same value (server idForEndpoint == the derived
        // localId), so this correctly flags "this device" AND lets us
        // resolve our row to load the real prefs — without it, a freshly
        // enabled device leaves currentSubscriptionId set but mutedLoaded
        // false and state.muted empty, so the control stays stuck in the
        // disabled paint and a category toggle would persist a mute set
        // that's missing the server-seeded defaults.
        if (!localId) localId = state.currentSubscriptionId;

        renderDevices(subs, localId);

        if (!localId) return;
        var found = subs.find(function (s) { return s.id === localId; });
        if (found) {
            state.currentSubscriptionId = found.id;
            state.muted = new Set(found.mutedCategories || []);
            state.mutedLoaded = true;
            state.minSeverity = found.minSeverity || 'info';
            renderCategories();
            renderMinSeverity();
        }
    } catch (e) {
        // Network-level failure (zrok host stopped resolving while
        // the page is still open). Surface ONE banner instead of
        // letting the caller's silent catch eat it — the page is
        // otherwise functionless until the tunnel is back.
        if (isNetworkError(e)) showTunnelUnreachable();
        /* otherwise swallow — page still works without subs list */
    }
}

function renderDevices(subs, localId) {
    var card = document.getElementById('devicesCard');
    if (!card) return;
    if (!subs.length) {
        card.innerHTML = '<div class="ui-empty">' + escapeHtml(BYD.i18n.t('notif.no_devices')) + '</div>';
        return;
    }
    card.innerHTML = '';
    subs.forEach(function (s) {
        var row = document.createElement('div');
        row.className = 'device-row';
        var lastSeen = s.lastSeenAt
            ? new Date(s.lastSeenAt).toLocaleString()
            : BYD.i18n.t('notif.device_never');
        var isThis = localId && s.id === localId;
        // "(this device)" tag is rendered as a small subdued chip so
        // the user can pick the right row to remove. It's also the
        // signal removeDevice() uses to do a FULL local+server
        // unsubscribe instead of the previous server-only path.
        var thisDeviceTag = isThis
            ? ' <span class="device-row-self" data-i18n="notif.device_this_device">(this device)</span>'
            : '';
        var btnLabel = isThis
            ? BYD.i18n.t('notif.device_remove_this')
            : BYD.i18n.t('notif.device_remove');
        row.innerHTML =
            '<div class="device-row-top">' +
                '<div>' +
                    '<div class="device-row-label">' + escapeHtml(s.label || BYD.i18n.t('notif.unnamed_device')) + thisDeviceTag + '</div>' +
                    '<div class="device-row-meta">' + escapeHtml(BYD.i18n.t('notif.device_last_seen', {time: lastSeen})) + '</div>' +
                '</div>' +
                '<button class="notif-btn danger" data-id="' + escapeAttr(s.id) + '"' +
                    (isThis ? ' data-self="1"' : '') + '>' +
                    escapeHtml(btnLabel) + '</button>' +
            '</div>';
        card.appendChild(row);
    });
    card.querySelectorAll('button[data-id]').forEach(function (b) {
        b.addEventListener('click', function () {
            removeDevice(b.dataset.id, b.dataset.self === '1');
        });
    });
}

async function removeDevice(id, isThisDevice) {
    if (!confirm(BYD.i18n.t('notif.remove_device_confirm'))) return;
    try {
        if (isThisDevice && window.OverdrivePush) {
            // Full unsubscribe path: clears the browser-side push
            // manager subscription AND the server row. Without this,
            // removing your own row used to leave the browser
            // holding a live subscription that any subsequent
            // /api/push/subscribe POST would resurrect server-side.
            await window.OverdrivePush.unsubscribe();
            await loadSubscriptions();
        } else {
            // Peer-device removal: server-only is correct (we can't
            // reach into another phone's PushManager). The new
            // server-side tombstone (TOMBSTONE_WINDOW_MS) prevents
            // that device from re-subscribing silently — when its
            // pwa-init.js runs, postSubscription returns 410 and
            // the local self-heal aborts.
            var resp = await BYDAuth.fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            if (!resp.ok) {
                showStatus('error', BYD.i18n.t('notif.remove_device_failed'));
                return;
            }
            var body = null;
            try { body = await resp.json(); } catch (_) {}
            if (body && body.success === false) {
                showStatus('error', BYD.i18n.t('notif.remove_device_failed'));
                return;
            }
            await loadSubscriptions();
            // Tell the user the tombstone is in effect — without
            // this banner the user has no way to know that the peer
            // device is now blocked from silently re-registering
            // for the next 30 min, which is exactly the guarantee
            // they wanted when they clicked Remove.
            showStatus('ok', BYD.i18n.t('notif.remove_device_tombstoned'));
        }
    } catch (e) {
        if (isNetworkError(e)) showTunnelUnreachable();
        else showStatus('error', BYD.i18n.t('notif.remove_device_failed'));
    }
}

var enableBtnEl = document.getElementById('enableBtn');
if (enableBtnEl) enableBtnEl.addEventListener('click', async function () {
    hideStatus();
    if (!ORIGIN_OK) return;
    if (!window.OverdrivePush) {
        showStatus('error', BYD.i18n.t('notif.pwa_not_loaded'));
        return;
    }
    try {
        var result = await window.OverdrivePush.requestAndSubscribe();
        if (!result.ok) {
            // subscribe-failed is the only reason that carries a
            // browser-level DOMException — Samsung Internet without
            // GMS, Brave with shields, Edge when WNS is offline. The
            // user can't fix any of those from our UI, but they CAN
            // see why and try a different browser. For other reasons
            // (permission-denied, no-vapid-key, backend-unreachable,
            // register-failed) the static toast text is enough.
            if (result.reason === 'subscribe-failed' && result.error) {
                showStatus('error', BYD.i18n.t('notif.subscribe_browser_error', {error: result.error}));
            } else {
                var reasonText = result.error ? (result.reason + ' (' + result.error + ')') : result.reason;
                showStatus('error', BYD.i18n.t('notif.enable_could_not', {reason: reasonText}));
            }
            return;
        }
        state.currentSubscriptionId = result.id;
        await refreshPermissionUI();
        await loadSubscriptions();
        // loadSubscriptions re-renders when it resolves our row, but it
        // early-returns if /subscriptions is unreachable (503/!ok). Paint
        // here too so the just-enabled control leaves its disabled state
        // even on that path — symmetric with the disable handler.
        renderCategories();
        renderMinSeverity();
        showStatus('ok', BYD.i18n.t('notif.enable_success'));
    } catch (e) {
        showStatus('error', BYD.i18n.t('notif.enable_failed', {error: (e && e.message ? e.message : e)}));
    }
});

var disableBtnEl = document.getElementById('disableBtn');
if (disableBtnEl) disableBtnEl.addEventListener('click', async function () {
    hideStatus();
    try {
        if (window.OverdrivePush) await window.OverdrivePush.unsubscribe();
        state.currentSubscriptionId = null;
        // Reset per-device prefs so the category toggles revert to the
        // registry default paint and the min-importance control shows
        // its disabled state — loadSubscriptions early-returns without a
        // localId, so re-render both here.
        state.mutedLoaded = false;
        state.muted = new Set();
        state.minSeverity = 'info';
        await refreshPermissionUI();
        await loadSubscriptions();
        renderCategories();
        renderMinSeverity();
        showStatus('ok', BYD.i18n.t('notif.disabled_on_device'));
    } catch (e) {
        showStatus('error', BYD.i18n.t('notif.disable_failed', {error: (e && e.message ? e.message : e)}));
    }
});

var testBtnEl = document.getElementById('testBtn');
if (testBtnEl) testBtnEl.addEventListener('click', async function () {
    hideStatus();
    try {
        // Send this device's id so the server delivers the test ONLY
        // here (and bypasses this device's mute/floor so the test isn't
        // hidden by a default-muted category or a raised floor). Only
        // include id when we actually have one — a JSON null would be
        // read as the string "null" by the server's optString and match
        // no device. With no id the server broadcasts to all, prefs
        // honoured (the pre-existing behaviour).
        var testBody = { severity: 'info' };
        if (state.currentSubscriptionId) testBody.id = state.currentSubscriptionId;
        var r = await BYDAuth.fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testBody)
        });
        if (r.status === 503) {
            showStatus('warn', BYD.i18n.t('notif.backend_not_initialized'));
            return;
        }
        if (!r.ok) {
            showStatus('error', BYD.i18n.t('notif.test_failed_http', {status: r.status}));
            return;
        }
        showStatus('ok', BYD.i18n.t('notif.test_sent'));
    } catch (e) {
        if (isNetworkError(e)) showTunnelUnreachable();
        else showStatus('error', BYD.i18n.t('notif.test_failed', {error: (e && e.message ? e.message : e)}));
    }
});

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }

// ===== Notification Log tab wiring =====
// The Log tab reads persisted history via NOTIFLOG (notif-log.js). Two
// hooks: (1) lazy-load the log the first time the tab becomes active so
// the page's first paint stays cheap; (2) hide the always-visible
// Vehicle-layout picker and Tyre-limits card while the Log tab is
// active (both are untagged so app-tabs keeps them on every tab
// otherwise). Also refresh the log's relative timestamps whenever the
// user returns to it.
function nlSyncChrome(activeId) {
    var hideOnLog = ['driveSideSection', 'tyreLimitsSection'];
    for (var i = 0; i < hideOnLog.length; i++) {
        var el = document.getElementById(hideOnLog[i]);
        if (el) el.style.display = (activeId === 'log') ? 'none' : '';
    }
    if (activeId === 'log' && window.NOTIFLOG) {
        if (!NOTIFLOG.loaded) NOTIFLOG.ensureLoaded();
        else NOTIFLOG.load();
    }
}
document.addEventListener('ot-tabs:active-changed', function (ev) {
    var id = (ev && ev.detail) ? ev.detail.id : null;
    if (id) nlSyncChrome(id);
});

// Resolve the active tab on load and sync chrome SYNCHRONOUSLY (no
// awaits) so the untagged Vehicle-layout picker can never paint on — or
// get stuck on — the Log tab if the async bootstrap below stalls or
// throws. Mirrors app-tabs' EXACT resolution: #hash wins, then the
// saved tab (key "ot-active-tab-<basename>"), then the first manifest
// tab. app-tabs fires no event on its initial mount, so we resolve it
// ourselves. Runs again on DOMContentLoaded in case the DOM/app-tabs
// bar isn't ready yet when this inline script executes.
function nlResolveInitialTab() {
    try {
        var tabs = window.OT_TABS || [];
        function tabExists(id) { for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) return true; } return false; }
        var basename = (location.pathname || '').split('/').pop() || 'index';
        var hash = (location.hash || '').replace(/^#/, '');
        var saved = null;
        try { saved = localStorage.getItem('ot-active-tab-' + basename); } catch (e) {}
        var activeNow = (hash && tabExists(hash)) ? hash
            : (saved && tabExists(saved)) ? saved
            : (tabs.length ? tabs[0].id : null);
        if (activeNow) nlSyncChrome(activeNow);
    } catch (e) { /* ignore */ }
}
nlResolveInitialTab();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', nlResolveInitialTab);
}

(async function () {
    // Languages might not be available yet
    await BYD.i18n.init();
    await refreshPermissionUI();
    await loadCategories();
    if (state.backendReady) await loadSubscriptions();
    // Paint the min-importance control once after load. loadSubscriptions
    // already re-paints it when this device has a saved row; this covers
    // the no-subscription-yet case (renders it in the disabled state).
    renderMinSeverity();
})();
