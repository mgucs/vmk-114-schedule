// Teachers of the first course matched to their pages in the VMK staff directory (cs.msu.ru/persons).
// Heavier than the timetable check, so it refreshes at most once a week (pass --force to run anyway).
import {readFile, writeFile} from 'node:fs/promises';
import {personKey} from '../lib/search.mjs';
import {teacherRows} from '../lib/schedule-model.mjs';
import {download} from './source-check.mjs';

const root = new URL('../public/', import.meta.url);
const file = new URL('people.json', root);
const WEEK = 7*86400000;
const previous = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);
if (previous && Date.now()-Date.parse(previous.updatedAt) < WEEK && !process.argv.includes('--force')) {
  console.log('Справочник преподавателей свежий:', previous.updatedAt);
  process.exit(0);
}
const get = async url => (await download(fetch, url, 'text/html', 3_000_000)).toString('utf8');
const text = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const pause = () => new Promise(r => setTimeout(r, 300));

// Everyone who appears in the timetable or the exam lists, as "Фамилия И.О.".
const source = JSON.parse(await readFile(new URL('source.json', root), 'utf8'));
const wanted = new Set();
for (const {lessons} of Object.values(source.schedule.groups)) for (const l of lessons) for (const row of teacherRows(l.detail)) { const n = personKey(row.teacher); if (/\.$/.test(n)) wanted.add(n); }
for (const list of Object.values(source.faculty?.session?.lists || {})) for (const e of list) wanted.add(personKey(e.lecturer));
for (const list of Object.values(source.faculty?.session?.credits || {})) for (const e of list) for (const t of e.teachers) wanted.add(personKey(t));

const letters = [...new Set([...wanted].map(n => n[0]))];
const directory = new Map();
for (const letter of letters) {
  const html = await get(`https://cs.msu.ru/persons/all/${encodeURIComponent(letter.toLowerCase())}`);
  for (const m of html.matchAll(/<a href="(\/persons\/[^"/]+)">([^<]+)<\/a>/g)) {
    const key = personKey(text(m[2]));
    directory.set(key, directory.has(key) ? null : {name:text(m[2]), url:'https://cs.msu.ru'+m[1]});
  }
  await pause();
}

const people = {};
for (const key of [...wanted].sort()) {
  const found = directory.get(key);
  if (!found) continue;
  try {
    const html = await get(found.url);
    const main = html.split(/<h1[^>]*>/)[1] || '';
    const lines = main.split(/<(?:br|p|div|li|h\d)\b[^>]*>/i).map(text).filter(Boolean);
    const position = lines.find(l => /(профессор|доцент|ассистент|преподаватель|научный сотрудник|заведующ|декан|академик)/i.test(l) && l.length < 160) || '';
    const degree = (main.match(/Ученая степень:\s*(?:&nbsp;|\s|<[^>]+>)*([^<]+)/i)?.[1] || '').trim();
    const istina = main.match(/href="(https?:\/\/istina\.msu\.ru\/[^"]+)"/)?.[1] || '';
    people[key] = {name:found.name, url:found.url, position:position.replace(/^Должность:\s*/i, ''), degree:text(degree), istina};
  } catch (error) { console.log('Не удалось прочитать', found.url, error.message); }
  await pause();
}
await writeFile(file, JSON.stringify({updatedAt:new Date().toISOString(), people}, null, 1)+'\n');
console.log(`Преподаватели: ${Object.keys(people).length} из ${wanted.size} найдены в справочнике ВМК`);
