// Deletes rules from the old shared sheets that can no longer match anything: every selector in
// the rule names a class that no page or script writes any more. Same rule as
// LegacySheetsAssetTest. Rules inside @media blocks are pruned too; emptied blocks go.
//   node scripts/prune-legacy.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const WEB = join(ROOT, '..', 'app', 'src', 'main', 'assets', 'web');
const SHEETS = ['styles.css', 'revamp.css', 'app-shell.css', 'app-tabs.css', 'app-collapse.css'];
const dry = process.argv.includes('--dry');

function files(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'vendor' ? [] : files(p);
    return /\.(html|js)$/.test(n) ? [p] : [];
  });
}

const words = new Set();
for (const f of [...files(join(WEB, 'local')), ...files(join(WEB, 'shared'))]) {
  for (const m of readFileSync(f, 'utf8').matchAll(/[A-Za-z_][\w-]*/g)) words.add(m[0]);
}
const classInUse = c => {
  if (words.has(c)) return true;
  for (let i = c.indexOf('-'); i > 0; i = c.indexOf('-', i + 1)) if (words.has(c.slice(0, i + 1))) return true;
  return false;
};
const selectorAlive = sel => [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].every(m => classInUse(m[1]));

// Walk blocks keeping comments with the rule that follows them.
function blocks(css) {
  const out = [];
  let depth = 0, start = 0, i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? css.length : e + 2; continue; }
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) { out.push([start, i + 1]); start = i + 1; }
    i++;
  }
  return out;
}

function prune(css) {
  let removed = 0;
  const cut = [];
  for (const [a, b] of blocks(css)) {
    const text = css.slice(a, b);
    const brace = text.indexOf('{');
    const head = text.slice(0, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (/^@(media|supports)/.test(head)) {
      const innerStart = a + brace + 1, innerEnd = a + text.lastIndexOf('}');
      const inner = css.slice(innerStart, innerEnd);
      const res = prune(inner);
      removed += res.removed;
      if (!res.css.replace(/\/\*[\s\S]*?\*\//g, '').trim()) cut.push([a, b, '']);
      else if (res.removed) cut.push([innerStart, innerEnd, res.css]);
    } else if (head && !head.startsWith('@') && !head.split(',').some(selectorAlive)) {
      cut.push([a, b, '']);
      removed++;
    }
  }
  for (const [a, b, rep] of cut.reverse()) css = css.slice(0, a) + rep + css.slice(b);
  return { css: css.replace(/\n{3,}/g, '\n\n'), removed };
}

for (const s of SHEETS) {
  const p = join(WEB, 'shared', s);
  const before = readFileSync(p, 'utf8');
  const { css, removed } = prune(before);
  console.log(s.padEnd(18), removed, 'rules removed,', before.split('\n').length, '->', css.split('\n').length, 'lines');
  if (!dry) writeFileSync(p, css);
}
