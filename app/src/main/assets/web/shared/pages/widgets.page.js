/* Moved out of local/widgets.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    BYD.core.init();
    WidgetsSettings.init();
});

// Security F9 step 4: data-on-* handlers find their object on window; a top-level const isn't.
window.WidgetsSettings = WidgetsSettings;

// Security F9 step 4: slider conversions that used to be inline expressions.
window.WidgetsPage = {
    slideNumber: function (key, value) {
        WidgetsSettings.slide(key, +value);
    },
    slidePercent: function (key, value) {
        WidgetsSettings.slide(key, value / 100);
    }
};
