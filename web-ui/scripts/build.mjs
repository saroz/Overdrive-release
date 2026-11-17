// Builds the committed web assets: shared/ui.css, shared/ph-icons.js and the icon licence.
// Usage: npm run build                -> writes into app/src/main/assets/web/shared
//        node scripts/build.mjs <dir>  -> writes into <dir> (used by check.mjs)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, SHARED, BANNER } from './paths.mjs';
import { buildIcons } from './icons.mjs';

export { ROOT, SHARED, BANNER };

export function buildCss(outDir) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'webui-')), 'ui.css');
  const cli = join(ROOT, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  execFileSync(process.execPath, [cli, '-i', join(ROOT, 'src', 'ui.css'), '-o', tmp, '--minify'],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  const css = readFileSync(tmp, 'utf8')
    // Keep Tailwind's MIT notice but drop its URL: the shipped CSS must not name any remote host.
    .replace(/\s*\|\s*https?:\/\/[^\s*]+/g, '')
    // The minifier spells `transparent` as #0000; keep the keyword so colour checks see no raw hex.
    .replace(/#0000(?![0-9a-fA-F])/g, 'transparent');
  writeFileSync(join(outDir, 'ui.css'), BANNER + '\n' + css.trim() + '\n');
}

export function buildAll(outDir) {
  mkdirSync(outDir, { recursive: true });
  buildCss(outDir);
  buildIcons(outDir);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] || SHARED;
  buildAll(out);
  console.log('built into', out);
}
