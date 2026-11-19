/* Moved out of local/widget-builder.html (security fix F9: no inline scripts). */
// Design · My widgets · Community as the shared section tabs; the car app gets no tabs (the page shows its notice there).
if (typeof window.AndroidBridge === 'undefined' && document.documentElement.getAttribute('data-android-embed') !== '1') {
    window.OT_TABS = [
        { id: 'design', label: 'Design', i18n: 'widgetBuilder.mode_design', svg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', readOnly: true },
        { id: 'mine', label: 'My widgets', i18n: 'widgetBuilder.tab_mine', svg: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>', readOnly: true },
        { id: 'community', label: 'Community', i18n: 'widgetBuilder.mode_community', svg: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>', readOnly: true }
    ];
}
