// «Жидкое стекло»: one number 0…100 drives how clear the Стекло style is. Left: dense matte glass
// (more blur, more fill, quiet highlights). Right: clear liquid glass (thin fill, light blur, bright rims and
// a glowing lower edge, stronger refraction where the browser can do it). 50 is the original look.
// index.html repeats liquidVars inline so the saved level applies before the first paint.
export const LIQUID_KEY = 'vmk114-liquid';
export const LIQUID_DEFAULT = 50;
export function liquidVars(value) {
  const l = Math.min(100, Math.max(0, Number(value))) / 100;
  const pct = n => `${Math.round(n)}%`;
  return {'--lg':String(l), '--g-fill-p':pct(71-58*l), '--g-thick-p':pct(92-34*l), '--g-past-p':pct(58-50*l), '--g-tabs-p':pct(84-44*l)};
}
export function loadLiquid() {
  try { const v = Number(localStorage.getItem(LIQUID_KEY)); return localStorage.getItem(LIQUID_KEY)!==null && Number.isFinite(v) ? v : LIQUID_DEFAULT; } catch { return LIQUID_DEFAULT; }
}
export function applyLiquid(value, save = false) {
  for (const [name, v] of Object.entries(liquidVars(value))) document.documentElement.style.setProperty(name, v);
  if (save) try { localStorage.setItem(LIQUID_KEY, String(Math.round(value))); } catch {}
  window.dispatchEvent(new CustomEvent('vmk-liquid-change'));
}
