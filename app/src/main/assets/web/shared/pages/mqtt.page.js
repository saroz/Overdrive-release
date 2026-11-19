/* Moved out of local/mqtt.html (security fix F9: no inline scripts). */
window.OT_TABS = [
    { id: 'connections', label: 'Connections', i18n: 'mqtt.tab_connections', svg: '<circle cx="12" cy="12" r="2"/><path d="M8.46 15.54A5 5 0 0 1 7 12a5 5 0 0 1 1.46-3.54"/><path d="M15.54 8.46A5 5 0 0 1 17 12a5 5 0 0 1-1.46 3.54"/><path d="M5.64 18.36A9 9 0 0 1 3 12a9 9 0 0 1 2.64-6.36"/><path d="M18.36 5.64A9 9 0 0 1 21 12a9 9 0 0 1-2.64 6.36"/>', readOnly: true },
    { id: 'add',         label: 'Add',         i18n: 'mqtt.tab_add',         svg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', readOnly: true },
    { id: 'telemetry',   label: 'Telemetry',   i18n: 'mqtt.tab_telemetry',   svg: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', readOnly: true }
];

// Helper used by mqtt.js to switch tabs after save / from list item Edit.
// Mirrors the click flow inside app-tabs.js so the localStorage active-tab
// record stays correct.
window.OT_setActiveTab = function (id) {
    var btn = document.querySelector('[data-tab-target="' + id + '"]');
    if (btn) { btn.click(); return true; }
    return false;
};
