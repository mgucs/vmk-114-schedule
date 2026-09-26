import {useMemo,useState,type ReactNode} from 'react';
import {Search,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {occursOn,searchIndex,searchLessons} from '../lib/search.mjs';

type Row={key:string;day:number;start:string;end:string;title:string;type:string;teacher:string;room:string;rule:{from?:string;dates?:string[]}|null;week:''|'odd'|'even';groups:string[]};
const shortDays=['Пн','Вт','Ср','Чт','Пт','Сб'];
const typeNames:Record<string,string>={lecture:'Лекция',consultation:'Конс.',sport:'Спорт'};
const examples=['Ким','анализ','606','118'];

// Where and when any class of the first course happens: by teacher, subject, room or group.
// `dates` holds this week's date for every weekday, so one-off classes are shown only on their day.
export function useSearch({table,term,dates,today,clock,group,room}:{table:any;term:{start:string;end:string;odd:boolean}[]|null;dates:string[];today:string;clock:string;group:string;room:(name:string,date:string,start:string)=>ReactNode}){
  const index=useMemo(()=>searchIndex(table) as Row[],[table]);
  const todayDay=dates.indexOf(today);
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[day,setDay]=useState<number|null>(null);
  const shownDay=day ?? (todayDay>=0&&todayDay<6?todayDay:0);
  const onDate=(row:Row)=>occursOn(row,dates[row.day],term);
  const results=(searchLessons(index,query,shownDay) as Row[]).filter(onDate);
  const button=<button className="icon-button" aria-label="Поиск по всем группам" title="Поиск: преподаватель, предмет, аудитория" onClick={()=>{setDay(null);setOpen(true);}}><Search size={18}/></button>;
  const dialog=<Dialog open={open} onOpenChange={setOpen}><DialogContent className="changes-dialog search-dialog">
    <DialogTitle>Поиск</DialogTitle>
    <DialogDescription>Преподаватель, предмет, аудитория или группа — по всему первому курсу.</DialogDescription>
    <label className="search-field"><Search size={17}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например, Ким или 606" enterKeyHint="search" aria-label="Что искать"/>
      {query&&<button aria-label="Очистить" onClick={()=>setQuery('')}><X size={16}/></button>}</label>
    <div className="search-days" role="group" aria-label="День недели">{shortDays.map((name,i)=><button key={name} aria-pressed={shownDay===i} className={i===todayDay?'today':''} onClick={()=>setDay(i)}>{name}</button>)}</div>
    {!query.trim() ? <div className="search-examples">{examples.map(text=><button key={text} onClick={()=>setQuery(text)}>{text}</button>)}</div>
    : results.length ? <ol className="search-results">{results.map(row=>{
        const now=dates[row.day]===today&&clock>=row.start&&clock<row.end;
        return <li key={row.key} className={`${row.type} ${now?'current':''}`}>
          <span className="search-time">{row.start}<small>{row.end}</small></span>
          <div className="search-body">
            <strong>{row.title}{typeNames[row.type]&&<em>{typeNames[row.type]}</em>}{now&&<em className="search-now">идёт</em>}</strong>
            {row.teacher&&<span>{row.teacher}</span>}
            <span className="search-groups">{row.groups.length>4?`${row.groups[0]}–${row.groups.at(-1)}`:row.groups.join(', ')}{row.groups.includes(group)&&<b> · твоя</b>}</span>
          </div>
          {row.room&&<span className="search-room" onClick={()=>setOpen(false)}>{room(row.room,dates[row.day],row.start)}</span>}
        </li>;})}</ol>
    : <p className="personal-hint">В {['понедельник','вторник','среду','четверг','пятницу','субботу'][shownDay]} ничего не нашлось{searchLessons(index,query,null).length?' — попробуй другой день.':'.'}</p>}
  </DialogContent></Dialog>;
  return {button,dialog};
}
