// Lists every old global class a page (or its scripts) still uses that the new styling doesn't
// define — the same rule MigratedPagesAssetTest enforces, but all at once.
//   node scripts/leftovers.mjs <page.html>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const WEB = join(ROOT, '..', 'app', 'src', 'main', 'assets', 'web');
const page = process.argv[2];
const name = page.replace(/\.html$/, '');
const html = readFileSync(join(WEB, 'local', page), 'utf8');
const snap = readFileSync(join(ROOT, 'ids', name + '.txt'), 'utf8');
const scripts = (/^# scripts:(.*)$/m.exec(snap) || [, ''])[1].trim().split(/\s+/).filter(Boolean);

let css = readFileSync(join(WEB, 'shared', 'ui.css'), 'utf8');
const pageCss = join(WEB, 'shared', 'pages', name + '.css');
if (existsSync(pageCss)) css += readFileSync(pageCss, 'utf8');
css += [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const defined = new Set([...css.replace(/\{[^{}]*\}/g, '{}').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
const forbidden = new Set(readFileSync(join(ROOT, 'legacy-classes.txt'), 'utf8').split(/\s+/).filter(c => c && !defined.has(c)));

const found = new Map();
const note = (c, where) => { if (forbidden.has(c)) found.set(c, (found.get(c) || new Set()).add(where)); };
const markup = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
for (const m of markup.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) note(c, 'markup');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => [m[1], 'inline'])
  .concat(scripts.map(f => [readFileSync(join(WEB, 'shared', f), 'utf8'), f]));
for (const [src, where] of js) {
  for (const re of [/class=\\?"([^"\\]*)\\?"/g, /className\s*=\s*'([^']*)'/g, /className\s*=\s*"([^"]*)"/g]) {
    for (const m of src.matchAll(re)) for (const c of m[1].replace(/'\s*\+.*/, '').split(/\s+/)) note(c, where);
  }
}
for (const [c, w] of [...found].sort()) console.log(c.padEnd(32), [...w].join(', '));
if (!found.size) console.log('clean');
