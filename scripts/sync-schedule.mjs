import {appendFile, readFile, writeFile} from 'node:fs/promises';
import * as pdfjs from '../public/vendor/pdf.mjs';
import {parseAll} from '../public/parser.mjs';
import {checkSource, download} from './source-check.mjs';
import {collectFaculty} from './faculty.mjs';

const root = new URL('../public/',import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../public/vendor/pdf.worker.mjs',import.meta.url).href;
const previous = JSON.parse(await readFile(new URL('source.json',root),'utf8'));
previous.schedule ||= JSON.parse(await readFile(new URL('initial.json',root),'utf8'));
const {pdf, snapshot} = await checkSource({previous, parse:bytes => parseAll(pdfjs,bytes)});
if (pdf) {
  await writeFile(new URL('latest.pdf',root),pdf);
  await writeFile(new URL('initial.json',root),JSON.stringify(snapshot.schedule,null,2)+'\n');
}
// Week parity, notices, the course office and the session come from other pages; a failure there never blocks the timetable.
try {
  snapshot.faculty = await collectFaculty({previous:previous.faculty, pdfjs, download:url => download(fetch, url, '*/*', 8_000_000)});
} catch (error) {
  snapshot.faculty = {...(previous.faculty || {}), errors:{page:error instanceof Error ? error.message : String(error)}};
}
// Failed attempts are published while the last verified timetable is retained.
await writeFile(new URL('source.json',root),JSON.stringify(snapshot)+'\n');
// Commit only real changes (plus one heartbeat a day); every run still deploys the fresh source.json.
const facts = faculty => JSON.stringify({...(faculty || {}), checkedAt:undefined, errors:undefined});
const commit = previous.schema !== snapshot.schema || previous.date !== snapshot.date || previous.hash !== snapshot.hash || previous.status !== snapshot.status || previous.error !== snapshot.error
  || previous.attemptedAt?.slice(0,10) !== snapshot.attemptedAt.slice(0,10) || facts(previous.faculty) !== facts(snapshot.faculty);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,`commit=${commit}\n`);
console.log(snapshot.status === 'ok'
  ? `ВМК проверен ${snapshot.checkedAt}: ${Object.keys(snapshot.schedule.groups).length} групп, PDF ${snapshot.hash}`
  : `Проверка не удалась; сохранена предыдущая версия: ${snapshot.error}`);
if (snapshot.faculty?.errors) console.log('Дополнительные данные ВМК:', JSON.stringify(snapshot.faculty.errors));
