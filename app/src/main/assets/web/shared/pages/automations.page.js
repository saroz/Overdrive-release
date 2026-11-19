/* Moved out of local/automations.html (security fix F9: no inline scripts). */
window.OT_TABS = [
    { id: 'automations', label: 'Automations', i18n: 'automation.tab_automations', svg: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>', readOnly: true },
    { id: 'add',         label: 'Add',         i18n: 'automation.tab_add',         svg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', readOnly: true },
    { id: 'groups',      label: 'Groups',      i18n: 'automation.tab_groups',      svg: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', readOnly: true },
    { id: 'safety',      label: 'Safety',      i18n: 'automation.tab_safety',      svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>', readOnly: true },
    { id: 'community',   label: 'Community',   i18n: 'community.tab_community',    svg: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>', readOnly: true }
];

// Helper used by automation.js to switch tabs after save / from list item Edit.
// Mirrors the click flow inside app-tabs.js so the localStorage active-tab
// record stays correct.
window.OT_setActiveTab = function (id) {
    var btn = document.querySelector('[data-tab-target="' + id + '"]');
    if (btn) { btn.click(); return true; }
    return false;
};
