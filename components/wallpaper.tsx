import {memo} from 'react';
import {GlassOptics} from './glass-optics';

// Shared with isolated style previews; local assets also work offline and on Pages.
// The main building at night for dark themes, by day for light ones: CSS picks one, only that one loads.
const photo = (name:string) => `url('${import.meta.env.BASE_URL}brand/${name}')`;
// The photo is sharp everywhere, under the classes too: their cards carry a dense backing of their own. The soft
// (blurred) copy that used to lie under the classes read as a haze over the building and is gone.
export const WALLPAPER = `<div class="glass-campus" style="--photo-night:${photo('msu-night.webp')};--photo-day:${photo('msu-day.webp')}"></div><div class="glass-dim"></div><div class="glass-atmosphere"></div><div class="glass-horizon"></div>`;

// One object for good: React 19 compares dangerouslySetInnerHTML by the object, and a new {__html} on every render of
// the page rebuilt the photo's layers (and repainted the whole photo) on each turn of the day and each clock tick.
const html = {__html:WALLPAPER};
export const Wallpaper = memo(function Wallpaper() {
  return <>
    <div className="wallpaper" aria-hidden="true" dangerouslySetInnerHTML={html}/>
    <GlassOptics/>
  </>;
});
