// How many classes of each subject a group has in a set of dates: the same rules as the timetable
// (holidays, weeks of classes, «с …» / «только …», ФИИТ week parity). A class with subgroups counts once.
import {cleanTitle, groupSchedule} from './schedule-model.mjs';
import {lessonsOn} from './day-glance.mjs';
import {termEnd, termStart} from './term.mjs';

const plus = (iso, n) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday = iso => (new Date(iso+'T12:00:00Z').getUTCDay()+6)%7;
export const kindOf = lesson => lesson.type==='lecture' ? 'lecture' : lesson.type==='consultation' ? 'consultation' : 'class';

export function termDates(table, term) {
  const out = [];
  for (let d = termStart(term) || `${table.year}-09-01`, end = termEnd(term) || `${table.year}-12-31`; d <= end; d = plus(d, 1)) out.push(d);
  return out;
}
// Monday–Saturday of the teaching week of a date; on Sunday the coming one.
export function weekDates(date) {
  const monday = plus(date, -weekday(date) + (weekday(date)===6 ? 7 : 0));
  return Array.from({length:6}, (_, i) => plus(monday, i));
}

// {subject: {lecture, class, consultation, total, done}}; done = already over by `now` ({date, clock}).
export function countLessons(table, term, group, dates, now) {
  const schedule = {...groupSchedule(table, group), term};
  const rows = {};
  for (const date of dates) for (const lesson of lessonsOn(schedule, date)) {
    const row = rows[cleanTitle(lesson)] ||= {lecture:0, class:0, consultation:0, total:0, done:0};
    row[kindOf(lesson)]++; row.total++;
    if (now && (date < now.date || (date===now.date && lesson.end <= now.clock))) row.done++;
  }
  return rows;
}

// Every group at once, with one order of subjects for the whole course: most classes in the term first.
export function courseCounts(table, term, dates, now) {
  const groups = Object.keys(table.groups).sort();
  const counts = Object.fromEntries(groups.map(g => [g, countLessons(table, term, g, dates, now)]));
  const weight = {};
  for (const g of groups) for (const [subject, row] of Object.entries(countLessons(table, term, g, termDates(table, term)))) weight[subject] = (weight[subject] || 0) + row.total;
  const subjects = Object.keys(weight).sort((a, b) => weight[b]-weight[a] || a.localeCompare(b, 'ru'));
  return {groups, subjects, counts};
}

// Rows whose numbers are not the same for every shown group.
export const differs = (counts, groups, subject) => new Set(groups.map(g => counts[g][subject]?.total || 0)).size > 1;
// The most common value of a row: cells that differ from it are marked.
export function usual(counts, groups, subject) {
  const seen = new Map();
  for (const g of groups) { const n = counts[g][subject]?.total || 0; seen.set(n, (seen.get(n) || 0) + 1); }
  return [...seen].sort((a, b) => b[1]-a[1] || b[0]-a[0])[0]?.[0] ?? 0;
}
