// Matte to luminous glass, with a continuous reading surface even at the clearest end.
// index.html repeats liquidVars inline so the saved level applies before the first paint.
export const LIQUID_KEY = 'vmk114-liquid';
export const LIQUID_DEFAULT = 50;
export function liquidVars(value) {
  const number = Number(value);
  const l = Math.min(100, Math.max(0, Number.isFinite(number) ? number : LIQUID_DEFAULT)) / 100;
  const lo = Math.min(l,.5), hi = Math.max(0,l-.5);
  const pct = n => `${Math.round(n)}%`, px = n => `${Math.round(n*10)/10}px`;
  return {'--lg':String(l), '--lg2':String(Math.max(0, l-.5)*2),
    '--g-fill-p':pct(78-72*lo-12*hi), '--g-reading-p':pct(80-76*lo-34*hi), '--g-thick-p':pct(96-44*lo-24*hi), '--g-past-p':pct(80-76*lo-34*hi), '--g-tabs-p':pct(74-104*lo-32*hi),
    '--g-blur-px':px(24-28*lo-6*hi), '--g-blur-thick-px':px(32-28*lo-16*hi)};
}
export function loadLiquid() {
  try { const v = Number(localStorage.getItem(LIQUID_KEY)); return localStorage.getItem(LIQUID_KEY)!==null && Number.isFinite(v) ? v : LIQUID_DEFAULT; } catch { return LIQUID_DEFAULT; }
}
export function applyLiquid(value, save = false) {
  for (const [name, v] of Object.entries(liquidVars(value))) document.documentElement.style.setProperty(name, v);
  if (save) try { localStorage.setItem(LIQUID_KEY, String(Math.round(value))); } catch {}
  window.dispatchEvent(new CustomEvent('vmk-liquid-change'));
}
