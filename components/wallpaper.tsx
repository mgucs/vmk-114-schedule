import {GlassOptics} from './glass-optics';

// Shared with isolated style previews; local assets also work offline and on Pages.
export const WALLPAPER = `<div class="glass-campus" style="background-image:url('${import.meta.env.BASE_URL}brand/msu-main-building.jpg')"></div><div class="glass-atmosphere"></div><div class="glass-horizon"></div>`;

export function Wallpaper() {
  return <>
    <div className="wallpaper" aria-hidden="true" dangerouslySetInnerHTML={{__html:WALLPAPER}}/>
    <GlassOptics/>
  </>;
}
