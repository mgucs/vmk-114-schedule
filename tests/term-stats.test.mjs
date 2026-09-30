import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {countLessons, courseCounts, differs, termDates, usual, weekDates} from '../lib/term-stats.mjs';

const source = JSON.parse(await readFile(new URL('../public/source.json', import.meta.url), 'utf8'));
const table = source.schedule, term = source.faculty.term;

test('subjects: one clean name per subject for every group', () => {
  const {subjects} = courseCounts(table, term, weekDates('2026-10-05'));
  for (const s of subjects) assert.doesNotMatch(s, /[А-ЯЁ]\.|П-\d|\d{3}|госуд\.$|\.$|^Конс/, s);
  assert.ok(subjects.includes('Основы российской государственности'));
});
test('a week of group 114: lectures, seminars and the weekly Практикум consultation apart', () => {
  const rows = countLessons(table, term, '114', weekDates('2026-10-05'));
  assert.deepEqual(rows['Практикум на ЭВМ'], {lecture:0, class:2, consultation:1, total:3, done:0});
  assert.equal(rows['Алгебра и геометрия'].lecture, 2);
  assert.equal(Object.values(rows).reduce((n, r) => n + r.total, 0), 20);
  assert.equal(rows['Межфакультетские курсы'], undefined);
});
test('term: holidays drop classes, «done» follows the clock', () => {
  const rows = countLessons(table, term, '114', termDates(table, term), {date:'2026-11-04', clock:'12:00'});
  // Mondays and Wednesdays for 16 weeks, less 4 November (a holiday) and 31 August (before the term).
  assert.equal(rows["Алгебра и геометрия"].lecture, 30);
  assert.ok(rows['Алгебра и геометрия'].done > 0 && rows['Алгебра и геометрия'].done < rows['Алгебра и геометрия'].total);
});
test('comparison: the order is the same for every group, differing rows are found', () => {
  const {subjects, counts, groups} = courseCounts(table, term, weekDates('2026-10-05'));
  assert.equal(subjects[0] !== undefined, true);
  assert.equal(differs(counts, ['101','102'], 'Алгоритмы и алгоритмические языки'), false);
  assert.equal(differs(counts, groups, 'Русский язык'), true);
  assert.equal(usual(counts, groups, 'Русский язык'), 0);
});
