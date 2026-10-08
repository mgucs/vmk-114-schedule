// A guard between reading a new PDF and publishing it. The parser stops on formats it cannot read at all; this
// catches the quiet failures that still look like a timetable — a day lost because VMK left a group's number out of
// one header row (it happened to 103 on a Monday), a group's column read empty, half of its classes gone.
// A group that looks broken keeps its previous, checked timetable, and a warning says so (the app then shows
// «Сверь с PDF»). Real changes pass: they do not empty a whole weekday that the rest of the stream still has.

const WEEKDAYS = [0, 1, 2, 3, 4];

// Why a group's new timetable looks misread, or '' if it looks fine.
export function suspicion(name, groups, before) {
  const lessons = groups[name].lessons, page = groups[name].page;
  const mates = Object.entries(groups).filter(([other, g]) => other !== name && g.page === page);
  for (const day of WEEKDAYS) {
    if (lessons.some(l => l.day === day)) continue;
    // The stream shares its lectures: when nearly every other group of the page has classes that day, an empty day
    // here is a column the parser did not find.
    const busy = mates.filter(([, g]) => g.lessons.filter(l => l.day === day).length >= 2).length;
    if (mates.length >= 2 && busy >= Math.ceil(mates.length * .75)) return `${['понедельник','вторник','среду','четверг','пятницу'][day]} не удалось прочитать — у остальных групп потока в этот день есть пары`;
  }
  const was = before?.groups?.[name]?.lessons;
  if (was && was.length >= 10 && lessons.length < was.length * .6) return `прочитано ${lessons.length} занятий вместо прежних ${was.length}`;
  return '';
}

// {groups, notes}: the groups to publish and the warnings for the ones kept from before.
export function guardGroups(groups, before) {
  const out = {...groups}, notes = [];
  for (const name of Object.keys(groups)) {
    const why = suspicion(name, groups, before);
    if (!why) continue;
    const kept = before?.groups?.[name];
    if (kept) out[name] = kept;
    notes.push({group:name, id:'', title:'Всё расписание', day:-1, start:'', text:kept ? `Новый PDF прочитан с ошибкой (${why}) — оставлено прежнее расписание группы.` : `Новый PDF, похоже, прочитан с ошибкой: ${why}.`});
  }
  // A group that was there before and is missing now keeps its timetable too.
  for (const [name, kept] of Object.entries(before?.groups || {})) if (!out[name] && Object.keys(out).length > 1) {
    out[name] = kept;
    notes.push({group:name, id:'', title:'Всё расписание', day:-1, start:'', text:'Группа не найдена в новом PDF — оставлено прежнее расписание.'});
  }
  // Most of the PDF misread is not a few bad columns but a failed read: the caller reports it as an error.
  if (notes.length > Object.keys(out).length / 2) throw Error('Новый PDF прочитан с ошибками у большинства групп.');
  return {groups:out, notes};
}
