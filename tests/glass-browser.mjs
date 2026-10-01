// Build with VITE_BASE=/vmk-schedule/, then run like the other browser suites:
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/glass-browser.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const safari=process.env.BROWSER_ENGINE==='webkit';
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
const browser=await (safari?webkit:chromium).launch(safari?{headless:true}:{channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
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
  if(safari)assert.equal(await page.locator('[data-glass-optics]').count(),0,'WebKit uses CSS glass');
  else await page.waitForFunction(()=>document.querySelectorAll('[data-glass-optics]').length>=3);
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
  const cdp=safari?null:await context.newCDPSession(page);
  const selected=()=>page.locator('.day-button[aria-pressed=true]').getAttribute('aria-label');
  const day=await selected();
  assert.equal(day,initialDay,'arrow keys in the dock must not change the schedule date');
  const area=await page.locator('.lesson').first().boundingBox();
  const p={x:area.x+area.width-25,y:area.y+area.height/2};
  if(cdp){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-i*20,y:p.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else await page.getByRole('button',{name:'Следующий день',exact:true}).click();
  await page.waitForTimeout(700);assert.notEqual(await selected(),day,'day navigation changes the day');
  console.log('PASS release-only tab drag, keyboard navigation, touch day swipe');

  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(100);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no overflow at ${width}`);
    const rect=await nav.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width,'dock stays in viewport');
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:initialDay,exact:true}).click();
  await page.waitForTimeout(650);
  await mkdir('test-results/glass',{recursive:true});
  const shot=async name=>page.screenshot({path:`test-results/glass/${safari?'webkit':'chromium'}-${name}.png`,fullPage:true});
  await shot('night');
  await page.getByRole('button',{name:'Оформление',exact:true}).click();
  assert.match(await page.locator('.style-gallery button').first().getAttribute('aria-label'),/^Стекло:/);
  const slider=page.getByRole('slider',{name:'Жидкое стекло: от матового к прозрачному'});
  await slider.focus();await slider.press('End');
  const alpha=async(selector,pseudo=null)=>page.locator(selector).first().evaluate((el,pseudo)=>{
    const c=getComputedStyle(el,pseudo).backgroundColor;
    const m=c.match(/\/\s*([\d.]+)\s*\)/)||c.match(/^rgba\(.+,\s*([\d.]+)\)$/);
    return m?Number(m[1]):1;
  },pseudo);
  assert(await alpha('[data-slot=dialog-content]')>=.62,'clear overlays retain a reading layer');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert(await alpha('.lesson')<=.05,'clear cards reveal the photo');
  assert(await alpha('.lesson h3','::before')>=.79,'clarity protects ink locally');
  assert.match(await nav.evaluate(el=>getComputedStyle(el).backdropFilter||getComputedStyle(el).webkitBackdropFilter),/blur\(10px\)/,'dock blurs scrolling text even when clear');
  await shot('night-clear');
  await nav.getByRole('button',{name:'Календарь',exact:true}).click();
  assert(await alpha('.term-month')>=.34,'dense calendar grid retains a reading field');
  assert.match(await page.locator('.term-month').first().evaluate(el=>getComputedStyle(el).backdropFilter||getComputedStyle(el).webkitBackdropFilter),/blur\(10px\)/);
  await nav.getByRole('button',{name:'Расписание',exact:true}).click();
  await page.reload();await page.locator('.lesson').first().waitFor();
  assert(await alpha('.lesson')<=.05,'saved clarity stays clear before hydration');
  assert(await alpha('.lesson h3','::before')>=.79,'saved clarity retains the local text veil');
  await page.getByRole('button',{name:'Оформление',exact:true}).click();
  await slider.focus();await slider.press('Home');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert(await alpha('.lesson')>=.84,'matte and clear have a visibly different material');
  await shot('night-matte');
  await page.getByRole('button',{name:'Оформление',exact:true}).click();
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();
  await page.getByRole('tab',{name:'Тема',exact:true}).click();
  await page.getByRole('button',{name:'МГУ день',exact:true}).click();
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await shot('day');
  await page.getByRole('button',{name:'Оформление',exact:true}).click();
  await page.getByRole('tab',{name:'Стиль',exact:true}).click();
  await slider.focus();await slider.press('End');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert(await alpha('.lesson')<=.05,'day photo shines through clear cards too');
  assert(await alpha('.lesson h3','::before')>=.79,'light ink has a local veil');
  await shot('day-clear');
  console.log('PASS wide clarity range, local reading veils, clear dock, persistence, glass-first picker');
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
  if(!safari)await page.waitForFunction(()=>document.querySelectorAll('[data-glass-optics]').length>=3);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelectorAll('.glass-optics filter').length===0);
  assert.equal(await nav.evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  if(!safari)await page.waitForFunction(()=>document.querySelectorAll('[data-glass-optics]').length>=3);
  await page.emulateMedia({contrast:'more'});
  assert.equal(await page.locator('.wallpaper').isVisible(),false);
  assert.equal(await nav.evaluate(e=>getComputedStyle(e).backdropFilter||getComputedStyle(e).webkitBackdropFilter),'none');
  assert.equal(await alpha('.lesson'),1,'contrast preference takes precedence over saved maximum clarity');
  await page.emulateMedia({contrast:'no-preference'});
  if(cdp){
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  await page.waitForFunction(()=>document.querySelectorAll('.glass-optics filter').length===0);
  assert.equal(await page.locator('.wallpaper').isVisible(),false);
  assert.equal(await nav.evaluate(e=>getComputedStyle(e).backdropFilter),'none');
  await cdp.send('Emulation.setEmulatedMedia',{features:[]});
  }
  console.log('PASS mobile/desktop bounds, theme persistence, cleanup, reduced effects');
  await mkdir('test-results/glass',{recursive:true});
  await page.screenshot({path:'test-results/glass/light.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
  const desktop=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await desktop.addInitScript(()=>{
    localStorage.setItem('vmk-group','114');localStorage.setItem('vmk-onboarded','1');
    localStorage.setItem('vmk114-style','glass');
  });
  const wide=await desktop.newPage();
  await wide.clock.setFixedTime(new Date('2026-09-28T07:45:00Z'));
  await wide.goto(base);await wide.locator('.slide:not([aria-hidden=true]) .lesson').first().waitFor();
  const card=wide.locator('.slide:not([aria-hidden=true]) .lesson').first();
  if(!safari)await wide.waitForFunction(()=>!!document.querySelector('.slide:not([aria-hidden=true]) .lesson[data-glass-optics]'));
  const rect=await card.boundingBox();
  await wide.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.3);await wide.mouse.down();
  await wide.waitForFunction(()=>!!document.querySelector('.lesson[data-glass-touch]'));
  await wide.waitForFunction(()=>document.querySelector('.lesson[data-glass-touch]')?.style.getPropertyValue('--mx'));
  assert(Math.abs(await card.evaluate(el=>parseFloat(el.style.getPropertyValue('--mx')))-80)<1,'highlight follows pointer position');
  await wide.mouse.up();
  assert.equal(await card.getAttribute('data-glass-touch'),null,'touch illumination cleans up after release');
  await wide.getByRole('button',{name:'Следующий день',exact:true}).click();
  await wide.waitForTimeout(700);
  if(!safari){
    await wide.waitForFunction(()=>!!document.querySelector('.slide:not([aria-hidden=true]) .lesson[data-glass-optics]'));
    assert.equal(await wide.locator('.slide[aria-hidden=true] .lesson[data-glass-optics]').count(),0,'hidden neighbour cards do not retain filters');
  }
  await wide.screenshot({path:`test-results/glass/${safari?'webkit':'chromium'}-desktop.png`});
  await desktop.close();
  console.log('PASS desktop edge refraction and pointer illumination');
} finally {await browser.close();await new Promise(r=>server.close(r));}
