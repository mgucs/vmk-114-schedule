// App icons from the МГУ photos and marks, drawn in Edge's canvas. Usage: node icons.mjs preview|write
import {readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const D = process.env.PHOTOS || 'C:/Users/a/Downloads/', B = 'public/brand/', OUT = 'public/icons/';
// crop: centre x and top y as fractions of the image, side as a fraction of the image height
const sources = {
  night:{file:D + 'Изображение ChatGPT 27 сент. 2026 г., 13_43_16.png', cx:.497, top:.06, side:.86, tone:'contrast(1.08) saturate(1.1)'},
  day:{file:D + 'Изображение ChatGPT 27 сент. 2026 г., 13_43_10.png', cx:.507, top:.0, side:.9, tone:'saturate(1.05)'},
  sunset:{file:D + '90922-moskovskij_gosudarstvennyj_universi-dostoprimechatelnost-spiral-neboskreb-stolica-3840x2160.jpg', cx:.493, top:.0, side:.92, tone:'saturate(1.08)'},
  emblem:{file:B + 'msu-emblem.png', mark:true, bg:'#0b1430', fg:'#e0bd6a', pad:.17},
  vmk:{file:B + 'vmk-mark.png', mark:true, bg:'#14306e', fg:'#ffffff', pad:.2},
};
const browser = await chromium.launch({channel:'msedge', headless:true});
const page = await browser.newPage();
const out = {};
for (const [key, s] of Object.entries(sources)) {
  const data = (await readFile(s.file)).toString('base64'), type = s.file.endsWith('.png') ? 'png' : 'jpeg';
  out[key] = await page.evaluate(async ({data, type, s}) => {
    const img = new Image(); img.src = `data:image/${type};base64,${data}`; await img.decode();
    const make = size => {
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      if (s.mark) {
        x.fillStyle = s.bg; x.fillRect(0, 0, size, size);
        const inner = size * (1 - 2*s.pad), m = document.createElement('canvas'); m.width = m.height = inner;
        const mx = m.getContext('2d'); mx.drawImage(img, 0, 0, inner, inner); mx.globalCompositeOperation = 'source-in'; mx.fillStyle = s.fg; mx.fillRect(0, 0, inner, inner);
        x.drawImage(m, size*s.pad, size*s.pad);
      } else {
        const side = img.height * s.side, sx = img.width * s.cx - side/2, sy = img.height * s.top;
        x.filter = s.tone; x.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      }
      return c.toDataURL('image/png');
    };
    return {512:make(512), 192:make(192), 180:make(180)};
  }, {data, type, s});
}
if (process.argv[2] === 'write') {
  for (const [key, set] of Object.entries(out)) for (const [size, url] of Object.entries(set))
    await writeFile(OUT + (size === '180' ? `apple-touch-icon-${key}.png` : `icon-${key}-${size}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('written');
} else {
  await page.setContent(`<body style="margin:0;padding:20px;background:#333;display:flex;gap:24px">${Object.entries(out).map(([k, v]) => `<figure style="margin:0;color:#fff;font:600 16px sans-serif;text-align:center"><img src="${v[512]}" style="width:180px;border-radius:40px;display:block"><br><img src="${v[192]}" style="width:60px;border-radius:14px">${k}</figure>`).join('')}</body>`);
  await page.setViewportSize({width:1100, height:340}); await page.screenshot({path:'icons-preview.png'}); console.log('preview');
}
await browser.close();
