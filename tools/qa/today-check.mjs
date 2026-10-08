import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const root = process.argv[2] || path.resolve('dist');
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => { const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
await context.addInitScript(() => { localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1'); });
const page = await context.newPage(); const cdp = await context.newCDPSession(page);
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForSelector('.lesson'); await page.waitForTimeout(800);
await cdp.send('Emulation.setCPUThrottlingRate', {rate:6});
for (let run = 0; run < 3; run++) {
  // two weeks ahead via the strip's arrows of the keyboard
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(2500);
  const ms = await page.evaluate(async () => {
    const want = document.querySelector('.day-button.today')?.getAttribute('aria-label')?.split(', ')[1];
    const t0 = performance.now(); document.querySelector('.dayhead-back').click();
    return await new Promise(res => { const tick = () => { const cur = document.querySelector('.pager > .slide.current section')?.getAttribute('aria-label'); if (cur && want && cur === want) res(Math.round(performance.now() - t0)); else if (performance.now() - t0 > 5000) res(-1); else requestAnimationFrame(tick); }; tick(); });
  });
  console.log(`«Сегодня»: today's page in place after ${ms} ms`);
}
await browser.close(); server.close();
