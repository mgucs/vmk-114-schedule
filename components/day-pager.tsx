import {useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';

// Pages are "day:2026-09-28" or "week:2026-09-28" (its Monday). Days lie side by side like pages of a book:
// a horizontal swipe drags the neighbours in with the finger, and any change of day slides the new one in from its side.
const GAP = 32;
const side = (a:string, b:string) => a.slice(0,4)!==b.slice(0,4) ? 0 : b>a ? 1 : b<a ? -1 : 0;
const offset = (el:HTMLElement) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function DayPager({page, render, neighbour, onTurn, surface}:{page:string; render:(page:string)=>ReactNode;
  neighbour:(page:string, d:number)=>string; onTurn:(d:number)=>void; surface:RefObject<HTMLElement|null>}) {
  const track = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<{page:string; leaving:{page:string; side:number}|null}>({page, leaving:null});
  const [peek, setPeek] = useState(false);
  // Where the track stood when the page changed: after a drag the new day continues from under the finger.
  const from = useRef<number|null>(null);
  const turn = useRef(onTurn); turn.current = onTurn;
  const after = useRef<(()=>void)|null>(null);
  if (shown.page!==page) {
    const d = side(shown.page, page);
    from.current = track.current ? offset(track.current) : 0;
    setShown({page, leaving:d && !calm() ? {page:shown.page, side:-d} : null});
  }

  // transitionend does not come while the page is hidden (the phone went to sleep mid-slide): a timer finishes instead.
  const guard = useRef(0);
  function hold() { clearTimeout(guard.current); after.current = null; }
  function finish() {
    clearTimeout(guard.current);
    const el = track.current;
    if (el) { el.style.transition = ''; el.style.transform = ''; }
    const then = after.current; after.current = null;
    setShown(s => s.leaving ? {...s, leaving:null} : s);
    then?.();
  }
  function settle(to:number, then?:()=>void) {
    const el = track.current!;
    after.current = then || null;
    if (calm() || Math.abs(offset(el)-to)<.5) { finish(); return; }
    el.style.transition = 'transform .46s cubic-bezier(.22,1,.36,1)';
    el.style.transform = `translate3d(${to}px,0,0)`;
    clearTimeout(guard.current); guard.current = window.setTimeout(finish, 700);
  }
  useEffect(() => () => clearTimeout(guard.current), []);

  useLayoutEffect(() => {
    const el = track.current, start = from.current;
    if (!el || start===null) return;
    from.current = null;
    if (!shown.leaving) { el.style.transition = ''; el.style.transform = ''; return; }
    // The page that was on screen now sits one width to the side: start where it stood and slide home.
    el.style.transition = 'none';
    el.style.transform = `translate3d(${start-shown.leaving.side*(el.offsetWidth+GAP)}px,0,0)`;
    el.getBoundingClientRect();
    settle(0);
  }, [shown]);

  // Touch is followed on the whole schedule area, not only on the cards.
  useEffect(() => {
    const area = surface.current;
    if (!area) return;
    let g:{x:number; y:number; axis:''|'x'|'y'; base:number; dx:number; lastX:number; lastT:number; v:number}|null = null;
    const start = (e:TouchEvent) => {
      // A second finger ends the drag: the page goes back to its place.
      if (g?.axis==='x' && track.current) settle(0, () => setPeek(false));
      const t = e.touches[0];
      g = e.touches.length===1 ? {x:t.clientX, y:t.clientY, axis:'', base:0, dx:0, lastX:t.clientX, lastT:e.timeStamp, v:0} : null;
    };
    const move = (e:TouchEvent) => {
      const el = track.current;
      if (!g || !el) return;
      const t = e.touches[0], dx = t.clientX-g.x, dy = t.clientY-g.y;
      if (!g.axis && Math.hypot(dx, dy)>9) {
        g.axis = Math.abs(dx)>Math.abs(dy)*1.2 && !(e.target as Element).closest?.('textarea,input') ? 'x' : 'y';
        if (g.axis==='x') {
          // Catch a page that is still sliding: the finger takes it from where it is.
          g.base = offset(el); g.x = t.clientX; hold();
          setShown(s => s.leaving ? {...s, leaving:null} : s); setPeek(true);
        }
      }
      if (g.axis!=='x') return;
      if (e.cancelable) e.preventDefault();
      const dt = Math.max(1, e.timeStamp-g.lastT);
      g.v = .7*(t.clientX-g.lastX)/dt+.3*g.v; g.lastX = t.clientX; g.lastT = e.timeStamp; g.dx = g.base+t.clientX-g.x;
      el.style.transition = 'none';
      el.style.transform = `translate3d(${g.dx}px,0,0)`;
    };
    const end = (e:TouchEvent) => {
      const s = g, el = track.current; g = null;
      if (!s || !el) return;
      if (!s.axis) {
        // A flick too quick to report any moves still turns the page.
        const t = e.changedTouches[0], dx = t.clientX-s.x, dy = t.clientY-s.y;
        if (e.type==='touchend' && Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) turn.current(dx<0 ? 1 : -1);
        return;
      }
      if (s.axis!=='x') return;
      const fling = Math.abs(s.v)>.35 && Math.sign(s.v)===Math.sign(s.dx) && Math.abs(s.dx)>24;
      if (e.type==='touchend' && (Math.abs(s.dx)>el.offsetWidth*.22 || fling)) { setPeek(false); turn.current(s.dx<0 ? 1 : -1); }
      else settle(0, () => setPeek(false));
    };
    area.addEventListener('touchstart', start, {passive:true});
    area.addEventListener('touchmove', move, {passive:false});
    area.addEventListener('touchend', end);
    area.addEventListener('touchcancel', end);
    return () => { area.removeEventListener('touchstart', start); area.removeEventListener('touchmove', move); area.removeEventListener('touchend', end); area.removeEventListener('touchcancel', end); };
  }, [surface]);

  const pages = [{page:shown.page, side:0}];
  if (shown.leaving) pages.push(shown.leaving);
  if (peek) for (const d of [-1, 1]) { const p = neighbour(shown.page, d); if (!pages.some(x => x.page===p)) pages.push({page:p, side:d}); }
  // While a page moves, Стекло drops the per-card backdrop blur (see glass.css): re-blurring every frame is what stutters on phones.
  return <div className="pager" data-paging={peek || shown.leaving ? '' : undefined}>
    <div className="pager-track" ref={track} onTransitionEnd={e => { if (e.target===track.current && e.propertyName==='transform') finish(); }}>
      {pages.map(p => <div key={p.page} className="slide" data-side={p.side || undefined} aria-hidden={p.side ? true : undefined}
        inert={p.side ? true : undefined} style={p.side ? {transform:`translateX(calc(${p.side} * (100% + ${GAP}px)))`} : undefined}>{render(p.page)}</div>)}
    </div>
  </div>;
}
