// Builds shared/ph-icons.js: a Phosphor (regular weight, MIT) SVG sprite plus window.phIcon(name, cls).
// The icon list lives in web-ui/icons.json as { "<our name>": "<phosphor file name>" }.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, BANNER } from './paths.mjs';

const PH = join(ROOT, 'node_modules', '@phosphor-icons', 'core');

export function buildIcons(outDir) {
  const map = JSON.parse(readFileSync(join(ROOT, 'icons.json'), 'utf8'));
  const missing = [];
  const symbols = Object.entries(map).map(([name, file]) => {
    const path = join(PH, 'assets', 'regular', file + '.svg');
    if (!existsSync(path)) { missing.push(`${name} -> ${file}`); return ''; }
    const inner = readFileSync(path, 'utf8')
      .replace(/^[\s\S]*?<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return `<symbol id="ph-${name}" viewBox="0 0 256 256">${inner}</symbol>`;
  });
  if (missing.length) {
    throw new Error('Phosphor icons not found: ' + missing.join(', '));
  }

  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">'
    + symbols.join('') + '</svg>';

  const js = `${BANNER}
/* Phosphor Icons (regular) — MIT License, see icons/PHOSPHOR-LICENSE.txt. */
(function () {
  var SPRITE = ${JSON.stringify(sprite)};
  var injected = false;
  function inject() {
    if (injected || !document.body) return;
    injected = true;
    var holder = document.createElement('div');
    holder.innerHTML = SPRITE;
    document.body.insertBefore(holder.firstChild, document.body.firstChild);
  }
  /** Markup for one icon, e.g. phIcon('car') or phIcon('car', 'my-class'). */
  window.phIcon = function (name, cls) {
    inject();
    return '<svg class="ui-icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false">'
      + '<use href="#ph-' + name + '"></use></svg>';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
`;
  writeFileSync(join(outDir, 'ph-icons.js'), js);
  mkdirSync(join(outDir, 'icons'), { recursive: true });
  // LF endings: the repo's .gitattributes normalises text to LF, so `npm run check` must compare LF.
  const licence = readFileSync(join(PH, 'LICENSE'), 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(join(outDir, 'icons', 'PHOSPHOR-LICENSE.txt'), licence);
}
