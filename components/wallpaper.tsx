import {GlassOptics} from './glass-optics';

// Shared with isolated style previews; local assets also work offline and on Pages.
// The main building at night for dark themes, by day for light ones: CSS picks one, only that one loads.
const photo = (name:string) => `url('${import.meta.env.BASE_URL}brand/${name}')`;
export const WALLPAPER = `<div class="glass-campus" style="--photo-night:${photo('msu-night.webp')};--photo-day:${photo('msu-day.webp')}"></div><div class="glass-atmosphere"></div><div class="glass-horizon"></div>`;

export function Wallpaper() {
  return <>
    <div className="wallpaper" aria-hidden="true" dangerouslySetInnerHTML={{__html:WALLPAPER}}/>
    <GlassOptics/>
  </>;
}
