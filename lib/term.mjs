// Teaching calendar: which dates have classes at all, and whether a week is odd or even.
// `term` comes from VMK's "Чётность недель" PDF: [{start, end, odd}], one row per week of classes.

// Public holidays (Labour Code, art. 112). A fixed holiday on a weekend moves to the next Monday,
// except the New Year days; transfers set by government decree are listed explicitly.
const FIXED = {'01-01':'Новый год','01-02':'Новогодние праздники','01-03':'Новогодние праздники','01-04':'Новогодние праздники','01-05':'Новогодние праздники',
  '01-06':'Новогодние праздники','01-07':'Рождество','01-08':'Новогодние праздники','02-23':'День защитника Отечества','03-08':'Международный женский день',
  '05-01':'Праздник Весны и Труда','05-09':'День Победы','06-12':'День России','11-04':'День народного единства'};
// 2026: 31 December is a day off by decree (moved from 4 January). Transfers for 2027 are not decided yet.
const DECREED = {'2026-12-31':'Выходной день (перенос)'};
const plus = (iso, n) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday = iso => (new Date(iso+'T12:00:00Z').getUTCDay()+6)%7;

export function holidayOn(date) {
  if (DECREED[date]) return DECREED[date];
  if (FIXED[date.slice(5)]) return FIXED[date.slice(5)];
  // Monday after a holiday that fell on Saturday or Sunday.
  if (weekday(date) === 0) for (const back of [1, 2]) {
    const d = plus(date, -back), name = FIXED[d.slice(5)];
    if (name && !d.slice(5).startsWith('01-')) return `${name} (перенос)`;
  }
  return '';
}

export const validTerm = value => Array.isArray(value) && value.length > 0 && value.length <= 30
  && value.every(w => w && /^20\d\d-\d\d-\d\d$/.test(w.start) && /^20\d\d-\d\d-\d\d$/.test(w.end) && w.start <= w.end && typeof w.odd === 'boolean');

export const weekOf = (term, date) => validTerm(term) ? term.find(w => date >= w.start && date <= w.end) || null : null;
export const termStart = term => validTerm(term) ? term[0].start : '';
export const termEnd = term => validTerm(term) ? term.at(-1).end : '';

// What a date is: a class day, a holiday, or outside the weeks of classes.
export function dayKind(term, date) {
  const holiday = holidayOn(date);
  if (holiday) return {kind:'holiday', name:holiday};
  if (!validTerm(term)) return {kind:'classes', odd:null};
  if (date < termStart(term)) return {kind:'before', start:termStart(term)};
  if (date > termEnd(term)) return {kind:'after', end:termEnd(term)};
  const week = weekOf(term, date);
  return {kind:'classes', odd:week ? week.odd : null};
}

// Two entries stacked in one PDF cell alternate: the upper one on odd weeks, the lower ("-2") on even ones.
// Applied to ФИИТ (groups 141–142), where this is how the timetable is written.
export function onThisWeek(lesson, lessons, group, term, date) {
  if (Number(group) < 140) return true;
  const odd = weekOf(term, date)?.odd;
  if (odd == null) return true;
  const base = lesson.id.replace(/-\d$/, '');
  const stacked = lessons.some(l => l !== lesson && l.id.replace(/-\d$/, '') === base);
  if (!stacked) return true;
  return lesson.id === base ? odd : !odd;
}
export const isStacked = (lesson, lessons) => lessons.some(l => l !== lesson && l.id.replace(/-\d$/, '') === lesson.id.replace(/-\d$/, ''));

// Parses the text of the parity PDF: "01 сентября 2026 г. - 06 сентября 2026 г. нечетная неделя".
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
export function parseParity(lines) {
  const iso = (d, m, y) => `${y}-${String(MONTHS.indexOf(m)+1).padStart(2,'0')}-${d.padStart(2,'0')}`;
  const weeks = [];
  for (const line of lines) {
    const m = line.match(/(\d{1,2})\s+([а-я]+)\s+(20\d\d)\s*г?\.?\s*[-–—]\s*(\d{1,2})\s+([а-я]+)\s+(20\d\d)\s*г?\.?\s*(нечетная|нечётная|четная|чётная)/i);
    if (!m || MONTHS.indexOf(m[2].toLowerCase()) < 0 || MONTHS.indexOf(m[5].toLowerCase()) < 0) continue;
    weeks.push({start:iso(m[1], m[2].toLowerCase(), m[3]), end:iso(m[4], m[5].toLowerCase(), m[6]), odd:/^не/i.test(m[7])});
  }
  weeks.sort((a,b) => a.start.localeCompare(b.start));
  if (!validTerm(weeks)) throw Error('Не удалось прочитать чётность недель.');
  return weeks;
}
