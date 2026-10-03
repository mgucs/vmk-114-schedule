import assert from 'node:assert/strict';
import {test} from 'node:test';
import {periodOn, yearPlan} from '../lib/academic-year.mjs';
import {holidayOn} from '../lib/term.mjs';

const session = (season, year, dates) => ({season, year, exams:{'114':dates.map(date => ({date}))}, credits:{}});

test('a year with published sessions: exact sessions and the vacations after them', () => {
  const plan = yearPlan(2025, {sessions:[session('winter', 2025, ['2025-12-19', '2026-01-23']), session('spring', 2025, ['2026-05-20', '2026-06-27'])]});
  assert.deepEqual(plan.map(p => [p.name, p.start, p.end, p.estimated]), [
    ['Осенний семестр', '2025-09-01', '2025-12-18', false],
    ['Зимняя сессия', '2025-12-19', '2026-01-23', false],
    ['Зимние каникулы', '2026-01-24', '2026-02-08', false],
    ['Весенний семестр', '2026-02-09', '2026-05-19', false],
    ['Летняя сессия', '2026-05-20', '2026-06-27', false],
    ['Летние каникулы', '2026-06-28', '2026-08-31', false],
  ]);
  assert.equal(periodOn(plan, '2026-02-01').name, 'Зимние каникулы');
});
test('a year without sessions yet: MSU usual dates, marked estimated', () => {
  const plan = yearPlan(2026, {term:[{start:'2026-09-01', end:'2026-12-20', odd:true}]});
  const breakDates = plan.find(p => p.name === 'Зимние каникулы');
  assert.deepEqual([breakDates.start, breakDates.end, breakDates.estimated], ['2027-01-25', '2027-02-07', true]);
  assert.equal(plan[0].estimated, false, 'the weeks of classes are official');
});
test('the New Year days are holidays, not student vacations', () => {
  assert.equal(holidayOn('2027-01-05'), 'Новогодние праздники');
});
