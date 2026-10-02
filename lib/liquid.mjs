// «Прозрачность» of the Стекло style: one number 0…100. Following Apple's Liquid Glass rules, glass is only the
// navigation layer (header, day strip, switches, tab bar); lesson cards are content on a dimming layer.
// Left: denser glass and fuller card backing. Right: clearer glass, thinner backing and the haze lifted off the МГУ
// photo (--lg2), but the backing never drops below what keeps text readable. 50 is the default.
// index.html repeats liquidVars inline so the saved level applies before the first paint.
export const LIQUID_KEY = 'vmk114-liquid';
export const LIQUID_DEFAULT = 50;
export function liquidVars(value) {
  const l = Math.min(100, Math.max(0, Number(value))) / 100, h = Math.max(0, l - .5);
  const pct = n => `${Math.round(n)}%`, px = n => `${Math.round(n * 10) / 10}px`;
  return {'--lg':String(l), '--lg2':String(h * 2),
    // Content layer (cards): dark and light themes, current and past classes.
    '--c-fill-d':pct(82 - 36 * l), '--c-fill-l':pct(90 - 26 * l), '--c-past-d':pct(68 - 36 * l), '--c-past-l':pct(80 - 26 * l), '--c-blur-px':px(24 - 14 * l),
    // Navigation layer (glass), windows and the tab bar.
    '--g-fill-p':pct(62 - 44 * l), '--g-blur-px':px(16 - 12 * l), '--g-thick-p':pct(90 - 24 * l), '--g-blur-thick-px':px(28 - 12 * l), '--g-tabs-p':pct(70 - 44 * l)};
}
export function loadLiquid() {
  try { const raw = localStorage.getItem(LIQUID_KEY), v = Number(raw); return raw !== null && Number.isFinite(v) ? v : LIQUID_DEFAULT; } catch { return LIQUID_DEFAULT; }
}
export function applyLiquid(value, save = false) {
  for (const [name, v] of Object.entries(liquidVars(value))) document.documentElement.style.setProperty(name, v);
  if (save) try { localStorage.setItem(LIQUID_KEY, String(Math.round(value))); } catch {}
  window.dispatchEvent(new CustomEvent('vmk-liquid-change'));
}
