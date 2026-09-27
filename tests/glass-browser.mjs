// Build with VITE_BASE=/vmk-schedule/, then run like the other browser suites:
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/glass-browser.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=path.resolve('dist'), prefix='/vmk-schedule/';
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try {
    const name=new URL(req.url,'http://localhost').pathname;
    if(!name.startsWith(prefix))throw Error('scope');
    const file=path.resolve(root,name.slice(prefix.length)||'index.html');
    if(!file.startsWith(root+path.sep))throw Error('path');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{
    localStorage.setItem('vmk-group','114');localStorage.setItem('vmk-onboarded','1');
    if(!localStorage.getItem('vmk114-style'))localStorage.setItem('vmk114-style','glass');
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-28T07:45:00Z'));
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  await page.goto(base);await page.locator('.lesson').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(500);
  await page.waitForFunction(()=>document.querySelectorAll('[data-glass-optics]').length>=3);
  assert.match(await page.locator('.glass-campus').getAttribute('style'),/vmk-schedule\/brand\/msu-night.webp/);
  assert.equal((await page.request.get(base+'brand/msu-night.webp')).status(),200);
  const nav=page.getByRole('navigation',{name:'Разделы'});
  const initialDay=await page.locator('.day-button[aria-pressed=true]').getAttribute('aria-label');
  const centre=async name=>{const b=await nav.getByRole('button',{name,exact:true}).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const a=await centre('Расписание'), b=await centre('Сессия');
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});
  assert.equal(await nav.getByRole('button',{name:'Расписание',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.session-main').count(),0,'do not mount a pane while scrubbing');
  await page.mouse.up();await page.getByRole('heading',{name:'Сессия',exact:true}).waitFor();
  await nav.getByRole('button',{name:'Сессия',exact:true}).focus();await page.keyboard.press('ArrowLeft');
  await page.getByRole('heading',{name:'Календарь',exact:true}).waitFor();
  await nav.getByRole('button',{name:'Расписание',exact:true}).click();
  await page.locator('.heading').waitFor();
  await page.waitForTimeout(600);
  const cdp=await context.newCDPSession(page);
  const selected=()=>page.locator('.day-button[aria-pressed=true]').getAttribute('aria-label');
  const day=await selected();
  assert.equal(day,initialDay,'arrow keys in the dock must not change the schedule date');
  const area=await page.locator('.lesson').first().boundingBox();
  const p={x:area.x+area.width-25,y:area.y+area.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-i*20,y:p.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(700);assert.notEqual(await selected(),day,'touch swipe changes the day');
  console.log('PASS release-only tab drag, keyboard navigation, touch day swipe');

  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(100);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no overflow at ${width}`);
    const rect=await nav.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width,'dock stays in viewport');
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Оформление',exact:true}).click();
  await page.getByRole('tab',{name:'Тема',exact:true}).click();
  await page.getByRole('button',{name:'Снег',exact:true}).click();
  await page.keyboard.press('Escape');await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'snow');
  assert.equal(await page.locator('html').getAttribute('data-style'),'glass');
  await page.getByRole('button',{name:'Оформление',exact:true}).click();
  await page.getByRole('button',{name:/^Минимал:/}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.glass-optics filter').length===0);
  assert.equal(await page.locator('[data-glass-optics]').count(),0);
  assert.equal(await page.locator('.wallpaper').isVisible(),false);
  await page.getByRole('button',{name:/^Стекло:/}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelectorAll('[data-glass-optics]').length>=3);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelectorAll('.glass-optics filter').length===0);
  assert.equal(await nav.evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelectorAll('[data-glass-optics]').length>=3);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  await page.waitForFunction(()=>document.querySelectorAll('.glass-optics filter').length===0);
  assert.equal(await page.locator('.wallpaper').isVisible(),false);
  assert.equal(await nav.evaluate(e=>getComputedStyle(e).backdropFilter),'none');
  await cdp.send('Emulation.setEmulatedMedia',{features:[]});
  console.log('PASS mobile/desktop bounds, theme persistence, cleanup, reduced effects');
  await mkdir('test-results/glass',{recursive:true});
  await page.screenshot({path:'test-results/glass/light.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
} finally {await browser.close();await new Promise(r=>server.close(r));}
