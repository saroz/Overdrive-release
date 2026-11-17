// State classes that scripts toggle on many elements; they are not components, so the
// migration checks never count them as leftovers (filtered out when the lists are written).
export const STATES = new Set(['active', 'hidden', 'open', 'show', 'visible', 'disabled', 'loading', 'error',
  'success', 'warning', 'info', 'danger', 'selected', 'checked', 'expanded', 'collapsed', 'charging',
  'connected', 'disconnected', 'online', 'offline', 'on', 'off', 'is-active', 'is-open', 'is-hidden',
  'is-disabled', 'is-loading', 'is-visible', 'is-selected', 'is-on', 'is-off', 'is-empty', 'is-error',
  'is-stale', 'dirty', 'pending', 'fullscreen', 'recording', 'idle', 'armed', 'live', 'stale', 'muted']);
