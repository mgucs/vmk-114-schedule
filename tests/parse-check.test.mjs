import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as pdfjs from '../public/vendor/pdf.mjs';
import {parseAll, readQualifiers} from '../public/parser.mjs';
import {checkTable, lessonWarnings} from '../lib/parse-check.mjs';
import {ruleActive} from '../lib/schedule-model.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../public/vendor/pdf.worker.mjs', import.meta.url).href;

test('dates and times written into a subject line', () => {
  const q = (text, start='10:30', end='12:05') => readQualifiers(text, 2026, start, end);
  const cases = [
    ['16.50-18.20 Физическая культура', 'Физическая культура', '16:50', '18:20', null, '16:20', '17:55'],
    ['с 12.15 Конс. Практикум на ЭВМ', 'Конс. Практикум на ЭВМ', '12:15', '14:25', null, '12:50', '14:25'],
    ['с 11.00 Русский язык', 'Русский язык', '11:00', '12:05', null],
    ['с 10.09 История России', 'История России', '10:30', '12:05', {from:'2026-09-10'}],
    ['10.09 История России', 'История России', '10:30', '12:05', {from:'2026-09-10'}],
    ['с октября Основы', 'Основы', '10:30', '12:05', {from:'2026-10-01'}],
    ['с 3 октября 9.00 Основы российской государственности', 'Основы российской государственности', '09:00', '10:20', {from:'2026-10-03'}, '08:45', '10:20'],
    // The same cell copied into the next row keeps that row's time.
    ['с 3 октября 9.00 Основы российской государственности', 'Основы российской государственности', '10:30', '12:05', {from:'2026-10-03'}],
    ['5, 12, 19, 26.09 Алгебра и геометрия', 'Алгебра и геометрия', '10:30', '12:05', {dates:['2026-09-05','2026-09-12','2026-09-19','2026-09-26']}],
    ['Алгебра (только 5.09, 12.09 и 3.10)', 'Алгебра', '10:30', '12:05', {dates:['2026-09-05','2026-09-12','2026-10-03']}],
    ['12 и 19 сентября Алгебра', 'Алгебра', '10:30', '12:05', {dates:['2026-09-12','2026-09-19']}],
    ['только 7 ноября Алгебра', 'Алгебра', '10:30', '12:05', {dates:['2026-11-07']}],
    ['Английский язык до 15 октября', 'Английский язык', '10:30', '12:05', {until:'2026-10-15'}],
    ['с 15.10 по 20.12 Английский язык', 'Английский язык', '10:30', '12:05', {from:'2026-10-15', until:'2026-12-20'}],
    ['с 12 января Алгебра', 'Алгебра', '10:30', '12:05', {from:'2027-01-12'}],
    ['Практикум на ЭВМ', 'Практикум на ЭВМ', '10:30', '12:05', null],
  ];
  for (const [text, title, start, end, rule, rowStart, rowEnd] of cases)
    assert.deepEqual(q(text, rowStart, rowEnd), {title, start, end, rule}, text);
  assert.equal(ruleActive({from:'2026-10-15', until:'2026-12-20'}, '2026-12-21'), false);
  assert.equal(ruleActive({until:'2026-10-15'}, '2026-10-15'), true);
});

test('every saved VMK PDF parses without a single doubtful place', async () => {
  for (const name of ['schedule.pdf', 'schedule-2409.pdf', 'schedule-2909.pdf', 'schedule-0110.pdf']) {
    const {groups} = await parseAll(pdfjs, await readFile(new URL(`./fixtures/${name}`, import.meta.url)));
    assert.deepEqual(checkTable(groups), [], name);
  }
});

test('the self-check catches what a misread PDF looks like', () => {
  const l = (o) => ({id:'5-08:45', day:5, start:'08:45', end:'10:20', title:'Алгебра', detail:'', room:'', type:'class', rule:null, raw:'', ...o});
  assert.match(lessonWarnings(l({title:'с 3 октября 9.00 Основы'}), '101').join(), /цифры/);
  assert.match(lessonWarnings(l({id:'5-08:45-2', title:'Ляховенко О.И.'}), '101').join(), /инициалы|две записи/);
  assert.match(lessonWarnings(l({title:'актикум на ЭВМ'}), '110').join(), /маленькой буквы/);
  assert.deepEqual(lessonWarnings(l({id:'5-08:45-2'}), '141'), [], 'ФИИТ alternates by weeks');
  assert.match(lessonWarnings(l({rule:{from:'2026-15-12'}}), '110').join(), /несуществующая дата/);
  const overlap = checkTable({'101':{page:1, lessons:[l({}), l({id:'5-09:00', start:'09:00', title:'Матанализ'})]}});
  assert.match(overlap[0].text, /пересекается/);
});
