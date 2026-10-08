import {memo, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {holidayOn, weekOf} from '../lib/term.mjs';
import {periodOn, yearPlan} from '../lib/academic-year.mjs';
import type {Session} from './session';

type Term = {start:string; end:string; odd:boolean}[] | null;
type Mark = {kind:'exam'|'credit'; time:string; subject:string; room:string};
type Period = {kind:'classes'|'session'|'break'; name:string; start:string; end:string; estimated:boolean};

// Date formatters are made once: making one (toLocaleDateString makes one each call) is slow, and a year of months
// names a few hundred days.
const formats = new Map<string,Intl.DateTimeFormat>();
const fmt = (options:Intl.DateTimeFormatOptions) => {
  const key = JSON.stringify(options);
  let f = formats.get(key); if (!f) { f = new Intl.DateTimeFormat('ru-RU', {...options, timeZone:'UTC'}); formats.set(key, f); } return f;
};
const at = (iso:string) => new Date(iso+'T12:00:00Z');
const plus = (iso:string, n:number) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday = (iso:string) => (at(iso).getUTCDay()+6)%7;
const cap = (s:string) => s[0].toUpperCase()+s.slice(1);
const monthOnly = (iso:string) => cap(fmt({month:'long'}).format(at(iso)));
const dayLong = (iso:string) => fmt({weekday:'long', day:'numeric', month:'long'}).format(at(iso));
const dayShort = (iso:string) => fmt({day:'numeric', month:'long'}).format(at(iso));
// «21 дек», «1 сент»: the short month without its dot, never torn from its number.
const dayAbbr = (iso:string) => fmt({day:'numeric', month:'short'}).format(at(iso)).replace('.','').replace(' ',' ');
const span = (a:string, b:string) => a.slice(5,7)===b.slice(5,7) ? `${Number(a.slice(8))}–${dayShort(b)}` : `${dayShort(a)} – ${dayShort(b)}`;
const spanAbbr = (a:string, b:string) => a.slice(5,7)===b.slice(5,7) ? `${Number(a.slice(8))}–${dayAbbr(b)}` : `${dayAbbr(a)} – ${dayAbbr(b)}`;
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

// One month: always six weeks, so the card keeps its height from month to month; days of the neighbouring months
// fill the corners, faint. The look of a day is worked out once (look keeps it until the year or the timetable
// changes); a month redraws only when the chosen day comes into it or leaves it.
const Month = memo(function Month({month, look, weeks, term, selected, onPick}:{month:string; look:(date:string)=>[string,string]; weeks:boolean; term:Term; selected:string; onPick:(date:string)=>void}) {
  const start = plus(month, -weekday(month));
  return <section className="term-month" aria-label={`${monthOnly(month)} ${month.slice(0,4)}`}>
    <h2>{monthOnly(month)} <span>{month.slice(0,4)}</span></h2>
    <div className={`term-grid ${weeks ? 'with-weeks' : ''}`}>
      {weeks && <span className="term-head"/>}
      {shortDays.map(d => <span key={d} className="term-head">{d}</span>)}
      {Array.from({length:6}, (_, row) => {
        const monday = plus(start, row*7), parity = weeks ? weekOf(term, monday)?.odd : undefined;
        return [weeks && <span key={'w'+row} className="term-week" title={parity==null ? '' : parity ? 'нечётная неделя' : 'чётная неделя'}>{parity==null ? '' : parity ? 'н' : 'ч'}</span>,
          ...Array.from({length:7}, (_, k) => {
            const date = plus(monday, k), day = Number(date.slice(8));
            if (date.slice(0,7)!==month.slice(0,7)) return <span key={date} className="term-cell outside" aria-hidden="true"><span className="n">{day}</span></span>;
            const [cls, name] = look(date);
            return <button key={date} className={date===selected ? cls+' selected' : cls} aria-pressed={date===selected} aria-label={name} onClick={()=>onPick(date)}><span className="n">{day}</span></button>;
          })];
      })}
    </div>
  </section>;
});

// The academic year, month by month as in the iPhone's Calendar: the month is the first thing on the page and turns
// with a swipe (a native snap scroller; the arrows do the same). Sessions and vacations are bands under the numbers,
// a day has one dot — classes, a credit or an exam — and holidays are red. Under the month: the chosen day, three
// short facts and the year's dates (a tap on one turns the month to it).
// The current year shows this group's timetable; the previous one is drawn from its archived sessions.
// dataKey changes when the saved timetable does (the days' look is kept until then).
export function TermCalendar({term, sessions, group, today, academicYear, classesOn, openDay, dataKey}:{term:Term; sessions:Session[]; group:string; today:string; academicYear:number;
  classesOn:(date:string)=>number; openDay:(date:string)=>void; dataKey:string}) {
  const [year, setYear] = useState(academicYear);
  const past = year < academicYear;
  const [selected, setSelected] = useState(today);
  const fiit = Number(group) >= 140, weeks = fiit && !past;
  const lessons = (date:string) => past ? 0 : classesOn(date);
  const hasLastYear = sessions.some(s => s.year===academicYear-1);

  const {own, plan, marks, months, first, last, look} = useMemo(() => {
    const own = sessions.filter(s => s.year===year);
    const plan = yearPlan(year, {term:past ? null : term, sessions:own}) as Period[];
    const marks = marksOf(own, group);
    // The current year runs to the end of the winter break; a past year is shown whole.
    const winterBreak = plan.find(p => p.name==='Зимние каникулы');
    const first = `${year}-09-01`, last = past ? `${year+1}-08-31` : (winterBreak?.end || `${year+1}-02-28`);
    const months:string[] = [];
    for (let m = first; m <= last; m = plus(m, 32).slice(0,8)+'01') months.push(m.slice(0,8)+'01');
    // Each day: its band (session or vacation), its dot and the colour of its number — worked out when its month is
    // first drawn, then kept.
    const autumn = plan[0];
    const bandOf = (date:string) => { const p = periodOn(plan, date); return p?.kind==='session' ? 'session' : p?.kind==='break' ? 'vacation' : ''; };
    const cache = new Map<string,[string,string]>();
    const look = (date:string):[string,string] => {
      const known = cache.get(date); if (known) return known;
      const holiday = !!holidayOn(date), list = marks.get(date) || [], period = periodOn(plan, date), n = past ? 0 : classesOn(date), band = bandOf(date), col = weekday(date);
      const cls = ['term-cell',
        band && `band ${band}`, band && period?.estimated && 'est',
        band && (col===0 || date.endsWith('-01') || bandOf(plus(date,-1))!==band) && 'b-start',
        band && (col===6 || plus(date,1).slice(0,7)!==date.slice(0,7) || bandOf(plus(date,1))!==band) && 'b-end',
        list.some(m => m.kind==='exam') ? 'exam' : list.length ? 'credit' : !holiday && n ? 'classes' : '',
        holiday && 'holiday',
        !past && !holiday && !n && !list.length && period?.kind==='classes' && date >= autumn.start && date <= autumn.end && 'off',
        date===today && 'today'].filter(Boolean).join(' ');
      const out:[string,string] = [cls, dayLong(date)]; cache.set(date, out); return out;
    };
    return {own, plan, marks, months, first, last, look};
  }, [year, group, today, dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const autumn = plan[0], classesEnd = autumn.end;
  const focus = past ? (selected.startsWith(String(year)) || selected.startsWith(String(year+1)) ? selected : first) : selected;
  const monthIndex = (iso:string) => Math.max(0, months.findIndex(m => m.slice(0,7)===iso.slice(0,7)));

  // The month in view lives in the scroller, not in React: turning a month redraws nothing. The arrows and «Сегодня»
  // follow it through their attributes.
  const pager = useRef<HTMLDivElement>(null), prev = useRef<HTMLButtonElement>(null), next = useRef<HTMLButtonElement>(null), back = useRef<HTMLButtonElement>(null);
  const state = useRef({focus, count:months.length, home:monthIndex(today), past});
  state.current = {focus, count:months.length, home:monthIndex(today), past};
  function sync() {
    const el = pager.current; if (!el) return;
    const i = Math.round(el.scrollLeft/Math.max(1, el.clientWidth)), s = state.current;
    if (prev.current) prev.current.disabled = i<=0;
    if (next.current) next.current.disabled = i>=s.count-1;
    back.current?.toggleAttribute('data-on', !s.past && (i!==s.home || s.focus!==today));
  }
  function turn(i:number, smooth=true) {
    const el = pager.current; if (!el) return;
    el.scrollTo({left:Math.max(0, Math.min(months.length-1, i))*el.clientWidth, behavior:smooth ? 'smooth' : 'auto'});
  }
  function current() { const el = pager.current; return el ? Math.round(el.scrollLeft/Math.max(1, el.clientWidth)) : 0; }
  // A year opens on the chosen day's month (today's in the current year, September in a past one).
  useLayoutEffect(() => { turn(monthIndex(focus), false); sync(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = pager.current; if (!el) return;
    let frame = 0;
    const on = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); }); };
    el.addEventListener('scroll', on, {passive:true});
    const resize = new ResizeObserver(() => { turn(current(), false); sync(); }); resize.observe(el);
    return () => { el.removeEventListener('scroll', on); resize.disconnect(); cancelAnimationFrame(frame); };
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(sync, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // The month in view and its neighbours are drawn at once, the rest of the year a moment later: the tab opens faster.
  const [whole, setWhole] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWhole(true), 300); return () => clearTimeout(t); }, []);

  function pick(next:number) { setYear(next); setSelected(next<academicYear ? `${next}-09-01` : today); }
  function goTo(date:string, top=false) { setSelected(date); turn(monthIndex(date)); if (top) scrollTo({top:0, behavior:'smooth'}); }

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
  const winterSession = plan.find(p => p.name==='Зимняя сессия');
  const approx = (p?:Period) => p?.estimated ? '≈ ' : '';
  // The year's dates: every period, holidays (the New Year days as one line), then this group's exams and credits.
  const rows:{d:string; title:string; note:string; kind:string}[] = plan.map(p => ({d:p.start, kind:p.kind,
    title:p.name, note:approx(p)+(p.kind==='classes' ? `занятия по ${dayAbbr(p.end)}` : `по ${dayAbbr(p.end)}`)}));
  for (let d = first; d <= last; d = plus(d, 1)) {
    const name = holidayOn(d);
    if (!name || /-01-0[2-8]$/.test(d)) continue;
    rows.push(d.endsWith('-01-01') ? {d, title:'Новогодние праздники', note:'1–8 янв', kind:'holiday'} : {d, title:name, note:'', kind:'holiday'});
  }
  for (const [d, list] of marks) for (const m of list) rows.push({d, title:`${m.kind==='exam' ? 'Экзамен' : 'Зачёт'}: ${m.subject}`, note:m.time, kind:m.kind});
  rows.sort((a,b) => a.d.localeCompare(b.d));

  return <section className="term">
    <div className="term-head-row">
      <h1 className="session-title">Календарь</h1>
      {hasLastYear && <div className="term-years" role="group" aria-label="Учебный год">
        <button aria-pressed={!past} onClick={()=>pick(academicYear)}>{label(academicYear)}</button>
        <button aria-pressed={past} onClick={()=>pick(academicYear-1)}>{label(academicYear-1)}</button>
      </div>}
    </div>
    {past && <p className="term-sub">Прошлый год — по архиву сессий ВМК</p>}

    <div className="term-cal">
      <div className="term-nav">
        {!past && <button ref={back} className="term-today" onClick={()=>goTo(today)}>Сегодня</button>}
        <button ref={prev} aria-label="Предыдущий месяц" onClick={()=>turn(current()-1)}><ChevronLeft size={20}/></button>
        <button ref={next} aria-label="Следующий месяц" onClick={()=>turn(current()+1)}><ChevronRight size={20}/></button>
      </div>
      <div className="term-pager" ref={pager} key={year} aria-label="Месяцы">
        {months.map((month, i) => whole || Math.abs(i-monthIndex(focus))<=1
          ? <Month key={month} month={month} look={look} weeks={weeks} term={term} selected={focus.slice(0,7)===month.slice(0,7) ? focus : ''} onPick={setSelected}/>
          : <section key={month} className="term-month" aria-hidden="true"/>)}
      </div>
      <div className="term-legend">
        {!past && <span><i className="l-classes"/>пары</span>}
        <span><i className="l-credit"/>зачёт</span><span><i className="l-exam"/>экзамен</span>
        <span><i className="l-session"/>сессия</span><span><i className="l-vacation"/>каникулы</span>
        <span><b className="l-holiday">7</b>праздник</span>
        {weeks && <span><b>н</b>/<b>ч</b> неделя</span>}
      </div>
    </div>

    <div className="term-day" aria-live="polite">
      <div><strong>{cap(dayLong(focus))}</strong>{describe(focus).map(l => <p key={l}>{l}</p>)}</div>
      {lessons(focus) > 0 && !holidayOn(focus) && <button className="term-open" onClick={()=>openDay(focus)}>Открыть</button>}
    </div>

    <div className="term-facts">
      {past ? <>
        <div><b>Сессии</b><span>{plan.filter(p=>p.kind==='session').map(p=>spanAbbr(p.start,p.end)).join(' и ')}</span></div>
        <div><b>Каникулы</b><span>{plan.filter(p=>p.kind==='break').map(p=>spanAbbr(p.start,p.end)).join(' и ')}</span></div>
      </> : <>
        {weeksLeft > 0 && <div><b>{weeksLeft} {plural(weeksLeft,['неделя','недели','недель'])}</b><span>занятия до {dayAbbr(classesEnd)}</span></div>}
        {upcoming ? <div><b>{days(today, upcoming[0]) === 0 ? 'Сегодня' : `Через ${days(today, upcoming[0])} ${plural(days(today, upcoming[0]),['день','дня','дней'])}`}</b><span>{upcoming[1][0].kind==='exam' ? 'экзамен' : 'зачёт'}: {upcoming[1][0].subject}</span></div>
          : <div><b>Сессия</b><span>{own.some(s=>s.season==='winter') ? 'впереди ничего нет' : winterSession ? approx(winterSession)+spanAbbr(winterSession.start, winterSession.end) : 'конец декабря – январь'}</span></div>}
        {nextBreak && <div><b>Каникулы</b><span>{approx(nextBreak)}{spanAbbr(nextBreak.start, nextBreak.end)}</span></div>}
      </>}
    </div>

    <section className="term-dates">
      <h2>Даты {label(year)}</h2>
      <ul>{rows.map(({d, title, note, kind}, i) => <li key={d+title+i} className={`${kind} ${!past && d<today ? 'gone' : ''}`}>
        <button onClick={()=>goTo(d, true)}><span>{dayAbbr(d)}</span><span><b>{title}</b>{note && <small>{note}</small>}</span></button>
      </li>)}</ul>
      {plan.some(p=>p.estimated) && <p className="term-note">≈ — примерно, по обычному календарю МГУ. Точные даты появятся, когда ВМК опубликует расписание сессии.</p>}
      {!past && !own.length && hasLastYear && <p className="term-note">Как было в прошлом году — {label(academicYear-1)} вверху.</p>}
    </section>
  </section>;
}
