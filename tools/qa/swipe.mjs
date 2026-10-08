// Profiles day swipes on the built site (dist) in Edge emulating a mid-range phone (CPU ×6).
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';

const root = path.resolve(process.argv[2] || path.resolve('dist'));
const rate = Number(process.argv[3] || 6);
const types = {'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.glb':'model/gltf-binary'};
const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname.replace(/^\//, '') || 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(await readFile(path.join(root, p))); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({channel:'msedge', headless:true});
const context = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
await context.addInitScript(() => {
  localStorage.setItem('vmk-group', '101'); localStorage.setItem('vmk-onboarded', '1');
  if (location.hash.includes('lite')) localStorage.setItem('vmk114-glass-quality', 'lite');
  const st = location.hash.match(/style=(\w+)/); if (st) localStorage.setItem('vmk114-style', st[1]);
  window.__frames = []; window.__loaf = [];
  window.__nums = [];
  const tick = t => { window.__frames.push(t); if (window.__watchNums) window.__nums.push([...document.querySelectorAll('.day-button strong')].map(e => { const b = e.getBoundingClientRect(); return Math.round(b.left*2)/2+','+Math.round(b.top*2)/2+','+e.textContent; }).join(' ')); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__loaf.push({start:e.startTime, dur:e.duration, block:e.blockingDuration, render:e.renderStart ? e.startTime + e.duration - e.renderStart : 0, style:e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0,
    scripts:(e.scripts || []).map(s => ({d:Math.round(s.duration), inv:s.invoker, src:(s.sourceFunctionName || '') + '@' + (s.sourceURL || '').split('/').pop() + ':' + s.sourceCharPosition, layout:Math.round(s.forcedStyleAndLayoutDuration)}))})))
    .observe({type:'long-animation-frame', buffered:true}); } catch {}
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await page.goto(base + (process.argv[4] || ''));
await page.waitForSelector('.lesson');
await page.waitForTimeout(1500);
await cdp.send('Emulation.setCPUThrottlingRate', {rate});
await page.waitForTimeout(500);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints:type === 'touchEnd' ? [] : [{x, y}]});
async function swipe(dir) {
  let x = dir < 0 ? 320 : 70; const y = 560;
  await touch('touchStart', x, y);
  for (let i = 0; i < 12; i++) { x += dir * 20; await touch('touchMove', x, y + i * .3); await page.waitForTimeout(16); }
  await touch('touchEnd', x, y);
}
const results = [];
const tracing = process.env.TRACE === '1';
if (tracing) await browser.startTracing(page, {categories:['devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing']});
const profiling = process.env.PROFILE === '1';
if (profiling) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval:100}); await cdp.send('Profiler.start'); }
for (const dir of [-1, -1, -1, 1, 1, -1]) {
  await page.evaluate(() => { window.__frames = []; window.__loaf = []; window.__nums = []; window.__watchNums = !!window.__nums_on; window.__t0 = performance.now(); });
  await swipe(dir);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const f = window.__frames.filter(t => t >= window.__t0), gaps = f.slice(1).map((t, i) => t - f[i]);
    return {frames:f.length, over20:gaps.filter(g => g > 20).length, over34:gaps.filter(g => g > 34).length, worst:Math.round(Math.max(0, ...gaps)),
      gaps:gaps.map(g => Math.round(g)).join(' '), loaf:window.__loaf.filter(e => e.start >= window.__t0 - 5).map(e => ({at:Math.round(e.start - window.__t0), dur:Math.round(e.dur), style:Math.round(e.style), scripts:e.scripts.filter(s => s.d > 3)})),
      nums:[...new Set(window.__nums)], day:document.querySelector('.day-button[aria-pressed=true]')?.getAttribute('aria-label')};
  });
  results.push(r);
}
if (tracing) {
  const buf = await browser.stopTracing(); const events = JSON.parse(buf.toString()).traceEvents;
  const pick = events.filter(e => ['UpdateLayoutTree','Layout','ScheduleStyleRecalculation','InvalidateLayout','StyleRecalcInvalidationTracking','StyleInvalidatorInvalidationTracking'].includes(e.name));
  const main = events.filter(e => e.ph === 'X' && e.dur); const tot = new Map();
  const threads = new Map(events.filter(e => e.name === 'thread_name').map(e => [e.pid+':'+e.tid, e.args.name]));
  for (const e of main) { const k = (threads.get(e.pid+':'+e.tid) || e.tid) + ' / ' + e.name; tot.set(k, (tot.get(k) || 0) + e.dur); }
  console.log([...tot].sort((a,b) => b[1]-a[1]).slice(0, 30).map(([k,v]) => (v/1000).toFixed(0).padStart(6)+'ms '+k).join(String.fromCharCode(10)));
  const heavy = pick.filter(e => e.dur > 8000).sort((a, b) => b.dur - a.dur).slice(0, 14);
  for (const e of heavy) console.log(e.name, (e.dur/1000).toFixed(1)+'ms', JSON.stringify(e.args?.elementCount ?? e.args?.beginData ?? {}).slice(0,200), JSON.stringify(e.args?.endData ?? '').slice(0,120), (e.args?.beginData?.stackTrace || e.args?.stackTrace || []).slice(0,3).map(f => f.functionName+':'+f.lineNumber).join(' < '));
}
if (profiling) {
  const {profile} = await cdp.send('Profiler.stop');
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas; const counts = new Map();
  profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
  for (const [id, us] of counts) { const n = byId.get(id), f = n.callFrame; const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + us); }
  // inclusive time per frame key
  const parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const incl = new Map();
  for (const [id, us] of counts) { const seen = new Set(); let cur = id; while (cur !== undefined) { const f = byId.get(cur).callFrame; const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + us); } cur = parent.get(cur); } }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / 1000).toFixed(1).padStart(7)} ms  ${k}`).join(String.fromCharCode(10));
  console.log('SELF', String.fromCharCode(10) + top(self, 30)); console.log('INCLUSIVE', String.fromCharCode(10) + top(incl, 60));
} else console.log(JSON.stringify(results, null, 1));
await browser.close(); server.close();
