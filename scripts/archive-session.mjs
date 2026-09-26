// Adds a past session to the archive shown in the app, from a saved copy of the exams page
// (e.g. the Wayback Machine): node scripts/archive-session.mjs <url or saved file of the archived exams page>
// The PDFs it links to are downloaded from cs.msu.ru. New sessions are archived automatically by the sync.
import {readFile, writeFile} from 'node:fs/promises';
import * as pdfjs from '../public/vendor/pdf.mjs';
import {download} from './source-check.mjs';
import {readSession, readSessionPage} from './faculty.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../public/vendor/pdf.worker.mjs', import.meta.url).href;
const pageUrl = process.argv[2];
if (!pageUrl) throw Error('Укажи адрес или файл сохранённой страницы расписания сессии.');
let html;
if (/^https?:/.test(pageUrl)) {
  const response = await fetch(pageUrl, {headers:{'User-Agent':'VMK114-Schedule/2.0'}});
  if (!response.ok) throw Error(`Страница недоступна (HTTP ${response.status}).`);
  html = await response.text();
} else html = await readFile(pageUrl, 'utf8');
const session = await readSession(readSessionPage(html), {pdfjs, download:url => download(fetch, url, '*/*', 8_000_000)});
if (!session.season || !session.year) throw Error('Не удалось понять, какая это сессия.');
const file = new URL('../public/source.json', import.meta.url);
const source = JSON.parse(await readFile(file, 'utf8'));
source.faculty ||= {};
source.faculty.archive = [session, ...(source.faculty.archive || []).filter(s => s.title !== session.title)]
  .sort((a, b) => b.year-a.year || ['summer','spring','winter'].indexOf(a.season)-['summer','spring','winter'].indexOf(b.season)).slice(0, 3);
await writeFile(file, JSON.stringify(source)+'\n');
console.log(`В архив добавлена: ${session.title} — групп с экзаменами: ${Object.keys(session.exams).length}, с зачётами: ${Object.keys(session.credits).length}`);
