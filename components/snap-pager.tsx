import {useLayoutEffect,useRef,type ReactNode,type RefObject} from 'react';

// A row of pages in the browser's own horizontal scroller with snap points: the days of the year, or its weeks.
// Every page has a fixed place for good — page i always starts at i × width — so the scroller is never rebuilt or
// moved back under the finger (the three-page pager did that after each swipe and, with a fling still running on a
// phone, could end up showing another day than the header). Only the pages near the current one have content; the
// rest are empty boxes of the same width. A swipe is a native scroll: the phone moves the pages on its compositor and
// no script runs until the scroller settles on a page, which is then reported once. While it moves, `onPeek` hears
// which page is more than half in view (once per change), so the day strip can follow the finger right away.
export type PagerHandle = {show:(i:number)=>void};
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function SnapPager({count, index, render, onSettle, onPeek, handle, className, near = 1, label}:{count:number; index:number;
  render:(i:number)=>ReactNode; onSettle:(i:number)=>void; onPeek?:(i:number)=>void; handle?:RefObject<PagerHandle|null>;
  className:string; near?:number; label?:string}) {
  const scroller = useRef<HTMLDivElement>(null);
  const shown = useRef(index);          // the page the scroller rests on or is heading to
  const settle = useRef(onSettle); settle.current = onSettle;
  const peek = useRef(onPeek); peek.current = onPeek;
  const peeked = useRef(index);
  const width = () => scroller.current?.clientWidth || 1;

  // First drawing, and the parent moving to another page (a tap, an arrow, «Сегодня»): a neighbour glides in,
  // a far page is shown at once (gliding past empty boxes would only flash).
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    const at = Math.round(el.scrollLeft / width());
    if (mounted.current && at === index && Math.abs(el.scrollLeft - index * width()) < 2) { shown.current = index; return; }
    const glide = mounted.current && Math.abs(at - index) === 1 && !calm();
    mounted.current = true; shown.current = index; peeked.current = index;
    el.scrollTo({left:index * width(), behavior:glide ? 'smooth' : 'auto'});
  }, [index]);
  // For another pager to move this one at once (the strip following the days), before React draws.
  if (handle) handle.current = {show:i => {
    const el = scroller.current; if (!el || i === shown.current) return;
    const glide = Math.abs(i - shown.current) === 1 && !calm();
    shown.current = i; peeked.current = i;
    el.scrollTo({left:i * width(), behavior:glide ? 'smooth' : 'auto'});
  }};

  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    let timer = 0;
    function done() {
      clearTimeout(timer);
      const w = width(), i = Math.round(el!.scrollLeft / w);
      if (Math.abs(el!.scrollLeft - i * w) > 1.5) return;     // still between pages (a fling running)
      if (peeked.current !== i) { peeked.current = i; peek.current?.(i); }
      if (i !== shown.current) { shown.current = i; settle.current(i); }
      else peek.current?.(i);                                  // back where it was: undo what a peek showed
    }
    // Safari has no scrollend: a pause in scroll events ends a scroll. A scroll that lands exactly on a page
    // (the snap's last step) ends at once.
    const scroll = () => {
      clearTimeout(timer);
      const w = width(), x = el.scrollLeft, i = Math.round(x / w);
      if (i !== peeked.current) { peeked.current = i; peek.current?.(i); }
      if (Math.abs(x - i * w) < .5 && i !== shown.current) { done(); return; }
      timer = window.setTimeout(done, 120);
    };
    el.addEventListener('scroll', scroll, {passive:true});
    el.addEventListener('scrollend', done);
    // A new width (rotation, a wider window): stay on the same page.
    const resize = new ResizeObserver(() => { el.scrollLeft = shown.current * width(); });
    resize.observe(el);
    return () => { clearTimeout(timer); el.removeEventListener('scroll', scroll); el.removeEventListener('scrollend', done); resize.disconnect(); };
  }, []);

  return <div className={className} ref={scroller} aria-label={label}>
    {Array.from({length:count}, (_, i) => <div key={i} className={`slide${i === index ? ' current' : ''}`} aria-hidden={i !== index || undefined} inert={i !== index || undefined}>
      {Math.abs(i - index) <= near ? render(i) : null}
    </div>)}
  </div>;
}
