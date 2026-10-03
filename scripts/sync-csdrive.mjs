// First-course study materials from CSDrive — the students' archive of ВМК on Yandex Disk
// (https://disk.yandex.ru/d/uBxTJDaahuSjZA) — read through Yandex's public, read-only API into public/csdrive.json
// for the «Полезное» tab. The folders change rarely: at most once a week (pass --force to run anyway).
import {readFile, writeFile} from 'node:fs/promises';

export const CSD = 'https://disk.yandex.ru/d/uBxTJDaahuSjZA';
const FOLDERS = ['/1 курс', '/Полезная информация'];
const SKIP = /^(link to root\.txt|push it\.txt|desktop\.ini|thumbs\.db|\.ds_store)$/i;
const WEEK = 7 * 86400000;
const file = new URL('../public/csdrive.json', import.meta.url);

const api = (path, offset) => `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(CSD)}&path=${encodeURIComponent(path)}`
  + `&limit=200&offset=${offset}&fields=public_key,_embedded.items.name,_embedded.items.type,_embedded.items.path,_embedded.items.size,_embedded.total`;

async function list(path, fetcher) {
  const items = []; let publicKey = '';
  for (let offset = 0; ; offset += 200) {
    const response = await fetcher(api(path, offset), {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`CSDrive ${response.status}: ${path}`);
    const json = await response.json(); publicKey = json.public_key;
    items.push(...(json._embedded?.items || []));
    if (items.length >= (json._embedded?.total || 0)) break;
  }
  return {items, publicKey};
}

// Compact tree: {n:name, c:[children]} for folders, {n:name, s:size} for files; paths are rebuilt from names.
async function walk(path, fetcher) {
  const {items} = await list(path, fetcher);
  const out = [];
  for (const item of items.sort((a, b) => a.name.localeCompare(b.name, 'ru', {numeric:true}))) {
    if (SKIP.test(item.name)) continue;
    out.push(item.type === 'dir' ? {n:item.name, c:await walk(item.path, fetcher)} : {n:item.name, s:item.size || 0});
  }
  return out;
}

export async function syncCsdrive(fetcher = fetch, now = () => new Date().toISOString()) {
  const {publicKey} = await list('/', fetcher);
  const folders = {};
  for (const path of FOLDERS) folders[path] = await walk(path, fetcher);
  return {updatedAt:now(), url:CSD, publicKey, folders};
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}` || process.argv[1]?.endsWith('sync-csdrive.mjs')) {
  const previous = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);
  if (previous && Date.now() - Date.parse(previous.updatedAt) < WEEK && !process.argv.includes('--force')) {
    console.log('CSDrive свежий:', previous.updatedAt);
  } else {
    const data = await syncCsdrive();
    const files = t => t.reduce((n, x) => n + (x.c ? files(x.c) : 1), 0);
    if (files(data.folders['/1 курс']) < 50) throw Error('CSDrive: слишком мало файлов, оставлена прошлая версия.');
    await writeFile(file, JSON.stringify(data) + '\n');
    console.log('CSDrive обновлён:', Object.entries(data.folders).map(([k, t]) => `${k}: ${files(t)} файлов`).join(', '));
  }
}
