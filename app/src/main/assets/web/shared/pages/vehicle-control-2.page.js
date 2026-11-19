/* Moved out of local/vehicle-control.html (security fix F9: no inline scripts). */
(function () {
    // Published so VC.switchViewMode() can pull the same stack, in the
    // same order, when the user turns 3D on without reloading.
    window.VC_VENDOR_CHAIN = [
        '../shared/SotaPlayer.js?v=13',
        '../shared/vendor/three.min.js?v=12',
        '../shared/vendor/DRACOLoader.js?v=12',
        '../shared/vendor/GLTFLoader.js?v=12',
        '../shared/vendor/OrbitControls.js?v=12',
        '../shared/vendor/gsap.min.js?v=12'
    ];
    var chain = window.VC_LITE ? [] : window.VC_VENDOR_CHAIN.slice();
    chain.push('../shared/vehicle-control.js?v=vclite40');
    for (var i = 0; i < chain.length; i++) {
        var s = document.createElement('script');
        s.src = chain[i];
        s.async = false;   // preserve execution order
        document.body.appendChild(s);
    }
})();
