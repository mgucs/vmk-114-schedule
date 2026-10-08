// Time from lifting the finger after a day swipe to the strip showing the new day (CPU slowed like a phone).
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const root = path.resolve(process.argv[2] || path.resolve('dist')), rate = Number(process.argv[3] || 6);
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => { const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
await context.addInitScript(() => { localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1'); });
const page = await context.newPage(); const cdp = await context.newCDPSession(page);
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForSelector('.lesson'); await page.waitForTimeout(800);
await cdp.send('Emulation.setCPUThrottlingRate', {rate});
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints:type === 'touchEnd' ? [] : [{x, y}]});
const out = [];
for (const dir of [-1, -1, -1, 1]) {
  await page.evaluate(() => { window.__sel = document.querySelector('.day-button[aria-pressed=true]')?.getAttribute('aria-label'); window.__line = document.querySelector('.dayline')?.textContent; window.__t = {}; 
    const tick = () => { const t = performance.now(); const s = document.querySelector('.day-button[aria-pressed=true]')?.getAttribute('aria-label'); if (s !== window.__sel && !window.__t.strip) window.__t.strip = t; if (document.querySelector('.dayline')?.textContent !== window.__line && !window.__t.line) window.__t.line = t; if (!window.__t.strip || !window.__t.line) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  let x = dir < 0 ? 330 : 60; await touch('touchStart', x, 560);
  for (let i = 0; i < 10; i++) { x += dir * 24; await touch('touchMove', x, 560); await page.waitForTimeout(16); }
  await touch('touchEnd', x, 560); const up = await page.evaluate(() => performance.now());
  await page.waitForTimeout(2500);
  out.push(await page.evaluate(up => `strip +${Math.round(window.__t.strip - up)}ms, line +${Math.round(window.__t.line - up)}ms`, up));
}
console.log(out.join('\n')); await browser.close(); server.close();
