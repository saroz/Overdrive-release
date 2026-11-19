/* Moved out of local/safekeep.html (security fix F9: no inline scripts). */
window.OT_TABS = [
    { id: 'overview', label: 'Overview', i18n: 'safekeep.tab_overview', svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', readOnly: true },
    { id: 'storage', label: 'Storage', i18n: 'safekeep.tab_storage', svg: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>', readOnly: true },
    { id: 'backup', label: 'What & when', i18n: 'safekeep.tab_backup', svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', readOnly: true },
    { id: 'limits', label: 'Limits', i18n: 'safekeep.tab_limits', svg: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>', readOnly: true },
    { id: 'activity', label: 'Activity', i18n: 'safekeep.tab_activity', svg: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>', readOnly: true }
];
window.OT_setActiveTab = function (id) {
    var btn = document.querySelector('[data-tab-target="' + id + '"]');
    if (btn) { btn.click(); return true; }
    return false;
};
