import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {courseTeachers, diskMentions, lecturersOf, surnamePattern} from '../lib/useful-teachers.mjs';

test('surnames in their usual cases, as whole words', () => {
  for (const [word, surname] of [['Руднева', 'Руднев'], ['Садовничей', 'Садовничая'], ['Кима', 'Ким'], ['Хорошиловой', 'Хорошилова'], ['Падарян', 'Падарян']])
    assert.ok(surnamePattern(surname).test(word), `${word} ← ${surname}`);
  assert.equal(surnamePattern('Ким').test('Кимура'), false);
});
test('disk materials by teacher: initials tell namesakes apart, program folders are skipped', () => {
  const drive = {folders:{'/1 курс':[
    {n:'Дискретная математика', c:[{n:'Лекции - Алексеев В.Б (2 семестр).pdf', s:1}, {n:'Теормин Алексеев.pdf', s:1}]},
    {n:'Алгоритмы', c:[{n:'pascal', c:[{n:'Руднев Иван.pas', s:1}]}, {n:'Корухова Л.С. - Введение.pdf', s:1}]},
  ]}};
  const found = diskMentions(drive, ['Алексеев В.Б.', 'Алексеев Р.А.', 'Руднев С.Г.', 'Корухова Л.С.', 'Корухова Ю.С.']);
  assert.equal(found.get('Алексеев В.Б.').length, 2);
  assert.deepEqual(found.get('Алексеев Р.А.').map(m => m.node.n), ['Теормин Алексеев.pdf'], 'no initials: kept for both, the view filters by subject');
  assert.equal(found.get('Руднев С.Г.').length, 0, 'student names in program folders are not teachers');
  assert.equal(found.get('Корухова Л.С.').length, 1);
  assert.equal(found.get('Корухова Ю.С.').length, 0);
});
test('lecturers of each stream from the timetable', async () => {
  const {schedule:table} = JSON.parse(await readFile(new URL('./fixtures/stats-30.09.json', import.meta.url), 'utf8'));
  const pages = [...new Set(Object.values(table.groups).map(g => g.page))].sort((a, b) => a - b);
  const streamOf = g => g >= '140' ? 'ФИИТ' : String(pages.indexOf(table.groups[g].page) + 1);
  const teachers = courseTeachers(table, streamOf);
  assert.deepEqual(lecturersOf(teachers, /анализ/i, '2'), ['Фомичёв В.В.']);
  assert.ok(lecturersOf(teachers, /алгебр/i, '2').includes('Ким Г.Д.'));
});
