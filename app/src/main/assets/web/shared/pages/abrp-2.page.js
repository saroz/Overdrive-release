/* Moved out of local/abrp.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    BYD.core.init();
    return ABRP.init();
}).catch(function (error) {
    console.error('Failed to initialize ABRP:', error);
    if (BYD.utils && BYD.utils.unlockSettingsHydration) BYD.utils.unlockSettingsHydration();
});
