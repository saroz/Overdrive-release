/* Moved out of local/performance.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    BYD.core.init();
    // init() is async + fire-and-forget; catch so a sync throw in an
    // early step (initCharts/startPolling) surfaces in the console
    // instead of silently aborting the rest of init (which would leave
    // late-initialized cards like Data Usage blank).
    try { Promise.resolve(BYD.performance.init()).catch(function (e) {
        console.error('[Performance] init failed:', e);
    }); } catch (e) { console.error('[Performance] init threw:', e); }
});
