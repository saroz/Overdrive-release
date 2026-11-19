/* Moved out of local/trips.html (security fix F9: no inline scripts). */
// ES5-only — Chrome 58 / Android 7.1 head-unit floor.
// Per-trip GPX / KML / CSV download (served on demand; no background work).
window.TripExport = {
    open: function () {
        var id = (typeof TRIPS !== 'undefined') ? TRIPS.currentTripId : null;
        if (id == null) return;
        function tr(k, f, vars) {
            var v = (window.BYD && BYD.i18n) ? BYD.i18n.t(k, vars) : null;
            if (v && v !== k) return v;
            if (vars) for (var n in vars) if (vars.hasOwnProperty(n)) f = f.split('{' + n + '}').join(String(vars[n]));
            return f;
        }
        function toast(msg, kind) { if (window.BYD && BYD.utils && BYD.utils.toast) BYD.utils.toast(msg, kind); }
        var backdrop = document.createElement('div');
        backdrop.className = 'ui-modal-backdrop';
        backdrop.style.display = 'flex';
        var card = document.createElement('div');
        card.className = 'ui-dialog';
        card.setAttribute('role', 'dialog');
        card.innerHTML = '<h3 class="ui-dialog-title"></h3><p></p><div class="ui-dialog-actions" style="flex-wrap:wrap;"></div>';
        card.querySelector('h3').textContent = tr('trip.detail.export_title', 'Export this trip');
        card.querySelector('p').textContent = tr('trip.detail.export_desc', 'GPX opens in maps and fitness apps, KML in Google Earth, CSV in a spreadsheet.');
        backdrop.appendChild(card);
        document.body.appendChild(backdrop);
        function close() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }
        backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
        var actions = card.querySelector('.ui-dialog-actions');
        [['gpx', 'GPX'], ['kml', 'KML'], ['csv', 'CSV']].forEach(function (f) {
            var b = document.createElement('button');
            b.className = 'ui-button ' + (f[0] === 'gpx' ? 'btn-primary' : 'btn-secondary');
            b.textContent = f[1];
            b.onclick = function () {
                close();
                var path = '/api/safekeep/export/trip?id=' + encodeURIComponent(id) + '&format=' + f[0];
                // The app WebView drops downloads; the native bridge saves into Download/Altitude 8848/.
                if (window.AndroidBridge && typeof AndroidBridge.downloadToFile === 'function') {
                    setTimeout(function () {
                        var saved = '';
                        try { saved = AndroidBridge.downloadToFile('http://127.0.0.1:8080' + path, 'trip-' + id + '.' + f[0]); } catch (e) { saved = ''; }
                        if (saved) toast(tr('trip.detail.export_saved', 'Saved to {path}', { path: saved }), 'success');
                        else toast(tr('trip.detail.export_failed', 'Could not save the file'), 'error');
                    }, 0);
                    return;
                }
                window.location.href = path;
            };
            actions.appendChild(b);
        });
        var c = document.createElement('button');
        c.className = 'ui-button';
        c.textContent = tr('common.close', 'Close');
        c.onclick = close;
        actions.appendChild(c);
    }
};
