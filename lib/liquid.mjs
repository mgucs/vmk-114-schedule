// Navigation can be clear; reading surfaces and floating dialogs retain a contrast floor.
// index.html repeats liquidVars inline so the saved level applies before the first paint.
export const LIQUID_KEY = 'vmk114-liquid';
export const LIQUID_DEFAULT = 50;
export function liquidVars(value) {
  const number = Number(value);
  const l = Math.min(100, Math.max(0, Number.isFinite(number) ? number : LIQUID_DEFAULT)) / 100;
  const pct = n => `${Math.round(n)}%`, px = n => `${Math.round(n*10)/10}px`;
  return {'--lg':String(l), '--lg2':String(Math.max(0, l-.5)*2),
    '--g-fill-p':pct(74-34*l), '--g-reading-p':pct(88-16*l), '--g-thick-p':pct(96-12*l), '--g-past-p':pct(88-16*l), '--g-tabs-p':pct(90-18*l),
    '--g-blur-px':px(22-10*l), '--g-blur-thick-px':px(32-10*l)};
}
export function loadLiquid() {
  try { const v = Number(localStorage.getItem(LIQUID_KEY)); return localStorage.getItem(LIQUID_KEY)!==null && Number.isFinite(v) ? v : LIQUID_DEFAULT; } catch { return LIQUID_DEFAULT; }
}
export function applyLiquid(value, save = false) {
  for (const [name, v] of Object.entries(liquidVars(value))) document.documentElement.style.setProperty(name, v);
  if (save) try { localStorage.setItem(LIQUID_KEY, String(Math.round(value))); } catch {}
  window.dispatchEvent(new CustomEvent('vmk-liquid-change'));
}
