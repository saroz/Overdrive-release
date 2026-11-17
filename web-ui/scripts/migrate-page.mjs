// Moves a page onto the mockup's ui- components (plan Tasks 8–12).
//   node scripts/migrate-page.mjs <page.html> [--scripts a.js,b.js] [--dry]
// 1. Renames the old shared vocabulary (card, setting-row, toggle-switch, btn, …) to ui- classes in
//    the page and in the given shared scripts: class="…" strings, className, classList calls and
//    CSS selector strings ('.setting-row').
// 2. Drops the old phone header and drawer overlay, wraps the content in .ui-main, tags <body>.
// 3. Moves the page's inline <style> into web-ui/src/pages/<page>.css (scoped to the page), minus
//    rules that only style the renamed vocabulary. `npm run build` compiles it to
//    shared/pages/<page>.css, which the page links after ui.css.
// The page still needs a visual pass afterwards; this does the mechanical part.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const WEB = join(ROOT, '..', 'app', 'src', 'main', 'assets', 'web');

export const MAP = {
  'page-header': 'ui-page-head', 'page-title': '', 'page-subtitle': '', 'page-body': 'ui-page-body',
  'header-badge': 'ui-badge', 'r-settings': '',
  'card': 'ui-panel', 'card-header': 'ui-panel-head', 'card-title': 'ui-panel-title',
  'card-subtitle': 'ui-panel-sub', 'card-body': 'ui-panel-body', 'card-footer': 'ui-panel-foot',
  'card-actions': 'ui-panel-foot',
  'setting-row': 'ui-row', 'setting-info': 'ui-row-copy', 'setting-name': 'ui-row-title',
  'setting-desc': 'ui-row-desc', 'setting-control': 'ui-row-end', 'setting-hint': 'ui-hint',
  'setting-stack': 'ui-row ui-row-stack', 'setting-row--inline': '',
  'toggle-switch': 'ui-toggle', 'toggle-slider': 'ui-toggle-track',
  'btn': 'ui-button', 'btn-primary': 'ui-button-primary', 'btn-secondary': '', 'btn-outline': '',
  'btn-danger': 'ui-button-danger', 'btn-sm': 'ui-button-sm', 'btn-small': 'ui-button-sm',
  'btn-block': 'ui-button-block', 'btn-icon': 'ui-button-icon', 'btn-ghost': 'ui-button-ghost',
  'btn-group': 'ui-segmented', 'btn-toggle': 'ui-segment',
  'form-group': 'ui-field', 'form-label': 'ui-label', 'form-control': 'ui-input', 'form-select': 'ui-select',
  'form-hint': 'ui-hint', 'help-text': 'ui-hint', 'form-row': 'ui-field-row',
  'md-field': 'ui-field', 'md-input': 'ui-input', 'md-label': 'ui-label', 'md-field-box': 'ui-field-box',
  'md-field-trailing': 'ui-field-has-trailing', 'md-helper': 'ui-hint',
  'info-row': 'ui-detail-row', 'info-label': 'ui-detail-label', 'info-value': 'ui-detail-value',
  'status-badge': 'ui-badge', 'badge': 'ui-badge',
  'r-hero': 'ui-panel ui-summary', 'r-hero-icon': 'ui-strip-icon', 'r-hero-title': 'ui-panel-title',
  'r-hero-text': 'ui-summary-text', 'r-hero-sub': 'ui-panel-sub', 'r-hero-stats': 'ui-summary-stats',
  'r-hero-stat': 'ui-summary-stat', 'r-hero-stat-label': 'ui-data-label', 'r-hero-stat-value': 'ui-summary-value',
  'r-link-card': 'ui-link-row', 'r-link-icon': 'ui-strip-icon', 'r-link-text': 'ui-row-copy',
  'r-link-title': 'ui-row-title', 'r-link-desc': 'ui-row-desc', 'r-link-chev': 'ui-row-end',
  'r-choice-row': 'ui-row-stack', 'r-choice-cards': 'ui-choices', 'r-choice-ico': 'ui-choice-icon',
  'r-choice-desc': 'ui-choice-desc', 'r-choice-hint': 'ui-hint',
  'header-actions': 'ui-page-actions', 'num': '', 'status-dot': 'ui-dot', 'empty-state-hint': 'ui-hint', 'md-supporting': 'ui-hint', 'spinner': 'ui-spinner',
  'modal-backdrop': 'ui-modal-backdrop', 'modal-card': 'ui-dialog', 'soh-modal-title': 'ui-dialog-title',
  'soh-modal-actions': 'ui-dialog-actions', 'soh-modal-input': 'ui-input', 'soh-modal-label': 'ui-label',
  'btn-danger-ghost': 'ui-button-ghost ui-button-danger', 'checkbox-row': 'ui-check-row', 'select-control': 'ui-select',
  'btn-group-vertical': 'ui-segmented ui-segmented-vertical', 'checkbox-item': 'ui-check', 'telemetry-fields': 'ui-check-group',
  'telemetry-fields-grid': 'ui-check-grid', 'info-box-note': 'ui-note', 'info-icon': 'ui-note-icon', 'info-note': 'ui-note-text',
  'mode-card-default': '', 'r-btn-spinner': 'ui-spinner', 'r-choice-native': 'ui-native-hidden', 'r-hero-ctl': 'ui-summary-ctl',
  'r-zone-ico': 'ui-zone-ico', 'z-dash': 'ui-zone-dash', 'z-red': 'ui-zone-red', 'z-ring': 'ui-zone-ring', 'z-yellow': 'ui-zone-yellow',
  'sd-status-dot': 'ui-dot', 'select-input': 'ui-select', 'text-input': 'ui-input', 'setting-badge': 'ui-badge',
  'slider-range-labels': 'ui-meter-labels',
  'info-box': 'ui-note', 'info-box-warning': 'ui-note-warning', 'storage-fallback-banner': 'ui-note ui-note-warning',
  'label': 'ui-detail-label', 'value': 'ui-detail-value', 'slider': 'ui-range', 'slider-control': 'ui-slider',
  'slider-value': 'ui-slider-value', 'storage-bar': 'ui-meter', 'storage-fill': 'ui-meter-fill', 'storage-info': 'ui-meter-labels', 'storage-fallback-warning': 'ui-warning-text', 'unsaved-indicator': 'ui-unsaved', 'footer-bar': 'ui-savebar', 'toast-container': 'ui-toast-stack', 'empty-state': 'ui-empty', 'hint': 'ui-hint', 'text-muted': 'ui-muted',
};

const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TOKENS = Object.keys(MAP).sort((a, b) => b.length - a.length);

export function mapTokens(value) {
  const out = [];
  for (const t of value.split(/\s+/)) {
    if (!t) continue;
    const m = Object.prototype.hasOwnProperty.call(MAP, t) ? MAP[t] : t;
    for (const x of m.split(/\s+/)) if (x && !out.includes(x)) out.push(x);
  }
  return out.join(' ');
}

/** class="…" attributes (also inside JS strings, escaped or not). Dynamic parts are left alone. */
function mapClassAttrs(src) {
  return src
    .replace(/class=(\\?)"([^"\\]*)\1"/g, (all, esc, v) => `class=${esc}"${mapLiteral(v)}${esc}"`)
    .replace(/class='([^']*)'/g, (all, v) => `class='${mapLiteral(v)}'`);
}

/** Map whole tokens in a literal that may contain '+ expr +' splices. */
function mapLiteral(v) {
  // Keep the literal's own leading/trailing spaces: 'sd-dot ' + state relies on them.
  const lead = /^\s*/.exec(v)[0];
  const trail = /\s*$/.exec(v)[0];
  const core = v.slice(lead.length, v.length - trail.length);
  if (!core) return v;
  const mapped = core.replace(/(^|\s)([A-Za-z][\w-]*)(?=\s|$)/g, (all, sp, t) => {
    if (!Object.prototype.hasOwnProperty.call(MAP, t)) return all;
    return MAP[t] ? sp + MAP[t] : sp;
  }).replace(/\s{2,}/g, ' ').trim();
  return lead + mapped + (mapped ? trail : (trail || lead ? ' ' : ''));
}

function mapScript(js) {
  let s = mapClassAttrs(js);
  // className = '…' / "…"
  s = s.replace(/(className\s*=\s*)(['"])([^'"]*)\2/g, (all, pre, q, v) => pre + q + mapLiteral(v) + q);
  // classList.add/remove/toggle/contains('token')
  s = s.replace(/(classList\.(?:add|remove|toggle|contains)\(\s*)(['"])([\w-]+)\2/g, (all, pre, q, t) =>
    Object.prototype.hasOwnProperty.call(MAP, t) && MAP[t] ? pre + q + MAP[t].split(' ').pop() + q : all);
  // Selector strings: '.token' after a quote or selector punctuation.
  for (const t of TOKENS) {
    if (!MAP[t]) continue;
    const to = MAP[t].split(' ').pop();
    s = s.replace(new RegExp(`(['"\\s,>(+~])\\.${ESC(t)}(?![\\w-])`, 'g'), `$1.${to}`);
  }
  return s;
}

/** Find an element (with nested children) whose opening tag matches `open`: its text and the html without it. */
function extractElement(html, open) {
  const m = open.exec(html);
  if (!m) return null;
  const tag = /^<(\w+)/.exec(m[0])[1];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = m.index + m[0].length;
  let depth = 1, end = -1, x;
  while ((x = re.exec(html))) {
    depth += x[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { end = x.index + x[0].length; break; }
  }
  if (end < 0) return null;
  let start = m.index;
  while (start > 0 && /[ \t]/.test(html[start - 1])) start--;
  if (html[end] === '\n') end++;
  return { text: html.slice(start, end), rest: html.slice(0, start) + html.slice(end) };
}

function removeElement(html, open) {
  const found = extractElement(html, open);
  return found ? found.rest : html;
}

/** Split CSS into top-level chunks (rules and at-rule blocks). */
function chunks(css) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) { out.push(css.slice(start, i + 1)); start = i + 1; } }
  }
  return out.map(c => c.trim()).filter(Boolean);
}

/** True when every selector in the rule targets renamed vocabulary (it styled the old look). */
function stylesOldVocabulary(selector) {
  const sels = selector.split(',');
  return sels.every(sel => TOKENS.some(t => new RegExp(`\\.${ESC(t)}(?![\\w-])`).test(sel)));
}

/** Rename old shared classes inside a selector to their ui- names (last name when one maps to two). */
function renameSelector(sel) {
  return sel.replace(/\.(-?[_a-zA-Z][\w-]*)/g, (all, t) =>
    Object.prototype.hasOwnProperty.call(MAP, t) && MAP[t] ? '.' + MAP[t].split(' ').pop() : all);
}

/** Prefix one selector with the page scope, keeping html/:root/body qualifiers in front.
 *  A leading class that sits on <body> (e.g. .live-view-page) is merged into the scope. */
function scopeSelector(sel, scope, bodyClasses = []) {
  let s = sel.trim();
  if (!s) return s;
  const lead = /^\.([\w-]+)((?:\.[\w-]+)*)(?=[\s>+~:[]|$)/.exec(s);
  if (lead && bodyClasses.includes(lead[1])) return scope + lead[0] + s.slice(lead[0].length);
  if (/^(:root|html)\b/.test(s)) {
    const m = /^((?::root|html)(?:\[[^\]]*\]|\.[\w-]+|:[\w-]+(?:\([^)]*\))?)*)(.*)$/.exec(s);
    const rest = m[2].trim();
    if (/^body\b/.test(rest)) return m[1] + ' ' + rest.replace(/^body/, scope);
    const bodyLead = /^\.([\w-]+)((?:\.[\w-]+)*)(?=[\s>+~:[]|$)/.exec(rest);
    if (bodyLead && bodyClasses.includes(bodyLead[1])) return `${m[1]} ${scope}${bodyLead[0]}${rest.slice(bodyLead[0].length)}`;
    return rest ? `${m[1]} ${scope} ${rest}` : scope;
  }
  if (/^body\b/.test(s)) return s.replace(/^body/, scope);
  return `${scope} ${s}`;
}

function keepCss(css, scope, bodyClasses = []) {
  const kept = [];
  for (const c of chunks(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    const head = c.slice(0, c.indexOf('{')).trim();
    const body = c.slice(c.indexOf('{') + 1, c.lastIndexOf('}'));
    if (head.startsWith('@media') || head.startsWith('@supports') || head.startsWith('@container')) {
      const inner = keepCss(body, scope, bodyClasses);
      if (inner.trim()) kept.push(`${head} {\n${inner}\n}`);
    } else if (head.startsWith('@')) {
      kept.push(c);
    } else if (!stylesOldVocabulary(head)) {
      // Mixed lists are kept; their old shared class names are renamed so the rule still applies.
      const sel = head.split(',').map(x => scopeSelector(renameSelector(x), scope, bodyClasses)).join(',\n');
      kept.push(`${sel} {${body}}`);
    }
  }
  return kept.join('\n');
}

export function migrate(page, scripts = [], dry = false) {
  const path = join(WEB, 'local', page);
  let html = readFileSync(path, 'utf8');
  const name = page.replace(/\.html$/, '');

  // Inline CSS -> web-ui/src/pages/<page>.css, scoped to this page.
  // A real tag at the start of a line only: comments may mention "<style>" in passing.
  const styles = [...html.matchAll(/^[ \t]*<style(?:\s[^>]*)?>([\s\S]*?)<\/style>\n?/gm)];
  const css = styles.map(m => m[1]).join('\n');
  for (const m of styles.reverse()) html = html.replace(m[0], '');
  const bodyClasses = ((/^[ 	]*<body[^>]*class="([^"]*)"/m.exec(html) || [])[1] || "").split(/\s+/).filter(Boolean);
  const kept = keepCss(css, `body[data-page="${name}"]`, bodyClasses);

  html = mapClassAttrs(html);
  // Inline scripts get the same renaming as shared scripts.
  html = html.replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g, (all, a, js, b) => a + mapScript(js) + b);
  html = removeElement(html, /<div class="mobile-header"[^>]*>/);
  html = removeElement(html, /<div class="sidebar-overlay"[^>]*>/);
  // Pages carried their own drawer toggle for the old sidebar; the shell provides toggleSidebar now.
  html = html.replace(/\n[ \t]*function toggleSidebar\(\)\s*\{[^{}]*\}[ \t]*(?=\n)/g, '');
  if (!/<main class="main-content[^"]*"[^>]*>\s*<div class="ui-main">/.test(html)) {
    html = html.replace(/(<main class="main-content[^"]*"[^>]*>)/, '$1\n            <div class="ui-main">');
    html = html.replace(/(\n\s*)<\/main>/, '$1    </div>$1</main>');
  }
  // The Apply bar sat fixed at the bottom of the window; it now floats at the end of the content.
  const bar = extractElement(html, /<div class="ui-savebar"[^>]*>/);
  if (bar && html.indexOf(bar.text) > html.indexOf('</main>')) {
    html = bar.rest;
    html = html.replace(/(\n[ \t]*)<\/div>(\s*<\/main>)/, `$1    ${bar.text.trim()}$1</div>$2`);
  }
  html = html.replace(/ class=""/g, '');
  html = html.replace(/^([ 	]*)<body([^>]*)>/m, (all, ind, attrs) => {
    let a = attrs.replace(/\sdata-page="[^"]*"/, '');
    if (/class="/.test(a)) a = a.replace(/class="([^"]*)"/, (m, v) => `class="${[...new Set(['ui-app', ...v.split(/\s+/).filter(Boolean)])].join(' ')}"`);
    else a += ' class="ui-app"';
    return `${ind}<body${a} data-page="${name}">`;
  });
  if (kept.trim() && !html.includes(`shared/pages/${name}.css`)) {
    html = html.replace(/([ \t]*)(<link rel="stylesheet" href="\.\.\/shared\/ui\.css[^"]*">)/,
      `$1$2\n$1<link rel="stylesheet" href="../shared/pages/${name}.css?v=1">`);
  }

  const results = { page, keptCssLines: kept.split('\n').length, droppedCssBytes: css.length - kept.length };
  if (!dry) {
    writeFileSync(path, html);
    if (kept.trim()) {
      mkdirSync(join(ROOT, 'src', 'pages'), { recursive: true });
      writeFileSync(join(ROOT, 'src', 'pages', name + '.css'),
        `/* ${page} — page-only styles, scoped to body[data-page="${name}"] (moved from its inline\n   <style>; rules for the old shared vocabulary dropped). Plain CSS for Chrome 58: no nesting. */\n${kept}\n`);
    }
    for (const f of scripts) {
      const p = join(WEB, 'shared', f);
      writeFileSync(p, mapScript(readFileSync(p, 'utf8')));
    }
  }
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('migrate-page.mjs')) {
  const args = process.argv.slice(2);
  const page = args[0];
  const si = args.indexOf('--scripts');
  const scripts = si >= 0 ? args[si + 1].split(',').filter(Boolean) : [];
  console.log(migrate(page, scripts, args.includes('--dry')));
}
