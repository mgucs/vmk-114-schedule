// Phone-size screenshots of the built site (dist): node tools/qa/shot.mjs out.png [scrollY] [clipTop clipHeight] [style] [theme]
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => { const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const [out='shot.png', scroll='0', top, height, style='glass', theme] = process.argv.slice(2);
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
await context.addInitScript(([style, theme]) => { localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1'); localStorage.setItem('vmk114-style', style); if (theme) localStorage.setItem('vmk114-theme', theme); if (location.hash.includes('full')) localStorage.setItem('vmk114-glass-quality','full'); const sh = location.hash.match(/shade=(\d+)/); if (sh) localStorage.setItem('vmk114-shade', sh[1]); }, [style, theme]);
const page = await context.newPage();
page.on('pageerror', e => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/` + (process.env.HASH || '')); await page.waitForSelector('.lesson'); await page.waitForTimeout(1200);
if (process.env.CLICK) { await page.click(process.env.CLICK); await page.waitForTimeout(700); }
if (+scroll) { await page.evaluate(y => scrollTo(0, y), +scroll); await page.waitForTimeout(300); }
await page.screenshot({path:out, ...(top ? {clip:{x:0, y:+top, width:390, height:+height}} : {})});
await browser.close(); server.close();
