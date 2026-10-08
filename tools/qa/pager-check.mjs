// Drives the new native-scroll day pager with real touch gestures and checks that the day, the header, the page in
// view and the drop always agree.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';

const root = path.resolve(process.argv[2] || path.resolve('dist'));
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => { const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
await context.addInitScript(() => { localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1'); });
const page = await context.newPage();
page.on('pageerror', e => console.log('PAGE ERROR', e.message));
const cdp = await context.newCDPSession(page);
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForSelector('.lesson');
await page.waitForTimeout(800);
const state = () => page.evaluate(() => {
  const pager = document.querySelector('.pager'), strip = document.querySelector('.week-strip');
  const visible = el => { const kids = [...el.children], i = Math.round(el.scrollLeft / el.clientWidth); return {i, el:kids[i], aligned:Math.abs(el.scrollLeft - i*el.clientWidth) < 2}; };
  const p = visible(pager), w = visible(strip);
  const shownDay = p.el?.querySelector('section')?.getAttribute('aria-label');
  const sel = document.querySelector('.day-button[aria-pressed=true]');
  const selInVisibleWeek = !!sel && w.el?.contains(sel);
  const line = (document.querySelector('.dayhead h1')?.textContent || '') + ' / ' + (document.querySelector('.dayhead p')?.textContent || '');
  const ok = p.aligned && w.aligned && p.el?.classList.contains('current') && shownDay && line.includes(shownDay) && selInVisibleWeek;
  return `${ok ? 'OK ' : 'BAD'} [pager ${Math.round(pager.scrollLeft)}/${pager.clientWidth} strip ${Math.round(strip.scrollLeft)}/${strip.clientWidth} cur ${p.el?.classList.contains('current')}] line "${line.slice(0,40)}" | page "${shownDay}" | strip week ${w.i} has selected: ${selInVisibleWeek} | footer ${Math.round(document.querySelector('.footer').getBoundingClientRect().top)}`;
});
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints:type === 'touchEnd' ? [] : [{x, y}]});
async function swipe(dir, steps = 10) {
  let x = dir < 0 ? 330 : 60; const y = 520;
  await touch('touchStart', x, y);
  for (let i = 0; i < steps; i++) { x += dir * 24; await touch('touchMove', x, y); await page.waitForTimeout(16); }
  await touch('touchEnd', x, y);
}
const log = [await state()];
for (const d of [-1, -1, -1, 1, -1]) { await swipe(d); await page.waitForTimeout(900); log.push((d < 0 ? 'swipe next ' : 'swipe prev ') + await state()); }
await swipe(-1, 3); await page.waitForTimeout(900); log.push('short drag ' + await state());
await page.locator('.week-strip .slide.current .day-button').nth(0).tap(); await page.waitForTimeout(1200); log.push('tap Mon    ' + await state());
await page.locator('.week-strip .slide.current .day-button').nth(4).tap(); await page.waitForTimeout(1200); log.push('tap Fri    ' + await state());
await page.locator('.week-strip .slide.current .day-button').nth(5).tap(); await page.waitForTimeout(1200); log.push('tap Sat    ' + await state());
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200); log.push('key right  ' + await state());
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1400); log.push('key x2     ' + await state());
await swipe(-1); await page.waitForTimeout(150); await swipe(-1); await page.waitForTimeout(1200); log.push('2 fast     ' + await state());
await page.locator('.dayhead-back').tap().catch(() => {}); await page.waitForTimeout(1400); log.push('Сегодня    ' + await state());
{ const yy = Math.round(await page.evaluate(() => document.querySelector('.week-strip').getBoundingClientRect().top + 30));
  async function sw(dir){ let x = dir < 0 ? 330 : 60; await touch('touchStart', x, yy); for (let i = 0; i < 10; i++) { x += dir*26; await touch('touchMove', x, yy); await page.waitForTimeout(16); } await touch('touchEnd', x, yy); }
  await sw(-1); await page.waitForTimeout(1300); log.push('strip next ' + await state());
  await sw(-1); await page.waitForTimeout(1300); log.push('strip next ' + await state());
  await sw(1); await page.waitForTimeout(1300); log.push('strip prev ' + await state()); }
console.log(log.join('\n'));
await browser.close(); server.close();
