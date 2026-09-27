import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from './app/page';
import './app/fonts.css';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Home/></React.StrictMode>);

// Стекло: a glass card lights up where the finger presses it, or under the mouse.
// Only on press and on mouse moves: nothing runs while a finger scrolls.
const glassy = '.lesson, .term-facts div, .session-item';
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
