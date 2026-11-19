/* Moved out of local/charging.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    if (typeof BYD !== 'undefined' && BYD.core) BYD.core.init();
    CHARGING.init();
});
