import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {Dialog, DialogContent, DialogTitle, DialogDescription} from './ui/dialog';
import {occursOn, person, personKey, searchIndex} from '../lib/search.mjs';
import directory from '../public/people.json';
import type {Session} from './session';

type Person = {name:string; url:string; position:string; degree:string; istina:string};
const people = (directory as {people:Record<string,Person>}).people;
const shortDays = ['Пн','Вт','Ср','Чт','Пт','Сб'];

// Tapping a teacher's name opens their card.
export const OpenTeacher = createContext<(name:string)=>void>(()=>{});
export function TeacherName({name}:{name:string}) {
  const open = useContext(OpenTeacher);
  return <button className="teacher-link" onClick={event=>{event.stopPropagation();open(name);}}>{name}</button>;
}

type Row = {key:string; day:number; start:string; end:string; title:string; type:string; teacher:string; room:string; groups:string[]};
// "This week" is the week the search uses (the coming one on Sunday); session is only the current one.
export function useTeacherCard({table, session, dates, term, room}:{table:any; session:Session|null; dates:string[]; term:any; room:(name:string, day:number, start:string)=>ReactNode}) {
  const [name, setName] = useState('');
  const index = useMemo(() => searchIndex(table) as Row[], [table]);
  const key = name ? personKey(name) : '';
  const found = key ? people[key] : undefined;
  const classes = index.filter(r => r.teacher && personKey(r.teacher)===key && occursOn(r, dates[r.day], term)).sort((a,b) => a.day-b.day || a.start.localeCompare(b.start));
  const exams = session ? Object.entries(session.lists).flatMap(([group, list]) => list.filter(e => personKey(e.lecturer)===key).map(e => ({group, name:e.name}))) : [];
  const examSubjects = [...new Set(exams.map(e => e.name))];
  const dialog = <Dialog open={!!name} onOpenChange={open=>{if(!open)setName('');}}><DialogContent className="changes-dialog teacher-card">
    <DialogTitle>{found?.name || person(name)}</DialogTitle>
    <DialogDescription>{found ? [found.position, found.degree].filter(Boolean).join(' · ') || 'Сотрудник ВМК' : 'Нет в справочнике сотрудников ВМК — возможно, преподаёт с другого факультета.'}</DialogDescription>
    {examSubjects.length > 0 && <p className="teacher-exam">Принимает экзамен: {examSubjects.join(', ')}</p>}
    {classes.length > 0 && <section className="teacher-classes">
      <h4>Пары на неделе</h4>
      <ul>{classes.map(r => <li key={r.key}>
        <span className="teacher-when">{shortDays[r.day]} {r.start}</span>
        <span className="teacher-what"><strong>{r.title}</strong><small>{r.groups.length > 4 ? `${r.groups[0]}–${r.groups.at(-1)}` : r.groups.join(', ')}</small></span>
        {r.room && <span onClick={()=>setName('')}>{room(r.room, r.day, r.start)}</span>}
      </li>)}</ul>
    </section>}
    {found && <div className="source-links">
      <a href={found.url} target="_blank" rel="noreferrer">Страница на сайте ВМК<ArrowUpRight size={14}/></a>
      {found.istina && <a href={found.istina} target="_blank" rel="noreferrer">Профиль в ИСТИНЕ<ArrowUpRight size={14}/></a>}
    </div>}
  </DialogContent></Dialog>;
  return {open:setName, dialog};
}
