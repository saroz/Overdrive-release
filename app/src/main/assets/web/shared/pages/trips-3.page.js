/* Moved out of local/trips.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    if (typeof BYD !== 'undefined' && BYD.core) BYD.core.init();
    return TRIPS.init();
}).catch(function (error) {
    console.error('Failed to initialize trips:', error);
    if (BYD.utils && BYD.utils.unlockSettingsHydration) BYD.utils.unlockSettingsHydration();
});
