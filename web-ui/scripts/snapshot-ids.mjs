// Records, before a page is rebuilt, which element ids its scripts depend on.
// Writes web-ui/ids/<page>.txt:
//   # scripts: <the page's own shared scripts>
//   <one id per line>  — ids present in the page HTML that some script looks up
// Usage: npm run snapshot -- trips.html   |   npm run snapshot -- --all
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';
import { STATES } from './legacy-states.mjs';

const WEB = join(ROOT, '..', 'app', 'src', 'main', 'assets', 'web');
const LOCAL = join(WEB, 'local');
const SHARED = join(WEB, 'shared');
const OUT = join(ROOT, 'ids');

// Loaded on every page; their lookups are checked through every page's ids.
const COMMON = new Set(['theme.js', 'ph-icons.js', 'core.js', 'app-shell.js', 'auth.js', 'update-flow.js',
  'app-tabs.js', 'app-collapse.js', 'pwa-init.js', 'settings-hydration.js', 'skeleton.js', 'lang-picker.js',
  'search.js', 'utils.js', 'send-logs.js', 'backup-flow.js']);

export function pageScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*\bsrc="\.\.\/shared\/([^"?]+\.js)/g)) {
    const f = m[1];
    if (!COMMON.has(f) && !f.startsWith('vendor/') && !/\.min\.js$/.test(f) && f !== 'leaflet.js') out.push(f);
  }
  return [...new Set(out)];
}

function lookups(js) {
  const ids = new Set();
  const patterns = [
    /getElementById\(\s*['"]([\w-]+)['"]\s*\)/g,
    /querySelector(?:All)?\(\s*['"]#([\w-]+)/g,
    /\$\(\s*['"]([\w-]+)['"]\s*\)/g,
    /\bel\(\s*['"]([\w-]+)['"]\s*\)/g,
    /\bbyId\(\s*['"]([\w-]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of js.matchAll(re)) ids.add(m[1]);
  return ids;
}

function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
}

const commonJs = [...COMMON].map(f => { try { return readFileSync(join(SHARED, f), 'utf8'); } catch { return ''; } }).join('\n');

export function snapshot(page) {
  const html = readFileSync(join(LOCAL, page), 'utf8');
  const scripts = pageScripts(html);
  const js = [inlineScripts(html), commonJs, ...scripts.map(f => readFileSync(join(SHARED, f), 'utf8'))].join('\n');
  const used = lookups(js);
  const present = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(m => m[1]));
  const keep = [...present].filter(id => used.has(id)).sort();
  // Classes the page's own old <style> blocks defined: a rebuilt page must not keep using them.
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const own = new Set();
  for (const block of css.split('}')) {
    const parts = block.split('{');
    if (parts.length < 2 || /^\s*@/.test(parts[parts.length - 2])) continue;
    for (const m of parts[parts.length - 2].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      if (!STATES.has(m[1]) && !m[1].startsWith('ui-')) own.add(m[1]);
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, page.replace(/\.html$/, '.txt')),
    `# scripts: ${scripts.join(' ')}\n# old-classes: ${[...own].sort().join(' ')}\n${keep.join('\n')}\n`);
  return keep.length;
}

if (process.argv[1] && process.argv[1].endsWith('snapshot-ids.mjs')) {
  const args = process.argv.slice(2);
  const pages = args.includes('--all')
    ? readdirSync(LOCAL).filter(f => f.endsWith('.html') && f !== 'vehicle-control-3d-test.html')
    : args;
  for (const p of pages) console.log(p, snapshot(p), 'ids');
}
