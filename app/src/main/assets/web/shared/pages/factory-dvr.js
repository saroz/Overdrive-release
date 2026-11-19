/* Moved out of local/factory-dvr.html (security fix F9: no inline scripts). */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}
document.addEventListener('DOMContentLoaded', function () {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        BYD.factoryDvr.init();
    });
});
