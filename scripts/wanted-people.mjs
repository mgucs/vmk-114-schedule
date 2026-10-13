import {personKey} from '../lib/search.mjs';
import {teacherRows} from '../lib/schedule-model.mjs';

// Winter exam lists can omit lecturers. Only complete names can match the staff directory.
export function wantedPeople(source) {
  const wanted = new Set();
  const add = raw => {
    const key = personKey(raw || '');
    if (/^[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)? [А-ЯЁ]\.[А-ЯЁ]\.$/.test(key)) wanted.add(key);
  };
  for (const {lessons} of Object.values(source.schedule.groups))
    for (const lesson of lessons) for (const row of teacherRows(lesson.detail)) add(row.teacher);
  for (const list of Object.values(source.faculty?.session?.lists || {}))
    for (const exam of list) add(exam.lecturer);
  for (const list of Object.values(source.faculty?.session?.credits || {}))
    for (const credit of list) for (const teacher of credit.teachers || []) add(teacher);
  return wanted;
}
