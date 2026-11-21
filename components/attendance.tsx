import {useCallback, useEffect, useState} from 'react';
import {cleanTitle} from '../lib/schedule-model.mjs';

const storageKey = 'vmk-absences-v1';

function loadAbsences(raw:string|null):Set<string> {
  try {
    const value:unknown = JSON.parse(raw || '[]');
    return new Set(Array.isArray(value) ? value.filter((id):id is string => typeof id==='string') : []);
  } catch { return new Set(); }
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
  const toggle = useCallback((id:string) => {
    try {
      const next = loadAbsences(localStorage.getItem(storageKey));
      if (!next.delete(id)) next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      setMarked(next);
    } catch {
      setMarked(previous => {
        const next = new Set(previous);
        if (!next.delete(id)) next.add(id);
        return next;
      });
    }
  }, []);
  return {marked,toggle};
}

export const absenceId = (group:string,date:string,lesson:{id:string;title:string}) => JSON.stringify([group,date,lesson.id,cleanTitle(lesson)]);

export function AbsenceButton({subject, pressed, onToggle}:{subject:string;pressed:boolean;onToggle:()=>void}) {
  const label = pressed ? 'Снять отметку об отсутствии' : 'Отметить отсутствие';
  return <button type="button" className="absence-button" aria-label={`Отсутствие: ${subject}`} aria-pressed={pressed} title={label}
    onClick={event => { event.stopPropagation(); onToggle(); }}>н</button>;
}
