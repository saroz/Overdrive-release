/* Moved out of local/events.html (security fix F9: no inline scripts). */
// Timeline scripts load on first use (the player fetches hls.js itself when it opens a source), so the List's init
// never waits on them. A Timeline-first page starts them now and inits the List after their boot, which claims
// ?file= first; if they fail to load, the List shows and works as before.
(function () {
    var html = document.documentElement, root = document.getElementById('tlvRoot');
    var SRC = ['../shared/timeline-strip.js?v=3', '../shared/timeline-player.js?v=3', '../shared/timeline-view.js?v=3'];
    var loaded = {}, wait = null, chosen = null, first = html.classList.contains('tlv-on'), listReady = !first, waiters = [];
    function view() { return window.BYD && BYD.tlview && BYD.tlview.setMode ? BYD.tlview : null; }
    function paint(mode) {
        var b = document.querySelectorAll('[data-tlv-mode]');
        for (var i = 0; i < b.length; i++) b[i].setAttribute('aria-pressed', b[i].getAttribute('data-tlv-mode') === mode ? 'true' : 'false');
    }
    function busy(on) {
        if (!root || view()) return;
        root.hidden = !on;
        root.innerHTML = on ? '<div class="loading"><div class="ui-spinner"></div></div>' : '';
    }
    function load() {
        if (wait) return wait;
        wait = new Promise(function (resolve, reject) {
            var left = 0;
            function settle() { if (--left > 0) return; if (view()) resolve(); else reject(new Error('timeline unavailable')); }
            // In order (async=false); a retry adds back only what failed, never re-runs a script that loaded.
            SRC.forEach(function (src) {
                if (loaded[src]) return;
                left++;
                var s = document.createElement('script');
                s.src = src;
                s.async = false;
                s.onload = function () { loaded[src] = true; settle(); };
                s.onerror = function () { if (s.parentNode) s.parentNode.removeChild(s); settle(); };
                document.body.appendChild(s);
            });
            if (!left) { left = 1; settle(); }
        });
        wait.then(null, function () { wait = null; });
        return wait;
    }
    function releaseList() {
        if (listReady) return;
        listReady = true;
        waiters.splice(0).forEach(function (fn) { fn(); });
    }
    function toList() {
        html.classList.remove('tlv-on');
        busy(false);
        paint('list');
    }
    window.BYD = window.BYD || {};
    BYD.tlListReady = function (fn) { if (listReady) fn(); else waiters.push(fn); };
    if (first) {
        paint('timeline');
        busy(true);
        load().then(releaseList, function () { toList(); releaseList(); });
    }
    // Until the view has booted (it then owns these buttons): Timeline loads it, List settles there even mid-load.
    var sw = document.getElementById('tlvModeSwitch');
    if (sw) sw.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-tlv-mode]') : null;
        if (!b || view()) return;
        chosen = b.getAttribute('data-tlv-mode') === 'timeline' ? 'timeline' : 'list';
        if (chosen === 'list') {
            // Timeline is remembered by the view's setMode once it runs; List is remembered now.
            try { localStorage.setItem('byd.events.view', 'list'); } catch (err) { /* private mode */ }
            toList();
            // As leaving the Timeline does, so a deep link doesn't reopen it when the view boots.
            try {
                var u = new URL(location.href);
                ['view', 't', 'end'].forEach(function (k) { u.searchParams.delete(k); });
                history.replaceState(history.state, '', u.toString());
            } catch (err) { /* old engines */ }
            releaseList();
            return;
        }
        paint('timeline');
        html.classList.add('tlv-on');
        busy(true);
        load().then(function () { view().setMode(chosen); }, function () {
            if (chosen !== 'timeline') return;
            toList();
            var msg = BYD.i18n && BYD.i18n.t ? BYD.i18n.t('tlview.offline') : '';
            if (BYD.core && BYD.core.toast) BYD.core.toast(msg && msg !== 'tlview.offline' ? msg : "Can't reach the recorder", 'error');
        });
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        BYD.tlListReady(function () { BYD.events.init(); });
    });
});
