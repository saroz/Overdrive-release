/* Moved out of local/vehicle-control.html (security fix F9: no inline scripts). */
(function () {
    var mode = null;
    try { mode = localStorage.getItem('vc.viewMode'); } catch (e) {}
    window.VC_LITE = (mode !== 'immersive');
    document.documentElement.className +=
        window.VC_LITE ? ' vc-mode-lite' : ' vc-mode-immersive';
    if (typeof window.AndroidBridge !== 'undefined') {
        document.documentElement.className += ' is-app-webview';
    }
})();
