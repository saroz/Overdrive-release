/* Moved out of local/live-view.html (security fix F9: no inline scripts). */
if (typeof window.AndroidBridge !== 'undefined') {
    document.documentElement.classList.add('is-app-webview');
}
