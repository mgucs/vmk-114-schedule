import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const root = path.resolve('dist');
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => { const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
await context.addInitScript(() => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1'); } });
const page = await context.newPage(); page.on('pageerror', e => console.log('PAGE ERROR', e.message));
const cdp = await context.newCDPSession(page);
const url = `http://127.0.0.1:${server.address().port}/`;
await page.goto(url); await page.waitForSelector('.lesson'); await page.waitForTimeout(600);
await page.click('.header-actions button[aria-label*="формлен"], .header-actions .icon-button:nth-of-type(2)'); await page.waitForTimeout(600);
const range = page.locator('.liquid-slider input[type=range]');
await range.scrollIntoViewIfNeeded();
const box = await range.boundingBox();
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints:type === 'touchEnd' ? [] : [{x, y}]});
const state = () => page.evaluate(() => ({value:document.querySelector('.liquid-slider input[type=range]').value, shade:document.querySelector('.wallpaper').style.getPropertyValue('--shade'), label:document.querySelector('.liquid-head span').textContent}));
console.log('start', JSON.stringify(await state()));
{ const y0 = box.y + box.height/2; await touch('touchStart', box.x + box.width*0.3, y0); await touch('touchMove', box.x + box.width*0.7, y0); await page.waitForTimeout(250);
  await page.screenshot({path:'peek.png'}); console.log('while held: data-peek', await page.evaluate(() => document.documentElement.hasAttribute('data-peek')));
  await touch('touchEnd', box.x + box.width*0.7, y0); await page.waitForTimeout(250); console.log('after release: data-peek', await page.evaluate(() => document.documentElement.hasAttribute('data-peek'))); }
const y = box.y + box.height/2;
for (const [from, to] of [[0.3, 0.9], [0.9, 0.05], [0.05, 0.6]]) {
  // a slightly diagonal drag, as a thumb does
  let x = box.x + box.width*from; await touch('touchStart', x, y); const steps = 12;
  for (let i = 1; i <= steps; i++) { await touch('touchMove', box.x + box.width*(from + (to-from)*i/steps), y + i*1.5); await page.waitForTimeout(16); }
  await touch('touchEnd', box.x + box.width*to, y + 18); await page.waitForTimeout(300);
  console.log(`drag ${from}→${to}`, JSON.stringify(await state()));
}
await page.reload(); await page.waitForSelector('.lesson'); await page.waitForTimeout(500);
console.log('after reload --shade on <html>:', await page.evaluate(() => document.documentElement.style.getPropertyValue('--shade')));
await browser.close(); server.close();
