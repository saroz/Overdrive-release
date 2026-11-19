/* Moved out of local/notifications.html (security fix F9: no inline scripts). */
(function () {
    if (typeof window !== 'undefined' && typeof window.AndroidBridge !== 'undefined') {
        document.documentElement.classList.add('is-app-webview');
    }
})();
