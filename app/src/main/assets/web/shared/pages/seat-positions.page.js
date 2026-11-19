/* Moved out of local/seat-positions.html (security fix F9: no inline scripts). */
document.addEventListener('DOMContentLoaded', function () {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        SeatPositions.init();
    });
});
