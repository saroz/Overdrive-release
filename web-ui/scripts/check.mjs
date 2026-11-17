// Fails when the committed generated files differ from a fresh build.
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildAll, SHARED } from './build.mjs';

const out = mkdtempSync(join(tmpdir(), 'webui-check-'));
buildAll(out);

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]);
}

let stale = 0;
for (const f of files(out)) {
  const rel = relative(out, f);
  const committed = join(SHARED, rel);
  if (!existsSync(committed) || !readFileSync(committed).equals(readFileSync(f))) {
    console.error('check: stale or missing ' + rel + ' — run npm run build');
    stale++;
  }
}
if (stale) process.exit(1);
console.log('check: up to date');
