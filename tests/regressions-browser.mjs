import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';

// Run after VITE_BASE=/vmk-schedule/ npm run build. Uses the installed Edge by default.
const root=path.resolve('dist'), prefix='/vmk-schedule/';
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary'};
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
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    localStorage.setItem('vmk-group','114');localStorage.setItem('vmk-onboarded','1');
    localStorage.setItem('vmk114-style','atelier');
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-09-25T06:10:00Z')});
  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
  const selected=()=>page.locator('.day-button[aria-pressed=true]').getAttribute('data-date');
  const expectDate=async date=>{await page.waitForFunction(d=>document.querySelector('.day-button[aria-pressed=true]')?.dataset.date===d,date);};
  const arrow=async key=>{
    // Dispatch from the body so dock-specific arrow handling is not involved.
    await page.evaluate(key=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})),key);
    await page.clock.runFor(200);
  };
  const choose=async date=>{
    await page.locator(`.week-strip .slide.current [data-date="${date}"]`).click();
    await expectDate(date);
  };
  await expectDate('2026-09-25');
  await arrow('ArrowRight');await expectDate('2026-09-26');
  await arrow('ArrowLeft');await expectDate('2026-09-25');
  // No lost presses when the listener has not yet been recreated.
  await page.evaluate(()=>{for(let i=0;i<2;i++)document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));});
  await expectDate('2026-09-23');
  await choose('2026-09-25');
  await page.locator('.heading button.status').click();await page.getByRole('dialog').waitFor();
  await arrow('ArrowRight');assert.equal(await selected(),'2026-09-25','dialog owns keyboard input');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  const nav=page.getByRole('navigation',{name:'Разделы'});
  for(const name of ['Календарь','Сессия','Полезное']) {
    await nav.getByRole('button',{name,exact:true}).click();await page.clock.runFor(200);
    await page.waitForFunction(name=>[...document.querySelectorAll('.dock button')].some(b=>b.textContent===name&&b.getAttribute('aria-pressed')==='true'),name);
    await arrow('ArrowRight');
    await nav.getByRole('button',{name:'Расписание',exact:true}).click();await page.clock.runFor(200);
    await expectDate('2026-09-25');
  }
  await page.locator('.pager .slide.current button.room').first().click();
  await page.locator('.campus-map').waitFor();
  await arrow('ArrowRight');
  await page.locator('.map-back').click();await expectDate('2026-09-25');
  console.log('PASS arrows navigate days, preserve rapid presses, and leave dialogs and other sections alone');

  // Editing and modified keys must not move the selected day either.
  await page.evaluate(()=>{
    const editor=document.createElement('div');editor.contentEditable='true';document.body.append(editor);
    editor.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));editor.remove();
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',ctrlKey:true,bubbles:true,cancelable:true}));
  });
  await page.clock.runFor(200);assert.equal(await selected(),'2026-09-25');

  // The live page is still refreshed while a cached neighbouring day is selected.
  const currentToday=page.locator('.pager .day[aria-label="25 сентября"] .lesson.current .live');
  await choose('2026-09-24');
  await page.clock.runFor(60_000);
  await choose('2026-09-25');
  assert.equal(await currentToday.count(),1);
  const end=await page.locator('.pager .slide.current .lesson.current .range').innerText();
  const [h,m]=end.match(/\d{2}:\d{2}/g).at(-1).split(':').map(Number);
  const untilEnd=await page.evaluate(({h,m})=>new Date(`2026-09-25T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+03:00`).getTime()-Date.now(),{h,m});
  await page.clock.fastForward(untilEnd+60_000);
  await page.waitForFunction(()=>document.querySelectorAll('.pager .slide.current .lesson.past').length===1);
  assert.equal(await page.locator('.pager .slide.current .lesson.past').count(),1);
  await page.getByRole('button',{name:'Вся неделя',exact:true}).click();
  await page.clock.runFor(60_000);
  assert.equal(await page.locator('.pager .slide.current .week-day[aria-label="25 сентября"] .week-rows li.done').count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS editable fields, modified keys, live clock and week cache; no browser exceptions');
} finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
