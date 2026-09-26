import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as pdfjs from '../public/vendor/pdf.mjs';
import {parseExamList, parseGrid, textLines} from '../scripts/session-parser.mjs';
import {readContacts, readNotices, readSessionPage, parityUrl} from '../scripts/faculty.mjs';
import {dayKind, holidayOn, onThisWeek, parseParity} from '../lib/term.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../public/vendor/pdf.worker.mjs', import.meta.url).href;
const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url));
const term = parseParity(await textLines(pdfjs, await fixture('parity.pdf')));

test('week parity: sixteen weeks from 1 September, the first one odd', () => {
  assert.equal(term.length, 16);
  assert.deepEqual(term[0], {start:'2026-09-01', end:'2026-09-06', odd:true});
  assert.deepEqual(term.at(-1), {start:'2026-12-14', end:'2026-12-20', odd:false});
});

test('holidays and the end of classes', () => {
  assert.equal(holidayOn('2026-11-04'), 'День народного единства');
  assert.equal(dayKind(term, '2026-11-04').kind, 'holiday');
  assert.equal(dayKind(term, '2026-11-05').kind, 'classes');
  assert.equal(dayKind(term, '2026-12-21').kind, 'after');
  assert.equal(dayKind(term, '2026-08-31').kind, 'before');
  // 9 May 2027 is a Sunday: the day off moves to Monday.
  assert.match(holidayOn('2027-05-10'), /День Победы/);
});

test('ФИИТ: the upper entry of a cell on odd weeks, the lower one on even weeks', () => {
  const lessons = [{id:'3-12:50'}, {id:'3-12:50-2'}, {id:'3-14:35'}];
  const odd = '2026-09-03', even = '2026-09-10';
  assert.equal(onThisWeek(lessons[0], lessons, '141', term, odd), true);
  assert.equal(onThisWeek(lessons[1], lessons, '141', term, odd), false);
  assert.equal(onThisWeek(lessons[0], lessons, '141', term, even), false);
  assert.equal(onThisWeek(lessons[1], lessons, '141', term, even), true);
  assert.equal(onThisWeek(lessons[2], lessons, '141', term, even), true);
  // Other groups keep showing both.
  assert.equal(onThisWeek(lessons[1], lessons, '114', term, odd), true);
});

test('notices: standing lines are skipped, anything else is shown', () => {
  const page = `<h2>Бакалавриат и интегрированные магистры</h2><p>Актуальную информацию ищите на стендах центрального холла 6-го этажа.</p>
    <p>КАЖДЫЙ ДЕНЬ СЛЕДИТЕ ЗА ИЗМЕНЕНИЯМИ В РАСПИСАНИИ!!!<br>Расписание обновлено 24.09.2026</p><p>30 сентября лекции Иванова И.И. по алгебре не будет</p>
    <p><a href="/sites/cmc/files/docs/a.pdf">Группы 101–121, 141-142.</a></p><p><a href="/sites/cmc/files/docs/chetnost.pdf">Четность недель осеннего семестра</a></p>
    <h2>Магистратура и второе высшее образование</h2><p>15 сентября лекции не будет</p>`;
  assert.deepEqual(readNotices(page), ['30 сентября лекции Иванова И.И. по алгебре не будет']);
  assert.equal(parityUrl(page), 'https://cs.msu.ru/sites/cmc/files/docs/chetnost.pdf');
});

test('course office of the first course', () => {
  const page = `<h1>Начальники и инспекторы курсов</h1><h3>1-ый курс</h3><p>Учебная часть: ауд. 629, тел. +7 (495) 000-00-00</p>
    <p>Начальник курса: Петров Пётр Петрович<br>Email: head@example.org</p><p>Инспектор курса: Сидорова Анна Ивановна<br>Email: insp@example.org</p><h3>2-ой курс</h3>`;
  const c = readContacts(page);
  assert.equal(c.room, '629');
  assert.deepEqual(c.head, {name:'Петров Пётр Петрович', email:'head@example.org'});
  assert.deepEqual(c.inspector, {name:'Сидорова Анна Ивановна', email:'insp@example.org'});
});

test('session page: the title names the session, commented-out links are ignored', () => {
  const page = `<h1>Расписание зимней экзаменационной сессии 2026/2027 учебного года</h1>
    <a href="/sites/cmc/files/docs/z1.pdf">Расписание зачётов 1 курс</a><a href="/sites/cmc/files/docs/z2.pdf">Расписание зачётов 2 курс</a>
    <h3>Бакалавриат</h3><p>Перечень зачетов и экзаменов</p><a href="/sites/cmc/files/docs/l1.pdf">Бакалавриат ФИИТ 1 курс</a><a href="/sites/cmc/files/docs/l2.pdf">Бакалавриат ПМИ 1 курс</a>
    <p>Расписание экзаменационной сессии</p><a href="/sites/cmc/files/docs/e1.pdf">Бакалавриат ПМИ 1 курс</a><!-- <a href="/sites/cmc/files/docs/old.pdf">Бакалавриат ФИИТ 1 курс</a> -->
    <h3>Магистратура</h3><a href="/sites/cmc/files/docs/m.pdf">Магистратура 1 курс</a>`;
  const s = readSessionPage(page);
  assert.equal(s.season, 'winter');
  assert.equal(s.year, 2026);
  assert.deepEqual(s.credits.map(l => l.url), ['https://cs.msu.ru/sites/cmc/files/docs/z1.pdf']);
  assert.deepEqual(s.examLists.map(l => l.program), ['fiit', 'pmi']);
  assert.deepEqual(s.exams, [{url:'https://cs.msu.ru/sites/cmc/files/docs/e1.pdf', program:'pmi'}]);
});

test('exam list and exam timetable of ФИИТ', async () => {
  const list = await parseExamList(pdfjs, await fixture('exam-list-fiit.pdf'));
  assert.ok(list.some(e => e.group === '141' && e.short === 'ОП' && e.name === 'Основы программирования' && e.lecturer === 'Корухова Ю.С.'));
  const grid = await parseGrid(pdfjs, await fixture('exams-fiit.pdf'));
  assert.equal(grid.year, 2025);
  assert.deepEqual(grid.entries['141'][0], {date:'2026-06-02', time:'09:00', room:'579', subject:'Основы программирования', teachers:[]});
  assert.ok(grid.entries['142'].some(e => e.date === '2026-06-17' && e.time === '10:00' && e.room === '526б' && e.subject === 'Дискретная математика'));
  assert.ok(grid.entries['141'].some(e => e.subject === 'Математический анализ'));
});

test('credits: several a day, raised minutes, the ФИИТ table with its own columns', async () => {
  const {entries} = await parseGrid(pdfjs, await fixture('credits.pdf'));
  const day = entries['101'].filter(e => e.date === '2026-05-25');
  assert.deepEqual(day.map(e => [e.time, e.room, e.subject]), [['10:00','МЗ','Практикум на ЭВМ'], ['14:00','713','Алгебра и геометрия']]);
  assert.deepEqual(entries['114'].find(e => e.date === '2026-05-22'), {date:'2026-05-22', time:'14:00', room:'МЗ-3', subject:'Практикум на ЭВМ', teachers:['Бордаченкова Е.А.', 'Панферов А.А.']});
  assert.deepEqual(entries['141'][0], {date:'2026-05-20', time:'15:00', room:'786', subject:'Английский язык', teachers:['Шабловский А.А.']});
});

test('a room at the end of the subject line is split off', async () => {
  const {entriesOf} = await import('../scripts/session-parser.mjs');
  assert.deepEqual(entriesOf(['14:00', 'Практикум на ЭВМ МЗ-3', 'Бордаченкова Е.А.']), [{time:'14:00', room:'МЗ-3', subject:'Практикум на ЭВМ', teachers:['Бордаченкова Е.А.']}]);
  assert.deepEqual(entriesOf(['10.00 Алгоритмы и алгоритмические языки 526б']), [{time:'10:00', room:'526б', subject:'Алгоритмы и алгоритмические языки', teachers:[]}]);
  assert.deepEqual(entriesOf(['15:00ауд. 786 Английский язык', 'Шабловский А.А']), [{time:'15:00', room:'786', subject:'Английский язык', teachers:['Шабловский А.А']}]);
});
