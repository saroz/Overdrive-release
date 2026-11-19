/* Moved out of local/sessions.html (security fix F9: no inline scripts). */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}
document.addEventListener('DOMContentLoaded', function () {
    if (window.BYD && BYD.core && BYD.i18n) {
        BYD.i18n.init().then(function () {
            BYD.core.init();
            BYD.sessions.refresh();
        });
    }
    document.getElementById('signOutOthersBtn').addEventListener('click', function () { BYD.sessions.signOutOthers(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) BYD.sessions.refresh(); });
});
