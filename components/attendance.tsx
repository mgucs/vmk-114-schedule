import {useCallback, useEffect, useState} from 'react';
import {ChevronRight} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from './ui/dialog';
import {cleanTitle} from '../lib/schedule-model.mjs';

const storageKey = 'vmk-absences-v1';

function loadAbsences(raw:string|null):Set<string> {
  try {
    const value:unknown = JSON.parse(raw || '[]');
    return new Set(Array.isArray(value) ? value.filter((id):id is string => typeof id==='string') : []);
  } catch { return new Set(); }
}

function toggleMarks(previous:Set<string>, ids:string[]) {
  const next = new Set(previous);
  const clear = ids.every(id=>next.has(id));
  for (const id of ids) {
    if (clear) next.delete(id);
    else next.add(id);
  }
  return next;
}

export function useAbsences() {
  const [marked,setMarked] = useState(() => {
    try { return loadAbsences(localStorage.getItem(storageKey)); }
    catch { return new Set<string>(); }
  });
  useEffect(() => {
    const sync = (event:StorageEvent) => {
      if (event.key===storageKey || event.key===null) setMarked(loadAbsences(event.newValue));
    };
    window.addEventListener('storage',sync);
    return () => window.removeEventListener('storage',sync);
  }, []);
  const toggle = useCallback((ids:string[]) => {
    try {
      const next = toggleMarks(loadAbsences(localStorage.getItem(storageKey)),ids);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      setMarked(next);
    } catch {
      setMarked(previous=>toggleMarks(previous,ids));
    }
  }, []);
  return {marked,toggle};
}

export const absenceId = (group:string,date:string,lesson:{id:string;title:string}) => JSON.stringify([group,date,lesson.id,cleanTitle(lesson)]);

export function absenceDays(marked:Set<string>, group:string) {
  const days = new Map<string,{id:string;time:string;title:string}[]>();
  for (const id of marked) {
    try {
      const value:unknown = JSON.parse(id);
      if (!Array.isArray(value)) continue;
      const [savedGroup,date,lessonId,title] = value;
      if (savedGroup!==group || typeof date!=='string' || !/^20\d\d-\d\d-\d\d$/.test(date) || typeof title!=='string' || typeof lessonId!=='string') continue;
      const stamp = new Date(date+'T12:00:00Z');
      if (!Number.isFinite(stamp.getTime()) || stamp.toISOString().slice(0,10)!==date) continue;
      const time = lessonId.match(/^\d-(\d\d:\d\d)/)?.[1];
      if (!time) continue;
      const lessons = days.get(date) || [];
      lessons.push({id,time,title});
      days.set(date,lessons);
    } catch { /* Ignore invalid stored entries. */ }
  }
  return [...days.entries()].sort(([a],[b])=>b.localeCompare(a)).map(([date,lessons])=>({date,lessons:lessons.sort((a,b)=>a.time.localeCompare(b.time))}));
}

export function DayAbsenceButton({pressed, onToggle}:{pressed:boolean;onToggle:()=>void}) {
  return <button type="button" className="absence-button absence-day" aria-pressed={pressed}
    aria-label="Пропустил весь день" title={pressed ? 'Снять отметки за весь день' : 'Отметить все пары этого дня'}
    onClick={event=>{event.stopPropagation();onToggle();}}>{pressed ? 'Весь день отмечен' : 'Пропустил весь день'}</button>;
}

export function AbsenceHistory({open,onOpenChange,days,label,onPick}:{open:boolean;onOpenChange:(open:boolean)=>void;
  days:ReturnType<typeof absenceDays>;label:(date:string)=>string;onPick:(date:string)=>void}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="changes-dialog absence-history">
    <DialogTitle>Пропуски</DialogTitle>
    <DialogDescription>{days.length ? 'Нажми на дату, чтобы открыть расписание дня.' : 'Пока нет отметок. Нажми «н» у пары или отметь весь день в расписании.'}</DialogDescription>
    {days.length>0 && <ul className="absence-list">{days.map(({date,lessons})=><li key={date}>
      <button type="button" onClick={()=>onPick(date)}><time dateTime={date}>{label(date)}</time><ChevronRight size={17} aria-hidden="true"/></button>
      <ul>{lessons.map(lesson=><li key={lesson.id}><span>{lesson.time}</span>{lesson.title}</li>)}</ul>
    </li>)}</ul>}
  </DialogContent></Dialog>;
}

export function AbsenceButton({subject, pressed, onToggle}:{subject:string;pressed:boolean;onToggle:()=>void}) {
  const label = pressed ? 'Снять отметку об отсутствии' : 'Отметить отсутствие';
  return <button type="button" className="absence-button" aria-label={`Отсутствие: ${subject}`} aria-pressed={pressed} title={label}
    onClick={event => { event.stopPropagation(); onToggle(); }}>н</button>;
}
