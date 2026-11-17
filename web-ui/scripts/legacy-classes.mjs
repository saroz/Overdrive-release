// Freezes the list of class names defined by the old global sheets, so a rebuilt page can be
// checked for leftovers. Writes web-ui/legacy-classes.txt (one class per line). Run once, before
// pages move; re-running after Task 13 would shrink the list, so the file is committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const SHARED = join(ROOT, '..', 'app', 'src', 'main', 'assets', 'web', 'shared');
const SHEETS = ['styles.css', 'revamp.css', 'app-shell.css', 'app-tabs.css', 'app-collapse.css'];

import { STATES } from './legacy-states.mjs';

const classes = new Set();
for (const f of SHEETS) {
  const css = readFileSync(join(SHARED, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Selector text only: everything before a `{` that isn't inside a declaration block.
  for (const block of css.split('}')) {
    // "@media x { .a { decl" -> the selector is the part before the last "{".
    const parts = block.split('{');
    if (parts.length < 2) continue;
    const sel = parts[parts.length - 2];
    if (/^\s*@/.test(sel)) continue;
    for (const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      const c = m[1];
      if (!STATES.has(c) && !c.startsWith('ui-') && !/^\d/.test(c)) classes.add(c);
    }
  }
}
writeFileSync(join(ROOT, 'legacy-classes.txt'), [...classes].sort().join('\n') + '\n');
console.log(classes.size, 'legacy classes');
