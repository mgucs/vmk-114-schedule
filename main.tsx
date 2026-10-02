import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from './app/page';
import './app/fonts.css';
import './app/globals.css';
import './app/glass.css';
import {TILT_KEY, startTilt, tiltNeedsPermission, tiltWanted} from './lib/tilt.mjs';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Home/></React.StrictMode>);

// Стекло: glass lights up from within where the finger presses it, or under the mouse.
// Only on press and on mouse moves: nothing runs while a finger scrolls.
const glassy = '.lesson, .term-facts div, .session-item, .header-actions, .date-navigation, .shell > .drag-tabs';
function light(event:PointerEvent) {
  if (document.documentElement.dataset.style !== 'glass') return;
  if (event.type === 'pointermove' && event.pointerType !== 'mouse') return;
  const el = (event.target as Element | null)?.closest?.(glassy) as HTMLElement | null;
  if (!el) return;
  const box = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${Math.round((event.clientX - box.left) / box.width * 100)}%`);
  el.style.setProperty('--my', `${Math.round((event.clientY - box.top) / box.height * 100)}%`);
}
addEventListener('pointerdown', light, {passive: true});
addEventListener('pointermove', light, {passive: true});

// Highlights follow the phone's tilt; on iOS only after the switch in «Оформление» was turned on once.
try { if (tiltWanted() && (!tiltNeedsPermission() || localStorage.getItem(TILT_KEY) === 'on')) startTilt(); } catch {}
