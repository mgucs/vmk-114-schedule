import {useState, type ReactNode} from 'react';
import {ArrowUpRight} from 'lucide-react';

export type Exam = {date:string; time:string; room:string; subject:string; lecturer:string};
export type Credit = {date:string; time:string; room:string; subject:string; teachers:string[]};
export type ExamInfo = {short:string; name:string; lecturer:string; position:string; program:string; control?:string[]};
export type Session = {title:string; season:string; year:number; sources:{url:string; label:string}[];
  lists:Record<string,ExamInfo[]>; exams:Record<string,Exam[]>; credits:Record<string,Credit[]>};

const seasons:Record<string,string> = {winter:'Зимняя сессия', spring:'Весенняя сессия', summer:'Летняя сессия'};
const short:Record<string,string> = {winter:'зима', spring:'весна', summer:'лето'};
const years = (s:Session) => `${s.year}/${String(s.year+1).slice(2)}`;
const daysBetween = (a:string, b:string) => Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const plural = (n:number, forms:[string,string,string]) => forms[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2];
const inDays = (n:number) => n===0 ? 'сегодня' : n===1 ? 'завтра' : `через ${n} ${plural(n,['день','дня','дней'])}`;
const longDate = (iso:string) => new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'long', day:'numeric', month:'long', timeZone:'UTC'});
const cap = (s:string) => s[0].toUpperCase()+s.slice(1);

type Item = {kind:'exam'|'credit'; date:string; time:string; room:string; subject:string; people:string[]};

// Only a session of the current academic year is the real one; older ones are kept for comparison.
export function isCurrent(session:Session|null|undefined, academicYear:number) { return !!session && session.year===academicYear; }

type Props = {session:Session|null; archive:Session[]; lecturers?:Record<string,string>; group:string; today:string; academicYear:number; classesEnd:string;
  room:(name:string, date:string, start:string)=>ReactNode; teacher:(name:string)=>ReactNode};

// Subject names differ slightly between files ("Математический анализ I"); compare by the first letters.
const key = (s:string) => s.toLowerCase().replace(/ё/g,'е').replace(/[^а-я]/g,'').slice(0, 12);

export function SessionView({session, archive, lecturers = {}, group, today, academicYear, classesEnd, room, teacher}:Props) {
  const current = isCurrent(session, academicYear) ? session : null;
  // Past sessions, the one of the coming season first: in autumn last winter is the closest comparison.
  const coming = Number(today.slice(5,7)) >= 8 || Number(today.slice(5,7)) === 1 ? 'winter' : 'spring';
  const past = [...(current || !session ? [] : [session]), ...archive].filter((s, i, all) => all.findIndex(o => o.title===s.title)===i)
    .sort((a, b) => Number(b.season===coming)-Number(a.season===coming) || b.year-a.year);
  const [shown, setShown] = useState('');
  const view = past.find(s => s.title===shown) || current;
  const compare = past.length > 0 && <div className="session-compare">
    <span>Для сравнения:</span>{past.map(s => <button key={s.title} aria-pressed={s.title===shown} onClick={()=>setShown(s.title===shown ? '' : s.title)}>{short[s.season] || s.season} {years(s)}</button>)}
  </div>;

  if (!view) return <section className="session">
    <h1 className="session-title">Сессия</h1>
    <div className="session-empty">
      <p>ВМК ещё не опубликовал расписание зимней сессии. Обычно оно появляется в конце декабря — в прошлом году 25 декабря.</p>
      <p>Приложение проверяет сайт каждые 15 минут и покажет здесь все зачёты и экзамены твоей группы, как только они появятся.</p>
      {classesEnd && <p className="session-muted">Занятия идут до {new Date(classesEnd+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric', month:'long', timeZone:'UTC'})}.</p>}
    </div>
    {compare}
  </section>;

  const live = view===current;
  const items:Item[] = [
    // The winter exam list names no lecturer; for the current session the lecturer of this term's lectures stands in.
    ...(view.exams[group] || []).map(e => { const who = e.lecturer || (view===current ? lecturers[key(e.subject)] || '' : '');
      return {kind:'exam' as const, date:e.date, time:e.time, room:e.room, subject:e.subject, people:who ? [who] : []}; }),
    ...(view.credits[group] || []).map(c => ({kind:'credit' as const, date:c.date, time:c.time, room:c.room, subject:c.subject, people:c.teachers})),
  ].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const next = live ? items.find(i => i.date >= today) : undefined;
  const days = [...new Set(items.map(i => i.date))];
  const list = view.lists[group] || [];
  const listed = list.some(e => e.control?.some(c => c.startsWith('зачёт')));
  const creditSubjects = listed ? [] : [...new Set((view.credits[group] || []).map(c => c.subject))];

  return <section className={`session ${live ? '' : 'archived'}`}>
    <h1 className="session-title">{seasons[view.season] || 'Сессия'} {years(view)}</h1>
    {!live && <p className="session-note">Прошлая сессия — чтобы представить, как пройдёт следующая: сколько зачётов, какие перерывы между экзаменами.{current ? '' : ' Расписание новой появится здесь само.'}</p>}
    {compare}
    {next && <div className="session-next">
      <b>{inDays(daysBetween(today, next.date))}</b>
      <span>{next.kind==='exam' ? 'Экзамен' : 'Зачёт'} · {next.subject}{next.time ? `, ${next.time}` : ''}</span>
    </div>}
    {!items.length && <p className="session-muted">В расписании сессии нет группы {group}. Проверь оригинальные файлы ниже.</p>}
    {days.map(date => <section className="session-day" key={date}>
      <h2>{cap(longDate(date))}
        {live && date >= today && <span> · {inDays(daysBetween(today, date))}</span>}
        {(() => {
          // Days to prepare: counted from the previous exam, not from credits.
          const prev = [...items].reverse().find(i => i.kind==='exam' && i.date < date);
          if (!prev || !items.some(i => i.date===date && i.kind==='exam')) return null;
          const n = daysBetween(prev.date, date);
          return <span className="session-gap"> · {n} {plural(n,['день','дня','дней'])} после прошлого экзамена</span>;
        })()}
      </h2>
      {items.filter(i => i.date===date).map((i, n) => <article key={n} className={`session-item ${i.kind} ${live && date < today ? 'past' : ''}`}>
        <span className="session-time">{i.time || '—'}</span>
        <div className="session-body">
          <span className="session-kind">{i.kind==='exam' ? 'Экзамен' : 'Зачёт'}</span>
          <h3>{i.subject}</h3>
          {i.people.length > 0 && <p>{i.people.map((p, m) => <span key={p}>{m > 0 && ', '}{teacher(p)}</span>)}</p>}
        </div>
        {i.room && <span className="session-room">{room(i.room, date, i.time)}</span>}
      </article>)}
    </section>)}
    {(list.length > 0 || creditSubjects.length > 0) && <section className="session-what">
      <h2>Что сдаём</h2>
      <ul>
        {list.map(e => <li key={e.name}>
          <span className={`session-kind ${e.control?.includes('экзамен') ? '' : 'credit'}`}>{cap((e.control || ['экзамен']).join(', '))}</span>
          <strong>{e.name}</strong>
          {e.lecturer && <small>{teacher(e.lecturer)}{e.position ? `, ${e.position.toLowerCase()}` : ''}</small>}
        </li>)}
        {creditSubjects.map(s => <li key={s}><span className="session-kind credit">Зачёт</span><strong>{s}</strong></li>)}
      </ul>
    </section>}
    {view.sources.length > 0 && <div className="source-links session-sources">{view.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label}<ArrowUpRight size={14}/></a>)}</div>}
  </section>;
}
