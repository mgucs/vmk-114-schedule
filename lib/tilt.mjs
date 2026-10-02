// Стекло: the highlight on the glass controls follows how the phone is tilted, as Liquid Glass highlights do.
// Two CSS variables on the root: --tilt (angle added to the rim gradient) and --hx (where the top highlight sits).
// Updated at most ~12 times a second and only on a noticeable change, so it costs nothing while scrolling.
// iOS asks for permission once, from a tap (the switch in «Оформление»); Android and others just work.
export const TILT_KEY = 'vmk114-tilt';
let attached = false, last = {g:0, b:0}, pending = 0;
export const tiltNeedsPermission = () => typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
export function tiltWanted() { try { return localStorage.getItem(TILT_KEY) !== 'off'; } catch { return true; } }
function onTilt(e) {
  if (e.gamma == null || e.beta == null) return;
  const g = Math.max(-35, Math.min(35, e.gamma)), b = Math.max(-35, Math.min(35, e.beta - 45));
  if (Math.abs(g - last.g) < 1.5 && Math.abs(b - last.b) < 1.5) return;
  last = {g, b};
  if (pending) return;
  pending = setTimeout(() => {
    pending = 0;
    const root = document.documentElement.style;
    root.setProperty('--tilt', `${Math.round(last.g * 1.2 - last.b * .4)}deg`);
    root.setProperty('--hx', `${Math.round(30 + last.g * 1.1)}%`);
  }, 80);
}
export function startTilt() {
  if (attached || typeof window === 'undefined' || !('DeviceOrientationEvent' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  attached = true;
  window.addEventListener('deviceorientation', onTilt, {passive:true});
}
export function stopTilt() {
  window.removeEventListener('deviceorientation', onTilt); attached = false;
  document.documentElement.style.removeProperty('--tilt'); document.documentElement.style.removeProperty('--hx');
}
// From a tap: asks iOS for motion access if needed, then starts. Resolves to whether highlights are on.
export async function enableTilt() {
  try {
    if (tiltNeedsPermission() && await DeviceOrientationEvent.requestPermission() !== 'granted') return false;
    localStorage.setItem(TILT_KEY, 'on');
  } catch { return false; }
  startTilt(); return true;
}
export function disableTilt() { try { localStorage.setItem(TILT_KEY, 'off'); } catch {} stopTilt(); }
