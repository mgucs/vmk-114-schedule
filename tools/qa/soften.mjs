// Makes the soft (blurred, toned) versions of the МГУ photos in Edge: canvas blur + brightness, saved as WebP.
import {readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const dir = 'public/brand/';
const browser = await chromium.launch({channel:'msedge', headless:true});
const page = await browser.newPage();
for (const [name, tone] of [['msu-night', 'brightness(.92) saturate(.92)'], ['msu-day', 'brightness(1.04) saturate(.8)']]) {
  const data = (await readFile(dir + name + '.webp')).toString('base64');
  const out = await page.evaluate(async ({data, tone}) => {
    const img = new Image(); img.src = 'data:image/webp;base64,' + data; await img.decode();
    // Small: it is blurred anyway, and the browser upscales a blur smoothly. Same framing as the original
    // (the two layers must line up); the edges are extended by their own pixels so the blur does not darken them.
    const w = 640, h = Math.round(img.height * w / img.width), p = 48;
    const a = document.createElement('canvas'); a.width = w + 2*p; a.height = h + 2*p;
    const ax = a.getContext('2d');
    ax.drawImage(img, p, p, w, h);
    const sx = img.width / w, sy = img.height / h;
    ax.drawImage(img, 0, 0, img.width, 1, p, 0, w, p);                       // top
    ax.drawImage(img, 0, img.height - 1, img.width, 1, p, p + h, w, p);      // bottom
    ax.drawImage(a, p, 0, 1, h + 2*p, 0, 0, p, h + 2*p);                     // left
    ax.drawImage(a, p + w - 1, 0, 1, h + 2*p, p + w, 0, p, h + 2*p);         // right
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.filter = `blur(7px) ${tone}`;
    x.drawImage(a, -p, -p);
    return {size:[img.width, img.height], out:c.toDataURL('image/webp', .82)};
  }, {data, tone});
  await writeFile(dir + name + '-soft.webp', Buffer.from(out.out.split(',')[1], 'base64'));
  console.log(name, 'source', out.size.join('×'));
}
await browser.close();
