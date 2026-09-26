// Everything else a first-year student looks up on cs.msu.ru: week parity, notices on the timetable page,
// the course office, and the exam session. Each part is independent: if one fails, the previous value stays.
import {parseParity} from '../lib/term.mjs';
import {parseExamList, parseGrid} from './session-parser.mjs';

export const SCHEDULE_PAGE = 'https://cs.msu.ru/studies/schedule';
export const EXAMS_PAGE = 'https://cs.msu.ru/studies/exams';
export const CONTACTS_PAGE = 'https://cs.msu.ru/studies/contacts';

const text = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  .replace(/<(br|p|div|li|h\d|tr|td)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&ndash;|&#8211;/g, '–').replace(/&mdash;/g, '—').replace(/[ \t]+/g, ' ');
const lines = html => text(html).split('\n').map(s => s.trim()).filter(Boolean);
const links = html => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map(m => ({url:new URL(m[1].replace(/&amp;/g, '&'), 'https://cs.msu.ru/').href, label:text(m[2]).replace(/\s+/g, ' ').trim()}));
const vmkPdf = url => { const u = new URL(url); return u.origin === 'https://cs.msu.ru' && u.pathname.startsWith('/sites/cmc/files/') && u.pathname.endsWith('.pdf'); };
const bachelors = html => {
  const section = html.split(/Бакалавриат и интегрированные магистры/i)[1]?.split(/Магистратура и второе высшее образование/i)[0];
  if (!section) throw Error('На сайте ВМК изменился раздел расписаний.');
  return section;
};

// Free text in the bachelors' section that is not one of its standing lines: cancellations, moves, reminders.
const STANDING = [/^Актуальную информацию ищите/i, /^КАЖДЫЙ ДЕНЬ СЛЕДИТЕ/i, /^Расписание обновлено/i, /^Группы\s+\d/i, /^Ч[её]тность недель/i,
  /^Перечень ЭЛЕКТИВНЫХ/i, /^Список спецкурсов/i, /^\(внешняя ссылка\)$/i, /^Положение о посещении/i];
export function readNotices(html) {
  return lines(bachelors(html)).filter(line => line.length >= 8 && line.length <= 500 && !STANDING.some(r => r.test(line))).slice(0, 8);
}

export function parityUrl(html) {
  const link = links(bachelors(html)).find(l => /ч[её]тность недель/i.test(l.label));
  if (!link || !vmkPdf(link.url)) throw Error('Не найдена ссылка на чётность недель.');
  return link.url;
}

// "1-ый курс": office room and phone, head of the course and the course inspector.
export function readContacts(html) {
  const block = text(html).split(/1\s*-?\s*ый\s+курс/i)[1]?.split(/2\s*-?\s*ой\s+курс/i)[0];
  if (!block) throw Error('Не найдены контакты 1 курса.');
  const one = s => s.replace(/\s+/g, ' ').trim();
  const office = block.match(/Учебная часть:\s*ауд\.?\s*([\dА-Яа-я-]+)\s*,?\s*(?:тел\.?\s*([+\d\s()-]{7,}))?/i);
  const person = role => {
    const m = block.match(new RegExp(role + ':\\s*([^\\n]+?)\\s*\\n?\\s*E-?mail:\\s*([\\w.+-]+@[\\w.-]+)', 'i'));
    return m ? {name:one(m[1]), email:m[2].trim()} : null;
  };
  const result = {room:office?.[1] || '', phone:one(office?.[2] || ''), head:person('Начальник курса'), inspector:person('Инспектор курса')};
  if (!result.room && !result.head && !result.inspector) throw Error('Не удалось прочитать контакты 1 курса.');
  return result;
}

// The exams page: its title names the session; links of the first course, split by the headings they stand under.
export function readSessionPage(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 ? text(h1[1]).replace(/\s+/g, ' ').trim() : '';
  const season = /зимн/i.test(title) ? 'winter' : /весенн/i.test(title) ? 'spring' : /летн/i.test(title) ? 'summer' : '';
  const year = Number(title.match(/(20\d\d)\s*\/\s*20\d\d/)?.[1] || 0);
  const body = html.replace(/<!--[\s\S]*?-->/g, '');
  const bachelor = body.split(/>\s*Бакалавриат\s*</i)[1]?.split(/>\s*Магистратура\s*</i)[0] || '';
  const head = body.split(/>\s*Бакалавриат\s*</i)[0];
  const lists = bachelor.split(/Расписание экзаменационной сессии/i);
  // "1 курс", or a shared file such as "1-4 курс" / "1-2-3-4 курс".
  const first = l => (/\b1\s*курс/i.test(l.label) || /\b1(?:\s*[-–]\s*\d)+\s*курс/i.test(l.label)) && vmkPdf(l.url);
  const program = l => /ФИИТ/i.test(l.label) ? 'fiit' : /ПМИ/i.test(l.label) ? 'pmi' : '';
  return {
    title, season, year,
    credits:links(head).filter(l => /зач[её]т/i.test(l.label) && first(l)).map(l => ({url:l.url, label:l.label})),
    consultations:links(head).filter(l => /консультаци/i.test(l.label) && vmkPdf(l.url) && !/\b[2-6]\s*курс/i.test(l.label)).map(l => ({url:l.url, label:l.label})),
    examLists:links(lists[0] || '').filter(first).map(l => ({url:l.url, program:program(l)})).filter(l => l.program),
    exams:links(lists[1] || '').filter(first).map(l => ({url:l.url, program:program(l)})).filter(l => l.program),
  };
}

const programOf = group => Number(group) >= 140 ? 'fiit' : 'pmi';
const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/g, '');
// Exam grids write "АиГ" or "Алгебра и аналитич.геометрия"; the exam list has both the short and the full name.
// Abbreviations used by the grids: initials ("АиГ", "АиАЯ", "МА") or three-letter stems ("ИстРос").
const words = name => name.toLowerCase().replace(/ё/g, 'е').split(/[^а-я]+/).filter(Boolean);
const initials = name => words(name).map(w => w === 'и' ? 'и' : w[0]).join('');
const stems = name => words(name).filter(w => w !== 'и').map(w => w.slice(0, 3)).join('');
function subjectFrom(list, subject) {
  const n = norm(subject);
  return list.find(e => e.short && norm(e.short) === n) || list.find(e => norm(e.name) === n)
    || list.find(e => initials(e.name) === n || stems(e.name) === n)
    || list.find(e => norm(e.name).startsWith(n.slice(0, 10)) || n.startsWith(norm(e.name).slice(0, 10))) || null;
}

export async function readSession(page, {download, pdfjs}) {
  const lists = {}, exams = {}, credits = {};
  for (const {url, program} of page.examLists)
    for (const e of await parseExamList(pdfjs, await download(url))) (lists[e.group] ||= []).push({short:e.short, name:e.name, lecturer:e.lecturer, position:e.position, control:e.control, program});
  for (const {url} of page.exams) {
    const grid = await parseGrid(pdfjs, await download(url));
    for (const [group, list] of Object.entries(grid.entries)) for (const e of list) {
      const known = subjectFrom(lists[group] || [], e.subject);
      (exams[group] ||= []).push({date:e.date, time:e.time, room:e.room, subject:known?.name || e.subject, lecturer:known?.lecturer || ''});
    }
  }
  for (const {url} of page.credits) {
    const grid = await parseGrid(pdfjs, await download(url));
    for (const [group, list] of Object.entries(grid.entries)) for (const e of list)
      (credits[group] ||= []).push({date:e.date, time:e.time, room:e.room, subject:e.subject, teachers:e.teachers});
  }
  return {title:page.title, season:page.season, year:page.year,
    sources:[...page.credits, ...page.consultations, ...page.examLists.map(l => ({url:l.url, label:`Перечень экзаменов ${l.program === 'fiit' ? 'ФИИТ' : 'ПМИ'}`})),
      ...page.exams.map(l => ({url:l.url, label:`Экзамены ${l.program === 'fiit' ? 'ФИИТ' : 'ПМИ'}`}))].map(s => ({url:s.url, label:s.label})),
    lists, exams, credits};
}

export async function collectFaculty({previous = {}, download, pdfjs, now = () => new Date().toISOString()}) {
  const out = {...previous, errors:{}};
  const attempt = async (name, work) => {
    try { out[name] = await work(); }
    catch (error) { out.errors[name] = error instanceof Error ? error.message : String(error); }
  };
  const page = (await download(SCHEDULE_PAGE)).toString('utf8');
  await attempt('notices', async () => readNotices(page));
  await attempt('term', async () => {
    const {textLines} = await import('./session-parser.mjs');
    return parseParity(await textLines(pdfjs, await download(parityUrl(page))));
  });
  await attempt('contacts', async () => readContacts((await download(CONTACTS_PAGE)).toString('utf8')));
  await attempt('session', async () => readSession(readSessionPage((await download(EXAMS_PAGE)).toString('utf8')), {download, pdfjs}));
  // A replaced session goes to the archive, so the next one can be compared with it.
  if (previous.session && out.session && previous.session.title !== out.session.title)
    out.archive = [previous.session, ...(previous.archive || [])].filter((s, i, all) => all.findIndex(o => o.title === s.title) === i).slice(0, 3);
  out.checkedAt = now();
  if (!Object.keys(out.errors).length) delete out.errors;
  return out;
}
