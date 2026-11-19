/* Moved out of local/parking.html (security fix F9: no inline scripts). */
document.addEventListener('DOMContentLoaded', function () {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        Parking.init();
    });
});

// Security F9 step 4: markup passes the raw value; the integer conversion lives here.
window.ParkingPage = {
    saveInt: function (key, value) {
        ParkingSettings.save(key, parseInt(value, 10));
    }
};
