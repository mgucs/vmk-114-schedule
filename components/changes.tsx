import {useState} from 'react';
import {ArrowRight, ArrowUpRight, Minus, Plus, RefreshCw} from 'lucide-react';

export type Change = {id:string; day:number; start:string; title?:string; before?:string; after?:string; details?:string[]};
export type HistoryEntry = {date:string; previousDate:string|null; detectedAt:string; pdfChanged:boolean; changes:Record<string,Change[]>; previousPdf?:string};

const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const asset = (path:string) => import.meta.env.BASE_URL + path.replace(/^\//,'');
const stamp = (iso:string) => new Date(iso).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
const plural = (n:number,f:[string,string,string]) => f[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2];

// "101–104, 108": consecutive group numbers joined into ranges.
export function groupRanges(names:string[]) {
  const out:string[] = [];
  for (const n of [...names].sort()) {
    const last = out.at(-1)?.split('–'), end = last && Number(last.at(-1));
    if (last && end === Number(n)-1) out[out.length-1] = `${last[0]}–${n}`; else out.push(n);
  }
  return out.join(', ');
}

// The server writes each difference as "Время: 08:45–10:20 → 09:00–10:20"; here it becomes a row «было → стало».
type Row = {label:string; from?:string; to?:string; text?:string};
function rowsOf(change:Change):{kind:'added'|'removed'|'changed'; when?:string; rows:Row[]} {
  const details = change.details || [];
  const added = details.find(d => d.startsWith('Новая пара:'));
  if (added) return {kind:'added', when:added.match(/(\d{2}:\d{2}–\d{2}:\d{2})$/)?.[1], rows:[]};
  if (details.some(d => d.startsWith('Пара убрана:'))) return {kind:'removed', rows:[]};
  return {kind:'changed', rows:details.map(d => {
    const m = d.match(/^([^:]+?):\s(.*?)\s→\s(.*)$/s);
    return m ? {label:m[1], from:m[2], to:m[3]} : {label:'', text:d==='Изменена запись в PDF' ? 'Текст в PDF изменился, но время, место и преподаватель те же' : d};
  })};
}
const kindNames = {added:'Новая пара', removed:'Пары больше нет', changed:'Изменилась'};
const kindIcons = {added:<Plus size={13}/>, removed:<Minus size={13}/>, changed:<RefreshCw size={12}/>};

export function ChangeCard({change, groups, mine}:{change:Change; groups?:string[]; mine?:boolean}) {
  const {kind, when, rows} = rowsOf(change);
  return <article className={`change-card ${kind}`}>
    <header>
      <span className="change-when"><b>{days[change.day]}</b> {when || change.start}</span>
      <span className={`change-kind ${kind}`}>{kindIcons[kind]}{kindNames[kind]}</span>
    </header>
    <h5 className={kind==='removed' ? 'gone' : ''}>{change.title || 'Пара'}</h5>
    {rows.length>0 && <dl className="change-rows">{rows.map((r, i) => r.label
      ? <div key={i}><dt>{r.label}</dt><dd><s>{r.from}</s><ArrowRight size={13} aria-label="стало"/><b>{r.to}</b></dd></div>
      : <div key={i} className="plain"><dd>{r.text}</dd></div>)}</dl>}
    {groups && <p className={`change-groups ${mine ? 'mine' : ''}`}>{groups.length===1 ? 'Группа' : 'Группы'} {groupRanges(groups)}{mine ? (groups.length===1 ? ' · твоя' : ' · и твоя') : ''}</p>}
  </article>;
}

// One VMK update: the chosen group by default; «Все группы» shows each distinct change once with the groups it concerns.
export function UpdateEntry({entry, group, all, pdf, open}:{entry:HistoryEntry; group:string; all:string[]; pdf?:string; open:boolean}) {
  const changed = Object.keys(entry.changes).filter(name => entry.changes[name].length).sort();
  const [view, setView] = useState<string>(changed.includes(group) || !changed.length ? group : 'all');
  const sortKey = (c:Change) => c.day*10000 + Number(c.start.replace(':',''));
  const merged = new Map<string,{change:Change; groups:string[]}>();
  for (const name of changed) for (const c of entry.changes[name]) {
    const key = [c.id, c.title, ...(c.details || [])].join('|');
    const item = merged.get(key) || {change:c, groups:[]};
    item.groups.push(name); merged.set(key, item);
  }
  const everyone = [...merged.values()].sort((a,b) => b.groups.length-a.groups.length || sortKey(a.change)-sortKey(b.change));
  const list = view==='all' ? [] : [...(entry.changes[view] || [])].sort((a,b) => sortKey(a)-sortKey(b));
  const count = (kind:string) => (view==='all' ? everyone.map(e => e.change) : list).filter(c => rowsOf(c).kind===kind).length;
  const unchanged = all.filter(name => !changed.includes(name));
  return <section className={`update ${open ? 'open' : ''}`}>
    <header className="update-head">
      <div>
        <h4>Расписание от {entry.date}</h4>
        <small>{entry.previousDate && entry.previousDate!==entry.date ? `было от ${entry.previousDate} · ` : ''}замечено {stamp(entry.detectedAt)}</small>
      </div>
      {(entry.previousPdf || pdf) && <div className="update-pdfs">
        {entry.previousPdf && <a href={asset(entry.previousPdf)} target="_blank" rel="noreferrer">PDF до<ArrowUpRight size={13}/></a>}
        {pdf && <a href={asset(pdf)} target="_blank" rel="noreferrer">PDF после<ArrowUpRight size={13}/></a>}
      </div>}
    </header>
    {!entry.pdfChanged ? <p className="personal-hint">На сайте ВМК сменилась только дата, сам PDF тот же — пары не менялись.</p> : !changed.length ? <p className="personal-hint">PDF обновлён, но ни у одной группы пары не поменялись.</p> : <>
      <div className="update-scope" role="group" aria-label="Чьи изменения показать">
        <button aria-pressed={view===group} className="mine" onClick={()=>setView(group)}>Моя · {group}</button>
        <button aria-pressed={view==='all'} onClick={()=>setView('all')}>Все группы</button>
        {changed.filter(name => name!==group).map(name => <button key={name} aria-pressed={view===name} onClick={()=>setView(name)}>{name}</button>)}
      </div>
      {(view==='all' || list.length>0) && <p className="update-summary">
        {view==='all' ? `Изменения у ${changed.length} ${plural(changed.length,['группы','групп','групп'])}: ` : `У группы ${view}: `}
        {[['added','новых','новая','новые'],['changed','изменилось','изменилась','изменились'],['removed','убрано','убрана','убраны']].map(([kind,many,one,few]) => { const n = count(kind); return n ? <span key={kind} className={`sum ${kind}`}>{n} {plural(n,[one,few,many])}</span> : null; })}
      </p>}
      <div className="change-list">
        {view==='all' ? everyone.map(e => <ChangeCard key={e.groups.join()+e.change.id+(e.change.details||[]).join()} change={e.change} groups={e.groups} mine={e.groups.includes(group)}/>)
          : list.length ? list.map(c => <ChangeCard key={c.id} change={c}/>)
          : <p className="update-none">У группы {view} в этой версии ничего не поменялось.</p>}
      </div>
      {view==='all' && unchanged.length>0 && <p className="personal-hint">Без изменений: {groupRanges(unchanged)}</p>}
    </>}
  </section>;
}
