/**
 * Overdrive — Web app shell.
 *
 * Each in-app web page used to copy-paste the same ~250-line <aside class="sidebar">
 * block. This script mounts it once at runtime so every page shares one source
 * of truth. The DOM produced here is identical (element IDs included) to what
 * the legacy markup produced — existing JS bindings (core.js, vehicle-control.js,
 * etc.) keep working without changes.
 *
 * Usage in HTML:
 *   <body>
 *     <div class="app-layout">
 *       <div id="app-shell-mount"></div>
 *       <main class="main-content">…page-specific content…</main>
 *     </div>
 *     <script src="../shared/app-shell.js?v=20"></script>
 *
 * If a page omits #app-shell-mount the shell appends itself to <body>.
 *
 * ES5-only (Chrome 58 / Android 7.1 head-unit floor). No const/let, no arrow
 * functions, no template strings, no async/await.
 *
 * Active link is detected from window.location.pathname's basename.
 */
(function () {
    'use strict';

    // The Android app supplies its own navigation rail and injects
    // AndroidBridge before the page starts loading. Its post-load CSS hides
    // this web sidebar, so rendering the sidebar's 3D vehicle there wastes a
    // full GLB parse and can race the visible aux canvas. Standalone/tunnel
    // pages have no bridge and keep the normal sidebar renderer.
    var embeddedInNativeApp =
        typeof window.AndroidBridge !== 'undefined';

    // Browser-only pages stay out of the car app's menu (its WebView stamps
    // <html data-android-embed="1"> and refuses them).
    function inCarApp() {
        return embeddedInNativeApp || document.documentElement.getAttribute('data-android-embed') === '1';
    }

    /*
     * Sidebar nav layout MIRRORS rail_menu.xml exactly:
     *   Dashboard → Live → Recordings → Vehicle → Trips → Integrations cluster →
     *   Diagnostics → Settings cluster → About.
     *
     * Recordings on the native rail opens the events list (the WebView's
     * recordings fragment shows events.html, not recording.html settings).
     * Recording / Surveillance / Notifications are SETTINGS pages — they
     * group under the "Settings" header to match how MainActivity.kt routes
     * them through SettingsFragment sub-destinations.
     *
     * Items with `divider: true` insert a hairline ABOVE that item.
     */
    var NAV_ITEMS = [
        // ===== Overview ===== — the "what's happening now" cluster.
        { divider: true, label: 'Overview', i18n: 'nav.overview_group' },
        { href: 'index.html',           i18n: 'nav.dashboard',       label: 'Dashboard',       icon: 'dashboard' },
        { href: 'assistant.html',       i18n: 'nav.assistant',       label: 'Assistant',       icon: 'assistant' },
        { href: 'live-view.html',       i18n: 'nav.live_view',       label: 'Live View',       icon: 'live-view' },
        { href: 'communicate.html',     i18n: 'nav.communicate',     label: 'Communicate',     icon: 'communicate' },
        { href: 'events.html',          i18n: 'nav.recordings',      label: 'Recordings',      icon: 'recordings' },
        // Parking Intelligence: sessions ("where did I park, what happened").
        { href: 'parking.html',         i18n: 'nav.parking',         label: 'Parking',         icon: 'parking' },

        // ===== Vehicle ===== — control + trip history.
        { divider: true, label: 'Vehicle', i18n: 'nav.vehicle_group' },
        { href: 'vehicle-control.html', i18n: 'nav.vehicle_control', label: 'Vehicle Control', icon: 'vehicle' },
        { href: 'remote-access.html',   i18n: 'nav.remote_access',   label: 'Proximity', icon: 'proximity' },
        { href: 'trips.html',           i18n: 'nav.trips',           label: 'Trips',           icon: 'trips' },
        { href: 'charging.html',        i18n: 'nav.charging',        label: 'Charging',        icon: 'charging' },
        { href: 'seat-positions.html',  i18n: 'nav.seat_positions',  label: 'Seat Positions',  icon: 'seats' },
        { href: 'automations.html',     i18n: 'nav.automations',     label: 'Automations',     icon: 'automations' },
        { href: 'key-mapping.html',     i18n: 'nav.key_mapping',     label: 'Key Mapping',     icon: 'key-mapping' },

        // ===== Integrations group ===== — mirrors the native Integrations
        // sub-page (Telegram, ABRP, MQTT, BYD Cloud); WireGuard is configured natively under Daemons.
        { divider: true, label: 'Integrations', i18n: 'nav.integrations_group' },
        { href: 'telegram.html',                          i18n: 'nav.telegram',       label: 'Telegram',       icon: 'telegram' },
        { href: 'abrp.html',                              i18n: 'nav.abrp',           label: 'ABRP',           icon: 'abrp' },
        { href: 'mqtt.html',                              i18n: 'nav.mqtt',           label: 'MQTT',           icon: 'mqtt' },
        { href: 'wireguard.html', browserOnly: true,     i18n: 'wireguard.page_title', label: 'WireGuard Tunnel', icon: 'wireguard' },
        { href: 'byd-cloud.html',                         i18n: 'nav.byd_cloud',      label: 'BYD Cloud',      icon: 'byd-cloud' },
        { href: 'safekeep.html',                          i18n: 'nav.safekeep',       label: 'SafeKeep',       icon: 'safekeep' },

        // ===== Diagnostics ===== — shared read-only vehicle warnings plus
        // head-unit performance diagnostics.
        { divider: true, label: 'Diagnostics', i18n: 'nav.diagnostics_group' },
        { href: 'performance.html',                       i18n: 'nav.performance',    label: 'Performance',    icon: 'performance' },
        { href: 'module-faults.html',                     i18n: 'nav.module_faults',  label: 'Module Faults',  icon: 'module-faults' },
        { href: 'network.html',                           i18n: 'nav.network',        label: 'Network',        icon: 'network' },
        { href: 'remote-dev-view.html',                   i18n: 'nav.remote_dev_view', label: 'Remote Dev View',  icon: 'remote-dev-view' },

        // ===== Settings ===== — surveillance + recording + notifications
        // are settings sub-destinations under SettingsFragment on native.
        { divider: true, label: 'Settings', i18n: 'nav.settings_group' },
        { href: 'surveillance.html',                      i18n: 'nav.surveillance',   label: 'Surveillance',   icon: 'surveillance' },
        { href: 'recording.html',                         i18n: 'surveillance.tab_recording', label: 'Recording', icon: 'recording' },
        { href: 'storage.html',                           i18n: 'recording.tab_storage', label: 'Storage', icon: 'storage' },
        { href: 'road-sense.html',                        i18n: 'nav.road_sense',     label: 'RoadSense',      icon: 'road-sense' },
        { href: 'widgets.html',                           i18n: 'nav.widgets',        label: 'Widgets',        icon: 'widgets' },
        { href: 'widget-builder.html', browserOnly: true, i18n: 'widgetBuilder.nav', label: 'Widget Builder', icon: 'widget-builder' },
        { href: 'notifications.html',                     i18n: 'nav.notifications',  label: 'Notifications',  icon: 'notifications' },
        { href: 'daemons.html', browserOnly: true,        i18n: 'nav.daemons',        label: 'Daemons',        icon: 'widgets' },
        { href: 'sessions.html', browserOnly: true,       i18n: 'nav.sessions',       label: 'Signed-in Browsers', icon: 'remote-dev-view' },

        // ===== About ===== — version, license, source, support links,
        // Check for Updates. Sits in its own group so the link isn't
        // dangling under "Settings".
        { divider: true, label: 'About', i18n: 'nav.about_group' },
        { href: 'about.html',                             i18n: 'nav.about',          label: 'About',          icon: 'about' }
    ];

    function activeBasename() {
        var path = window.location.pathname || '';
        var idx = path.lastIndexOf('/');
        var base = idx >= 0 ? path.substring(idx + 1) : path;
        if (!base) base = 'index.html';
        return base;
    }

    function buildNav() {
        // Pages are served both as /trips and /trips.html.
        var current = activeBasename().replace(/\.html$/, '') + '.html';
        var html = '';
        for (var i = 0; i < NAV_ITEMS.length; i++) {
            var item = NAV_ITEMS[i];
            // Group label (mockup .nav-label) or a bare hairline. Foldable
            // groups are wired by wireGroupCollapse() via data-nav-group.
            if (item.divider) {
                if (item.label && item.i18n !== 'nav.about_group') {
                    html += '<div class="ui-nav-label" data-nav-group>'
                        +    '<span class="ui-nav-label-text"' + (item.i18n ? ' data-i18n="' + item.i18n + '"' : '') + '>' + item.label + '</span>'
                        +  '</div>';
                } else {
                    html += '<div class="ui-nav-divider" data-nav-divider role="separator"></div>';
                }
                continue;
            }
            if (item.browserOnly && inCarApp()) continue;
            var isActive = item.href === current;
            // aria-label doubles as the tooltip text on the 72px icon rail.
            html += '<a href="' + item.href + '" class="ui-nav-link' + (isActive ? ' is-active' : '') + '" data-nav-link'
                +     (isActive ? ' aria-current="page"' : '')
                +     ' aria-label="' + item.label + '">'
                +   navIcon(item.icon)
                +   '<span class="ui-nav-text"' + (item.i18n ? ' data-i18n="' + item.i18n + '"' : '') + '>' + item.label + '</span>'
                +  '</a>';
        }
        return html;
    }

    // Phosphor sprite (ph-icons.js). Pages load it before this script; the
    // empty fallback keeps the shell usable if it ever fails to load.
    function navIcon(name, cls) {
        return typeof window.phIcon === 'function' ? window.phIcon(name, cls) : '';
    }

    function buildShellMarkup() {
        // Brand (mockup .brand): the app glyph in the ink tile, then the name.
        var header = ''
            + '<a href="index.html" class="ui-brand" data-sidebar-brand aria-label="OverDrive — open Dashboard" data-i18n-attr="aria-label:nav.brand_home">'
            +   '<span class="ui-brand-mark"><span class="ui-brand-glyph"></span></span>'
            +   '<span class="ui-brand-text" data-i18n="app.name">OverDrive</span>'
            + '</a>';

        var nav = '<nav class="ui-nav" data-sidebar-nav aria-label="Main navigation">' + buildNav() + '</nav>';

        // Footer (mockup .sidebar-bottom / .garage): the vehicle row, a battery
        // bar and a compact device status list. Every id below is written by
        // core.js / vehicle-control.js / performance.js and must stay.
        var footer = ''
            + '<div class="ui-sidebar-foot">'
            +   '<div class="ui-garage" id="evCard">'
            +     '<span class="ui-garage-icon">' + navIcon('vehicle') + '</span>'
            +     '<span class="ui-garage-copy">'
            +       '<strong><span data-i18n="status.vehicle_status">Vehicle Status</span> <span id="evPercentValue">--%</span></strong>'
            +       '<small><span id="evRange">-- km</span> · <span id="evPower">-- kW</span></small>'
            +     '</span>'
            +   '</div>'
            +   '<div class="ui-progress ui-garage-bar" id="evBatteryBar"><span id="evBatteryFill" style="width:0%"></span></div>'
            +   '<dl class="ui-sidebar-status">'
            +     '<div class="ui-sidebar-status-extra" id="evSohRow" style="display:none;"><dt>SOH</dt><dd id="evSohValue">--%</dd></div>'
            +     '<div class="ui-sidebar-status-extra" id="evPersonalizedRow" style="display:none;"><dt data-i18n="vehicle.personalized_label">Personalized</dt><dd id="evPersonalizedRange">-- km</dd></div>'
            +     '<div class="ui-sidebar-status-extra" id="evCombinedRow" style="display:none;"><dt data-i18n="vehicle.combined_label">Combined</dt><dd id="evCombinedRange">-- km</dd></div>'
            +     '<div><dt><span class="ui-dot" id="connDot"></span><span data-i18n="status.device">Device</span></dt><dd id="deviceId">--</dd></div>'
            +     '<div><dt data-i18n="status.acc">ACC</dt><dd id="accValue">--</dd></div>'
            +     '<div><dt data-i18n="status.battery_12v">12V</dt><dd id="batteryValue">--</dd></div>'
            +     '<div><dt data-i18n="status.sentry">Surveillance</dt><dd id="survStatus" data-i18n="status.off">OFF</dd></div>'
            +     '<div><dt><span id="networkIcon"></span><span data-i18n="status.network">Net</span></dt><dd id="networkValue">--</dd></div>'
            +   '</dl>'
            +   buildFuelCard()
            +   '<span class="ui-sidebar-version" id="appVersion"></span>'
            + '</div>';

        return header + nav + footer;
    }

    function buildFuelCard() {
        return '<div class="ui-sidebar-fuel" id="fuelCard" style="display:none;">'
            +   '<div class="ui-sidebar-fuel-head"><span data-i18n="vehicle.fuel">Fuel</span><strong id="fuelPercentValue">--%</strong></div>'
            +   '<div class="ui-progress"><span id="fuelBarFill" style="width:0%"></span></div>'
            +   '<dl class="ui-sidebar-status"><div id="fuelPersonalizedRow" style="display:none;"><dt data-i18n="vehicle.personalized_label">Personalized</dt><dd id="fuelPersonalizedRange">-- km</dd></div></dl>'
            + '</div>';
    }

    function findMount() {
        var explicit = document.getElementById('app-shell-mount');
        if (explicit) return explicit;
        // Fall back: prepend a new <div> as the first child of .app-layout.
        var layout = document.querySelector('.app-layout');
        if (!layout) return null;
        var holder = document.createElement('div');
        holder.id = 'app-shell-mount';
        layout.insertBefore(holder, layout.firstChild);
        return holder;
    }

    // Phones (≤540px) get the mockup's bottom bar; "More" opens the full
    // menu in a dialog. toggleSidebar() is kept for pages that call it.
    function ensureResponsiveShell(aside) {
        if (typeof window.toggleSidebar !== 'function') {
            window.toggleSidebar = function (forceOpen) {
                if (forceOpen === false) { closeMoreSheet(); return; }
                openMoreSheet();
            };
        }
        if (embeddedInNativeApp) return;
        document.documentElement.classList.add('ui-shell-on');
    }

    var moreSheet = null;
    function openMoreSheet() {
        if (embeddedInNativeApp || !document.body) return;
        if (!moreSheet) {
            moreSheet = document.createElement('dialog');
            moreSheet.className = 'ui-dialog ui-more-sheet';
            moreSheet.setAttribute('aria-label', i18nText('common.more', 'More'));
            moreSheet.innerHTML =
                '<div class="ui-dialog-head"><h2 data-i18n="common.more">More</h2>'
                + '<button type="button" class="ui-dialog-close" aria-label="Close" data-i18n-attr="aria-label:common.close">' + navIcon('close') + '</button></div>'
                + '<nav class="ui-nav ui-more-nav">' + buildNav() + '</nav>';
            moreSheet.querySelector('.ui-dialog-close').addEventListener('click', closeMoreSheet);
            moreSheet.addEventListener('click', function (e) { if (e.target === moreSheet) closeMoreSheet(); });
            document.body.appendChild(moreSheet);
            try { if (window.BYD && BYD.i18n && BYD.i18n.applyAll) BYD.i18n.applyAll(); } catch (e) {}
        }
        if (typeof moreSheet.showModal === 'function') {
            if (!moreSheet.open) moreSheet.showModal();
        } else {
            moreSheet.setAttribute('open', '');
        }
    }
    function closeMoreSheet() {
        if (!moreSheet) return;
        if (typeof moreSheet.close === 'function' && moreSheet.open) moreSheet.close();
        else moreSheet.removeAttribute('open');
    }

    // Phone bottom bar: four primary destinations plus More.
    var BOTTOM_NAV = ['index.html', 'live-view.html', 'events.html', 'trips.html'];
    var BOTTOM_NAV_SKIP = { 'vehicle-control.html': 1, 'remote-dev-view.html': 1 };

    function mountBottomNav() {
        if (embeddedInNativeApp || !document.body) return;
        // Pages are served both as /trips and /trips.html.
        var current = activeBasename().replace(/\.html$/, '') + '.html';
        if (BOTTOM_NAV_SKIP[current] || document.querySelector('.ui-bottom-nav')) return;
        var html = '';
        var onPrimary = false;
        for (var i = 0; i < BOTTOM_NAV.length; i++) {
            var item = null;
            for (var j = 0; j < NAV_ITEMS.length; j++) {
                if (NAV_ITEMS[j].href === BOTTOM_NAV[i]) { item = NAV_ITEMS[j]; break; }
            }
            if (!item) continue;
            var on = item.href === current;
            if (on) onPrimary = true;
            html += '<a class="ui-bottom-link' + (on ? ' is-active' : '') + '" href="' + item.href + '"' + (on ? ' aria-current="page"' : '') + '>'
                + navIcon(item.icon)
                + '<span data-i18n="' + item.i18n + '">' + item.label + '</span>'
                + '</a>';
        }
        html += '<button type="button" class="ui-bottom-link' + (onPrimary ? '' : ' is-active') + '" data-bottom-more aria-haspopup="dialog">'
            + navIcon('more')
            + '<span data-i18n="common.more">More</span>'
            + '</button>';
        var nav = document.createElement('nav');
        nav.className = 'ui-bottom-nav';
        nav.setAttribute('aria-label', 'Primary');
        nav.innerHTML = html;
        nav.querySelector('[data-bottom-more]').addEventListener('click', openMoreSheet);
        document.body.appendChild(nav);
        // Page sheets (live-view, events) key bottom padding off this class.
        document.documentElement.classList.add('has-bottom-nav');
    }

    // Rows whose only control is a switch keep it beside the text on phones
    // (revamp.css .setting-row--inline). Rows rendered later are tagged too.
    function tagSwitchRows(root) {
        var rows = root.querySelectorAll('.setting-row:not(.setting-row--inline)');
        for (var i = 0; i < rows.length; i++) {
            var ctl = null, n = 0;
            for (var c = rows[i].firstElementChild; c; c = c.nextElementSibling) {
                if (c.classList.contains('setting-info')) continue;
                n++;
                ctl = c;
            }
            if (n !== 1) continue;
            if (ctl.classList.contains('toggle-switch')
                    || (ctl.children.length === 1 && ctl.firstElementChild.classList.contains('toggle-switch'))) {
                rows[i].classList.add('setting-row--inline');
            }
        }
        nameSwitches(root);
    }

    // The device already shows the time; no page header carries a clock badge.
    function hideHeaderClock() {
        var clock = document.getElementById('currentTime');
        var badge = clock && clock.closest ? clock.closest('.header-badge, .ui-badge') : null;
        if (badge) badge.style.display = 'none';
    }

    // A switch whose label holds only the track gets its name from the row title.
    var switchNameSeq = 0;
    function nameSwitches(root) {
        var inputs = root.querySelectorAll('.ui-toggle input');
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) continue;
            var label = input.closest ? input.closest('label') : null;
            if (label && (label.textContent || '').replace(/\s+/g, '') !== '') continue;
            var row = input.closest ? input.closest('.ui-row, .ui-row-stack, .ui-summary, .ui-panel-head, li, [class*="-row"], [class*="-item"], [class*="-card"]') : null;
            var name = row ? row.querySelector('.ui-row-title, .ui-panel-title, .ui-summary-text h2, [class*="-name"], [class*="-title"], h2, h3, h4, strong') : null;
            if (!name || !(name.textContent || '').replace(/\s+/g, '')) continue;
            if (!name.id) name.id = 'sw-name-' + (++switchNameSeq);
            input.setAttribute('aria-labelledby', name.id);
        }
    }

    // Summary tiles take their off look from the page's own status badge
    // (<div class="r-hero" data-hero-badge="badgeId">; badge.inactive = off).
    function wireHeroState() {
        var heroes = document.querySelectorAll('.r-hero[data-hero-badge]');
        for (var i = 0; i < heroes.length; i++) {
            (function (hero) {
                var badge = document.getElementById(hero.getAttribute('data-hero-badge'));
                if (!badge) return;
                function sync() { hero.classList.toggle('is-off', badge.classList.contains('inactive')); }
                sync();
                if (typeof MutationObserver !== 'undefined') {
                    new MutationObserver(sync).observe(badge, { attributes: true, attributeFilter: ['class'] });
                }
            }(heroes[i]));
        }
    }

    // Long row descriptions fold to two lines behind a More / Less button
    // (revamp.css .is-folded); the button only shows when text is clipped.
    var FOLD_MIN_CHARS = 100;
    var CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    function i18nText(key, fallback) {
        try {
            var v = window.BYD && window.BYD.i18n && window.BYD.i18n.t ? window.BYD.i18n.t(key) : null;
            return v && v !== key ? v : fallback;
        } catch (e) { return fallback; }
    }

    function foldDescriptions(root) {
        var descs = root.querySelectorAll('.setting-row .setting-desc:not([data-fold]), .setting-stack .setting-desc:not([data-fold])');
        for (var i = 0; i < descs.length; i++) {
            var d = descs[i], info = d.parentNode;
            var hint = info && info.classList.contains('has-hint') ? info.querySelector('.setting-hint') : null;
            if (!hint && (d.textContent || '').replace(/\s+/g, ' ').length < FOLD_MIN_CHARS) continue;
            d.setAttribute('data-fold', hint ? 'hint' : 'clamp');
            d.classList.add('is-folded');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'desc-more';
            btn.setAttribute('aria-expanded', 'false');
            btn.hidden = !hint;
            btn.innerHTML = '<span data-i18n="common.more">' + i18nText('common.more', 'More') + '</span>' + CHEVRON;
            btn.addEventListener('click', (function (desc) {
                return function () {
                    var open = !desc.classList.contains('is-open');
                    desc.classList.toggle('is-open', open);
                    this.setAttribute('aria-expanded', open ? 'true' : 'false');
                    var label = this.firstChild;
                    label.setAttribute('data-i18n', open ? 'common.less' : 'common.more');
                    label.textContent = i18nText(open ? 'common.less' : 'common.more', open ? 'Less' : 'More');
                };
            }(d)));
            d.parentNode.insertBefore(btn, d.nextSibling);
        }
    }

    function refreshFolds(root) {
        var descs = root.querySelectorAll('.setting-desc[data-fold="clamp"]:not(.is-open)');
        for (var i = 0; i < descs.length; i++) {
            var d = descs[i], btn = d.nextSibling;
            if (!btn || btn.className !== 'desc-more' || !d.offsetHeight) continue;
            btn.hidden = !(d.scrollHeight > d.clientHeight + 2);
        }
    }

    // The section tab bar sits under the page header, which some pages grow
    // (subtitles, wrapped titles) or hide (detail views).
    var lastHeaderH = null;
    function syncHeaderHeight() {
        var header = document.querySelector('.page-header');
        var h = header ? header.offsetHeight : 0;
        if (!h) {
            var mobile = document.querySelector('.mobile-header');
            h = mobile ? mobile.offsetHeight : 0;
        }
        if (h === lastHeaderH) return;
        lastHeaderH = h;
        document.documentElement.style.setProperty('--page-header-h', h + 'px');
    }

    // The page header is transparent at the top (as in the mock) and gains
    // its bar once content scrolls under it.
    function watchScrolled() {
        var root = document.documentElement, on = false;
        function check() {
            var y = window.pageYOffset || root.scrollTop || 0;
            if ((y > 4) !== on) {
                on = !on;
                root.classList.toggle('is-scrolled', on);
            }
        }
        check();
        window.addEventListener('scroll', check, { passive: true });
    }

    // Short helper text that belongs to a row (.setting-hint right after it)
    // becomes the row's visible description; the long description moves
    // behind More, as in the mock.
    function inlineHints(root) {
        // Choice cards carry their own descriptions, so their hint stays out of the row.
        var hints = root.querySelectorAll('.setting-row + .setting-hint:not(.r-choice-hint)');
        for (var i = 0; i < hints.length; i++) {
            var hint = hints[i], row = hint.previousElementSibling;
            var info = row && row.querySelector('.setting-info');
            if (!info || info.querySelector('.setting-hint')) continue;
            var desc = info.querySelector('.setting-desc');
            info.insertBefore(hint, desc || null);
            info.classList.add('has-hint');
        }
    }

    function watchSwitchRows() {
        var main = document.querySelector('.main-content');
        if (!main) return;
        function sweep() {
            tagSwitchRows(main);
            inlineHints(main);
            foldDescriptions(main);
            refreshFolds(main);
            syncHeaderHeight();
        }
        sweep();
        requestAnimationFrame(function () { refreshFolds(main); });
        document.addEventListener('ot-tabs:active-changed', function () {
            requestAnimationFrame(function () { refreshFolds(main); });
        });
        var resizeTimer = null;
        window.addEventListener('resize', function () {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () { resizeTimer = null; refreshFolds(main); syncHeaderHeight(); }, 200);
        });
        if (typeof MutationObserver === 'undefined') return;
        var pending = null;
        new MutationObserver(function () {
            if (pending) return;
            pending = setTimeout(function () { pending = null; sweep(); }, 150);
        }).observe(main, { childList: true, subtree: true });
    }

    // A freshly built sidebar always starts at scroll 0, so picking a link
    // near the bottom and opening the menu again hid that link above the
    // fold. Bring the current page's row into view. No-op when it is
    // already on screen, so a short menu and the top items stay put.
    function revealActiveNav(aside) {
        if (!aside || !aside.clientHeight) return;
        // The phone menu sheet opens at the top: vehicle status first, then the page grid.
        if (window.matchMedia && window.matchMedia('(max-width: 540px)').matches && !embeddedInNativeApp) {
            aside.scrollTop = 0;
            return;
        }
        var link = aside.querySelector('[data-nav-link][aria-current="page"]');
        if (!link || link.hasAttribute('hidden')) return;
        var header = aside.querySelector('[data-sidebar-brand]');
        var headerH = header ? header.offsetHeight : 0;
        var linkRect = link.getBoundingClientRect();
        var linkTop = linkRect.top - aside.getBoundingClientRect().top + aside.scrollTop;
        var linkBottom = linkTop + linkRect.height;
        var viewTop = aside.scrollTop + headerH + 8;
        var viewBottom = aside.scrollTop + aside.clientHeight - 8;
        if (linkTop >= viewTop && linkBottom <= viewBottom) return;
        var target = linkTop - headerH - Math.max(12, (aside.clientHeight - headerH - linkRect.height) / 2);
        var maxScroll = Math.max(0, aside.scrollHeight - aside.clientHeight);
        if (target < 0) target = 0;
        if (target > maxScroll) target = maxScroll;
        aside.scrollTop = target;
    }

    // Pages ship their own toggleSidebar(), which replaces the shell one.
    // Wrap whichever is installed so the row is revealed on open too
    // (some phones drop the scroll position when the off-screen transform
    // is removed).
    function installSidebarReveal(aside) {
        if (window.toggleSidebar && window.toggleSidebar._revealsActive) return;
        var inner = window.toggleSidebar;
        function wrapped(forceOpen) {
            var opening = typeof forceOpen === 'boolean'
                ? forceOpen
                : !aside.classList.contains('open');
            if (typeof inner === 'function') inner.apply(this, arguments);
            if (opening) revealActiveNav(aside);
        }
        wrapped._revealsActive = true;
        window.toggleSidebar = wrapped;
    }

    // Browser-only top bar (mockup .toolbar): breadcrumb on the left; search
    // and the day/night switch on the right; the brand on phones. Inserted at
    // the top of .main-content.
    function renderTopbar(pageTitle) {
        var main = document.querySelector('.main-content');
        if (!main || main.querySelector('.ui-topbar')) return;
        var esc = function (s) {
            return String(s).replace(/[&<>"]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
        };
        var bar = document.createElement('header');
        bar.className = 'ui-topbar';
        bar.innerHTML =
            '<nav class="ui-breadcrumb" aria-label="Breadcrumb">' +
              '<span data-i18n="app.name">OverDrive</span><span aria-hidden="true">/</span>' +
              '<strong>' + esc(pageTitle) + '</strong>' +
            '</nav>' +
            '<a class="ui-topbar-brand" href="index.html" aria-label="OverDrive — open Dashboard" data-i18n-attr="aria-label:nav.brand_home">' +
              '<span class="ui-brand-mark"><span class="ui-brand-glyph"></span></span>' +
              '<span data-i18n="app.name">OverDrive</span>' +
            '</a>' +
            '<div class="ui-topbar-actions">' +
              '<button type="button" class="ui-icon-button ui-topbar-search od-search-open" aria-label="Search" data-i18n-attr="aria-label:common.search">' + navIcon('search') + '</button>' +
              '<div class="ui-theme-switch" role="group" aria-label="Colour theme" data-i18n-attr="aria-label:settings.theme">' +
                '<button type="button" data-theme-choice="light" aria-label="Light theme" aria-pressed="false">' + navIcon('sun') + '</button>' +
                '<button type="button" data-theme-choice="dark" aria-label="Dark theme" aria-pressed="false">' + navIcon('moon') + '</button>' +
              '</div>' +
            '</div>';
        var buttons = bar.querySelectorAll('[data-theme-choice]');
        var sync = function () {
            var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-theme-choice') === current));
            }
        };
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () {
                var choice = this.getAttribute('data-theme-choice');
                if (window.BYD && window.BYD.theme && typeof window.BYD.theme.set === 'function') {
                    window.BYD.theme.set(choice);
                } else {
                    document.documentElement.setAttribute('data-theme', choice);
                }
                sync();
            });
        }
        new MutationObserver(sync).observe(document.documentElement,
            { attributes: true, attributeFilter: ['data-theme'] });
        sync();
        main.insertBefore(bar, main.firstChild);
    }

    function currentPageTitle() {
        var source = document.querySelector('.page-title, .dev-view-header h1, main h1');
        var text = source && source.textContent ? source.textContent.replace(/^\s+|\s+$/g, '') : '';
        return text || (document.title || '').replace(/\s*[—|-].*$/, '') || 'Dashboard';
    }

    function mount() {
        var holder = findMount();
        if (!holder) return;
        // Render the shell as <aside class="ui-sidebar"> (mockup sidebar). Only
        // ui- classes, so none of the older sidebar rules in styles.css /
        // revamp.css / app-shell.css match it. id="sidebar" stays for scripts.
        var aside = document.createElement('aside');
        aside.className = 'ui-sidebar';
        aside.id = 'sidebar';
        aside.innerHTML = buildShellMarkup();
        // Replace the holder with the aside (lighter than nesting another wrapper).
        if (holder.parentNode) {
            holder.parentNode.replaceChild(aside, holder);
        }
        // Tag the body so shell-scoped CSS in app-shell.css ([data-app-shell="1"])
        // can tighten icon→label spacing across cards, info boxes, settings rows
        // etc. without touching per-page stylesheets.
        if (document.body) document.body.setAttribute('data-app-shell', '1');

        // Fill the two shell pieces that legacy pages occasionally omitted:
        // the dismiss overlay and the compact mobile app bar.
        ensureResponsiveShell(aside);
        if (!embeddedInNativeApp) renderTopbar(currentPageTitle());
        hideHeaderClock();
        mountBottomNav();
        watchSwitchRows();
        wireHeroState();
        watchScrolled();

        // The brand-logo <img> just got injected — re-run the theme.js icon
        // selector so it picks up the right asset for the active data-theme.
        // Without this, light-theme users see the hardcoded dark fallback.
        try { if (window.BYD && window.BYD.theme && window.BYD.theme.applyIcons) window.BYD.theme.applyIcons(); } catch (e) {}

        // Wire per-group collapse on the rendered nav. Each [data-nav-group]
        // becomes a tappable toggle that hides every link between it and
        // the next group-header / divider. State persists per-group.
        wireGroupCollapse(aside);

        // Reflect the user's vehicle pick (model + colour) on the EV card.
        // Each page mounts the same shell, so fetching once per page-load
        // keeps the sidebar in sync with whatever the user selected on
        // vehicle-control.html. The fetch is best-effort — failures fall
        // back to the default ceramic body.
        applyVehicleSelection();

        // Notify the page so it can run its post-shell initialization (i18n
        // re-application, status pollers, etc.). Listen for this event in
        // page-specific scripts that need the sidebar DOM ready.
        try {
            var ev = document.createEvent('Event');
            ev.initEvent('app-shell:ready', true, true);
            document.dispatchEvent(ev);
        } catch (e) { /* ignore — older browsers */ }

        // i18n.js calls applyI18n() at script-load time — but the shell DOM
        // didn't exist then. Re-run it now if the helper is available.
        if (window.BYD && window.BYD.i18n && typeof window.BYD.i18n.applyAll === 'function') {
            try { window.BYD.i18n.applyAll(); } catch (e) {}
        } else if (typeof window.applyI18n === 'function') {
            try { window.applyI18n(); } catch (e) {}
        }

        revealActiveNav(aside);
        installSidebarReveal(aside);
        // Labels can wrap after i18n and push the active row down.
        requestAnimationFrame(function () { revealActiveNav(aside); });
    }

    // ============================================================
    // Vehicle selection → EV card visualization
    // ============================================================

    // Lazy-loaded EV-card 3D scene. Created on first setEvCardAppearance
    // call once the GLB renderer module has loaded. setModel/setColor on
    // the instance is safe even before vendor JS lands — pending values
    // are queued and applied when the renderer is ready.
    //
    // Sprite-cache fast path:
    //   On every page navigation the sidebar mounts the same #evCardCanvas.
    //   If a webp sprite for the user's (model, colour, view, dpr) is
    //   already in IndexedDB, paint it into the canvas immediately and
    //   skip the three.js + GLB load entirely. The 3D pipeline still
    //   runs once on first cold load (or after the user picks a colour
    //   we haven't seen before) — and at the end of that render we snap
    //   the canvas back into the cache for the next page visit.
    //
    //   Cache ownership: the cache key includes a SPRITE_VERSION constant
    //   in ev-card-sprite-cache.js, so a pipeline change (lighting rig,
    //   camera framing) invalidates everything in one go. Per-key
    //   invalidation also runs when the user changes their selection.
    var ev3dInstance = null;
    var ev3dLoadStarted = false;
    var spriteCacheLoadStarted = false;
    // True once the sidebar canvas has been painted from the sprite
    // cache. A canvas can hold a 2D context OR a WebGL context, never
    // both — so if a later setEvCardAppearance call has to fall back to
    // the live 3D pipeline (cache miss after a previous hit), we have
    // to swap in a fresh <canvas> element first.
    var sidebarPaintedFromSprite = false;
    // Per-canvas, per-key flag so we only snapshot the FIRST render
    // after a (model, colour) change — subsequent identical-key renders
    // (resize, visibility flip) shouldn't keep rewriting the same blob.
    var snapshotsTaken = {};

    // Replace #evCardCanvas with a fresh clone. Used when transitioning
    // from a 2D-painted sprite to the live WebGL pipeline within the
    // same page session — the existing 2D context permanently locks the
    // canvas out of WebGL, so we have to swap the element. References
    // held elsewhere (battery overlay, charge SVG) sit on adjacent DOM
    // and are unaffected.
    function swapSidebarCanvasForFresh() {
        var old = document.getElementById('evCardCanvas');
        if (!old || !old.parentNode) return null;
        var fresh = old.cloneNode(false);
        old.parentNode.replaceChild(fresh, old);
        sidebarPaintedFromSprite = false;
        return fresh;
    }

    function ensureSpriteCacheModule(cb, lifetime) {
        if (lifetime && lifetime.disposed) return;
        if (typeof window.OverdriveEvSpriteCache === 'object') { cb(window.OverdriveEvSpriteCache); return; }
        if (spriteCacheLoadStarted) {
            // A disabled preview is a single cache attempt, never a poller.
            if (lifetime && lifetime.cacheOnly) { cb(null); return; }
            // Poll briefly for the global to land.
            var tries = 0;
            var iv = setInterval(function () {
                if (lifetime && lifetime.disposed) { clearInterval(iv); return; }
                tries++;
                if (typeof window.OverdriveEvSpriteCache === 'object') {
                    clearInterval(iv);
                    cb(window.OverdriveEvSpriteCache);
                } else if (tries > 60) {
                    clearInterval(iv);
                    cb(null);
                }
            }, 50);
            if (lifetime) lifetime.timers.push(iv);
            return;
        }
        spriteCacheLoadStarted = true;
        var s = document.createElement('script');
        s.src = '../shared/ev-card-sprite-cache.js';
        s.async = true;
        s.onload = function () {
            if (!lifetime || !lifetime.disposed) cb(window.OverdriveEvSpriteCache || null);
        };
        s.onerror = function () { if (!lifetime || !lifetime.disposed) cb(null); };
        document.head.appendChild(s);
    }

    // Try to paint a cached sprite into `canvasEl` for the given key
    // tuple. On success the 3D pipeline can be skipped for this canvas
    // until the user changes selection. Calls `cb(true|false)`.
    function tryPaintFromSpriteCache(canvasEl, modelId, color, view, cb, lifetime) {
        if (lifetime && lifetime.disposed) return;
        if (!canvasEl || !modelId || !color) { cb(false); return; }
        ensureSpriteCacheModule(function (cache) {
            if (lifetime && lifetime.disposed) return;
            if (!cache) { cb(false); return; }
            cache.get(modelId, color, view, canvasEl).then(function (entry) {
                if (lifetime && lifetime.disposed) return;
                if (!entry || !entry.blob) { cb(false); return; }
                // A sprite decode can finish after its owner is disabled. Paint
                // cancellable mounts off-screen, then commit only while alive.
                var target = canvasEl;
                if (lifetime) {
                    target = document.createElement('canvas');
                    target.width = canvasEl.clientWidth || canvasEl.width;
                    target.height = canvasEl.clientHeight || canvasEl.height;
                }
                cache.paintInto(target, entry).then(function (hit) {
                    if (lifetime && lifetime.disposed) return;
                    if (hit && lifetime) {
                        canvasEl.width = target.width;
                        canvasEl.height = target.height;
                        var context = canvasEl.getContext('2d');
                        if (!context) { cb(false); return; }
                        context.clearRect(0, 0, target.width, target.height);
                        context.drawImage(target, 0, 0);
                    }
                    cb(hit);
                }, function () { if (!lifetime || !lifetime.disposed) cb(false); });
            }, function () { if (!lifetime || !lifetime.disposed) cb(false); });
        }, lifetime);
    }

    // Schedule a one-shot post-render snapshot into the sprite cache.
    // The 3D instance fires `onceAfterRender` after the next paint that
    // includes both the GLB and the requested colour, so the captured
    // canvas contents reflect the correct (model, colour) tuple.
    function scheduleSpriteSnapshot(inst, canvasEl, modelId, color, view, lifetime) {
        if (lifetime && lifetime.disposed) return;
        if (!inst || !canvasEl || !modelId || !color) return;
        ensureSpriteCacheModule(function (cache) {
            if (lifetime && lifetime.disposed) return;
            if (!cache) return;
            var key = cache.buildKey(modelId, color, view, canvasEl);
            if (snapshotsTaken[key]) return;
            snapshotsTaken[key] = lifetime || true;
            if (lifetime) lifetime.snapshotKeys.push(key);
            inst.onceAfterRender(function () {
                if (lifetime && lifetime.disposed) return;
                cache.snapshot(canvasEl).then(function (blob) {
                    if (lifetime && lifetime.disposed) return;
                    if (!blob) { delete snapshotsTaken[key]; return; }
                    cache.put(modelId, color, view, canvasEl, blob,
                              canvasEl.width, canvasEl.height);
                });
            });
        }, lifetime);
    }

    // Clear a previously-set snapshotsTaken flag so a later attempt
    // (different page in the same session, or a re-mount) can take a
    // fresh snapshot. Called when a pendingSidebarSnapshot is dropped
    // before its render callback ran.
    function clearSnapshotFlag(modelId, color, view, canvasEl) {
        if (!modelId || !color) return;
        ensureSpriteCacheModule(function (cache) {
            if (!cache) return;
            delete snapshotsTaken[cache.buildKey(modelId, color, view, canvasEl)];
        });
    }

    function ensureEv3d() {
        if (ev3dInstance) return ev3dInstance;
        var canvas = document.getElementById('evCardCanvas');
        if (!canvas) return null;
        if (ev3dLoadStarted) return null; // load is in flight
        ev3dLoadStarted = true;

        // Defer the script load until the page has had a chance to render
        // its primary content. requestIdleCallback is ideal; fall back to
        // a setTimeout for browsers without it (notably Safari ≤14).
        function instantiate() {
            if (ev3dInstance) return;
            if (typeof window.OverdriveEvCard3D !== 'function') return;
            // The native shell hides #sidebar after page load. The script may
            // still be needed by a visible aux canvas, but never bind WebGL
            // to the hidden sidebar canvas in that environment.
            if (embeddedInNativeApp) return;
            try {
                ev3dInstance = new window.OverdriveEvCard3D(canvas);
                // Replay the most recent (model, colour) pair. SOC +
                // charging state are painted on the DOM battery overlay
                // independently so they need no replay here.
                if (lastEv3dColor) ev3dInstance.setColor(lastEv3dColor);
                if (lastEv3dModel) ev3dInstance.setModel(lastEv3dModel);
                // If a setEvCardAppearance call hit the sprite-cache miss
                // path before the renderer module finished loading, we
                // owe a snapshot for that key. Replay it now.
                if (pendingSidebarSnapshot) {
                    var p = pendingSidebarSnapshot;
                    pendingSidebarSnapshot = null;
                    if (p.modelId && p.color) {
                        scheduleSpriteSnapshot(ev3dInstance, canvas,
                                               p.modelId, p.color, 'side');
                    }
                }
            } catch (e) {
                if (window.console) console.warn('[app-shell] ev-card-3d init failed:', e);
            }
        }

        function inject() {
            // Skip on pages that explicitly opt out (e.g. login.html could
            // set window.OverdriveDisableEvCard3D = true).
            if (window.OverdriveDisableEvCard3D) return;

            // If the global is already present (vehicle-control bundles
            // its own three.js + we got loaded second; or ev-map-sprite.js
            // got there first on a map page), instantiate immediately.
            if (typeof window.OverdriveEvCard3D === 'function') {
                instantiate();
                return;
            }

            // If a previous caller has already inserted the <script>,
            // don't insert a duplicate — just poll for the global to
            // appear once that load completes.
            if (document.querySelector('script[data-overdrive-ev-card-3d]')) {
                var pollTries = 0;
                var pollIv = setInterval(function () {
                    pollTries++;
                    if (typeof window.OverdriveEvCard3D === 'function') {
                        clearInterval(pollIv);
                        instantiate();
                    } else if (pollTries > 60) {
                        clearInterval(pollIv);
                    }
                }, 100);
                return;
            }

            var s = document.createElement('script');
            s.src = '../shared/ev-card-3d.js?v=3';
            s.async = true;
            s.setAttribute('data-overdrive-ev-card-3d', '1');
            s.onload = instantiate;
            s.onerror = function () {
                if (window.console) console.warn('[app-shell] ev-card-3d.js load failed');
            };
            document.head.appendChild(s);
        }
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(inject, { timeout: 1500 });
        } else {
            setTimeout(inject, 200);
        }
        return null;
    }

    // Most-recent values applied to the 3D card. Used when the renderer
    // module finishes loading after one or more setEvCardAppearance calls
    // — replay these so the deferred mount is already correctly painted.
    var lastEv3dModel = null;
    var lastEv3dColor = null;
    // Holds the (modelId, colour) for which we owe the sidebar a
    // snapshot once the renderer module finishes loading. ensureEv3d()'s
    // instantiate() callback drains this. Hoisted up here (not down by
    // applyToAux) so the relationship to lastEv3dModel/lastEv3dColor is
    // visible at a glance.
    var pendingSidebarSnapshot = null;
    // Extra OverdriveEvCard3D instances mounted by other surfaces on the
    // same page (currently: Live View's top-down camera selector). These
    // share the same model/colour as the sidebar card and stay in sync
    // when the user changes their selection on vehicle-control.html.
    var auxEv3dInstances = [];
    // Aux canvases can mount as soon as app-shell:ready fires, while the
    // selected vehicle is still being fetched asynchronously. Treating
    // that short "unknown selection" window as a sprite-cache miss forces
    // every page visit through three.js + the full GLB, even when a cached
    // sprite exists. Hold those mounts until setEvCardAppearance resolves
    // either the saved selection or the normal fallback.
    var vehicleSelectionWaiters = [];
    var FALLBACK_MODEL_ID = 'seal';
    var FALLBACK_MODEL_COLOR = '#E8E8EC';

    function setEvCardAppearance(modelId, hexColor) {
        // Forward the user's selection to the 3D card. ev-card-3d.js
        // queues setModel/setColor calls if the renderer hasn't loaded
        // yet, so the deferred mount lands on the right (model, colour).
        var prevModel = lastEv3dModel;
        var prevColor = lastEv3dColor;
        lastEv3dModel = modelId;
        lastEv3dColor = hexColor;

        // Sidebar canvas — try the sprite-cache fast path first. Only
        // injects the 3D pipeline on a miss, so subsequent page loads
        // paint the EV card from a ~30KB webp instead of a 600KB
        // three.js + 1.6MB GLB cold parse.
        var sidebarCanvas = embeddedInNativeApp
            ? null
            : document.getElementById('evCardCanvas');
        if (sidebarCanvas && modelId && hexColor) {
            tryPaintFromSpriteCache(sidebarCanvas, modelId, hexColor, 'side', function (hit) {
                if (hit) {
                    sidebarPaintedFromSprite = true;
                    // Cache hit — the canvas is already painted. Don't
                    // touch the 3D instance unless one already exists
                    // (e.g. the user is on vehicle-control.html where
                    // the live three.js scene is wanted anyway).
                    if (ev3dInstance) {
                        if (modelId)  ev3dInstance.setModel(modelId);
                        if (hexColor) ev3dInstance.setColor(hexColor);
                    }
                    return;
                }
                // Miss — fall through to the 3D pipeline AND register a
                // snapshot for the next page that lands on this key.
                // If we've already painted the canvas in 2D from a
                // prior cache hit, the canvas is locked out of WebGL;
                // swap it for a fresh clone first.
                var canvasForLive = sidebarCanvas;
                if (sidebarPaintedFromSprite && !ev3dInstance) {
                    canvasForLive = swapSidebarCanvasForFresh() || sidebarCanvas;
                }
                var inst = ensureEv3d();
                if (inst) {
                    if (modelId)  inst.setModel(modelId);
                    if (hexColor) inst.setColor(hexColor);
                    scheduleSpriteSnapshot(inst, canvasForLive, modelId, hexColor, 'side');
                } else {
                    // Renderer module is in flight. Schedule the
                    // snapshot once it lands — ensureEv3d's instantiate
                    // callback drains pendingSidebarSnapshot.
                    //
                    // Two rapid misses before the renderer instantiates
                    // would overwrite an earlier pending snapshot here.
                    // That's fine semantically (last-write-wins matches
                    // the user's most recent selection), but if the
                    // earlier (model,colour) had already set its
                    // snapshotsTaken flag we need to clear it so a
                    // future page navigation can still snapshot it.
                    if (pendingSidebarSnapshot
                            && (pendingSidebarSnapshot.modelId !== modelId
                                || pendingSidebarSnapshot.color !== hexColor)) {
                        clearSnapshotFlag(pendingSidebarSnapshot.modelId,
                                          pendingSidebarSnapshot.color, 'side',
                                          sidebarCanvas);
                    }
                    pendingSidebarSnapshot = { modelId: modelId, color: hexColor };
                }
            });
        } else if (!embeddedInNativeApp) {
            // Fallback for callers that don't have the canvas or only
            // have one of (model, colour) — preserve the original
            // behaviour so login.html and friends still work.
            var inst = ensureEv3d();
            if (inst) {
                if (modelId)  inst.setModel(modelId);
                if (hexColor) inst.setColor(hexColor);
            }
        }

        // Aux canvases (Live View top-down selector, map markers).
        // Iterate backwards so we can splice disposed instances out as
        // we go without confusing the index. Trip-map remounts churn
        // these — without the splice the array would grow each time
        // the user opens a different trip and stale entries would
        // throw on setColor (carModel/scene set to null in dispose()).
        for (var i = auxEv3dInstances.length - 1; i >= 0; i--) {
            var aux = auxEv3dInstances[i];
            if (aux._disposed) {
                auxEv3dInstances.splice(i, 1);
                continue;
            }
            applyToAux(aux, modelId, hexColor);
        }

        // Drain deferred aux mounts only after the existing aux iteration.
        // A callback can add a sprite-only/live entry to auxEv3dInstances;
        // deferring the drain avoids applying the same selection twice in
        // this pass and issuing duplicate cache lookups.
        if (modelId && hexColor && vehicleSelectionWaiters.length) {
            var waiters = vehicleSelectionWaiters.slice();
            vehicleSelectionWaiters = [];
            for (var w = 0; w < waiters.length; w++) {
                try { waiters[w](); } catch (e) {
                    if (window.console) console.warn('[app-shell] deferred vehicle canvas mount failed:', e);
                }
            }
        }

        // If the user actually changed their selection (vehicle-control
        // calls refreshVehicle() after a save), surface a
        // vehicle-changed event so other surfaces (map markers, custom
        // pages) can react without re-polling the daemon. Includes the
        // previous values so listeners that maintain their own caches
        // can invalidate the right entries.
        //
        // Suppress the synthetic "null → first value" diff that fires
        // on the initial applyVehicleSelection — listeners only care
        // about user-driven changes, not the first hydration.
        var hadPrior = (prevModel !== null) || (prevColor !== null);
        try {
            var resolvedEv;
            if (typeof CustomEvent === 'function') {
                resolvedEv = new CustomEvent('overdrive:vehicle-resolved', {
                    detail: { modelId: modelId, color: hexColor }
                });
            } else {
                resolvedEv = document.createEvent('CustomEvent');
                resolvedEv.initCustomEvent('overdrive:vehicle-resolved', true, true, {
                    modelId: modelId, color: hexColor
                });
            }
            document.dispatchEvent(resolvedEv);
        } catch (e) {}
        if (hadPrior && (prevModel !== modelId || prevColor !== hexColor)) {
            try {
                var ev;
                if (typeof CustomEvent === 'function') {
                    ev = new CustomEvent('overdrive:vehicle-changed', {
                        detail: {
                            modelId: modelId,  color: hexColor,
                            prevModelId: prevModel, prevColor: prevColor
                        }
                    });
                } else {
                    ev = document.createEvent('CustomEvent');
                    ev.initCustomEvent('overdrive:vehicle-changed', true, true, {
                        modelId: modelId,  color: hexColor,
                        prevModelId: prevModel, prevColor: prevColor
                    });
                }
                document.dispatchEvent(ev);
            } catch (e) {}
        }
    }

    // Apply (model, colour) to an aux instance. Sprite-only auxes
    // (created when mountVehicleCanvas hit the cache) re-attempt the
    // cache for the new key inside their own setModel/setColor; live
    // 3D auxes update their scene and queue a snapshot for the new key
    // so the next page that mounts the same aux gets a fast paint.
    //
    // CRITICAL: must NOT call tryPaintFromSpriteCache on a canvas that's
    // already bound to a WebGL context (live aux) — getContext('2d')
    // would fail and the call would be a no-op anyway. The sprite-only
    // path is opt-in via aux._spriteOnly; live auxes route through the
    // 3D state and snapshot AFTER their next render.
    function applyToAux(aux, modelId, hexColor) {
        if (!aux || !modelId || !hexColor) {
            if (aux) {
                if (modelId)  aux.setModel(modelId);
                if (hexColor) aux.setColor(hexColor);
            }
            return;
        }
        // Preserve the aux's actual view ('top' | 'three-quarter' | 'side')
        // so the sprite-cache key here matches the one mountVehicleCanvas
        // filed the snapshot under. Collapsing to a 'top'|'side' binary
        // mis-keyed the dashboard hero's 'three-quarter' canvas as 'side',
        // so every colour change missed the cache and re-rendered WebGL +
        // orphaned a sprite under the wrong key.
        var view = (aux.view === 'top' || aux.view === 'three-quarter') ? aux.view : 'side';
        if (aux._spriteOnly) {
            // Sprite-only aux: setModel/setColor on the pseudo-instance
            // re-try the cache. On miss they upgrade to a live mount,
            // which in turn schedules its own snapshot.
            aux.setModel(modelId);
            aux.setColor(hexColor);
            return;
        }
        // Live 3D aux. Update the scene; snapshot the next render into
        // the cache so a future page can take the fast path.
        aux.setModel(modelId);
        aux.setColor(hexColor);
        if (aux.canvas) {
            scheduleSpriteSnapshot(aux, aux.canvas, modelId, hexColor, view, aux._mountLifetime);
        }
    }


    var vehicleSelectionRequested = false;

    function applyVehicleSelection() {
        // Skip only when no vehicle visualization surface or waiter exists on this page.
        if (!document.getElementById('evCardCanvas')
            && !auxEv3dInstances.length
            && !vehicleSelectionWaiters.length
            && !document.querySelector('.ui-hero-image')) return;
        vehicleSelectionRequested = true;
        function applyFallbackAppearance() {
            setEvCardAppearance(FALLBACK_MODEL_ID, FALLBACK_MODEL_COLOR);
        }
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/models/selected', true);
            xhr.timeout = 4000;
            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    applyFallbackAppearance();
                    return;
                }
                var data;
                try { data = JSON.parse(xhr.responseText) || {}; }
                catch (e) {
                    applyFallbackAppearance();
                    return;
                }
                setEvCardAppearance(data.modelId || FALLBACK_MODEL_ID,
                    data.color || FALLBACK_MODEL_COLOR);
            };
            xhr.onerror = function () { applyFallbackAppearance(); };
            xhr.ontimeout = function () { applyFallbackAppearance(); };
            xhr.send();
        } catch (e) { applyFallbackAppearance(); }
    }

    // ============================================================
    // Sidebar group collapse
    // ============================================================
    //
    // Each [data-nav-group] label (Integrations / Diagnostics / Settings) becomes
    // a tappable summary that toggles every nav link between it and the
    // next group-header / nav-divider.
    //
    // Implementation: walk the [data-sidebar-nav] once, for each group label
    //  - inject a chevron at the trailing edge,
    //  - record the link siblings up to the next break,
    //  - on click, toggle a `data-collapsed` attribute on the group-header
    //    and apply [hidden] to its children. Persist to localStorage.
    //
    // The persistence key uses the group's i18n slug (e.g. "integrations_group")
    // so it survives label translation.
    function wireGroupCollapse(aside) {
        var nav = aside.querySelector('[data-sidebar-nav]');
        if (!nav) return;
        // Cache the nav so external callers (update-flow.js after it injects
        // its sidebar entry) can re-run wiring on the same DOM.
        wireGroupCollapse._lastAside = aside;
        var children = nav.children;
        // Collect group definitions: { headerEl, slug, members: [linkEl,…] }.
        var groups = [];
        var currentGroup = null;
        for (var i = 0; i < children.length; i++) {
            var el = children[i];
            if (el.hasAttribute('data-nav-group')) {
                if (currentGroup) groups.push(currentGroup);
                var labelEl = el.querySelector('[data-i18n]');
                var slug = labelEl && labelEl.getAttribute('data-i18n')
                    ? labelEl.getAttribute('data-i18n')
                    : (labelEl ? labelEl.textContent.trim().toLowerCase() : 'group-' + i);
                currentGroup = { headerEl: el, slug: slug, members: [] };
            } else if (el.hasAttribute('data-nav-divider')) {
                // Bare hairline closes the current group.
                if (currentGroup) { groups.push(currentGroup); currentGroup = null; }
            } else if (currentGroup) {
                // Anything else (a [data-nav-link]) between labels belongs to the group.
                currentGroup.members.push(el);
            }
        }
        if (currentGroup) groups.push(currentGroup);

        // Overview and Vehicle are plain labels; the other groups fold and
        // start closed unless they hold the current page or the user opened them.
        var PLAIN = { 'nav.overview_group': 1, 'nav.vehicle_group': 1 };
        function readState(slug) {
            try {
                var v = localStorage.getItem('overdrive.navGroup.' + slug);
                return v === null ? true : v === '1';
            }
            catch (e) { return true; }
        }
        function writeState(slug, collapsed) {
            try { localStorage.setItem('overdrive.navGroup.' + slug, collapsed ? '1' : '0'); }
            catch (e) { /* ignore */ }
        }

        var firstFold = true;
        for (var g = 0; g < groups.length; g++) {
            (function (group) {
                var header = group.headerEl;
                if (PLAIN[group.slug]) {
                    header.classList.add('is-plain');
                    for (var p = 0; p < group.members.length; p++) group.members[p].removeAttribute('hidden');
                    return;
                }
                header.classList.add('is-foldable');

                // Determine whether this group is currently collapsed — we
                // need to apply that state to ALL current members (including
                // freshly-injected ones), even if the header itself is
                // already wired from a prior call.
                var alreadyWired = header.hasAttribute('data-group-wired');
                var collapsed;
                if (alreadyWired) {
                    collapsed = header.getAttribute('data-collapsed') === 'true';
                } else {
                    var hasActive = false;
                    for (var k = 0; k < group.members.length; k++) {
                        if (group.members[k].classList.contains('is-active') ||
                            group.members[k].getAttribute('aria-current') === 'page') {
                            hasActive = true; break;
                        }
                    }
                    collapsed = hasActive ? false : readState(group.slug);
                }

                // Apply state to every tracked member — re-runs reach newly
                // injected links so they pick up the current collapsed state.
                if (collapsed) header.setAttribute('data-collapsed', 'true');
                else header.removeAttribute('data-collapsed');
                header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                for (var m = 0; m < group.members.length; m++) {
                    if (collapsed) group.members[m].setAttribute('hidden', '');
                    else group.members[m].removeAttribute('hidden');
                }

                // Skip the click/keydown bind on re-runs to avoid duplicate
                // handlers firing the toggle twice per click.
                if (alreadyWired) return;
                header.setAttribute('data-group-wired', '1');

                // Add chevron + interactive affordance.
                header.setAttribute('role', 'button');
                header.setAttribute('tabindex', '0');
                if (!header.querySelector('.ui-nav-chevron')) {
                    var chev = document.createElement('span');
                    chev.className = 'ui-nav-chevron';
                    chev.setAttribute('aria-hidden', 'true');
                    chev.innerHTML = navIcon('caret-down');
                    header.appendChild(chev);
                }

                function toggle() {
                    var nowCollapsed = header.getAttribute('data-collapsed') !== 'true';
                    if (nowCollapsed) header.setAttribute('data-collapsed', 'true');
                    else header.removeAttribute('data-collapsed');
                    header.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
                    // Walk siblings live each click — handles members injected
                    // after the initial wire (e.g. update-flow.js's link).
                    for (var s2 = header.nextElementSibling; s2; s2 = s2.nextElementSibling) {
                        if (s2.hasAttribute('data-nav-group') ||
                            s2.hasAttribute('data-nav-divider')) break;
                        if (nowCollapsed) s2.setAttribute('hidden', '');
                        else s2.removeAttribute('hidden');
                    }
                    writeState(group.slug, nowCollapsed);
                }
                header.addEventListener('click', toggle);
                header.addEventListener('keydown', function (ev) {
                    if (ev.key === 'Enter' || ev.key === ' ' || ev.keyCode === 13 || ev.keyCode === 32) {
                        ev.preventDefault();
                        toggle();
                    }
                });
            }(groups[g]));
        }
    }

    // Re-apply on demand (for pages that change the selection live, like
    // vehicle-control.html itself). Pages can call:
    //     window.OverdriveAppShell.refreshVehicle()
    // after they save a new model/colour to /api/models/selected.
    window.OverdriveAppShell = window.OverdriveAppShell || {};
    window.OverdriveAppShell.refreshVehicle = applyVehicleSelection;
    window.OverdriveAppShell.getSelectedVehicle = function () {
        return lastEv3dModel ? { modelId: lastEv3dModel, color: lastEv3dColor } : null;
    };

    // Expose the page registry (non-divider nav items) to the unified-search
    // palette (search.js). Returns fresh objects so callers can't mutate
    // NAV_ITEMS. Each: { href, i18n, label, svg }.
    window.OverdriveAppShell.getPages = function () {
        var out = [];
        for (var i = 0; i < NAV_ITEMS.length; i++) {
            var it = NAV_ITEMS[i];
            if (it.divider || !it.href) continue;
            out.push({
                href: it.href,
                i18n: it.i18n || null,
                label: it.label || '',
                icon: it.icon || '',
                svg: ''
            });
        }
        return out;
    };

    // Mount an additional OverdriveEvCard3D on a custom canvas (e.g. the
    // Live View camera selector). Reuses the sidebar's vendor download —
    // ev-card-3d.js is idempotent and adopts already-loaded THREE — and
    // tracks whatever (model, colour) the user has selected, replaying
    // the latest values once the renderer module is in place. The optional
    // returned handle releases this mount without affecting other surfaces.
    window.OverdriveAppShell.mountVehicleCanvas = function (canvasEl, opts) {
        if (!canvasEl) return null;
        opts = opts || {};
        var view = 'side';
        if (opts.view === 'top') view = 'top';
        else if (opts.view === 'three-quarter') view = 'three-quarter';
        var readyNotified = false;
        var unavailableNotified = false;
        var lifetime = { disposed: false, cacheOnly: !!opts.cacheOnly, timers: [], snapshotKeys: [] };
        var instance = null;
        var spriteAux = null;
        var vendorPoll = null;
        var vendorScript = null;
        var vendorReady = null;
        var vendorFailed = null;

        function removeAux(aux) {
            for (var i = auxEv3dInstances.length - 1; i >= 0; i--) {
                if (auxEv3dInstances[i] === aux) auxEv3dInstances.splice(i, 1);
            }
        }
        function stopVendorWait() {
            if (vendorPoll !== null) { clearInterval(vendorPoll); vendorPoll = null; }
            if (vendorScript) {
                vendorScript.removeEventListener('load', vendorReady);
                vendorScript.removeEventListener('error', vendorFailed);
                vendorScript = null;
            }
        }
        var handle = {
            dispose: function () {
                if (lifetime.disposed) return;
                lifetime.disposed = true;
                stopVendorWait();
                for (var i = 0; i < lifetime.timers.length; i++) clearInterval(lifetime.timers[i]);
                lifetime.timers = [];
                for (var w = vehicleSelectionWaiters.length - 1; w >= 0; w--) {
                    if (vehicleSelectionWaiters[w] === mountResolvedSelection) vehicleSelectionWaiters.splice(w, 1);
                }
                for (var k = 0; k < lifetime.snapshotKeys.length; k++) {
                    var key = lifetime.snapshotKeys[k];
                    if (snapshotsTaken[key] === lifetime) delete snapshotsTaken[key];
                }
                lifetime.snapshotKeys = [];
                if (spriteAux) {
                    spriteAux._disposed = true;
                    removeAux(spriteAux);
                    spriteAux = null;
                }
                if (instance) {
                    var current = instance;
                    instance = null;
                    removeAux(current);
                    try { current.dispose(); } catch (e) {
                        if (window.console) console.warn('[app-shell] vehicle canvas disposal failed:', e);
                    }
                }
            }
        };

        // Surfaces may keep an inexpensive placeholder visible until this
        // callback fires. A cache hit and the first complete WebGL render
        // both count as ready; notify at most once for the initial mount.
        function notifyReady(source) {
            if (lifetime.disposed || readyNotified) return;
            readyNotified = true;
            if (typeof opts.onReady === 'function') {
                try { opts.onReady({ source: source, canvas: canvasEl }); } catch (e) {
                    if (window.console) console.warn('[app-shell] vehicle canvas onReady failed:', e);
                }
            }
        }
        function notifyUnavailable() {
            if (lifetime.disposed || unavailableNotified) return;
            unavailableNotified = true;
            if (typeof opts.onUnavailable === 'function') {
                try { opts.onUnavailable(); } catch (e) {
                    if (window.console) console.warn('[app-shell] vehicle canvas unavailable callback failed:', e);
                }
            }
        }

        // Sprite-cache fast path. If we have a webp for this
        // (model, colour, view), paint the canvas in 2D and stop.
        // CRITICAL: a single HTMLCanvasElement can hold either a 2D
        // context OR a WebGL context, never both — once getContext('2d')
        // succeeds, a subsequent getContext('webgl') returns null. So
        // for aux canvases we have to commit to one path. Sprite path
        // is the right default for non-interactive surfaces (map
        // markers, top-down hotspot art); it gives the same perf win
        // the sidebar already enjoys.
        function tryCache(cb) {
            if (lifetime.disposed) return;
            if (!lastEv3dModel || !lastEv3dColor) { cb(false); return; }
            tryPaintFromSpriteCache(canvasEl, lastEv3dModel, lastEv3dColor, view, cb, lifetime);
        }

        function instantiate() {
            if (lifetime.disposed || opts.cacheOnly) return null;
            if (instance) return instance;
            if (typeof window.OverdriveEvCard3D !== 'function') return null;
            try {
                instance = new window.OverdriveEvCard3D(canvasEl, opts);
                instance._mountLifetime = lifetime;
                auxEv3dInstances.push(instance);
                if (lastEv3dColor) instance.setColor(lastEv3dColor);
                if (lastEv3dModel) instance.setModel(lastEv3dModel);
                if (lastEv3dModel && lastEv3dColor) {
                    instance.onceAfterRender(function () { notifyReady('render'); });
                    scheduleSpriteSnapshot(instance, canvasEl,
                                           lastEv3dModel, lastEv3dColor, view, lifetime);
                }
            } catch (e) {
                if (window.console) console.warn('[app-shell] aux ev-card-3d init failed:', e);
            }
            return instance;
        }

        // Aux mounts own their wait instead of invoking ensureEv3d(), whose
        // sidebar idle callback must keep its independent lifecycle.
        function loadRenderer() {
            if (lifetime.disposed || opts.cacheOnly) return;
            if (typeof window.OverdriveEvCard3D === 'function') { instantiate(); return; }
            if (vendorPoll !== null) return;
            vendorScript = document.querySelector('script[data-overdrive-ev-card-3d]');
            var created = !vendorScript;
            if (created) {
                vendorScript = document.createElement('script');
                vendorScript.src = '../shared/ev-card-3d.js?v=3';
                vendorScript.async = true;
                vendorScript.setAttribute('data-overdrive-ev-card-3d', '1');
            }
            vendorReady = function () {
                stopVendorWait();
                if (!lifetime.disposed) {
                    if (typeof window.OverdriveEvCard3D === 'function') instantiate();
                    else notifyUnavailable();
                }
            };
            vendorFailed = function () { stopVendorWait(); notifyUnavailable(); };
            vendorScript.addEventListener('load', vendorReady);
            vendorScript.addEventListener('error', vendorFailed);
            var tries = 0;
            vendorPoll = setInterval(function () {
                if (lifetime.disposed) { stopVendorWait(); return; }
                if (typeof window.OverdriveEvCard3D === 'function') vendorReady();
                else if (++tries > 80) vendorFailed();
            }, 100);
            if (created) document.head.appendChild(vendorScript);
        }

        // Track this canvas in auxEv3dInstances even when we satisfy it
        // from the sprite cache, so a later setEvCardAppearance can
        // re-paint it on user selection change. We use a lightweight
        // pseudo-instance — not a real OverdriveEvCard3D — exposing the
        // minimum the iteration loop needs (canvas, view, _disposed,
        // setModel/setColor that re-attempt the cache).
        function makeSpriteOnlyAux() {
            if (lifetime.disposed) return null;
            var aux = {
                canvas: canvasEl,
                view: view,
                _disposed: false,
                _spriteOnly: true,
                _mountLifetime: lifetime,
                setModel: function (m) {
                    if (lifetime.disposed || aux._disposed || !m || !lastEv3dColor) return;
                    tryPaintFromSpriteCache(canvasEl, m, lastEv3dColor, view, function (hit) {
                        if (!hit && !opts.cacheOnly) upgradeToLive(aux);
                    }, lifetime);
                },
                setColor: function (c) {
                    if (lifetime.disposed || aux._disposed || !c || !lastEv3dModel) return;
                    tryPaintFromSpriteCache(canvasEl, lastEv3dModel, c, view, function (hit) {
                        if (!hit && !opts.cacheOnly) upgradeToLive(aux);
                    }, lifetime);
                }
            };
            auxEv3dInstances.push(aux);
            spriteAux = aux;
            return aux;
        }

        // Sprite-only auxes upgrade to a real WebGL instance the first
        // time the user selects a (model, colour) we don't have a
        // sprite for — at that point we can't paint anything from the
        // cache, so we have to render live. Splice the sprite-only
        // entry out before mounting (it shares the canvas, and the
        // WebGL context will own it from now on).
        function upgradeToLive(spriteAux) {
            if (lifetime.disposed || opts.cacheOnly || spriteAux._disposed) return;
            spriteAux._disposed = true;
            removeAux(spriteAux);
            // Reset the canvas: dropping its parent and reinserting
            // gives us a fresh element. Cheap if simply replaceChildren
            // — but we can't replace the canvas itself without breaking
            // existing references in the page (Leaflet marker, hotspot
            // overlay). Instead clear the 2D context and let three.js
            // attach. WebGL will refuse if a 2D context exists, so we
            // null out the canvas's getContext result by reassigning
            // width — this DOES NOT release the 2D context. The only
            // safe way is to swap the <canvas> for a fresh one.
            var fresh = canvasEl.cloneNode(false);
            if (canvasEl.parentNode) canvasEl.parentNode.replaceChild(fresh, canvasEl);
            canvasEl = fresh;
            loadRenderer();
        }

        // Wait for vehicle selection, then try the cache before loading
        // the renderer. This makes warm navigations a sprite-only path.
        function mountResolvedSelection() {
            if (lifetime.disposed) return;
            tryCache(function (hit) {
                if (lifetime.disposed) return;
                if (hit) {
                    makeSpriteOnlyAux();
                    notifyReady('cache');
                    return;
                }
                if (opts.cacheOnly) { notifyUnavailable(); return; }
                loadRenderer();
            });
        }

        if (lastEv3dModel && lastEv3dColor) {
            mountResolvedSelection();
        } else {
            vehicleSelectionWaiters.push(mountResolvedSelection);
            if (!vehicleSelectionRequested) applyVehicleSelection();
        }

        return handle;
    };

    // Battery strip driver. The bar lives at the base of the 3D body
    // (see CSS .ev-battery-body-overlay). Single solid colour by SOC
    // band — green when healthy, amber when low, red when critical, no
    // multi-colour ramp. data-soc-state on the wrapper picks the
    // gradient; SOC also sets the WIDTH of the visible portion.
    function socStateFor(pct) {
        if (pct <= 20) return 'critical';
        if (pct <= 50) return 'warning';
        return 'healthy';
    }
    window.OverdriveAppShell.setSoc = function (pct) {
        var fill = document.getElementById('evBatteryFill');
        var bar  = document.getElementById('evBatteryBar');
        var clamped = Math.max(0, Math.min(100, pct));
        if (fill) fill.style.width = clamped + '%';
        if (bar)  bar.setAttribute('data-soc-state', socStateFor(clamped));
    };
    // Map charging power (kW) to fill-up animation duration. Slow AC L1
    // crawls (5s/cycle) → fast DC charging visibly snaps (~0.8s/cycle).
    // The mapping is piecewise so the visual differentiation lines up
    // with the user's mental model: trickle, AC, DC, ultra-fast.
    function fillupDurationForKw(kw) {
        if (!kw || kw <= 0) return 2.4;          // unknown → default
        if (kw <= 3.6)   return 5.0;              // L1 trickle
        if (kw <= 11)    return 3.6;              // AC L2
        if (kw <= 22)    return 2.6;              // AC fast L2
        if (kw <= 50)    return 1.6;              // DC fast
        if (kw <= 150)   return 1.0;              // DC hyper
        return 0.8;                                // ultra-rapid (>150 kW)
    }
    window.OverdriveAppShell.setCharging = function (on, powerKw) {
        // The .charging class on the EV card root gates the CSS keyframes
        // (battery sweep + bolt icon scale-in). core.js already toggles
        // this class before calling us — forwarding here keeps the
        // contract intact for any direct callers. powerKw is optional;
        // when supplied, the fill-up cycle speed scales with charging
        // power (set as a CSS var on the card root so the keyframe
        // animation-duration follows live).
        var card = document.getElementById('evCard');
        if (!card) return;
        if (on) card.classList.add('charging');
        else    card.classList.remove('charging');
        var dur = fillupDurationForKw(powerKw);
        card.style.setProperty('--ev-charge-fillup-duration', dur + 's');
    };

    // Re-run group-collapse wiring after dynamic nav links land (e.g.
    // update-flow.js's "Check for Updates" link). The function is
    // idempotent — already-wired headers skip the click bind, and every
    // run re-applies the persisted collapsed state to current members.
    window.OverdriveAppShell.rewireNavGroups = function () {
        var aside = wireGroupCollapse._lastAside ||
                    document.getElementById('sidebar') ||
                    document.querySelector('.ui-sidebar');
        if (aside) wireGroupCollapse(aside);
    };

    // Auto-load the collapsible-card script so every page that includes
    // app-shell.js gets the collapse behavior without needing a per-page
    // <script> tag. Idempotent: a second injection is a no-op via the
    // data-overdrive-collapse marker.
    function ensureCollapseScript() {
        if (document.querySelector('script[data-overdrive-collapse]')) return;
        var s = document.createElement('script');
        s.src = '../shared/app-collapse.js';
        s.setAttribute('data-overdrive-collapse', '1');
        s.async = false;
        // Place it next to app-shell.js so the relative path resolves the
        // same way as the page's other shared imports.
        var ref = document.querySelector('script[src*="app-shell.js"]');
        if (ref && ref.parentNode) ref.parentNode.insertBefore(s, ref.nextSibling);
        else document.head.appendChild(s);
    }
    ensureCollapseScript();

    // ============================================================
    // Unified search (command palette) — trigger + lazy loader
    // ============================================================
    //
    // The palette lives in search.js (+ search.css), loaded the same
    // next-to-app-shell.js way as app-collapse.js. We defer the load to idle
    // so the index can pre-warm without competing with first paint, but also
    // load eagerly the moment a trigger is used.

    function ensureSearchCss() {
        if (document.querySelector('link[data-overdrive-search-css]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = '../shared/search.css?v=1';
        l.setAttribute('data-overdrive-search-css', '1');
        document.head.appendChild(l);
    }
    function ensureSearchScript() {
        if (window.OverdriveSearch) return;
        if (document.querySelector('script[data-overdrive-search]')) return;
        ensureSearchCss();
        var s = document.createElement('script');
        s.src = '../shared/search.js?v=3';
        s.setAttribute('data-overdrive-search', '1');
        s.async = false;
        var ref = document.querySelector('script[src*="app-shell.js"]');
        if (ref && ref.parentNode) ref.parentNode.insertBefore(s, ref.nextSibling);
        else document.head.appendChild(s);
    }
    function openSearch() {
        if (window.OverdriveSearch && typeof window.OverdriveSearch.open === 'function') {
            window.OverdriveSearch.open();
        } else {
            // search.js drains this flag on load.
            window.__odSearchPendingOpen = true;
            ensureSearchScript();
        }
    }

    // Delegate clicks from any .od-search-open trigger (sidebar pill, mobile
    // header icon). Walk up from the event target to the trigger element —
    // SVG children have a non-string className, but the button ancestor is an
    // HTMLElement whose className is a plain string.
    document.addEventListener('click', function (ev) {
        var el = ev.target;
        while (el && el !== document.body &&
               !(el.className && ('' + el.className).indexOf('od-search-open') >= 0)) {
            el = el.parentNode;
        }
        if (el && el.className && ('' + el.className).indexOf('od-search-open') >= 0) {
            ev.preventDefault();
            openSearch();
        }
    });

    // Keyboard: Ctrl/Cmd+K anywhere; '/' when focus isn't in a text field.
    document.addEventListener('keydown', function (ev) {
        var k = ev.key;
        if ((ev.ctrlKey || ev.metaKey) && (k === 'k' || k === 'K' || ev.keyCode === 75)) {
            ev.preventDefault();
            openSearch();
            return;
        }
        // Match ev.key only — keyCode 191 is a different physical key on many
        // non-US layouts, so a keyCode fallback would hijack it.
        if (k === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
            var ae = document.activeElement;
            var tag = ae && ae.tagName ? ae.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' ||
                (ae && ae.isContentEditable)) return;
            ev.preventDefault();
            openSearch();
        }
    });

    // Warm the palette on idle so the first open is instant and a setting
    // deep-link's arrival handler (which reads the sessionStorage handoff — no
    // query string, the static server 404s those) runs even without a trigger.
    // Not in the car app: its chrome hides every trigger, and the warm-up would
    // crawl every page on the head unit for a palette nobody can open.
    if (!embeddedInNativeApp) {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(function () { ensureSearchScript(); }, { timeout: 4000 });
        } else {
            setTimeout(ensureSearchScript, 1500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
}());
