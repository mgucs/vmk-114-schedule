import {useMemo, useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from './ui/dialog';
import {courseCounts, differs, termDates, usual, weekDates} from '../lib/term-stats.mjs';

type Table = {year:number; groups:Record<string,{page:number; lessons:any[]}>};
type Term = {start:string; end:string; odd:boolean}[] | null;
type Row = {lecture:number; class:number; consultation:number; total:number; done:number};
type Stream = {title:string; groups:string[]};

const plus = (iso:string, n:number) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const short = (iso:string) => new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU', {day:'numeric', month:'short', timeZone:'UTC'}).replace('.', '');
const empty:Row = {lecture:0, class:0, consultation:0, total:0, done:0};

// «Сколько пар»: one group by subject, or every group side by side; a week or the whole term.
export function StatsDialog({open, onOpenChange, table, term, group, today, clock, streams}:{open:boolean; onOpenChange:(v:boolean)=>void;
  table:Table; term:Term; group:string; today:string; clock:string; streams:Stream[]}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="changes-dialog wide stats-dialog">
    <DialogTitle>Сколько пар</DialogTitle>
    <DialogDescription>По текущему расписанию: праздники, даты «с …» / «только …» и чётность недель ФИИТ учтены. Пара с подгруппами — одна пара.</DialogDescription>
    {open && <Stats table={table} term={term} group={group} today={today} clock={clock} streams={streams}/>}
  </DialogContent></Dialog>;
}

function Stats({table, term, group, today, clock, streams}:{table:Table; term:Term; group:string; today:string; clock:string; streams:Stream[]}) {
  const [span, setSpan] = useState<'week'|'term'>('week');
  const [mode, setMode] = useState<'group'|'all'>('group');
  const [week, setWeek] = useState(() => weekDates(today)[0]);
  const [shown, setShown] = useState(group);
  const [stream, setStream] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(true);
  const dates = useMemo(() => span==='week' ? weekDates(week) : termDates(table, term), [span, week, table, term]);
  const data = useMemo(() => courseCounts(table, term, dates, {date:today, clock}) as {groups:string[]; subjects:string[]; counts:Record<string,Record<string,Row>>}, [table, term, dates, today, clock]);
  const hasConsult = data.subjects.some(s => data.groups.some(g => data.counts[g][s]?.consultation));
  const first = dates[0], last = dates.at(-1)!;

  const controls = <div className="stats-controls">
    <div className="segmented" role="group" aria-label="Период">
      <button aria-pressed={span==='week'} onClick={()=>setSpan('week')}>Неделя</button><button aria-pressed={span==='term'} onClick={()=>setSpan('term')}>Семестр</button>
    </div>
    <div className="segmented" role="group" aria-label="Что показать">
      <button aria-pressed={mode==='group'} onClick={()=>setMode('group')}>Группа</button><button aria-pressed={mode==='all'} onClick={()=>setMode('all')}>Все группы</button>
    </div>
    {span==='week' && <div className="stats-week">
      <button aria-label="Предыдущая неделя" onClick={()=>setWeek(plus(week, -7))}><ChevronLeft size={16}/></button>
      <span>{short(first)} – {short(last)}{first<=today && today<=plus(last,1) ? ' · эта неделя' : ''}</span>
      <button aria-label="Следующая неделя" onClick={()=>setWeek(plus(week, 7))}><ChevronRight size={16}/></button>
    </div>}
  </div>;

  if (mode==='group') {
    const name = data.counts[shown] ? shown : group, counts = data.counts[name];
    const rows = data.subjects.filter(s => counts[s]?.total);
    const sum = (k:keyof Row) => rows.reduce((n, s) => n + counts[s][k], 0);
    const max = Math.max(1, ...rows.map(s => counts[s].total));
    return <>
      {controls}
      <div className="stats-groups" role="group" aria-label="Группа">
        {data.groups.map(g => <button key={g} aria-pressed={g===name} className={g===group ? 'mine' : ''} onClick={()=>setShown(g)}>{g}</button>)}
      </div>
      {rows.length ? <table className="stats-table">
        <thead><tr><th scope="col">Предмет</th><th scope="col" title="Лекции">Лек.</th><th scope="col" title="Семинары и практикумы">Сем.</th>
          {hasConsult && <th scope="col" title="Консультации">Конс.</th>}<th scope="col">Всего</th>{span==='term' && <th scope="col">Прошло</th>}</tr></thead>
        <tbody>{rows.map(s => { const r = counts[s]; return <tr key={s}>
          <th scope="row">{s}<i style={{width:`${r.total/max*100}%`}} aria-hidden="true"/></th>
          <td>{r.lecture || '—'}</td><td>{r.class || '—'}</td>{hasConsult && <td>{r.consultation || '—'}</td>}<td><b>{r.total}</b></td>{span==='term' && <td>{r.done}</td>}
        </tr>; })}</tbody>
        <tfoot><tr><th scope="row">Итого · {name}</th><td>{sum('lecture')}</td><td>{sum('class')}</td>{hasConsult && <td>{sum('consultation')}</td>}<td><b>{sum('total')}</b></td>{span==='term' && <td>{sum('done')}</td>}</tr></tfoot>
      </table> : <p className="personal-hint">В эти дни пар нет.</p>}
    </>;
  }

  const groups = stream ? streams.find(s => s.title===stream)?.groups || data.groups : data.groups;
  const rows = data.subjects.filter(s => groups.some(g => data.counts[g][s]?.total) && (!onlyDiff || differs(data.counts, groups, s)));
  const totals = Object.fromEntries(groups.map(g => [g, Object.values(data.counts[g]).reduce((n, r) => n + r.total, 0)]));
  const totalUsual = usual(Object.fromEntries(groups.map(g => [g, {'': {...empty, total:totals[g]}}])), groups, '');
  return <>
    {controls}
    <div className="stats-filters">
      <div className="stats-groups" role="group" aria-label="Поток">
        <button aria-pressed={!stream} onClick={()=>setStream('')}>Все</button>
        {streams.map(s => <button key={s.title} aria-pressed={stream===s.title} onClick={()=>setStream(s.title)}>{s.title}</button>)}
      </div>
      <label className="stats-toggle"><input type="checkbox" checked={onlyDiff} onChange={e=>setOnlyDiff(e.target.checked)}/> Только отличающиеся</label>
    </div>
    <div className="stats-matrix-wrap">
      <table className="stats-matrix">
        <thead><tr><th scope="col">Предмет</th>{groups.map(g => <th scope="col" key={g} className={g===group ? 'mine' : ''}>{g}</th>)}</tr></thead>
        <tbody>{rows.map(s => { const u = usual(data.counts, groups, s); return <tr key={s}>
          <th scope="row">{s}</th>
          {groups.map(g => { const r = data.counts[g][s] || empty; return <td key={g} className={[g===group ? 'mine' : '', r.total!==u ? 'odd' : ''].join(' ')}
            title={`${g}: лекций ${r.lecture}, семинаров ${r.class}${r.consultation ? `, консультаций ${r.consultation}` : ''}`}>{r.total || '—'}</td>; })}
        </tr>; })}</tbody>
        <tfoot><tr><th scope="row">Всего пар</th>{groups.map(g => <td key={g} className={[g===group ? 'mine' : '', totals[g]!==totalUsual ? 'odd' : ''].join(' ')}>{totals[g]}</td>)}</tr></tfoot>
      </table>
    </div>
    {!rows.length && <p className="personal-hint">{onlyDiff ? 'По предметам у этих групп всё одинаково.' : 'В эти дни пар нет.'}</p>}
    <p className="session-muted">Выделены числа, которые отличаются от большинства групп.</p>
  </>;
}
