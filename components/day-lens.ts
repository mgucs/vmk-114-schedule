import {useLayoutEffect, useRef} from 'react';

// The «drop» that marks the chosen day in the day strip (Стекло).
// It is moved with the Web Animations API, started in the very input handler (tap, arrow, end of a swipe) —
// before React draws the new day — and run by the compositor, so the page redraw cannot hold it back.
// The old way (a CSS transition on a variable set by React) only started after that redraw: it stood still,
// then jumped. During a swipe the finger holds it; on release it continues from exactly where it is.
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useDayLens(index:number, week:string) {
  const lens = useRef<HTMLElement|null>(null);
  const at = useRef<number|null>(null);        // the day the drop rests on or is heading to
  const shownWeek = useRef(week);

  const buttons = () => lens.current?.parentElement?.querySelectorAll<HTMLElement>('.day-button');
  const xOf = (i:number) => { const b = buttons(); return b && b[i] && b[0] ? b[i].offsetLeft - b[0].offsetLeft : 0; };
  const now = (el:HTMLElement) => getComputedStyle(el).transform;

  // Glide to day i from where the drop is now (mid-animation or under the finger included).
  function glide(i:number) {
    const el = lens.current; if (!el || i < 0 || i > 6) return;
    const from = now(el), fromX = new DOMMatrixReadOnly(from).m41, to = xOf(i);
    el.getAnimations().forEach(a => a.cancel());
    el.style.transform = `translateX(${to}px)`;
    at.current = i;
    if (calm() || Math.abs(to - fromX) < 1) return;
    // Stretched along the way, most in the first half, by how far it travels (a gel, not a wobble).
    const width = el.offsetWidth || 40, stretch = Math.min(1.18, 1 + Math.abs(to - fromX) / width * .07);
    el.animate([
      {transform:from === 'none' ? 'translateX(0px)' : from},
      {offset:.4, transform:`translateX(${fromX + (to - fromX) * .55}px) scale(${stretch}, ${2 - stretch})`},
      {transform:`translateX(${to}px) scale(1, 1)`},
    ], {duration:Math.min(520, 300 + Math.abs(to - fromX) * .6), easing:'cubic-bezier(.22,.9,.3,1)'});
  }

  // Swipe of the days: −1…1 of a page; the drop follows the finger towards the next or previous day.
  function follow(fraction:number) {
    const el = lens.current; if (!el) return;
    el.getAnimations().forEach(a => a.cancel());
    const f = Math.max(-1, Math.min(1, fraction)), base = at.current ?? index;
    const step = xOf(1) - xOf(0) || el.offsetWidth;
    const x = xOf(base) - f * step, s = 1 + Math.abs(f) * .12;
    el.style.transform = `translateX(${x}px) scale(${s}, ${2 - s})`;
  }

  // React's own changes (a new week strip, «К ближайшим», a day picked elsewhere): place or glide the drop there.
  useLayoutEffect(() => {
    const el = lens.current; if (!el) return;
    if (shownWeek.current !== week || at.current === null) {
      shownWeek.current = week; at.current = index;
      el.getAnimations().forEach(a => a.cancel());
      el.style.transform = `translateX(${xOf(index)}px)`;
    } else if (at.current !== index) glide(index);
  }, [index, week]);

  // The strip changes width with the window: keep the drop on its day.
  useLayoutEffect(() => {
    const strip = lens.current?.parentElement; if (!strip) return;
    const observer = new ResizeObserver(() => { const el = lens.current; if (el && at.current !== null && !el.getAnimations().length) el.style.transform = `translateX(${xOf(at.current)}px)`; });
    observer.observe(strip); return () => observer.disconnect();
  }, [week]);

  return {
    ref:(el:HTMLElement|null) => { lens.current = el; },
    // Called by the tap or arrow handler with the target day, before the state update.
    glide,
    follow,
    // End of a swipe that did not turn the page: back to the current day.
    settle:() => glide(at.current ?? index),
  };
}
