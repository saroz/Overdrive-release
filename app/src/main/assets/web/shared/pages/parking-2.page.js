/* Moved out of local/parking.html (security fix F9: no inline scripts). */
document.addEventListener('DOMContentLoaded', function () {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        Parking.init();
    });
});
