/* Moved out of local/byd-cloud.html (security fix F9: no inline scripts). */
// Mirror legacy section-level visibility (set by BydCloud.updateStatusUI)
// onto the wrapper cards so that clearCard / mergeCard / pushCard hide
// when their inner section hides — without us having to monkey-patch
// the shared module.
(function () {
    function mirror(sectionId, cardId) {
        var sec = document.getElementById(sectionId);
        var card = document.getElementById(cardId);
        if (!sec || !card || typeof MutationObserver === 'undefined') return;
        var apply = function () {
            var hidden = sec.style.display === 'none';
            card.style.display = hidden ? 'none' : '';
        };
        new MutationObserver(apply).observe(sec, { attributes: true, attributeFilter: ['style'] });
        apply();
    }
    // bydCloudInfoEmpty inverts bydCloudInfo's visibility — show empty
    // text only when info is hidden.
    function invertMirror(sectionId, hostId) {
        var sec = document.getElementById(sectionId);
        var host = document.getElementById(hostId);
        if (!sec || !host || typeof MutationObserver === 'undefined') return;
        var apply = function () {
            host.style.display = sec.style.display === 'none' ? '' : 'none';
        };
        new MutationObserver(apply).observe(sec, { attributes: true, attributeFilter: ['style'] });
        apply();
    }
    document.addEventListener('app-shell:ready', function () {
        mirror('bydCloudPushSection', 'bydCloudPushCard');
        mirror('bydCloudMergeSection', 'bydCloudMergeCard');
        mirror('bydClearSection',     'bydClearCard');
        invertMirror('bydCloudInfo',  'bydCloudInfoEmpty');
        // Hide the Advanced empty-state once any clear-card etc. shows up.
        var clearCard = document.getElementById('bydClearCard');
        var emptyAdv  = document.getElementById('bydAdvancedEmpty');
        if (clearCard && emptyAdv) {
            var sync = function () {
                emptyAdv.style.display = clearCard.style.display === 'none' ? '' : 'none';
            };
            new MutationObserver(sync).observe(clearCard, { attributes: true, attributeFilter: ['style'] });
            sync();
        }
    });
}());

document.addEventListener('DOMContentLoaded', function () {
    var unlockSettings = function () {
        if (BYD.utils && BYD.utils.unlockSettingsHydration) {
            BYD.utils.unlockSettingsHydration();
        }
    };
    BYD.i18n.init().then(function () {
        BYD.core.init();
        if (window.BydCloud && BydCloud.loadStatus) {
            return BydCloud.loadStatus();
        }
    }).then(unlockSettings, unlockSettings);
});
