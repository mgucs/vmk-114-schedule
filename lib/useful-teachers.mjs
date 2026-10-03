// «Полезное» by teacher: who teaches what in the first course (from the timetable) and which CSDrive materials
// name a teacher (by surname in a folder or file name, in any case: «Руднева», «Садовничей», «Кима»).
import {cleanTitle, isDisplayedLesson, teacherRows} from './schedule-model.mjs';
import {person, personKey} from './search.mjs';

// Teachers whose materials are on the disk but who may not teach the first course this year.
export const DISK_TEACHERS = ['Садовничая И.В.', 'Хорошилова Е.В.', 'Фоменко Т.Н.', 'Никитин А.А.', 'Руднев С.Г.', 'Матвеев В.А.', 'Ломов И.С.', 'Белеванцев А.А.',
  'Корухова Л.С.', 'Кузьменкова Е.А.', 'Падарян В.А.', 'Махнычев В.С.', 'Алексеев В.Б.', 'Бочкарёв П.Н.', 'Пильщиков В.Н.', 'Абрамов В.Г.', 'Трифонов Н.П.', 'Машечкин И.В.', 'Столяров А.В.'];
// Program folders hold students' names, not teachers'.
const CODE = /\/(pascal|assembler|work|bp|dos|EXAMPLES|Интерпретатор[^/]*|Программирование на С\+\+|2\. Домашние задания)(\/|$)/i;
// Initials next to the surname («Корухова Л.С.», «Е.А. Кузьменкова») tell namesakes apart.
function initialsNear(name, re) {
  const m = name.match(new RegExp(String.raw`${re.source}\s+([А-ЯЁ])\.\s*([А-ЯЁ])(?![а-яё])|([А-ЯЁ])\.\s*([А-ЯЁ])\.\s*${re.source}`));
  return m ? (m[1] ? m[1] + m[2] : m[3] + m[4]) : '';
}

const surnameOf = key => key.split(' ')[0];
// A surname in its usual Russian cases, as a whole word.
export function surnamePattern(surname) {
  const s = surname.replace(/ё/g, '[её]');
  const body = /ая$/.test(surname) ? `${s.slice(0, -2)}(?:ая|ой|ей|ую)` : /[ое]ва$|[иы]на$/.test(surname) ? `${s.slice(0, -1)}(?:а|ой|у)`
    : /(ко|ян|их|ых|ч)$/.test(surname) && !/ич$/.test(surname) ? s : `${s}(?:а|у|ым|ом|е)?`;
  return new RegExp(`(?<![А-Яа-яЁё])${body}(?![а-яё])`);
}

// Folders and files of CSDrive that name each teacher; a matching folder is taken whole.
export function diskMentions(drive, keys) {
  const found = new Map(keys.map(k => [k, []]));
  const patterns = keys.map(k => [k, surnamePattern(surnameOf(k))]);
  const walk = (nodes, path) => { for (const n of nodes || []) {
    const full = `${path}/${n.n}`;
    if (CODE.test(full)) continue;
    const hits = patterns.filter(([k, re]) => {
      if (!re.test(n.n)) return false;
      const initials = initialsNear(n.n, re);
      return !initials || k.split(' ')[1]?.replace(/\./g, '') === initials;
    });
    for (const [k] of hits) found.get(k).push({path:full.slice(1), node:n});
    if (n.c && !hits.length) walk(n.c, full);
  } };
  for (const [root, nodes] of Object.entries(drive?.folders || {})) walk(nodes, root);
  return found;
}

// Who teaches what: {key → {key, short, subjects:{subject → {lecture:Set(stream), class:Set(group)}}}}.
export function courseTeachers(table, streamOf) {
  const out = new Map();
  for (const [group, {lessons}] of Object.entries(table.groups)) for (const lesson of lessons) {
    if (!isDisplayedLesson(lesson) || lesson.type === 'sport') continue;
    const subject = cleanTitle(lesson);
    const names = teacherRows(lesson.detail).map(r => r.teacher).filter(t => /[А-ЯЁ][а-яё]+/.test(t));
    for (const raw of names) {
      const key = personKey(raw), short = person(raw);
      if (!/^[А-ЯЁ][а-яё-]+ [А-ЯЁ]\.[А-ЯЁ]\.$/.test(short)) continue;
      const t = out.get(key) || {key, short, subjects:{}};
      const s = t.subjects[subject] ||= {lecture:new Set(), class:new Set()};
      if (lesson.type === 'lecture') s.lecture.add(streamOf(group)); else s.class.add(group);
      out.set(key, t);
    }
  }
  return out;
}

// Lecturers of a subject in a stream, by the timetable: «Математический анализ» → ['Фомичёв В.В.'].
export function lecturersOf(teachers, subjectMatch, stream) {
  return [...teachers.values()].filter(t => Object.entries(t.subjects).some(([s, v]) => subjectMatch.test(s) && v.lecture.has(stream))).map(t => t.short);
}
