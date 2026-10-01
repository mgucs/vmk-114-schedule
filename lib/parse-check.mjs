// Checks a parsed timetable for what usually means the PDF was read wrong. The parser keeps working on
// formats it does not know; these warnings make such places visible (in the app and the GitHub log)
// instead of letting them pass silently as odd subject names, phantom classes or wrong times.
import {cleanTitle} from './schedule-model.mjs';

const minutes = t => Number(t.slice(0,2))*60 + Number(t.slice(3));
const validDay = iso => { const d = new Date(iso+'T12:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===iso; };

export function lessonWarnings(lesson, group) {
  const title = cleanTitle(lesson), out = [];
  if (/\d/.test(title)) out.push('в названии предмета остались цифры (дата, время или аудитория)');
  if (/(?:^|\s)[А-ЯЁ]\.\s*[А-ЯЁ]?\.?(?:\s|$)/.test(title) || /[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]?\.?/.test(title)) out.push('в названии предмета инициалы преподавателя');
  if (/^[а-яё]/.test(title)) out.push('название начинается с маленькой буквы — возможно, обрезано');
  if (/(?:^|\s)(?:с|до|по|только|кроме)\s*$/i.test(title) || /(?:^|\s)(?:кроме|нечетн|четн|нечётн|чётн)/i.test(title)) out.push('в названии осталось условие по датам или неделям');
  if (title.length > 70) out.push('слишком длинное название — возможно, слились две записи');
  if (title.length < 4) out.push('слишком короткое название');
  if (lesson.end <= lesson.start || minutes(lesson.end)-minutes(lesson.start) > 240) out.push(`странное время ${lesson.start}–${lesson.end}`);
  const rule = lesson.rule;
  if (rule) for (const d of [rule.from, rule.until, ...(rule.dates || [])].filter(Boolean)) if (!validDay(d)) out.push(`несуществующая дата ${d}`);
  if (rule?.from && rule?.until && rule.until < rule.from) out.push('дата «по» раньше даты «с»');
  // Two entries in one cell alternate by weeks only for ФИИТ; elsewhere it is a split the parser did not understand.
  if (/-\d$/.test(lesson.id) && Number(group) < 140) out.push('в клетке две записи — проверь, не одна ли это пара');
  return out;
}

// [{group, id, title, day, start, text}] for the whole table, one entry per problem.
export function checkTable(groups) {
  const out = [];
  for (const [group, {lessons}] of Object.entries(groups)) {
    for (const lesson of lessons) for (const text of lessonWarnings(lesson, group))
      out.push({group, id:lesson.id, title:cleanTitle(lesson), day:lesson.day, start:lesson.start, text});
    // Different classes at the same time on the same days (ФИИТ week pairs and copies of one cell aside).
    for (let i = 0; i < lessons.length; i++) for (let j = i+1; j < lessons.length; j++) {
      const a = lessons[i], b = lessons[j];
      if (a.day!==b.day || a.id.replace(/-\d$/,'')===b.id.replace(/-\d$/,'')) continue;
      if (minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end) && !(a.rule?.dates && b.rule?.dates && !a.rule.dates.some(d => b.rule.dates.includes(d)))
        && !(a.rule?.until && b.rule?.from && a.rule.until < b.rule.from) && !(b.rule?.until && a.rule?.from && b.rule.until < a.rule.from))
        out.push({group, id:b.id, title:cleanTitle(b), day:b.day, start:b.start, text:`пересекается по времени с «${cleanTitle(a)}» ${a.start}–${a.end}`});
    }
  }
  return out;
}
