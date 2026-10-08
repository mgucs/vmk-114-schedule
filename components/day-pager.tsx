import {useDeferredValue,useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';

// Pages are "day:2026-09-28" or "week:2026-09-28" (its Monday). Days lie side by side like pages of a book:
// a horizontal swipe drags the neighbours in with the finger, and any change of day slides the new one in from its side.
// The neighbours are rendered ahead of time and wait off screen in the same GPU layer (globals.css, .pager-track):
// a swipe only moves that layer, so its first frame does no React work and no painting.
// The track is moved with the Web Animations API, which runs on the compositor. When a swipe turns the page, the
// slide starts at once, from under the finger, and React draws the new day a frame later, while the slide is
// already running: the new day keeps sliding through the redraw instead of waiting for it (on a phone the redraw
// takes several frames, and the page used to stand still for them and then jump). After the redraw the same slide
// continues in the new coordinates at the same moment of its timing, so there is no seam.
// Nothing here reads the layout or the computed style back (offsetWidth, getComputedStyle): after React changed the
// page that forces the browser to lay out the whole page there and then — it was most of a turn's cost on a phone.
// The width is kept by a ResizeObserver, and the position is known from the motion's own timing.
const GAP = 32;
const EASE = 'cubic-bezier(.25,.75,.35,1)';
const side = (a:string, b:string) => a.slice(0,4)!==b.slice(0,4) ? 0 : b>a ? 1 : b<a ? -1 : 0;
// cubic-bezier(.25,.75,.35,1) as a function of time, to know where the track is mid-slide without asking the browser.
function bezier(x1:number, y1:number, x2:number, y2:number) {
  const f = (t:number, a:number, b:number) => 3*a*t*(1-t)**2 + 3*b*t*t*(1-t) + t**3;
  return (x:number) => { let lo = 0, hi = 1; for (let i = 0; i < 20; i++) { const mid = (lo+hi)/2; if (f(mid, x1, x2) < x) lo = mid; else hi = mid; } return f((lo+hi)/2, y1, y2); };
}
const eased = bezier(.25, .75, .35, 1);
const at = (x:number) => `translate3d(${x}px,0,0)`;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// An ease-out whose start is 3× its average speed: with the finger's speed v (px/ms) the start matches it.
function duration(distance:number, v:number, toward:boolean) {
  return Math.round(Math.min(460, Math.max(toward ? 240 : 320, toward && v ? 3*distance/Math.abs(v) : 240+distance*.45)));
}
// `swipe`: the slide a swipe started before React drew the new day.
type Motion = {anim:Animation; from:number; to:number; ms:number; done:()=>void; swipe?:boolean};
type Gesture = {x:number; y:number; axis:''|'x'|'y'; base:number; dx:number; lastX:number; lastT:number; v:number};

export function DayPager({page, render, neighbour, onTurn, surface, onDrag}:{page:string; render:(page:string)=>ReactNode;
  neighbour:(page:string, d:number)=>string; onTurn:(d:number)=>void; surface:RefObject<HTMLElement|null>;
  onDrag?:(fraction:number|null, turned?:boolean)=>void}) {
  const track = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<{page:string; leaving:{page:string; side:number}|null}>({page, leaving:null});
  const near = useDeferredValue(shown.page);
  // Where the track stood when the page changed (a tap or an arrow): the new day continues from there.
  const from = useRef<number|null>(null);
  const turn = useRef(onTurn); turn.current = onTurn;
  // How far the finger has pulled the page (−1…1 of its width), for the day lens to follow; null when let go.
  const follow = useRef(onDrag); follow.current = onDrag;
  const motion = useRef<Motion|null>(null);
  // A swipe's slide reached the new day before React drew it.
  const landed = useRef(false);
  const gesture = useRef<Gesture|null>(null);
  const width = useRef(0);   // the track's width, kept by a ResizeObserver
  const rested = useRef(0);  // where the track stands when no motion runs
  if (shown.page!==page) {
    const d = side(shown.page, page);
    from.current = now();
    setShown({page, leaving:d && !calm() ? {page:shown.page, side:-d} : null});
  }

  // The finish event does not come while the page is hidden (the phone went to sleep mid-slide): a timer ends it.
  const guard = useRef(0);
  // Where the track is drawn now.
  function now() {
    const m = motion.current; if (!m) return rested.current;
    return m.from + (m.to-m.from)*eased(Math.min(1, Math.max(0, (Number(m.anim.currentTime) || 0)/m.ms)));
  }
  function place(x:number|null) { const el = track.current; if (el) el.style.transform = x===null ? '' : at(x); rested.current = x ?? 0; }
  function run(m:Omit<Motion,'anim'>, time=0) {
    const el = track.current!;
    const anim = el.animate({transform:[at(m.from), at(m.to)]}, {duration:m.ms, easing:EASE});
    anim.currentTime = time;
    place(m.to);
    const current:Motion = {...m, anim};
    motion.current = current;
    const end = () => { if (motion.current===current) { motion.current = null; clearTimeout(guard.current); anim.cancel(); m.done(); } };
    anim.onfinish = end;
    clearTimeout(guard.current); guard.current = window.setTimeout(end, m.ms-time+250);
  }
  // Move the track from where it is now to `to`, at the finger's release speed v.
  function move(to:number, v:number, done:()=>void, swipe=false) {
    if (!track.current) return;
    const x = now();
    stop();
    const distance = Math.abs(to-x);
    if (calm() || distance<.5) { place(to); done(); return; }
    run({from:x, to, ms:duration(distance, v, !!v && Math.sign(v)===Math.sign(to-x)), done, swipe});
  }
  // Freeze the track where it is drawn now.
  function stop() {
    const m = motion.current; if (!m) return;
    const x = now();
    motion.current = null; clearTimeout(guard.current); m.anim.cancel();
    place(x);
  }
  function rest() {
    place(null);
    setShown(s => s.leaving ? {...s, leaving:null} : s);
  }
  useEffect(() => () => { clearTimeout(guard.current); motion.current?.anim.cancel(); }, []);
  useLayoutEffect(() => {
    const el = track.current; if (!el) return;
    width.current = el.offsetWidth;
    const observer = new ResizeObserver(([entry]) => { width.current = entry.contentRect.width; });
    observer.observe(el); return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = track.current, start = from.current;
    if (!el || start===null) return;
    from.current = null;
    const swiped = landed.current; landed.current = false;
    if (!shown.leaving) { stop(); place(null); return; }
    // The day that was on screen now sits one width to the side; the track shifts the other way to keep it in place.
    const delta = -shown.leaving.side*(width.current+GAP);
    const g = gesture.current;
    if (g?.axis==='x') {
      // A finger caught the page before the new day was drawn: it keeps holding it.
      stop(); place(now()+delta); g.base += delta;
      setShown(s => ({...s, leaving:null}));
      return;
    }
    const m = motion.current;
    if (m?.swipe) {
      // The swipe's slide goes on: same timing, same moment, new coordinates.
      const time = Number(m.anim.currentTime) || 0;
      motion.current = null; m.anim.cancel();
      run({from:m.from+delta, to:m.to+delta, ms:m.ms, done:rest}, time);
      return;
    }
    if (swiped) { rest(); return; }
    // A tap or an arrow: slide the new day in from its side, from wherever the track stood.
    stop();
    place(start+delta);
    move(0, 0, rest);
  }, [shown]);

  // Touch is followed on the whole schedule area, not only on the cards.
  useEffect(() => {
    const area = surface.current;
    if (!area) return;
    const start = (e:TouchEvent) => {
      // A second finger ends the drag: the page goes back to its place.
      if (gesture.current?.axis==='x' && track.current) { follow.current?.(null); move(0, 0, rest); }
      const t = e.touches[0];
      gesture.current = e.touches.length===1 ? {x:t.clientX, y:t.clientY, axis:'', base:0, dx:0, lastX:t.clientX, lastT:e.timeStamp, v:0} : null;
    };
    const drag = (e:TouchEvent) => {
      const el = track.current, g = gesture.current;
      if (!g || !el) return;
      const t = e.touches[0], dx = t.clientX-g.x, dy = t.clientY-g.y;
      if (!g.axis && Math.hypot(dx, dy)>9) {
        g.axis = Math.abs(dx)>Math.abs(dy)*1.2 && !(e.target as Element).closest?.('textarea,input') ? 'x' : 'y';
        if (g.axis==='x') {
          // Catch a page that is still sliding: the finger takes it from where it is.
          stop(); g.base = now(); g.x = t.clientX;
          setShown(s => s.leaving ? {...s, leaving:null} : s);
        }
      }
      if (g.axis!=='x') return;
      if (e.cancelable) e.preventDefault();
      const dt = Math.max(1, e.timeStamp-g.lastT);
      g.v = .7*(t.clientX-g.lastX)/dt+.3*g.v; g.lastX = t.clientX; g.lastT = e.timeStamp; g.dx = g.base+t.clientX-g.x;
      place(g.dx);
      follow.current?.(g.dx/(width.current || 1));
    };
    const end = (e:TouchEvent) => {
      const s = gesture.current, el = track.current; gesture.current = null;
      if (!s || !el) return;
      if (!s.axis) {
        // A flick too quick to report any moves still turns the page.
        const t = e.changedTouches[0], dx = t.clientX-s.x, dy = t.clientY-s.y;
        if (e.type==='touchend' && Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) turn.current(dx<0 ? 1 : -1);
        return;
      }
      if (s.axis!=='x') return;
      const fling = Math.abs(s.v)>.35 && Math.sign(s.v)===Math.sign(s.dx) && Math.abs(s.dx)>24;
      const v = e.timeStamp-s.lastT < 80 ? s.v : 0;
      if (e.type==='touchend' && (Math.abs(s.dx)>width.current*.22 || fling)) {
        const d = s.dx<0 ? 1 : -1;
        follow.current?.(null, true);
        // The neighbour slides fully in right now; React draws the new day once this frame is out.
        landed.current = false;
        move(-d*(width.current+GAP), v, () => { landed.current = true; }, true);
        // After the next frame (the slide is on the compositor by then); a timer in case frames are held back.
        let sent = false; const send = () => { if (!sent) { sent = true; turn.current(d); } };
        requestAnimationFrame(() => setTimeout(send)); setTimeout(send, 50);
      } else { follow.current?.(null); move(0, v, rest); }
    };
    area.addEventListener('touchstart', start, {passive:true});
    area.addEventListener('touchmove', drag, {passive:false});
    area.addEventListener('touchend', end);
    area.addEventListener('touchcancel', end);
    return () => { area.removeEventListener('touchstart', start); area.removeEventListener('touchmove', drag); area.removeEventListener('touchend', end); area.removeEventListener('touchcancel', end); };
  }, [surface]);

  const pages = [{page:shown.page, side:0}];
  if (shown.leaving) pages.push(shown.leaving);
  // New neighbours are drawn once the slide is over, not in the middle of it; and right after a turn the deferred
  // page still lags: its neighbours would stand on the wrong side, so they wait for it.
  else for (const d of [-1, 1]) { const p = neighbour(shown.page, d); if (p===neighbour(near, d)) pages.push({page:p, side:d}); }
  return <div className="pager">
    <div className="pager-track" ref={track}>
      {pages.map(p => <div key={p.page} className="slide" data-side={p.side || undefined} aria-hidden={p.side ? true : undefined}
        inert={p.side ? true : undefined} style={p.side ? {transform:`translateX(calc(${p.side} * (100% + ${GAP}px)))`} : undefined}>{render(p.page)}</div>)}
    </div>
  </div>;
}
