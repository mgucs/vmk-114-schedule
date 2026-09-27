import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from './app/page';
import './app/fonts.css';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Home/></React.StrictMode>);

// Стекло: the highlight on a glass surface follows the finger or the mouse.
const glassy = '.lesson, .now-bar, .term-facts div, .session-item, .glance-line, .shell>.drag-tabs';
addEventListener('pointermove', event => {
  if (document.documentElement.dataset.style !== 'glass') return;
  const el = (event.target as Element | null)?.closest?.(glassy) as HTMLElement | null;
  if (!el) return;
  const box = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${Math.round((event.clientX - box.left) / box.width * 100)}%`);
  el.style.setProperty('--my', `${Math.round((event.clientY - box.top) / box.height * 100)}%`);
}, {passive: true});
