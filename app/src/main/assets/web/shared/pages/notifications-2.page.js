/* Moved out of local/notifications.html (security fix F9: no inline scripts). */
var __OT_LOG_TAB = { id: 'log', label: 'Log', i18n: 'notif.tab_log', svg: '<line x1="8" y1="7" x2="18" y2="7"/><line x1="8" y1="12" x2="18" y2="12"/><line x1="8" y1="17" x2="14" y2="17"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>' };
var __OT_ALL_TABS = [
    __OT_LOG_TAB,
    { id: 'push',     label: 'Push',     i18n: 'notif.tab_push',     svg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
    { id: 'telegram', label: 'Telegram', i18n: 'notif.tab_telegram', svg: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' },
    { id: 'devices',  label: 'Devices',  i18n: 'notif.tab_devices',  svg: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>', readOnly: true }
];
// The Log tab reads persisted history (no tunnel needed) so it is useful
// in the head-unit WebView too — keep it alongside Telegram there. Push
// and Devices still make no sense in-car and are filtered out.
window.OT_TABS = (typeof window.AndroidBridge !== 'undefined')
    ? __OT_ALL_TABS.filter(function (t) { return t.id === 'telegram' || t.id === 'log'; })
    : __OT_ALL_TABS;
