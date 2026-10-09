// Calendar tab on a mid-range phone (Edge, CPU ×6): how long the tab takes to open, and frames while the months are
// swiped. node tools/qa/calendar-check.mjs [rate]
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';

const root = path.resolve('dist'), rate = Number(process.argv[2] || 6);
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => { const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
await context.addInitScript(() => {
  localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1');
  window.__frames = []; const tick = t => { window.__frames.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  window.__long = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({type:'long-animation-frame'}); } catch {}
});
const page = await context.newPage(); page.on('pageerror', e => console.log('PAGE ERROR', e.message));
const cdp = await context.newCDPSession(page);
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForSelector('.lesson'); await page.waitForTimeout(1200);
await cdp.send('Emulation.setCPUThrottlingRate', {rate}); await page.waitForTimeout(300);

const frames = async run => {
  await page.evaluate(() => { window.__frames = []; window.__long = []; });
  await run();
  return page.evaluate(() => { const f = window.__frames, gaps = f.slice(1).map((t, i) => Math.round(t - f[i]));
    return {frames:gaps.length, over34:gaps.filter(g => g > 34).length, worst:Math.max(0, ...gaps), longFrames:window.__long}; });
};
console.log('open tab  ', await frames(async () => { await page.tap('.dock button:nth-child(3)'); await page.waitForSelector('.term-page .term-top'); await page.waitForTimeout(800); }));
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints:type === 'touchEnd' ? [] : [{x, y}]});
async function swipe(dx) {
  const b = await page.locator('.term-pager').boundingBox(); const y = b.y + 150; let x = dx < 0 ? b.x + b.width - 40 : b.x + 40;
  await touch('touchStart', x, y);
  for (let i = 0; i < 12; i++) { x += dx / 12; await touch('touchMove', x, y); await page.waitForTimeout(16); }
  await touch('touchEnd', x, y); await page.waitForTimeout(700);
}
const month = () => page.evaluate(() => { const el = document.querySelector('.term-pager'); return document.querySelectorAll('.term-page')[Math.round(el.scrollLeft / el.clientWidth)]?.querySelector('h2')?.textContent; });
console.log('swipe →→ ', await frames(async () => { await swipe(-260); await swipe(-260); }), await month());
console.log('swipe ←  ', await frames(async () => { await swipe(260); }), await month());
console.log('tap day   ', await frames(async () => { await page.tap('.term-page:nth-child(2) .term-cell[aria-label*="18"]'); await page.waitForTimeout(400); }),
  await page.evaluate(() => document.querySelector('.term-day strong')?.textContent));
await browser.close(); server.close();
