/* Moved out of local/recording.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    BYD.core.init();
    return RecSettings.init();
}).catch(function (error) {
    console.error('Failed to initialize recording settings:', error);
    if (BYD.utils && BYD.utils.unlockSettingsHydration) BYD.utils.unlockSettingsHydration();
});
