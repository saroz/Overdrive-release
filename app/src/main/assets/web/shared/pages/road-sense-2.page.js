/* Moved out of local/road-sense.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    BYD.core.init();
    return RoadSenseSettings.init();
}).catch(function (error) {
    console.error('Failed to initialize RoadSense settings:', error);
    if (BYD.utils && BYD.utils.unlockSettingsHydration) BYD.utils.unlockSettingsHydration();
});
