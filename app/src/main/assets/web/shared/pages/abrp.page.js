/* Moved out of local/abrp.html (security fix F9: no inline scripts). */
window.OT_TABS = [
    { id: 'status',    label: 'Status',    i18n: 'abrp.tab_status',    svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>', readOnly: true },
    { id: 'token',     label: 'Token',     i18n: 'abrp.tab_token',     svg: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
    { id: 'telemetry', label: 'Telemetry', i18n: 'abrp.tab_telemetry', svg: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', readOnly: true }
];

// Security F9 step 4: one markup call for the data-saving gate switch.
window.ABRPPage = {
    gateChanged: function () {
        ABRP.onGateToggle();
        ABRP.saveDataSaving();
    }
};
