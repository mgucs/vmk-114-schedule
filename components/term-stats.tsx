import {useState} from 'react';
import {cleanTitle, groupSchedule} from '../lib/schedule-model.mjs';
import {lessonsOn} from '../lib/day-glance.mjs';
import {termEnd, termStart} from '../lib/term.mjs';

type Lesson = {id:string; day:number; start:string; end:string; title:string; type:string};
type Table = {year:number; groups:Record<string,{page:number; lessons:any[]}>};
type Term = {start:string; end:string; odd:boolean}[] | null;
type Row = {subject:string; lectures:number; classes:number; total:number; done:number};

const plus = (iso:string, n:number) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);

// Every class of the term for one group, by subject: holidays, date limits and ФИИТ week parity are counted as in the timetable.
export function termCounts(table:Table, term:Term, group:string, today:string, clock:string) {
  const schedule = {...groupSchedule(table, group), term};
  const from = termStart(term) || `${table.year}-09-01`, to = termEnd(term) || `${table.year}-12-31`;
  const rows = new Map<string,Row>();
  for (let date = from; date <= to; date = plus(date, 1)) for (const l of lessonsOn(schedule, date) as Lesson[]) {
    const subject = cleanTitle(l);
    const row = rows.get(subject) || {subject, lectures:0, classes:0, total:0, done:0};
    if (l.type==='lecture') row.lectures++; else row.classes++;
    row.total++;
    if (date < today || (date===today && l.end <= clock)) row.done++;
    rows.set(subject, row);
  }
  return [...rows.values()].sort((a,b) => b.total-a.total || a.subject.localeCompare(b.subject, 'ru'));
}

// "Пары за семестр": how many classes of each subject a group has, lectures apart; any group can be picked for comparison.
export function TermStats({table, term, group, today, clock}:{table:Table; term:Term; group:string; today:string; clock:string}) {
  const names = Object.keys(table.groups).sort();
  const [shown, setShown] = useState(group);
  const current = table.groups[shown] ? shown : group;
  const rows = termCounts(table, term, current, today, clock);
  const sum = (key:keyof Omit<Row,'subject'>) => rows.reduce((n, r) => n + r[key], 0);
  const max = Math.max(1, ...rows.map(r => r.total));
  return <section className="term-stats" aria-label="Пары за семестр">
    <h2>Пары за семестр</h2>
    <div className="stats-groups" role="group" aria-label="Группа">
      {names.map(name => <button key={name} aria-pressed={name===current} className={name===group ? 'mine' : ''} onClick={()=>setShown(name)}>{name}</button>)}
    </div>
    <table className="stats-table">
      <thead><tr><th scope="col">Предмет</th><th scope="col" title="Лекции">Лек.</th><th scope="col" title="Семинары, практикумы, консультации">Сем.</th><th scope="col">Всего</th><th scope="col">Прошло</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.subject}>
        <th scope="row">{r.subject}<i style={{width:`${r.total/max*100}%`}} aria-hidden="true"/></th>
        <td>{r.lectures || '—'}</td><td>{r.classes || '—'}</td><td><b>{r.total}</b></td><td>{r.done}</td>
      </tr>)}</tbody>
      <tfoot><tr><th scope="row">Итого{current!==group ? ` · ${current}` : ''}</th><td>{sum('lectures')}</td><td>{sum('classes')}</td><td><b>{sum('total')}</b></td><td>{sum('done')}</td></tr></tfoot>
    </table>
    <p className="session-muted">По текущему расписанию с учётом праздников{Number(current) >= 140 ? ', чётности недель' : ''} и дат «с …» / «только …». Пара с подгруппами считается одной.</p>
  </section>;
}
