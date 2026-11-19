/* Moved out of local/events.html (security fix F9: no inline scripts). */
// Timeline first (deep link or remembered): the List stays hidden from the first paint; the loader at the end undoes it on failure.
// A List-first load is never a return to the Timeline, so a playhead stashed for one (timeline-view.js) is dropped.
(function () {
    try {
        if (new URLSearchParams(location.search).get('view') === 'timeline' || localStorage.getItem('byd.events.view') === 'timeline') document.documentElement.classList.add('tlv-on');
        else sessionStorage.removeItem('byd.tlview.resume');
    } catch (e) { /* storage blocked: List first */ }
})();
