// Layout check for local pages, driven through the installed Microsoft Edge (no browser download).
// Needs `npm run serve` running. Usage:
//   node scripts/inspect.mjs <page.html> [width] [light|dark] [--shot out.png] [--rtl]
// Prints page errors, horizontal overflow and the widest elements that stick out.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const [page = 'index.html', w = '1440', theme = 'dark', ...rest] = process.argv.slice(2);
const shot = rest.includes('--shot') ? rest[rest.indexOf('--shot') + 1] : null;
const rtl = rest.includes('--rtl');
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

const browser = await chromium.launch({ executablePath: edge, headless: true });
const ctx = await browser.newContext({ viewport: { width: Number(w), height: 900 } });
await ctx.addInitScript(([t, r]) => {
  try { localStorage.setItem('overdrive.theme', t); localStorage.setItem('byd-theme', t); } catch (e) {}
  const root = document.documentElement;
  if (root) { root.setAttribute('data-theme', t); if (r) root.setAttribute('dir', 'rtl'); }
}, [theme, rtl]);
const tab = await ctx.newPage();
const errors = [];
tab.on('pageerror', e => errors.push(String(e.stack || e.message || e).split(/\n/).slice(0, 3).join(' | ')));
tab.on('requestfailed', r => { if (!r.url().includes('/api/')) errors.push('failed: ' + r.url()); });
tab.on('request', r => { if (!r.url().startsWith('http://127.0.0.1')) errors.push('external: ' + r.url()); });
const url = page.startsWith('http') ? page
  : page.includes('/') ? 'http://127.0.0.1:8097/' + page
  : 'http://127.0.0.1:8097/app/src/main/assets/web/local/' + page;
await tab.goto(url, { waitUntil: 'networkidle' });
await tab.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
await tab.waitForTimeout(600);
const report = await tab.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
      wide.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''), right: Math.round(r.right), width: Math.round(r.width) });
    }
  }
  wide.sort((a, b) => a.width - b.width);
  return { vw, sw, overflow: sw > vw, wide: wide.slice(0, 8) };
});
if (shot) await tab.screenshot({ path: shot, fullPage: false });
console.log(JSON.stringify({ page, w: Number(w), theme, errors, ...report }, null, 1));
await browser.close();
