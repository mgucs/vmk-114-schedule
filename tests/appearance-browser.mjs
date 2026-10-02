import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=path.resolve('dist');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{const pathname=new URL(req.url,'http://localhost').pathname.replace(/^\/vmk-schedule\//,'');const file=path.resolve(root,pathname||'index.html');if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-12-12T12:00:00Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}/vmk-schedule/`);
  await page.locator('.onboarding').getByRole('button',{name:'114',exact:true}).click();
  await page.locator('.onboarding').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Оформление',exact:true}).click();
  assert.match(await page.locator('.style-gallery button').first().getAttribute('aria-label'),/^Стекло:/);
  assert.equal(await page.locator('.style-live-preview iframe').count(),5);
  const frames=page.locator('.style-live-preview iframe');
  for(let i=0;i<5;i++){
    const frame=await (await frames.nth(i).elementHandle()).contentFrame();
    await frame.getByText('Математический анализ').waitFor();
    assert.equal(await frame.locator('.lesson').count(),2);
  }
  await page.getByRole('button',{name:/^Стекло:/}).click();
  assert.equal(await page.locator('html').getAttribute('data-style'),'glass');
  await page.keyboard.press('Escape');
  await page.reload();assert.equal(await page.locator('.onboarding').count(),0);
  assert.equal(await page.locator('html').getAttribute('data-style'),'glass');
  console.log('PASS first-visit style previews, selection and persistence');

  const nav=page.getByRole('navigation',{name:'Разделы'});
  const center=async name=>{const b=await nav.getByRole('button',{name,exact:true}).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const a=await center('Расписание'),b=await center('Сессия');
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
  assert.equal(await nav.getByRole('button',{name:'Расписание',exact:true}).getAttribute('aria-pressed'),'true','do not mount sections during scrubbing');
  assert.match(await nav.getAttribute('class'),/dragging/);
  await page.mouse.up();await page.getByRole('heading',{name:'Сессия',exact:true}).waitFor();
  const c=await center('Календарь');
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[b]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+(c.x-b.x)*i/8,y:b.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByRole('heading',{name:'Календарь',exact:true}).waitFor();
  assert.equal(await page.locator('.term-month h2').first().textContent(),'Декабрь 2026');
  assert.equal(await page.locator('.term-month').count(),3);
  await page.getByRole('button',{name:'Показать прошедшие месяцы'}).click();assert.equal(await page.locator('.term-month').count(),6);
  await page.getByRole('button',{name:'Скрыть прошедшие месяцы'}).click();assert.equal(await page.locator('.term-month').count(),3);
  await nav.getByRole('button',{name:'Календарь',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await page.getByRole('heading',{name:'Сессия',exact:true}).waitFor();
  console.log('PASS mouse/touch lens dragging, keyboard navigation and past-month visibility');
  assert.deepEqual(errors,[]);
  await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
