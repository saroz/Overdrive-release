/* Moved out of local/automations.html (security fix F9: no inline scripts). */
// Show the clock badge only outside the head-unit WebView. The native
// shell injects window.AndroidBridge, so its absence means we're in a
// browser or standalone PWA — where the page-level clock is useful.
// BYD.core.init() runs startClock(), which populates #currentTime when
// the element is present regardless of visibility.
if (typeof window.AndroidBridge === 'undefined') {
    var headerActions = document.getElementById('headerActions');
    if (headerActions) headerActions.style.display = '';
}
BYD.i18n.init().then(function () {
    BYD.core.init();
    AutomationSettings.init();
    if (window.CommunityAutomations) CommunityAutomations.init();
    if (window.ClusterProjection) ClusterProjection.renderInto('autoClusterSizeMount', 'autoClusterSize');
});
