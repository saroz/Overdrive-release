/* Moved out of local/surveillance.html (security fix F9: no inline scripts). */
var unlockSettings = function () {
    if (BYD.utils && BYD.utils.unlockSettingsHydration) {
        BYD.utils.unlockSettingsHydration();
    }
};
var failSettings = function (error) {
    console.error('Failed to initialize surveillance settings:', error);
    unlockSettings();
    if (BYD.utils && BYD.utils.toast) {
        BYD.utils.toast(BYD.i18n.t('errors.load_failed'), 'error');
    }
};
BYD.i18n.init().then(function () {
    BYD.core.init();
    return Promise.all([
        SurvSettings.init(),
        SafeLocations.init(),
        RoiEditor.init(),
        ScheduleEditor.init(),
        ParkingSettings.init()
    ]);
}).then(unlockSettings, failSettings);

// Security F9 step 4: expressions the markup can no longer hold.
window.SurveillancePage = {
    saveParkingInt: function (key, value) {
        ParkingSettings.save(key, parseInt(value, 10));
    },
    uploadDeterrentImage: function (input) {
        SurvSettings.uploadScreenDeterrentImage(input.files[0]);
    }
};
