/* Moved out of local/daemons.html (security fix F9: no inline scripts). */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}
var D = BYD.daemons, t = D.t;
var TUNNEL_NAMES = { cloudflared: 'Cloudflared', zrok: 'Zrok', tailscale: 'Tailscale', wireguard: 'WireGuard' };
function render(data) {
    var list = document.getElementById('daemonList');
    list.textContent = '';
    document.getElementById('loadError').hidden = true;
    document.getElementById('parkedNote').hidden = !data.parkedShutdown;
    var badge = document.getElementById('summaryBadge');
    var known = typeof data.running === 'number';
    badge.textContent = known
        ? t('daemons.summary_running', '{running}/{total} running', { running: data.running, total: data.total })
        : t('daemons.summary_unknown', 'Status unavailable');
    badge.className = 'status-badge ' + (known && data.running > 0 ? 'active' : 'inactive');
    ['core', 'optional'].forEach(function (g) {
        list.appendChild(D.el('div', 'pr-group', t('daemons.group_' + g, g === 'core' ? 'Core' : 'Optional')));
        (data.daemons || []).filter(function (d) { return d.group === g; }).forEach(function (d) {
            var st = D.stateOf(d);
            var row = D.el('div', 'pr-row');
            row.appendChild(D.el('span', 'pr-dot ' + st));
            var info = D.el('div', 'pr-info');
            info.appendChild(D.el('span', 'pr-name', t('daemons.name_' + d.id, d.name)));
            info.appendChild(D.el('span', 'pr-meta', d.process));
            row.appendChild(info);
            row.appendChild(D.el('span', 'pr-state', t('daemons.state_' + st, st)));
            list.appendChild(row);
        });
    });
    renderTunnels(data);
}
function renderTunnels(data) {
    var box = document.getElementById('tunnelList');
    box.textContent = '';
    var tunnels = data.tunnels || [];
    if (!tunnels.length) {
        box.appendChild(D.el('p', 'pr-note', typeof data.running === 'number'
            ? t('daemons.tunnel_none', 'No tunnel running')
            : t('daemons.summary_unknown', 'Status unavailable')));
        return;
    }
    tunnels.forEach(function (tun) {
        var row = D.el('div', 'pr-row');
        row.appendChild(D.el('span', 'pr-dot ' + (tun.running ? 'running' : 'starting')));
        var info = D.el('div', 'pr-info');
        info.appendChild(D.el('span', 'pr-name', TUNNEL_NAMES[tun.type] || tun.type));
        if (tun.url) {
            var link = D.el('a', 'pr-url', tun.url);
            link.href = tun.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            info.appendChild(link);
        }
        var note = D.tunnelNote(tun, data.urlsHidden);
        if (note) info.appendChild(D.el('span', 'pr-sub', note));
        row.appendChild(info);
        box.appendChild(row);
    });
}
var loading = false;
function refresh() {
    if (loading) return;
    loading = true;
    D.load().then(render).catch(function () {
        document.getElementById('loadError').hidden = false;
    }).then(function () { loading = false; });
}
document.addEventListener('DOMContentLoaded', function () {
    if (window.BYD && BYD.core && BYD.i18n) {
        BYD.i18n.init().then(function () {
            BYD.core.init();
            refresh();
        });
    }
    document.getElementById('refreshBtn').addEventListener('click', refresh);
    setInterval(function () { if (!document.hidden) refresh(); }, 5000);
});
