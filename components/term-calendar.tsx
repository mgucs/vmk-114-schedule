import {useState} from 'react';
import {holidayOn, weekOf} from '../lib/term.mjs';
import {periodOn, yearPlan} from '../lib/academic-year.mjs';
import type {Session} from './session';

type Term = {start:string; end:string; odd:boolean}[] | null;
type Mark = {kind:'exam'|'credit'; time:string; subject:string; room:string};
type Period = {kind:'classes'|'session'|'break'; name:string; start:string; end:string; estimated:boolean};

const plus = (iso:string, n:number) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday = (iso:string) => (new Date(iso+'T12:00:00Z').getUTCDay()+6)%7;
const monthName = (iso:string) => { const m = new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{month:'long', year:'numeric', timeZone:'UTC'}).replace(' г.',''); return m[0].toUpperCase()+m.slice(1); };
const dayLong = (iso:string) => new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'long', day:'numeric', month:'long', timeZone:'UTC'});
const dayShort = (iso:string) => new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric', month:'long', timeZone:'UTC'});
const span = (a:string, b:string) => a.slice(5,7)===b.slice(5,7) ? `${Number(a.slice(8))}–${dayShort(b)}` : `${dayShort(a)} – ${dayShort(b)}`;
const cap = (s:string) => s[0].toUpperCase()+s.slice(1);
const days = (a:string, b:string) => Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const plural = (n:number, f:[string,string,string]) => f[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2];
const shortDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const label = (y:number) => `${y}/${String(y+1).slice(2)}`;

function marksOf(sessions:Session[], group:string) {
  const out = new Map<string, Mark[]>();
  for (const session of sessions) {
    for (const e of session.exams[group] || []) out.set(e.date, [...(out.get(e.date) || []), {kind:'exam', time:e.time, subject:e.subject, room:e.room}]);
    for (const c of session.credits[group] || []) out.set(c.date, [...(out.get(c.date) || []), {kind:'credit', time:c.time, subject:c.subject, room:c.room}]);
  }
  for (const list of out.values()) list.sort((a,b) => a.time.localeCompare(b.time));
  return out;
}

// The academic year on one page: classes, sessions, vacations and holidays; a tap on a day tells what happens then.
// The current year shows this group's timetable; the previous one is drawn from its archived sessions.
export function TermCalendar({term, sessions, group, today, academicYear, classesOn, openDay}:{term:Term; sessions:Session[]; group:string; today:string; academicYear:number;
  classesOn:(date:string)=>number; openDay:(date:string)=>void}) {
  const [year, setYear] = useState(academicYear);
  const past = year < academicYear;
  const [selected, setSelected] = useState(today);
  const [showPast,setShowPast]=useState(false);
  const own = sessions.filter(s => s.year===year);
  const plan = yearPlan(year, {term:past ? null : term, sessions:own}) as Period[];
  const autumn = plan[0], classesEnd = autumn.end;
  const marks = marksOf(own, group);
  const fiit = Number(group) >= 140;
  const lessons = (date:string) => past ? 0 : classesOn(date);
  const hasLastYear = sessions.some(s => s.year===academicYear-1);
  // The current year runs to the end of the winter break; a past year is shown whole.
  const winterBreak = plan.find(p => p.name==='Зимние каникулы');
  const first = `${year}-09-01`, last = past ? `${year+1}-08-31` : (winterBreak?.end || `${year+1}-02-28`);
  const months:string[] = [];
  for (let m = first; m <= last; m = plus(m, 32).slice(0,8)+'01') months.push(m.slice(0,8)+'01');
  const focus = past ? (selected.startsWith(String(year)) || selected.startsWith(String(year+1)) ? selected : first) : selected;

  function pick(next:number) { setYear(next); setSelected(next<academicYear ? `${next}-09-01` : today); setShowPast(false); }

  function describe(date:string) {
    const holiday = holidayOn(date), list = marks.get(date) || [], n = lessons(date), period = periodOn(plan, date);
    const lines:string[] = [];
    if (holiday) lines.push(`${holiday} — выходной`);
    for (const m of list) lines.push(`${m.kind==='exam' ? 'Экзамен' : 'Зачёт'}: ${m.subject}${m.time ? `, ${m.time}` : ''}${m.room ? `, ауд. ${m.room}` : ''}`);
    if (!holiday && n) lines.push(`${n} ${plural(n,['пара','пары','пар'])}${fiit && weekOf(term, date) ? ` · ${weekOf(term, date)!.odd ? 'нечётная' : 'чётная'} неделя` : ''}`);
    if (!past && date === classesEnd) lines.push('Последний день занятий');
    if (period && (period.kind!=='classes' || past) && !list.length) lines.push(`${period.name}, ${span(period.start, period.end)}${period.estimated ? ' (примерно)' : ''}`);
    else if (!past && !holiday && !n && !list.length && period?.kind==='classes')
      lines.push(date < autumn.start ? 'Занятия ещё не начались' : 'Пар нет');
    if (!period && !holiday && !list.length) lines.push('Учебный год ещё не начался');
    return lines;
  }

  const upcoming = past ? undefined : [...marks.entries()].filter(([d]) => d >= today).sort()[0];
  const weeksLeft = !past && today <= classesEnd ? Math.ceil(days(today, classesEnd)/7) : 0;
  const nextBreak = plan.find(p => p.kind==='break' && p.end >= today);
  // Key dates: every period of the year, holidays (the New Year days as one line), then this group's session.
  const key:[string,string][] = plan.map(p => [p.start, p.kind==='classes' ? `${p.name}: занятия ${span(p.start, p.end)}${p.estimated ? ' (примерно)' : ''}`
    : `${p.name}: ${span(p.start, p.end)}${p.estimated ? ' (примерно)' : ''}`]);
  for (let d = first; d <= last; d = plus(d, 1)) {
    const name = holidayOn(d);
    if (!name || /-01-0[2-8]$/.test(d)) continue;
    key.push([d, d.endsWith('-01-01') ? 'Новогодние праздники, 1–8 января' : name]);
  }
  key.sort((a,b) => a[0].localeCompare(b[0]));
  const winterSession = plan.find(p => p.name==='Зимняя сессия');

  return <section className="term">
    <div className="term-head-row">
      <h1 className="session-title">Календарь</h1>
      {hasLastYear && <div className="term-years" role="group" aria-label="Учебный год">
        <button aria-pressed={!past} onClick={()=>pick(academicYear)}>{label(academicYear)}</button>
        <button aria-pressed={past} onClick={()=>pick(academicYear-1)}>{label(academicYear-1)}</button>
      </div>}
    </div>
    <p className="term-sub">{past ? `Учебный год ${label(year)} · прошлый, по архиву сессий ВМК` : `Осенний семестр ${label(year)}`}</p>
    <div className="term-facts">
      {past ? <>
        <div><b>Сессии</b><span>{plan.filter(p=>p.kind==='session').map(p=>span(p.start,p.end)).join(' и ')}</span></div>
        <div><b>Каникулы</b><span>{plan.filter(p=>p.kind==='break').map(p=>span(p.start,p.end)).join(' и ')}</span></div>
      </> : <>
        {weeksLeft > 0 && <div><b>{weeksLeft} {plural(weeksLeft,['неделя','недели','недель'])}</b><span>до конца занятий, {dayShort(classesEnd)}</span></div>}
        {upcoming ? <div><b>{days(today, upcoming[0]) === 0 ? 'сегодня' : `через ${days(today, upcoming[0])} ${plural(days(today, upcoming[0]),['день','дня','дней'])}`}</b><span>{upcoming[1][0].kind==='exam' ? 'экзамен' : 'зачёт'}: {upcoming[1][0].subject}</span></div>
          : <div><b>Сессия</b><span>{own.some(s=>s.season==='winter') ? 'зачётов и экзаменов впереди нет' : `ВМК опубликует даты в конце декабря; обычно ${winterSession ? span(winterSession.start, winterSession.end) : 'конец декабря – январь'}`}</span></div>}
        {nextBreak && <div><b>Каникулы</b><span>{span(nextBreak.start, nextBreak.end)}{nextBreak.estimated ? ', примерно' : ''}</span></div>}
      </>}
    </div>

    <div className="term-day" aria-live="polite">
      <strong>{cap(dayLong(focus))}</strong>
      {describe(focus).map(l => <p key={l}>{l}</p>)}
      {lessons(focus) > 0 && !holidayOn(focus) && <button className="text-button" onClick={()=>openDay(focus)}>Открыть в расписании</button>}
    </div>

    {!past && months.some(m=>m.slice(0,7)<today.slice(0,7)) && <button className="calendar-history text-button" aria-expanded={showPast} onClick={()=>setShowPast(v=>!v)}>{showPast?'Скрыть прошедшие месяцы':'Показать прошедшие месяцы'}</button>}
    {months.filter(month=>past || showPast || month.slice(0,7)>=today.slice(0,7)).map(month => {
      const lead = weekday(month), count = days(month, plus(month, 32).slice(0,8)+'01');
      const cells = [...Array(lead).fill(''), ...Array.from({length:count}, (_, i) => plus(month, i))];
      return <section className="term-month" key={month}>
        <h2>{monthName(month)}</h2>
        <div className={`term-grid ${fiit && !past ? 'with-weeks' : ''}`}>
          {fiit && !past && <span className="term-head"/>}
          {shortDays.map(d => <span key={d} className="term-head">{d}</span>)}
          {Array.from({length:Math.ceil(cells.length/7)}, (_, row) => {
            const week = cells.slice(row*7, row*7+7);
            const monday = week.find(Boolean) as string;
            const parity = fiit && !past ? weekOf(term, monday)?.odd : undefined;
            return [fiit && !past && <span key={'w'+row} className="term-week" title={parity==null ? '' : parity ? 'нечётная неделя' : 'чётная неделя'}>{parity==null ? '' : parity ? 'н' : 'ч'}</span>,
              ...week.map((date, i) => date ? (() => {
                const holiday = !!holidayOn(date), list = marks.get(date) || [], period = periodOn(plan, date), n = lessons(date);
                const cls = ['term-cell', holiday ? 'holiday' : '', list.some(m => m.kind==='exam') ? 'exam' : list.length ? 'credit' : '',
                  !holiday && n ? 'classes' : '',
                  !holiday && !n && !list.length && period?.kind==='break' ? 'vacation' : '',
                  !holiday && !n && !list.length && period?.kind==='session' ? 'session-day' : '',
                  !past && !holiday && !n && period?.kind==='classes' && date >= autumn.start && date <= classesEnd ? 'rest' : '',
                  date===today ? 'today' : '', date===focus ? 'selected' : ''].filter(Boolean).join(' ');
                return <button key={date} className={cls} aria-pressed={date===focus} aria-label={dayLong(date)} onClick={()=>setSelected(date)}>{Number(date.slice(8))}</button>;
              })() : <span key={row*7+i}/>)];
          })}
        </div>
      </section>;
    })}

    <div className="term-legend">
      {!past && <span><i className="l-classes"/>есть пары</span>}{!past && <span><i className="l-rest"/>выходной</span>}
      <span><i className="l-holiday"/>праздник</span><span><i className="l-session"/>сессия</span><span><i className="l-vacation"/>каникулы</span>
      <span><i className="l-credit"/>зачёт</span><span><i className="l-exam"/>экзамен</span>
      {fiit && !past && <span><b>н</b>/<b>ч</b> — чётность недели</span>}
    </div>

    <section className="term-dates">
      <h2>Важные даты {label(year)}</h2>
      {/* Periods, holidays and this group's exams and credits in one list by date. */}
      <ul>{[...key.map(([d, text]) => ({d, text, kind:''})), ...[...marks.entries()].flatMap(([d, list]) => list.map(m => ({d, text:`${m.kind==='exam' ? 'Экзамен' : 'Зачёт'}: ${m.subject}`, kind:m.kind})))]
        .sort((a, b) => a.d.localeCompare(b.d)).map(({d, text, kind}, i) => <li key={d+text+i} className={kind}><span>{dayShort(d)}</span>{text}</li>)}
      </ul>
      {plan.some(p=>p.estimated) && <p className="session-muted">«Примерно» — по обычному календарю МГУ: зимние каникулы с конца сессии до начала весеннего семестра (первый понедельник после 7 февраля), летние — до 31 августа. Точные даты появятся, когда ВМК опубликует расписание сессии.</p>}
      {!past && !own.length && hasLastYear && <p className="session-muted">Как было в прошлом году — переключатель {label(academicYear-1)} вверху.</p>}
    </section>
  </section>;
}
