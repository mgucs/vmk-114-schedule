// Стекло: the wallpaper behind the glass. Three ribbons of light sweep up to the right in the theme's colours;
// each has a lit upper edge and a shaded lower one and casts a soft shadow on the ribbon behind it.
// Crisp vector shapes, drawn once: nothing here moves, so scrolling never repaints it.
const ribbons = [
  {top:'M -200 1300 C 600 1270, 1250 1060, 1800 300', bottom:'M 1800 860 C 1320 1240, 700 1420, -200 1470'},
  {top:'M -200 1450 C 650 1420, 1280 1290, 1800 800', bottom:'M 1800 1180 C 1360 1450, 760 1560, -200 1590'},
  {top:'M -200 1560 C 700 1550, 1320 1470, 1800 1170', bottom:'M 1800 1520 C 1400 1640, 800 1690, -200 1700'},
];
// Colours come from the theme through CSS variables, so the picture follows a theme change by itself.
const violet = 'color-mix(in oklch,var(--wp-c),var(--now))';
const colours = [
  ['var(--wp-c)', `color-mix(in oklch,var(--wp-c) 55%,${violet})`],
  [violet, `color-mix(in oklch,${violet} 45%,var(--now))`],
  ['var(--now)', 'var(--lecture)'],
];
const stop = (offset:number, colour:string) => `<stop offset="${offset}" style="stop-color:${colour}"/>`;

export const WALLPAPER = `<svg viewBox="0 0 1600 1600" preserveAspectRatio="xMaxYMax slice" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="wp-base" x1="0" y1="0" x2="0" y2="1">${stop(.2,'var(--background)')}${stop(1,'var(--wp-floor)')}</linearGradient>
<radialGradient id="wp-glow" cx=".92" cy=".3" r=".5"><stop offset="0" style="stop-color:var(--wp-c);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--wp-c);stop-opacity:0"/></radialGradient>
<linearGradient id="wp-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient>
<filter id="wp-shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28"/></filter>
<filter id="wp-light" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="13"/></filter>
${colours.map(([mid, end], i) => `<linearGradient id="wp-fill${i}" x1="0" y1="1" x2="1" y2=".1">${stop(0,`color-mix(in oklab,${mid} 30%,var(--wp-deep))`)}${stop(.6,mid)}${stop(1,end)}</linearGradient>`).join('')}
${ribbons.map((r, i) => `<clipPath id="wp-clip${i}"><path d="${r.top} L ${r.bottom.slice(2)} Z"/></clipPath>`).join('')}
</defs><rect width="1600" height="1600" fill="url(#wp-base)"/><rect width="1600" height="1600" fill="url(#wp-glow)"/>
${ribbons.map((r, i) => {
  const body = `${r.top} L ${r.bottom.slice(2)} Z`;
  return `<path d="${body}" transform="translate(0 50)" style="fill:var(--wp-ink);opacity:var(--wp-shadow)" filter="url(#wp-shadow)"/>
<path d="${body}" fill="url(#wp-fill${i})"/>
<g clip-path="url(#wp-clip${i})"><path d="${r.bottom}" fill="none" stroke-width="170" style="stroke:var(--wp-ink);stroke-opacity:var(--wp-shadow)" filter="url(#wp-shadow)"/>
<path d="${r.top}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="50" filter="url(#wp-light)"/></g>
<path d="${r.top}" fill="none" stroke="url(#wp-edge)" stroke-width="3"/>`;
}).join('')}</svg>`;

export function Wallpaper() {
  return <div className="wallpaper" aria-hidden="true" dangerouslySetInnerHTML={{__html:WALLPAPER}}/>;
}
