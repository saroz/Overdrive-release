/* Moved out of local/storage.html (security fix F9: no inline scripts). */
var unlockSettings = function () {
    if (BYD.utils && BYD.utils.unlockSettingsHydration) {
        BYD.utils.unlockSettingsHydration();
    }
};
var failSettings = function (error) {
    console.error('Failed to initialize storage settings:', error);
    unlockSettings();
    if (BYD.utils && BYD.utils.toast) {
        BYD.utils.toast(BYD.i18n.t('errors.load_failed'), 'error');
    }
};
BYD.i18n.init().then(function () {
    BYD.core.init();
    return StoragePage.init();
}).then(unlockSettings, failSettings);
