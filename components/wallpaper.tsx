import {GlassOptics} from './glass-optics';

// Shared with isolated style previews; local assets also work offline and on Pages.
// The main building at night for dark themes, by day for light ones: CSS picks one, only that one loads.
const photo = (name:string) => `url('${import.meta.env.BASE_URL}brand/${name}')`;
// Under the schedule the photo turns into its soft copy (blurred and toned ahead of time, a few KB — no live blur):
// sharp МГУ behind the header and the week, a calm field behind the classes.
export const WALLPAPER = `<div class="glass-campus" style="--photo-night:${photo('msu-night.webp')};--photo-day:${photo('msu-day.webp')}"></div><div class="glass-soft" style="--photo-night:${photo('msu-night-soft.webp')};--photo-day:${photo('msu-day-soft.webp')}"></div><div class="glass-atmosphere"></div><div class="glass-horizon"></div>`;

export function Wallpaper() {
  return <>
    <div className="wallpaper" aria-hidden="true" dangerouslySetInnerHTML={{__html:WALLPAPER}}/>
    <GlassOptics/>
  </>;
}
