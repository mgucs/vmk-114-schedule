import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from './app/page';
import './app/fonts.css';
import './app/globals.css';
import './app/glass.css';
import {watchFrames} from './lib/glass-quality.mjs';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Home/></React.StrictMode>);

// Auto effects level: steps down if this device cannot keep up while scrolling or swiping.
watchFrames();
