/* Moved out of local/network.html (security fix F9: no inline scripts). */
BYD.i18n.init().then(function () {
    BYD.core.init();
    NetworkPage.init();
});

// Security F9 step 4: data-on-* handlers find their object on window; a top-level const isn't.
window.NetworkPage = NetworkPage;
