// Moves feature-widget rules out of the old global sheets (styles.css, revamp.css) into
// web-ui/src/components/adopted/<name>.css, so they survive when those sheets are deleted.
//   node scripts/adopt-rules.mjs <name> <class-regex> [<class-regex> ...]
// Every rule (also inside @media) whose selector names a matching class is cut from the old
// sheet and written to the adopted file. Colour keywords become tokens (the build's Chrome 58
// lowering would otherwise turn them into raw hex).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const SHARED = join(ROOT, '..', 'app', 'src', 'main', 'assets', 'web', 'shared');
const SHEETS = ['styles.css', 'revamp.css'];
const [name, ...patterns] = process.argv.slice(2);
if (!name || !patterns.length) { console.error('usage: adopt-rules.mjs <name> <class-regex>...'); process.exit(2); }
const res = patterns.map(p => new RegExp(`\\.(?:${p})(?![\\w-])`));
const matches = sel => res.some(re => re.test(sel));

// Walk top-level blocks; keep comments attached to the following block.
function blocks(css) {
  const out = [];
  let depth = 0, start = 0, i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? css.length : e + 2; continue; }
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { out.push([start, i + 1]); start = i + 1; } }
    i++;
  }
  return out;
}

function tokenise(css) {
  return css
    .replace(/:\s*white\b/g, ': var(--fixed-white)').replace(/\bwhite\s*;/g, 'var(--fixed-white);')
    .replace(/:\s*black\b/g, ': var(--fixed-black)').replace(/\bblack\s*;/g, 'var(--fixed-black);');
}

let adopted = '';
let moved = 0;
for (const sheet of SHEETS) {
  const path = join(SHARED, sheet);
  let css = readFileSync(path, 'utf8');
  const cut = [];
  for (const [a, b] of blocks(css)) {
    const text = css.slice(a, b);
    const brace = text.indexOf('{');
    const head = text.slice(0, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (/^@(media|supports)/.test(head)) {
      const inner = text.slice(brace + 1, text.lastIndexOf('}'));
      const kept = [], taken = [];
      for (const [x, y] of blocks(inner)) {
        const r = inner.slice(x, y);
        const h = r.slice(0, r.indexOf('{')).replace(/\/\*[\s\S]*?\*\//g, '').trim();
        (matches(h) ? taken : kept).push(r.trim());
      }
      if (taken.length) {
        adopted += `${head} {\n  ${taken.join('\n  ')}\n}\n`;
        moved += taken.length;
        cut.push([a, b, kept.length ? `\n${head} {\n    ${kept.join('\n    ')}\n}` : '']);
      }
    } else if (!head.startsWith('@') && matches(head)) {
      adopted += text.trim().replace(/^\/\*[\s\S]*?\*\/\s*/, '') + '\n';
      moved++;
      cut.push([a, b, '']);
    }
  }
  for (const [a, b, rep] of cut.reverse()) css = css.slice(0, a) + rep + css.slice(b);
  writeFileSync(path, css);
}

// Keyframes the moved rules animate with travel along (copied; the old sheet keeps its own).
const names = new Set([...adopted.matchAll(/animation(?:-name)?\s*:\s*([\w-]+)/g)].map(m => m[1]));
for (const sheet of SHEETS) {
  const css = readFileSync(join(SHARED, sheet), 'utf8');
  for (const n of names) {
    const at = css.indexOf(`@keyframes ${n}`);
    if (at < 0 || adopted.includes(`@keyframes ${n}`)) continue;
    let depth = 0, i = css.indexOf('{', at);
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) break;
    }
    adopted += css.slice(at, i + 1) + '\n';
  }
}

const dir = join(ROOT, 'src', 'components', 'adopted');
mkdirSync(dir, { recursive: true });
const file = join(dir, name + '.css');
const prev = existsSync(file) ? readFileSync(file, 'utf8') : `/* ${name}: feature widget styles moved from styles.css / revamp.css (adopt-rules.mjs). */\n`;
writeFileSync(file, prev + tokenise(adopted));
const entry = join(ROOT, 'src', 'ui.css');
const ui = readFileSync(entry, 'utf8');
const imp = `@import "./components/adopted/${name}.css";`;
if (!ui.includes(imp)) writeFileSync(entry, ui.replace('@import "tailwindcss/utilities.css"', `${imp}\n\n@import "tailwindcss/utilities.css"`));
console.log(name, moved, 'rules moved');
