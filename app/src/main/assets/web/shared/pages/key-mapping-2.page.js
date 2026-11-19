/* Moved out of local/key-mapping.html (security fix F9: no inline scripts). */
document.addEventListener('DOMContentLoaded', function () {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        KM.init();
        if (window.ClusterProjection) ClusterProjection.renderInto('kmClusterSizeMount', 'kmClusterSize');
    });
});
