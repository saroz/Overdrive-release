/* Moved out of local/key-mapping.html (security fix F9: no inline scripts). */
window.OT_TABS = [
    { id: 'bindings', label: 'Bindings', i18n: 'keymap.tab_bindings', svg: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 13h10"/>', readOnly: true },
    { id: 'add',      label: 'Add',      i18n: 'keymap.tab_add',      svg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', readOnly: true }
];
window.OT_setActiveTab = function (id) {
    var btn = document.querySelector('[data-tab-target="' + id + '"]');
    if (btn) { btn.click(); return true; }
    return false;
};
