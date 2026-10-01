// «Жидкое стекло»: one number 0…100 drives how clear the Стекло style is. Left: dense matte glass
// (more blur, more fill, quiet highlights). Right: clear liquid glass (thin fill, light blur, bright rims and
// a glowing lower edge, stronger refraction where the browser can do it). 50 is the original look.
// index.html repeats liquidVars inline so the saved level applies before the first paint.
export const LIQUID_KEY = 'vmk114-liquid';
export const LIQUID_DEFAULT = 50;
// Up to the middle the glass thins gently; past it, it goes almost fully clear and the photo loses its haze (--lg2).
export function liquidVars(value) {
  const l = Math.min(100, Math.max(0, Number(value))) / 100, h = Math.max(0, l-.5), lo = Math.min(l, .5);
  const pct = n => `${Math.round(n)}%`, px = n => `${Math.round(n*10)/10}px`;
  return {'--lg':String(l), '--lg2':String(h*2),
    '--g-fill-p':pct(71-58*lo-76*h), '--g-thick-p':pct(92-34*lo-90*h), '--g-past-p':pct(58-50*lo-56*h), '--g-tabs-p':pct(84-44*lo-70*h),
    '--g-blur-px':px(20-14*lo-20*h), '--g-blur-thick-px':px(30-14*lo-24*h)};
}
export function loadLiquid() {
  try { const v = Number(localStorage.getItem(LIQUID_KEY)); return localStorage.getItem(LIQUID_KEY)!==null && Number.isFinite(v) ? v : LIQUID_DEFAULT; } catch { return LIQUID_DEFAULT; }
}
export function applyLiquid(value, save = false) {
  for (const [name, v] of Object.entries(liquidVars(value))) document.documentElement.style.setProperty(name, v);
  if (save) try { localStorage.setItem(LIQUID_KEY, String(Math.round(value))); } catch {}
  window.dispatchEvent(new CustomEvent('vmk-liquid-change'));
}
