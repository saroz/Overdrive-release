import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const out = process.argv[2];
const pages = readFileSync('migrated-pages.txt', 'utf8').split(/\s+/).filter(Boolean);
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1280), height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(t => { try { localStorage.setItem('byd-theme', t); } catch (e) {} }, theme);
  // Map tiles are external and load at random times: block them so shots are stable.
  await ctx.route(/openstreetmap/, r => r.abort());
  const t = await ctx.newPage();
  for (const p of pages) {
    await t.goto(`http://127.0.0.1:8097/app/src/main/assets/web/local/${p}?devPwa=1`, { waitUntil: 'networkidle' });
    await t.evaluate(th => document.documentElement.setAttribute('data-theme', th), theme);
    await t.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await t.waitForTimeout(400);
    await t.screenshot({ path: `${out}/${theme}-${p}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
console.log('shots', pages.length * 2);
