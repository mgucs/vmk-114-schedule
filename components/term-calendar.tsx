import {useState} from 'react';
import {holidayOn, termEnd, termStart, weekOf} from '../lib/term.mjs';
import type {Session} from './session';

type Term = {start:string; end:string; odd:boolean}[] | null;
type Mark = {kind:'exam'|'credit'; time:string; subject:string; room:string};

const plus = (iso:string, n:number) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday = (iso:string) => (new Date(iso+'T12:00:00Z').getUTCDay()+6)%7;
const monthName = (iso:string) => { const m = new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{month:'long', year:'numeric', timeZone:'UTC'}).replace(' г.',''); return m[0].toUpperCase()+m.slice(1); };
const dayLong = (iso:string) => new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'long', day:'numeric', month:'long', timeZone:'UTC'});
const dayShort = (iso:string) => new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric', month:'long', timeZone:'UTC'});
const cap = (s:string) => s[0].toUpperCase()+s.slice(1);
const days = (a:string, b:string) => Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const plural = (n:number, f:[string,string,string]) => f[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2];
const shortDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function marksOf(session:Session|null, group:string) {
  const out = new Map<string, Mark[]>();
  if (!session) return out;
  for (const e of session.exams[group] || []) out.set(e.date, [...(out.get(e.date) || []), {kind:'exam', time:e.time, subject:e.subject, room:e.room}]);
  for (const c of session.credits[group] || []) out.set(c.date, [...(out.get(c.date) || []), {kind:'credit', time:c.time, subject:c.subject, room:c.room}]);
  for (const list of out.values()) list.sort((a,b) => a.time.localeCompare(b.time));
  return out;
}

// The whole term on one page: classes, holidays, the session; a tap on a day tells what happens then.
export function TermCalendar({term, session, lastWinter, group, today, academicYear, classesOn, openDay}:{term:Term; session:Session|null; lastWinter:Session|null; group:string; today:string; academicYear:number;
  classesOn:(date:string)=>number; openDay:(date:string)=>void}) {
  const [selected, setSelected] = useState(today);
  const [showPast,setShowPast]=useState(false);
  const start = termStart(term) || `${academicYear}-09-01`, end = termEnd(term) || `${academicYear}-12-31`;
  const marks = marksOf(session, group);
  const fiit = Number(group) >= 140;
  const first = `${academicYear}-09-01`, last = `${academicYear+1}-02-28`;
  const months:string[] = [];
  for (let m = first; m <= last; m = plus(m, 32).slice(0,8)+'01') months.push(m.slice(0,8)+'01');

  function describe(date:string) {
    const holiday = holidayOn(date), list = marks.get(date) || [], n = classesOn(date);
    const lines:string[] = [];
    if (holiday) lines.push(`${holiday} — выходной`);
    for (const m of list) lines.push(`${m.kind==='exam' ? 'Экзамен' : 'Зачёт'}: ${m.subject}${m.time ? `, ${m.time}` : ''}${m.room ? `, ауд. ${m.room}` : ''}`);
    if (!holiday && n) lines.push(`${n} ${plural(n,['пара','пары','пар'])}${fiit && weekOf(term, date) ? ` · ${weekOf(term, date)!.odd ? 'нечётная' : 'чётная'} неделя` : ''}`);
    if (date === end) lines.push('Последний день занятий');
    else if (!holiday && !n && !list.length)
      lines.push(date > end ? (session ? 'Нет зачётов и экзаменов' : 'Занятий уже нет — впереди зачёты и сессия') : date < start ? 'Занятия ещё не начались' : 'Пар нет');
    return lines;
  }

  const upcoming = [...marks.entries()].filter(([d]) => d >= today).sort()[0];
  const weeksLeft = today <= end ? Math.ceil(days(today, end)/7) : 0;
  // Key dates: start and end of classes, holidays (the New Year days as one line), then the session.
  const key:[string,string][] = [[start, 'Начало занятий'], [end, 'Последний день занятий']];
  for (let d = first; d <= last; d = plus(d, 1)) {
    const name = holidayOn(d);
    if (!name) continue;
    if (/-01-0[2-8]$/.test(d)) continue;
    key.push([d, d.endsWith('-01-01') ? 'Новогодние праздники, 1–8 января' : name]);
  }
  key.sort((a,b) => a[0].localeCompare(b[0]));

  const winter = lastWinter ? marksOf(lastWinter, group) : new Map<string,Mark[]>();
  const winterExams = [...winter.entries()].flatMap(([d, list]) => list.filter(m => m.kind==='exam').map(m => ({d, ...m}))).sort((a,b) => a.d.localeCompare(b.d));
  const winterCredits = [...winter.entries()].filter(([, list]) => list.some(m => m.kind==='credit')).map(([d]) => d).sort();

  return <section className="term">
    <h1 className="session-title">Календарь</h1>
    <p className="term-sub">Осенний семестр {academicYear}/{String(academicYear+1).slice(2)}</p>
    <div className="term-facts">
      {weeksLeft > 0 && <div><b>{weeksLeft} {plural(weeksLeft,['неделя','недели','недель'])}</b><span>до конца занятий, {dayShort(end)}</span></div>}
      {upcoming ? <div><b>{days(today, upcoming[0]) === 0 ? 'сегодня' : `через ${days(today, upcoming[0])} ${plural(days(today, upcoming[0]),['день','дня','дней'])}`}</b><span>{upcoming[1][0].kind==='exam' ? 'экзамен' : 'зачёт'}: {upcoming[1][0].subject}</span></div>
        : <div><b>Сессия</b><span>{session ? 'зачётов и экзаменов впереди нет' : 'даты ВМК опубликует в конце декабря'}</span></div>}
    </div>

    <div className="term-day" aria-live="polite">
      <strong>{cap(dayLong(selected))}</strong>
      {describe(selected).map(l => <p key={l}>{l}</p>)}
      {classesOn(selected) > 0 && !holidayOn(selected) && <button className="text-button" onClick={()=>openDay(selected)}>Открыть в расписании</button>}
    </div>

    {months.some(m=>m.slice(0,7)<today.slice(0,7)) && <button className="calendar-history text-button" aria-expanded={showPast} onClick={()=>setShowPast(v=>!v)}>{showPast?'Скрыть прошедшие месяцы':'Показать прошедшие месяцы'}</button>}
    {!showPast && months.every(m=>m.slice(0,7)<today.slice(0,7)) && <p className="session-muted">Этот семестр завершён. Его календарь доступен в прошедших месяцах.</p>}
    {months.filter(month=>showPast || month.slice(0,7)>=today.slice(0,7)).map(month => {
      const lead = weekday(month), count = days(month, plus(month, 32).slice(0,8)+'01');
      const cells = [...Array(lead).fill(''), ...Array.from({length:count}, (_, i) => plus(month, i))];
      return <section className="term-month" key={month}>
        <h2>{monthName(month)}</h2>
        <div className={`term-grid ${fiit ? 'with-weeks' : ''}`}>
          {fiit && <span className="term-head"/>}
          {shortDays.map(d => <span key={d} className="term-head">{d}</span>)}
          {Array.from({length:Math.ceil(cells.length/7)}, (_, row) => {
            const week = cells.slice(row*7, row*7+7);
            const monday = week.find(Boolean) as string;
            const parity = fiit ? weekOf(term, monday)?.odd : undefined;
            return [fiit && <span key={'w'+row} className="term-week" title={parity==null ? '' : parity ? 'нечётная неделя' : 'чётная неделя'}>{parity==null ? '' : parity ? 'н' : 'ч'}</span>,
              ...week.map((date, i) => date ? (() => {
                const holiday = !!holidayOn(date), list = marks.get(date) || [];
                const cls = ['term-cell', holiday ? 'holiday' : '', list.some(m => m.kind==='exam') ? 'exam' : list.length ? 'credit' : '',
                  !holiday && classesOn(date) ? 'classes' : '', !holiday && !classesOn(date) && date >= start && date <= end ? 'rest' : '', date===today ? 'today' : '', date===selected ? 'selected' : '', date > end ? 'after' : ''].filter(Boolean).join(' ');
                return <button key={date} className={cls} aria-pressed={date===selected} aria-label={dayLong(date)} onClick={()=>setSelected(date)}>{Number(date.slice(8))}</button>;
              })() : <span key={row*7+i}/>)];
          })}
        </div>
      </section>;
    })}

    <div className="term-legend">
      <span><i className="l-classes"/>есть пары</span><span><i className="l-rest"/>выходной</span><span><i className="l-holiday"/>праздник</span><span><i className="l-credit"/>зачёт</span><span><i className="l-exam"/>экзамен</span>
      {fiit && <span><b>н</b>/<b>ч</b> — чётность недели</span>}
    </div>

    <section className="term-dates">
      <h2>Важные даты</h2>
      <ul>{key.map(([d, label]) => <li key={d+label}><span>{dayShort(d)}</span>{label}</li>)}
        {[...marks.entries()].sort().map(([d, list]) => list.map((m, i) => <li key={d+i} className={m.kind}><span>{dayShort(d)}</span>{m.kind==='exam' ? 'Экзамен' : 'Зачёт'}: {m.subject}</li>))}
      </ul>
      {!session && <p className="session-muted">Зачёты и экзамены появятся здесь, как только ВМК опубликует расписание зимней сессии.</p>}
    </section>

    {!session && lastWinter && (winterExams.length > 0 || winterCredits.length > 0) && <section className="term-dates">
      <h2>Как было прошлой зимой</h2>
      {winterCredits.length > 0 && <p>Зачёты: {dayShort(winterCredits[0])} – {dayShort(winterCredits.at(-1)!)}</p>}
      <ul>{winterExams.map(e => <li key={e.d+e.subject}><span>{dayShort(e.d)}</span>Экзамен: {e.subject}</li>)}</ul>
      <p className="session-muted">Для ориентира: в этом году даты будут другими.</p>
    </section>}
  </section>;
}
