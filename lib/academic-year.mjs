// The academic year as periods: autumn classes, winter session, winter break, spring classes, summer session,
// summer break. Exact where VMK published dates — the weeks of classes (parity table) and the session timetables —
// and MSU's usual calendar otherwise (marked estimated): the winter break runs from the end of the session to the
// start of the spring term, the first Monday on or after 7 February; the summer break lasts until 31 August.
import {termEnd, termStart} from './term.mjs';

const plus = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekday = iso => (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
const mondayFrom = iso => plus(iso, (7 - weekday(iso)) % 7);

// First and last date of a session's exams and credits, over all groups.
export function sessionSpan(session) {
  if (!session) return null;
  const dates = [...Object.values(session.exams || {}), ...Object.values(session.credits || {})].flat().map(e => e.date).filter(Boolean).sort();
  return dates.length ? {start:dates[0], end:dates.at(-1)} : null;
}

// sessions: every known session ({season:'winter'|'spring', year}); only those of this academic year are used.
/** @param {number} year @param {{term?: {start:string,end:string,odd:boolean}[] | null, sessions?: any[]}} [options] */
export function yearPlan(year, {term = null, sessions = []} = {}) {
  const find = season => sessionSpan(sessions.find(s => s && s.season === season && s.year === year));
  const winter = find('winter'), spring = find('spring');
  const autumnStart = termStart(term) || `${year}-09-01`;
  const autumnEnd = termEnd(term) || (winter ? plus(winter.start, -1) : `${year}-12-20`);
  const winterSession = winter || {start:plus(autumnEnd, 1), end:`${year + 1}-01-24`};
  const springStart = mondayFrom(`${year + 1}-02-07`);
  const springEnd = spring ? plus(spring.start, -1) : `${year + 1}-05-24`;
  const springSession = spring || {start:`${year + 1}-05-25`, end:`${year + 1}-06-30`};
  return [
    {kind:'classes', name:'Осенний семестр', start:autumnStart, end:autumnEnd, estimated:!term && !winter},
    {kind:'session', name:'Зимняя сессия', ...winterSession, estimated:!winter},
    {kind:'break', name:'Зимние каникулы', start:plus(winterSession.end, 1), end:plus(springStart, -1), estimated:!winter},
    {kind:'classes', name:'Весенний семестр', start:springStart, end:springEnd, estimated:!spring},
    {kind:'session', name:'Летняя сессия', ...springSession, estimated:!spring},
    {kind:'break', name:'Летние каникулы', start:plus(springSession.end, 1), end:`${year + 1}-08-31`, estimated:!spring},
  ].filter(p => p.start <= p.end);
}

// What period a date is in; sessions win where they overlap the last days of classes.
export function periodOn(plan, date) {
  const hits = plan.filter(p => date >= p.start && date <= p.end);
  return hits.find(p => p.kind === 'session') || hits[0] || null;
}
