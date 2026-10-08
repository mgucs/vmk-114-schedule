import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

// Pages are "day:2026-09-28" or "week:2026-09-28" (its Monday), side by side like pages of a book.
// The pager is the browser's own horizontal scroller with snap points: three pages (the one before, this one, the one
// after), the middle one in view. A swipe is a native scroll — the phone moves the pages on its compositor, with its
// own physics, and no script of ours runs while the finger moves (the hand-made pager, however light, still stuttered
// on phones). React draws only when the scroller has settled on a page: then the pages are shifted by one and the
// scroller is put back on the middle one in the same frame, so nothing visible moves.
// A tap on a day or an arrow scrolls smoothly to that page; a far day is first put in the slot on its side.
const side = (a:string, b:string) => a.slice(0,4)!==b.slice(0,4) ? 0 : b>a ? 1 : b<a ? -1 : 0;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
type Slots = [string, string, string];

export function DayPager({page, render, neighbour, onTurn, onDrag}:{page:string; render:(page:string)=>ReactNode;
  neighbour:(page:string, d:number)=>string; onTurn:(d:number)=>void; onDrag?:(fraction:number|null, turned?:boolean)=>void}) {
  const around = (p:string):Slots => [neighbour(p,-1), p, neighbour(p,1)];
  const scroller = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Slots>(() => around(page));
  const current = useRef({slots, page}); current.current = {slots, page};
  // A scroll we started (tap, arrow): the day lens glides by itself meanwhile, and the parent already shows its page.
  const ours = useRef(false);
  // The slot to scroll to once React has drawn it (a far day put next to this one).
  const want = useRef<number|null>(null);
  const turn = useRef(onTurn); turn.current = onTurn;
  const follow = useRef(onDrag); follow.current = onDrag;

  // One page step: every page is the scroller's full width (globals.css, .pager).
  const step = () => scroller.current!.clientWidth || 1;
  // If our scroll does not arrive (interrupted, the app went to the background), the page is put in place anyway.
  const rescue = useRef(0);
  function scrollToSlot(i:number) {
    const el = scroller.current; if (!el) return;
    ours.current = true;
    el.scrollTo({left:i*step(), behavior:calm() ? 'auto' : 'smooth'});
    clearTimeout(rescue.current);
    rescue.current = window.setTimeout(() => {
      const {slots, page} = current.current;
      if (ours.current && slots[1]!==page) { ours.current = false; setSlots(around(page)); }
    }, 1000);
  }

  // Every change of the slots puts the scroller back on the middle page (it already shows the same page there),
  // unless a far day was just placed beside it: then it scrolls there.
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    el.scrollLeft = step();
    if (want.current!==null) { const i = want.current; want.current = null; scrollToSlot(i); }
  }, [slots]);

  // The parent changed the page.
  useLayoutEffect(() => {
    const el = scroller.current; if (!el || page===slots[1]) return;
    const i = slots.indexOf(page), resting = Math.round(el.scrollLeft/step());
    // Already in view, or another change arrives while our scroll still runs (keys pressed quickly): stand there at once.
    if ((i!==-1 && i===resting) || ours.current) { ours.current = false; want.current = null; setSlots(around(page)); return; }
    if (i!==-1) { scrollToSlot(i); return; }
    const d = side(slots[1], page) || 1;
    want.current = d>0 ? 2 : 0;
    setSlots(d>0 ? [slots[0], slots[1], page] : [page, slots[1], slots[2]]);
  }, [page]);

  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    let timer = 0;
    function settle() {
      clearTimeout(timer);
      const s = step(), i = Math.round(el!.scrollLeft/s);
      if (Math.abs(el!.scrollLeft - i*s) > 1.5) return;   // not on a page yet (a fling still running)
      const {slots, page} = current.current;
      if (i===1) { if (!ours.current) follow.current?.(null); ours.current = false; return; }
      if (ours.current || slots[i]===page) { ours.current = false; if (slots[i]===page) setSlots(around(page)); return; }
      // The finger turned the page: the parent shows the new day, then the slots recenter (the effect on `page`).
      follow.current?.(null, true);
      turn.current(i===2 ? 1 : -1);
    }
    const scroll = () => {
      if (!ours.current) follow.current?.((el.scrollLeft - step())/step());
      // Safari has no scrollend: a pause in scroll events ends it.
      clearTimeout(timer); timer = window.setTimeout(settle, 140);
    };
    el.addEventListener('scroll', scroll, {passive:true});
    el.addEventListener('scrollend', settle);
    return () => { clearTimeout(timer); clearTimeout(rescue.current); el.removeEventListener('scroll', scroll); el.removeEventListener('scrollend', settle); };
  }, []);

  return <div className="pager" ref={scroller}>
    {slots.map((p, i) => <div key={p} className="slide" aria-hidden={i!==1 || undefined} inert={i!==1 || undefined}>{render(p)}</div>)}
  </div>;
}
