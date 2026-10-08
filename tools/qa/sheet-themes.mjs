// All themes side by side (glass style, main page top), for comparing how alike they are.
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist'), out = process.argv[2], themes = process.argv.slice(3);
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => { const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'msedge', headless:true});
const shots = [];
for (const theme of themes) {
  const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true, serviceWorkers:'block'});
  await context.addInitScript(t => { localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1'); localStorage.setItem('vmk114-theme', t); localStorage.setItem('vmk114-style', 'glass'); }, theme);
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForSelector('.lesson'); await page.waitForTimeout(700);
  shots.push({theme, src:'data:image/png;base64,' + (await page.screenshot({clip:{x:0, y:0, width:390, height:640}})).toString('base64')});
  await context.close();
}
const page = await browser.newPage({viewport:{width:1600, height:900}});
await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(6,260px);gap:6px;padding:6px">${shots.map(s => `<figure style="margin:0;color:#fff;font:600 15px sans-serif;text-align:center"><img src="${s.src}" style="width:260px;display:block">${s.theme}</figure>`).join('')}</body>`);
await page.waitForTimeout(300); await page.screenshot({path:out, fullPage:true});
await browser.close(); server.close();
