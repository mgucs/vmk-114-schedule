import {useEffect, useRef} from 'react';

const NS = 'http://www.w3.org/2000/svg';
// Refraction is for the glass chrome that stays in place. Lesson cards move with every swipe:
// displacing their backdrop each frame is what made swipes stutter, so they keep plain frosted glass.
const surfaces = '.shell > .drag-tabs, .date-navigation, .header-actions, .heading .view-switch, .tab-lens';
// «Жидкое стекло» (the slider) as 0…1: how clear the glass is and how strongly it bends what is behind.
export const liquidLevel = () => {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lg'));
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : .5;
};

// Displacement maps are drawn once per size at half resolution, never on scroll. Only the backdrop is displaced.
// "edge": a neutral centre and a curved bend at the rounded rim, like the thick edge of a glass slab.
// "drop": a water drop — the whole lens magnifies, most strongly towards its rim.
const maps = new Map<string,string>();
function displacementMap(kind:'edge'|'drop', width:number, height:number, radius:number, band:number) {
  const key = `${kind}:${width}:${height}:${radius}:${band}`;
  if (!maps.has(key)) { const map = draw(kind, width, height, radius, band); if (!map) return null; maps.set(key, map); }
  return maps.get(key)!;
}
function draw(kind:'edge'|'drop', width:number, height:number, radius:number, band:number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width / 2));
  canvas.height = Math.max(1, Math.ceil(height / 2));
  const context = canvas.getContext('2d');
  if (!context) return null;
  const pixels = context.createImageData(canvas.width, canvas.height);
  const r = Math.min(radius, width / 2, height / 2);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const px = (x + .5) * width / canvas.width - width / 2;
    const py = (y + .5) * height / canvas.height - height / 2;
    const qx = Math.abs(px) - (width / 2 - r), qy = Math.abs(py) - (height / 2 - r);
    const ax = Math.max(qx, 0), ay = Math.max(qy, 0), len = Math.hypot(ax, ay);
    const distance = len + Math.min(Math.max(qx, qy), 0) - r;
    const edge = Math.max(0, 1 - Math.abs(distance) / band);
    const i = (y * canvas.width + x) * 4;
    if (kind === 'drop') {
      // Sample closer to the centre (magnify), more so near the rim where a drop is steepest.
      const m = .55 + .45 * Math.sin(edge * Math.PI / 2);
      pixels.data[i] = 128 - 127 * m * px / (width / 2);
      pixels.data[i + 1] = 128 - 127 * m * py / (height / 2);
    } else {
      const nx = len ? ax / len : qx > qy ? 1 : 0;
      const ny = len ? ay / len : qy >= qx ? 1 : 0;
      const bend = Math.sin(edge * Math.PI / 2) * .85;
      pixels.data[i] = 128 + Math.sign(px) * nx * bend * 127;
      pixels.data[i + 1] = 128 + Math.sign(py) * ny * bend * 127;
    }
    pixels.data[i + 2] = 128;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}

export function GlassOptics() {
  const defs = useRef<SVGDefsElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-transparency: reduce)');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    // SVG backdrop filters are a Chromium enhancement. Safari/Firefox retain
    // the CSS blur + highlights instead of accepting an unsupported URL.
    const supported = /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent)
      && CSS.supports('backdrop-filter', 'url("#glass-test")');
    const filters = new Map<HTMLElement, SVGFilterElement>();
    const sizes = new Map<HTMLElement, string>();
    let nextId = 0, frame = 0;
    let watching = false;
    const active = () => supported && root.dataset.style === 'glass' && !reduced.matches && !motion.matches;
    function remove(el:HTMLElement) {
      observer.unobserve(el);
      filters.get(el)?.remove(); filters.delete(el); sizes.delete(el);
      el.style.removeProperty('--g-optics'); el.removeAttribute('data-glass-optics');
    }
    function render(el:HTMLElement) {
      if (!active()) return;
      const width = el.offsetWidth, height = el.offsetHeight;
      if (!width || !height) return;
      const level = liquidLevel();
      const kind = el.classList.contains('tab-lens') ? 'drop' : 'edge';
      const radius = parseFloat(getComputedStyle(el).borderRadius) || 24;
      // Clearer glass bends more and over a wider rim.
      const band = Math.round(10 + level * 16), scale = Math.round(kind === 'drop' ? 14 + level * 30 : 6 + level * 34);
      const key = `${kind}:${width}:${height}:${radius}:${band}:${scale}`;
      if (sizes.get(el) === key) return;
      const map = displacementMap(kind, width, height, radius, band);
      if (!map) return;
      let filter = filters.get(el);
      if (!filter) {
        filter = document.createElementNS(NS, 'filter');
        filter.id = `vmk-glass-${++nextId}`;
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        defs.current?.append(filter); filters.set(el, filter);
      }
      for (const [name, value] of Object.entries({x:0, y:0, width, height})) filter.setAttribute(name, String(value));
      const image = document.createElementNS(NS, 'feImage');
      for (const [name, value] of Object.entries({href:map, x:0, y:0, width, height, result:'edge', preserveAspectRatio:'none'})) image.setAttribute(name, String(value));
      const displacement = document.createElementNS(NS, 'feDisplacementMap');
      for (const [name, value] of Object.entries({in:'SourceGraphic', in2:'edge', scale, xChannelSelector:'R', yChannelSelector:'G'})) displacement.setAttribute(name, String(value));
      filter.replaceChildren(image, displacement);
      sizes.set(el, key);
      el.style.setProperty('--g-optics', `url("#${filter.id}")`);
      el.setAttribute('data-glass-optics', '');
    }
    const observer = new ResizeObserver(entries => entries.forEach(({target}) => render(target as HTMLElement)));
    function sync() {
      frame = 0;
      if (!active()) {
        contentObserver.disconnect(); watching = false;
        for (const el of filters.keys()) remove(el);
        return;
      }
      if (!watching) {
        contentObserver.observe(document.getElementById('root') || document.body, {childList:true, subtree:true});
        watching = true;
      }
      for (const el of filters.keys()) if (!el.isConnected) remove(el);
      document.querySelectorAll<HTMLElement>(surfaces).forEach(el => {
        if (!filters.has(el)) { observer.observe(el); render(el); }
      });
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
    // The slider redraws every surface with the new strength.
    function relevel() { sizes.clear(); for (const el of filters.keys()) render(el); schedule(); }
    const styleObserver = new MutationObserver(schedule);
    styleObserver.observe(root, {attributes:true, attributeFilter:['data-style']});
    const contentObserver = new MutationObserver(schedule);
    reduced.addEventListener('change', schedule); motion.addEventListener('change', schedule);
    window.addEventListener('vmk-liquid-change', relevel);
    sync();
    return () => {
      cancelAnimationFrame(frame); styleObserver.disconnect(); contentObserver.disconnect();
      reduced.removeEventListener('change', schedule); motion.removeEventListener('change', schedule);
      window.removeEventListener('vmk-liquid-change', relevel);
      for (const el of filters.keys()) remove(el);
      observer.disconnect();
    };
  }, []);
  return <svg className="glass-optics" width="0" height="0" aria-hidden="true" focusable="false"><defs ref={defs}/></svg>;
}
