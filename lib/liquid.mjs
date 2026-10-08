// «Фон» of the Стекло style: one number 0…100 — how much the МГУ photo is toned down under the schedule.
// It used to be «Прозрачность» and thinned the cards too: the clear end made the page flicker with the photo, and
// moving it changed a dozen variables on <html>, which restyled the whole page on every step (the thumb stuck).
// Now the cards always keep their dense backing, and the slider sets a single variable, --shade, on the wallpaper
// (glass.css: .glass-atmosphere, .glass-dim) — only the photo's own layers are restyled while it moves.
// index.html repeats liquidVars inline so the saved level applies before the first paint.
export const LIQUID_KEY = 'vmk114-shade';
export const LIQUID_DEFAULT = 30;
export function liquidVars(value) {
  const v = Math.min(100, Math.max(0, Number(value)));
  return {'--shade':String(Math.round(v) / 100)};
}
export function loadLiquid() {
  try { const raw = localStorage.getItem(LIQUID_KEY), v = Number(raw); return raw !== null && Number.isFinite(v) ? v : LIQUID_DEFAULT; } catch { return LIQUID_DEFAULT; }
}
// While the thumb moves: only the wallpapers (the page's and the style previews'). Saved: also <html>, for next time.
export function applyLiquid(value, save = false) {
  const vars = Object.entries(liquidVars(value));
  document.querySelectorAll('.wallpaper').forEach(el => { for (const [name, v] of vars) el.style.setProperty(name, v); });
  if (!save) return;
  for (const [name, v] of vars) document.documentElement.style.setProperty(name, v);
  try { localStorage.setItem(LIQUID_KEY, String(Math.round(value))); } catch {}
}
