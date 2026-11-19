/* Moved out of local/assistant.html (security fix F9: no inline scripts). */
window.OT_TABS = [
    { id: 'assistant', label: 'Assistant', i18n: 'genai.tab_assistant', svg: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>' },
    { id: 'briefing', label: 'Trip Briefing', i18n: 'trip_briefing.tab', svg: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>' },
    { id: 'provider', label: 'Provider', i18n: 'genai.tab_provider', svg: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>' },
    { id: 'privacy', label: 'Privacy', i18n: 'genai.tab_privacy', svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' }
];
window.OT_setActiveTab = function (id) {
    var button = document.querySelector('[data-tab-target="' + id + '"]');
    if (button) button.click();
};
