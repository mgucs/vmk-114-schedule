// How much of the Стекло effects a device can afford: data-glass on <html> = lite | balanced | full (see glass.css).
// The choice is «auto» unless set in «Оформление». Auto starts from what the device looks like (a computer gets full,
// a phone balanced, a weak or «reduce transparency» device lite) and then listens: while the user scrolls or swipes,
// it measures frames, and if the device keeps missing them (under ~30 fps) it steps down one level and remembers it.
// index.html repeats initialTier inline so the level is set before the first paint; a test keeps both equal.
export const QUALITY_KEY = 'vmk114-glass-quality'; // auto | lite | balanced | full
export const AUTO_KEY = 'vmk114-glass-auto';        // the level auto settled on after measuring
export const TIERS = ['lite', 'balanced', 'full'];
const rank = t => TIERS.indexOf(t);

export function deviceTier(env) {
  const {cores = 8, memory = 8, coarse = true, reduced = false} = env;
  if (reduced || memory <= 3 || cores <= 4) return 'lite';
  return coarse ? 'balanced' : 'full';
}
// The level to use now: a manual choice wins; auto takes the lower of the device guess and what measuring found.
export function initialTier(choice, measured, env) {
  if (TIERS.includes(choice)) return choice;
  const guess = deviceTier(env);
  return TIERS.includes(measured) && rank(measured) < rank(guess) ? measured : guess;
}
export function environment() {
  return {cores:navigator.hardwareConcurrency || 8, memory:navigator.deviceMemory || 8,
    coarse:matchMedia('(pointer: coarse)').matches, reduced:matchMedia('(prefers-reduced-transparency: reduce)').matches};
}
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch {} };
// The level is always automatic now: the three levels looked alike once cards stopped being blurred, and the switch
// left the settings. An old manual choice is forgotten.
try { localStorage.removeItem(QUALITY_KEY); } catch {}
export const loadChoice = () => 'auto';
export function applyTier(tier) {
  document.documentElement.dataset.glass = tier;
  window.dispatchEvent(new CustomEvent('vmk-glass-quality', {detail:tier}));
}

// Frame watchdog for auto: samples requestAnimationFrame only while the page moves (scroll, touch), in windows of
// ~2 seconds. A window with enough frames where at least a fifth took longer than 34 ms counts as struggling;
// two such windows step the level down. Nothing runs while the page is still.
export function watchFrames() {
  let sampling = false, frames = [], last = 0, idle = 0, bad = 0;
  const struggling = () => frames.length >= 40 && frames.filter(t => t > 34).length / frames.length >= .2;
  function stop() {
    sampling = false;
    if (struggling() && ++bad >= 2) {
      bad = 0;
      const now = document.documentElement.dataset.glass, next = TIERS[Math.max(0, rank(now) - 1)];
      if (loadChoice() === 'auto' && document.documentElement.dataset.style === 'glass' && next !== now) { write(AUTO_KEY, next); applyTier(next); }
    }
    frames = [];
  }
  function frame(t) {
    if (!sampling) return;
    if (last) frames.push(t - last);
    last = t;
    if (performance.now() - idle > 400 || frames.length > 150) { stop(); return; }
    requestAnimationFrame(frame);
  }
  function moved() {
    idle = performance.now();
    if (sampling || loadChoice() !== 'auto' || document.documentElement.dataset.glass === 'lite' || document.documentElement.dataset.style !== 'glass' || document.hidden) return;
    sampling = true; last = 0; requestAnimationFrame(frame);
  }
  addEventListener('scroll', moved, {passive:true});
  addEventListener('touchmove', moved, {passive:true});
}
