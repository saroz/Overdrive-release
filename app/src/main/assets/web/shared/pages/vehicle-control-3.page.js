/* Moved out of local/vehicle-control.html (security fix F9: no inline scripts). */
// Kick off sidebar status polling. core.js doesn't auto-init (other
// pages call BYD.core.init() from their own bootstrap blocks).
if (window.BYD && BYD.core && typeof BYD.core.init === 'function') {
    BYD.i18n.init().then(function () {
        BYD.core.init();
    });
}
