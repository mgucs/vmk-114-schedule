import {useEffect,useRef,useState} from 'react';
import {Palette,NotebookPen,Check,CalendarPlus} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {StylePreview} from './style-preview';
import {calendarFile} from '../lib/calendar.mjs';

// name, label, scheme, swatch colours (background, lecture, now)
export const THEMES = [
  ['snow','Снег','light',['#f6f7f9','#3b6fe0','#e5484d']], ['fog','Туман','light',['#e9edf1','#5b7896','#d9735b']],
  ['mint','Мята','light',['#edf5f1','#2e9a74','#e0604e']], ['lavender','Лаванда','light',['#f3f1f9','#7b66d6','#df5a86']],
  ['pearl','Жемчуг','light',['#f6f3ed','#9a7738','#16151a']], ['paper','Бумага','light',['#f3efe6','#f5c518','#ff5a36']],
  ['spring','Весна','light',['#f1f5ec','#6dbb5a','#ea4f8a']], ['summer','Лето','light',['#fff6e3','#ffae1f','#ff4e2e']],
  ['msu','МГУ','dark',['#0b1030','#d8b45c','#2a3aa8']], ['msu-classic','МГУ классика','dark',['#090d24','#e3bd55','#9aa3cf']], ['midnight','Полночь','dark',['#111120','#9f8cff','#ff7eb0']],
  ['ocean','Океан','dark',['#0b161b','#4cc2c4','#ff8a73']], ['forest','Лес','dark',['#0e1512','#74c98f','#ffae6b']],
  ['steel','Сталь','dark',['#17181b','#7aa7ff','#ff7a7a']], ['onyx','Оникс','dark',['#0d0d0f','#c9a96e','#ece7de']],
  ['night','Ночь','dark',['#15130f','#e8b923','#ff6a48']], ['graphite','Графит','dark',['#111214','#b8f34a','#ff4f8b']],
  ['winter','Зима','dark',['#0b1220','#6ea8ff','#ff6b9a']], ['autumn','Осень','dark',['#17100b','#ea7a36','#ff5e3a']],
] as const;
// Layout and type, independent of the colour theme.
export const STYLES = [
  ['atelier','Журнал','Антиква и тонкие линейки'],
  ['minimal','Минимал','Время, предмет, аудитория'],
  ['timeline','Лента','Шкала времени и карточки'],
  ['cards','Карточки','Как в приложениях iOS'],
  ['glass','Стекло','Матовые панели и живой фон'],
] as const;
const themeKey='vmk114-theme',styleKey='vmk114-style';
const loadStyle=()=>{try{const s=localStorage.getItem(styleKey);return STYLES.some(x=>x[0]===s)?s!:'atelier';}catch{return 'atelier';}};
// Older versions stored plain "light"/"dark".
const legacy=(value:string|null)=>value==='light'?'paper':value==='dark'?'night':value;
export function applyTheme(choice:string,style=loadStyle()){
  const name=choice==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'midnight':'snow'):choice;
  const theme=THEMES.find(t=>t[0]===name)||THEMES.find(t=>t[0]==='paper')!;
  document.documentElement.dataset.theme=theme[0];
  document.documentElement.dataset.scheme=theme[2];
  document.documentElement.dataset.style=style;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme[3][0]);
}
export function useStyleChoice() {
  const [style,setStyle]=useState(loadStyle);
  useEffect(()=>{const sync=(e:Event)=>setStyle((e as CustomEvent<string>).detail||loadStyle());window.addEventListener('vmk-style-change',sync);return()=>window.removeEventListener('vmk-style-change',sync);},[]);
  function pickStyle(name:string){
    if(!STYLES.some(s=>s[0]===name))return;
    setStyle(name);try{localStorage.setItem(styleKey,name);}catch{}
    document.documentElement.dataset.style=name;
    window.dispatchEvent(new CustomEvent('vmk-style-change',{detail:name}));
  }
  return [style,pickStyle] as const;
}
export function StylePicker({value,onChange}:{value:string;onChange:(name:string)=>void}) {
  return <div className="style-grid style-gallery">{STYLES.map(([name,label,hint])=><button key={name} aria-label={`${label}: ${hint}`} aria-pressed={value===name} onClick={()=>onChange(name)}>
    <StylePreview name={name}/><span className="style-choice-title"><strong>{label}</strong><span className="style-check" aria-hidden="true">{value===name&&<Check size={12}/>}</span></span><small>{hint}</small>
  </button>)}</div>;
}
export function ThemeButton() {
  // MSU is the default look; anyone can switch.
  const [choice,setChoice]=useState(()=>{try{return legacy(localStorage.getItem(themeKey))||'msu';}catch{return 'msu';}});
  const [style,pickStyle]=useStyleChoice();
  const [open,setOpen]=useState(false),[section,setSection]=useState<'style'|'theme'>('style');
  useEffect(()=>{
    applyTheme(choice,style);
    if(choice!=='auto')return;
    const media=matchMedia('(prefers-color-scheme: dark)'),follow=()=>applyTheme('auto',style);
    media.addEventListener('change',follow);return()=>media.removeEventListener('change',follow);
  },[choice,style]);
  function pick(name:string){setChoice(name);try{localStorage.setItem(themeKey,name);}catch{}}
  return <>
    <button className="icon-button" aria-label="Оформление" title="Оформление" onClick={()=>setOpen(true)}><Palette size={18}/></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="changes-dialog"><DialogTitle>Оформление</DialogTitle><DialogDescription>Сохраняется на этом устройстве.</DialogDescription>
      <div className="segmented" role="tablist" aria-label="Что настраивать">
        <button role="tab" aria-selected={section==='style'} onClick={()=>setSection('style')}>Стиль</button>
        <button role="tab" aria-selected={section==='theme'} onClick={()=>setSection('theme')}>Тема</button>
      </div>
      {section==='style' ? <StylePicker value={style} onChange={pickStyle}/>
      : (['light','dark'] as const).map(scheme=><div key={scheme}>
        <h4 className="theme-section">{scheme==='light'?'Светлые':'Тёмные'}</h4>
        <div className="theme-grid">
          {scheme==='light' && <button aria-pressed={choice==='auto'} onClick={()=>pick('auto')}><span className="swatch auto"/>Как в системе</button>}
          {THEMES.filter(t=>t[2]===scheme).map(([name,label,,colors])=><button key={name} aria-pressed={choice===name} onClick={()=>pick(name)}>
            <span className="swatch" style={{background:colors[0]}}><i style={{background:colors[1]}}/><i style={{background:colors[2]}}/></span>{label}</button>)}
        </div>
      </div>)}
    </DialogContent></Dialog>
  </>;
}

// All classes of the group as an .ics file: the phone's calendar imports them with weekly repeats.
export function useCalendarExport(schedule:{group:number;year:number;lessons:unknown[];term?:{end:string}[]|null},subgroups:Record<string,string>){
  const end=new Date((schedule.term?.at(-1)?.end||`${schedule.year}-12-31`)+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'});
  const [open,setOpen]=useState(false),[done,setDone]=useState(false);
  function download(){
    const url=URL.createObjectURL(new Blob([calendarFile(schedule,subgroups)],{type:'text/calendar;charset=utf-8'}));
    const link=Object.assign(document.createElement('a'),{href:url,download:`vmk-${schedule.group}.ics`});
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);setDone(true);
  }
  const chosen=Object.values(subgroups).filter(Boolean).length;
  return {button:<button onClick={()=>{setDone(false);setOpen(true);}}>В календарь</button>,
    dialog:<Dialog open={open} onOpenChange={setOpen}><DialogContent className="changes-dialog"><DialogTitle>В календарь телефона</DialogTitle>
      <DialogDescription>Все пары группы {schedule.group} до {end}, когда кончаются занятия, — с аудиториями и преподавателями, без праздников. Повторяются каждую неделю.</DialogDescription>
      <ul className="calendar-notes">
        <li>{chosen?`Учтена твоя подгруппа (${chosen} ${chosen===1?'предмет':chosen<5?'предмета':'предметов'}).`:'Подгруппа не выбрана — в парах будут все преподаватели.'}</li>
        <li>iPhone: открой файл и нажми «Добавить все». Android: открой файл в Google Календаре.</li>
        <li>Если ВМК поменяет расписание, скачай файл заново — старые события обновятся.</li>
      </ul>
      <button className="save-task" onClick={download}><CalendarPlus size={16}/> {done?'Скачать ещё раз':'Скачать .ics'}</button>
    </DialogContent></Dialog>};
}

export type Task={id:string;date:string;subject:string;text:string;done:boolean;group?:string};
const key='vmk114-homework-v1';
function load():Task[]{try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter(t=>t&&typeof t.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&typeof t.subject==='string'&&typeof t.text==='string'&&typeof t.done==='boolean'):[];}catch{return [];}}
const shortDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});

// Homework lives inside the lesson row; the list dialog only jumps to it.
// Tasks without a group were written for 114 before group switching existed.
export function useHomework(group:string,onPick:(date:string,lessonId:string)=>void){
  const [all,setTasks]=useState<Task[]>(load);
  const tasks=all.filter(t=>(t.group||'114')===group);
  const [editing,setEditing]=useState(''),[listOpen,setListOpen]=useState(false),[error,setError]=useState('');
  function write(mine:Task[]){const next=[...all.filter(t=>(t.group||'114')!==group),...mine];try{localStorage.setItem(key,JSON.stringify(next));setTasks(next);setError('');return true;}catch{setError('Не удалось сохранить. Освободи место на устройстве.');return false;}}
  function save(task:Task){const other=tasks.filter(t=>t.id!==task.id);return write(task.text.trim()?[...other,{...task,group,text:task.text.trim()}]:other);}
  function toggle(id:string){write(tasks.map(t=>t.id===id?{...t,done:!t.done}:t));}
  const pending=tasks.filter(t=>!t.done).length;
  const dialogs=<Dialog open={listOpen} onOpenChange={setListOpen}><DialogContent className="changes-dialog"><DialogTitle>Задания{pending?` · ${pending}`:''}</DialogTitle><DialogDescription>Хранятся только на этом устройстве и доступны без сети.</DialogDescription>{tasks.length?[...tasks].sort((a,b)=>Number(a.done)-Number(b.done)||a.date.localeCompare(b.date)).map(task=><div className="task-list-row" key={task.id}><button className={'task-check '+(task.done?'done':'')} aria-label={task.done?'Отметить невыполненным':'Отметить выполненным'} onClick={()=>toggle(task.id)}>{task.done&&<Check size={14}/>}</button><button className="task-open" onClick={()=>{setListOpen(false);const lessonId=task.id.slice(11);onPick(task.date,lessonId);setEditing(task.id);}}><small>{shortDate(task.date)} · {task.subject}</small><span className={task.done?'task-done':''}>{task.text}</span></button></div>):<p className="personal-hint">Нажми «+ ДЗ» у пары, чтобы записать задание.</p>}{error&&<p role="alert">{error}</p>}</DialogContent></Dialog>;
  return {tasks,save,toggle,editing,setEditing,error,dialogs,listButton:<button onClick={()=>{setError('');setListOpen(true);}}>Задания{pending?` · ${pending}`:''}</button>};
}

export function HomeworkButton({task,onClick}:{task?:Task;onClick:()=>void}){
  return <button className={'homework-button '+(task?'has-task':'')} aria-label={task?'Открыть задание':'Добавить задание'} onClick={onClick}>{task?.done?<Check size={13}/>:task?<NotebookPen size={13}/>:null}<span>{task?(task.done?'Сделано':'ДЗ'):'+ ДЗ'}</span></button>;
}

export function HomeworkEditor({task,onSave,onToggle,onClose,error}:{task:Task;onSave:(t:Task)=>boolean;onToggle:()=>void;onClose:()=>void;error:string}){
  const [text,setText]=useState(task.text);
  const area=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{area.current?.focus();setTimeout(()=>area.current?.scrollIntoView({block:'center',behavior:'smooth'}),250);},[]);
  function done(){if(onSave({...task,text}))onClose();}
  return <div className="homework-editor">
    <textarea ref={area} aria-label="Домашнее задание" rows={3} maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder="Что задали…" onKeyDown={e=>{if(e.key==='Escape')onClose();}}/>
    {error&&<p role="alert" className="personal-hint">{error}</p>}
    <div className="homework-actions">
      {task.text&&<label className="task-toggle"><input type="checkbox" checked={task.done} onChange={onToggle}/>Сделано</label>}
      <span/>
      {task.text&&<button className="text-button danger" onClick={()=>{onSave({...task,text:''});onClose();}}>Удалить</button>}
      <button className="text-button" onClick={onClose}>Отмена</button>
      <button className="small-primary" onClick={done}>Сохранить</button>
    </div>
  </div>;
}
