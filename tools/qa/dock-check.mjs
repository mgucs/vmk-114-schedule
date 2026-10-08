// Taps every dock tab on the built site with the CPU slowed 6×: the lens must start moving in the tap's own frame
// (before the section is drawn), end under the tab, and the right section must open.
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
await context.addInitScript(() => { localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1'); });
const page = await context.newPage(); page.on('pageerror', e => console.log('PAGE ERROR', e.message));
const cdp = await context.newCDPSession(page);
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForSelector('.lesson'); await page.waitForTimeout(800);
await cdp.send('Emulation.setCPUThrottlingRate', {rate:6});
for (const i of [1, 2, 3, 0, 2]) {
  const r = await page.evaluate(async i => {
    const lens = document.querySelector('.dock-lens'), b = document.querySelectorAll('.dock button')[i];
    const t0 = performance.now(); b.click();
    const styleAtTap = lens.style.transform, sectionAtTap = document.querySelector('.dock button[aria-pressed=true] span').textContent;
    await new Promise(r => setTimeout(r, 1500));
    const x = new DOMMatrixReadOnly(getComputedStyle(lens).transform).m41, w = lens.offsetWidth;
    return `tap ${i}: lens target set at tap: ${styleAtTap} (section then: ${sectionAtTap}) → lens at ${Math.round(x/w*100)/100} cells, open: ${document.querySelector('.dock button[aria-pressed=true] span').textContent}, on: ${[...document.querySelectorAll('.dock button')].findIndex(x => x.hasAttribute('data-on'))}`;
  }, i);
  console.log(r);
}
await browser.close(); server.close();
