import {useLayoutEffect, useRef} from 'react';

// The «drop» that marks the chosen day in the day strip (Стекло).
// It is moved with the Web Animations API, started in the very input handler (tap, arrow, end of a swipe) —
// before React draws the new day — and run by the compositor, so the page redraw cannot hold it back.
// Movement and squash are two separate animations on the `translate` and `scale` properties: one smooth spring
// carries the drop, and the stretch swells and settles on its own. (They used to be one transform with a middle
// keyframe: the drop covered half the way in the first 40% of the time, then braked hard — it looked like a stall.)
// During a swipe the finger holds it; on release it continues from exactly where it is.
// Nothing here reads the layout or computed style on the way (offsetLeft, getComputedStyle, getAnimations): during a
// swipe that forced the browser to lay out the page on every move of the finger. The days' positions are measured
// once per week strip and size, and the drop's position mid-animation is worked out from the animation's own time.
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// A soft, well-damped spring (ω 6.5, ζ 0.82): it picks up gently, is ¾ of the way at a third of the time and
// settles with a 1% overshoot. The earlier, stiffer curve covered 80% of the way in the first 180 ms — it read as a jump.
const SPRING = [0, 0.032, 0.109, 0.211, 0.323, 0.434, 0.539, 0.634, 0.716, 0.785, 0.842, 0.888, 0.924, 0.952, 0.972, 0.987, 0.997, 1.004, 1.008, 1.01, 1.011, 1.011, 1.01, 1.009, 1];
const linearOk = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)');
// A plain curve where linear() is missing; position math then follows the same spring closely enough.
const spring = linearOk ? `linear(${SPRING.join(', ')})` : 'cubic-bezier(.35,.1,.25,1)';
const springAt = (t:number) => { const i = Math.min(SPRING.length-2, Math.floor(t*(SPRING.length-1))), f = t*(SPRING.length-1)-i; return SPRING[i] + (SPRING[i+1]-SPRING[i])*f; };

type Glide = {move:Animation; squash:Animation; from:number; to:number; ms:number; stretch:number; squashMs:number};

export function useDayLens(index:number, week:string) {
  const lens = useRef<HTMLElement|null>(null);
  const at = useRef<number|null>(null);        // the day the drop rests on or is heading to
  const shownWeek = useRef(week);
  const xs = useRef<number[]|null>(null);      // each day's offset in the strip
  const rest = useRef({x:0, s:1});             // where the drop stands when no glide runs
  const glideRef = useRef<Glide|null>(null);

  const xOf = (i:number) => {
    if (!xs.current) { const b = lens.current?.parentElement?.querySelectorAll<HTMLElement>('.day-button'); xs.current = b && b[0] ? [...b].map(x => x.offsetLeft - b[0].offsetLeft) : []; }
    return xs.current[i] ?? 0;
  };
  // Where the drop is drawn right now, mid-glide included.
  function now() {
    const g = glideRef.current; if (!g) return rest.current;
    const t = Math.min(1, Math.max(0, (Number(g.move.currentTime) || 0)/g.ms)), q = Math.min(1, (Number(g.squash.currentTime) || 0)/g.squashMs);
    const s = q < .3 ? 1 + (g.stretch-1)*q/.3 : g.stretch + (1-g.stretch)*(q-.3)/.7;
    return {x:g.from + (g.to-g.from)*springAt(t), s};
  }
  function place(el:HTMLElement, x:number, s = 1) {
    const g = glideRef.current; glideRef.current = null;
    g?.move.cancel(); g?.squash.cancel();
    el.style.translate = `${x}px 0`; el.style.scale = `${s} ${2 - s}`;
    rest.current = {x, s};
  }

  // Glide to day i from where the drop is now.
  function glide(i:number) {
    const el = lens.current; if (!el || i < 0 || i > 6) return;
    const {x:fromX, s:fromS} = now(), to = xOf(i), distance = Math.abs(to - fromX);
    place(el, to);
    at.current = i;
    if (calm() || distance < 1) return;
    const step = (xOf(1) - xOf(0)) || 40, steps = distance / step;
    const ms = Math.min(640, 500 + steps * 25), squashMs = Math.min(560, 420 + steps * 25);
    // A gel, not a wobble: it stretches along the way, more for a longer trip, and is round again on arrival.
    const stretch = Math.min(1.16, 1.05 + steps * .03);
    const move = el.animate({translate:[`${fromX}px 0`, `${to}px 0`]}, {duration:ms, easing:spring});
    const squash = el.animate({scale:[`${fromS} ${2 - fromS}`, `${stretch} ${2 - stretch}`, '1 1'], offset:[0, .3, 1]}, {duration:squashMs, easing:'linear'});
    const g:Glide = {move, squash, from:fromX, to, ms, stretch, squashMs};
    glideRef.current = g;
    move.onfinish = () => { if (glideRef.current === g) { glideRef.current = null; squash.cancel(); } };
  }

  // Swipe of the days: −1…1 of a page; the drop follows the finger towards the next or previous day.
  function follow(fraction:number) {
    const el = lens.current; if (!el) return;
    const f = Math.max(-1, Math.min(1, fraction)), base = at.current ?? index;
    const step = xOf(1) - xOf(0) || 40;
    place(el, xOf(base) - f * step, 1 + Math.abs(f) * .1);
  }

  // React's own changes (a new week strip, «К ближайшим», a day picked elsewhere): place or glide the drop there.
  useLayoutEffect(() => {
    const el = lens.current; if (!el) return;
    // The strip's buttons stay from week to week (page.tsx): a new week only glides the drop to its weekday.
    shownWeek.current = week;
    if (at.current === null) { at.current = index; place(el, xOf(index)); }
    else if (at.current !== index) glide(index);
  }, [index, week]);

  // The strip changes width with the window: measure the days again and keep the drop on its day.
  useLayoutEffect(() => {
    const strip = lens.current?.parentElement; if (!strip) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) { first = false; return; }
      xs.current = null; const el = lens.current;
      if (el && at.current !== null && !glideRef.current) place(el, xOf(at.current));
    });
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
