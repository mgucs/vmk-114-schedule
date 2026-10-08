import {useLayoutEffect, useRef} from 'react';

// The «drop» that marks the chosen day in the day strip (Стекло).
// It is moved with the Web Animations API, started in the very input handler (tap, arrow, end of a swipe) —
// before React draws the new day — and run by the compositor, so the page redraw cannot hold it back.
// Movement and squash are two separate animations on the `translate` and `scale` properties: one smooth spring
// carries the drop, and the stretch swells and settles on its own. (They used to be one transform with a middle
// keyframe: the drop covered half the way in the first 40% of the time, then braked hard — it looked like a stall.)
// During a swipe the finger holds it; on release it continues from exactly where it is.
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// A soft, well-damped spring (ω 6.5, ζ 0.82): it picks up gently, is ¾ of the way at a third of the time and
// settles with a 1% overshoot. The earlier, stiffer curve covered 80% of the way in the first 180 ms — it read as a jump.
// A plain ease-in-out-ish curve where linear() is missing.
const spring = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')
  ? 'linear(0, 0.032, 0.109, 0.211, 0.323, 0.434, 0.539, 0.634, 0.716, 0.785, 0.842, 0.888, 0.924, 0.952, 0.972, 0.987, 0.997, 1.004, 1.008, 1.01, 1.011, 1.011, 1.01, 1.009, 1)'
  : 'cubic-bezier(.35,.1,.25,1)';

export function useDayLens(index:number, week:string) {
  const lens = useRef<HTMLElement|null>(null);
  const at = useRef<number|null>(null);        // the day the drop rests on or is heading to
  const shownWeek = useRef(week);

  const buttons = () => lens.current?.parentElement?.querySelectorAll<HTMLElement>('.day-button');
  const xOf = (i:number) => { const b = buttons(); return b && b[i] && b[0] ? b[i].offsetLeft - b[0].offsetLeft : 0; };
  // Where the drop is drawn right now, mid-animation or under the finger included.
  const nowX = (el:HTMLElement) => parseFloat(getComputedStyle(el).translate) || 0;
  const nowScale = (el:HTMLElement) => { const s = getComputedStyle(el).scale; return s && s !== 'none' ? s : '1 1'; };
  function place(el:HTMLElement, x:number, scale = '1 1') {
    el.getAnimations().forEach(a => a.cancel());
    el.style.translate = `${x}px 0`; el.style.scale = scale;
  }

  // Glide to day i from where the drop is now.
  function glide(i:number) {
    const el = lens.current; if (!el || i < 0 || i > 6) return;
    const fromX = nowX(el), fromScale = nowScale(el), to = xOf(i), distance = Math.abs(to - fromX);
    place(el, to);
    at.current = i;
    if (calm() || distance < 1) return;
    const width = el.offsetWidth || 40, steps = distance / width;
    el.animate({translate:[`${fromX}px 0`, `${to}px 0`]}, {duration:Math.min(640, 500 + steps * 25), easing:spring});
    // A gel, not a wobble: it stretches along the way, more for a longer trip, and is round again on arrival.
    const s = Math.min(1.16, 1.05 + steps * .03);
    el.animate({scale:[fromScale, `${s} ${2 - s}`, '1 1'], offset:[0, .3, 1]}, {duration:Math.min(560, 420 + steps * 25), easing:'ease-in-out'});
  }

  // Swipe of the days: −1…1 of a page; the drop follows the finger towards the next or previous day.
  function follow(fraction:number) {
    const el = lens.current; if (!el) return;
    const f = Math.max(-1, Math.min(1, fraction)), base = at.current ?? index;
    const step = xOf(1) - xOf(0) || el.offsetWidth, s = 1 + Math.abs(f) * .1;
    place(el, xOf(base) - f * step, `${s} ${2 - s}`);
  }

  // React's own changes (a new week strip, «К ближайшим», a day picked elsewhere): place or glide the drop there.
  useLayoutEffect(() => {
    const el = lens.current; if (!el) return;
    if (shownWeek.current !== week || at.current === null) {
      shownWeek.current = week; at.current = index;
      place(el, xOf(index));
    } else if (at.current !== index) glide(index);
  }, [index, week]);

  // The strip changes width with the window: keep the drop on its day.
  useLayoutEffect(() => {
    const strip = lens.current?.parentElement; if (!strip) return;
    const observer = new ResizeObserver(() => { const el = lens.current; if (el && at.current !== null && !el.getAnimations().length) place(el, xOf(at.current)); });
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
