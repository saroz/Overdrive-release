/* Moved out of local/recording.html (security fix F9: no inline scripts). */
// Capture is the default tab — owns the recording-mode picker, OEM
// Dashcam card, and Native DVR control. Status is read-only and
// was the previous default; that hid the OEM Dashcam toggle behind
// a tab the user had to discover.
window.OT_TABS = [
    { id: 'capture', label: 'Capture', i18n: 'recording.tab_capture', svg: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>' },
    { id: 'quality', label: 'Quality', i18n: 'recording.tab_quality', svg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
    { id: 'oem',     label: 'Dashcam',   i18n: 'recording.tab_oem', svg: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2"/><circle cx="10" cy="12" r="2.5"/>' }
];
