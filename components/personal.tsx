import React,{useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Palette,NotebookPen,Check,CalendarPlus} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {calendarFile} from '../lib/calendar.mjs';
import {LIQUID_DEFAULT,applyLiquid,loadLiquid} from '../lib/liquid.mjs';

// name, label, scheme, swatch colours (background, lecture, now)
export const THEMES = [
  ['snow','Снег','light',['#f6f7f9','#3b6fe0','#e5484d']], ['fog','Туман','light',['#e9edf1','#5b7896','#d9735b']],
  ['msu-light','МГУ день','light',['#eaf1f8','#c07a45','#2f6fd1']], ['mint','Мята','light',['#edf5f1','#2e9a74','#e0604e']], ['lavender','Лаванда','light',['#f3f1f9','#7b66d6','#df5a86']],
  ['pearl','Жемчуг','light',['#f6f3ed','#9a7738','#16151a']], ['paper','Бумага','light',['#f3efe6','#f5c518','#ff5a36']],
  ['spring','Весна','light',['#f1f5ec','#6dbb5a','#ea4f8a']], ['summer','Лето','light',['#fff6e3','#ffae1f','#ff4e2e']],
  ['msu','МГУ ночь','dark',['#0b1030','#d8b45c','#2a3aa8']], ['midnight','Полночь','dark',['#111120','#9f8cff','#ff7eb0']],
  ['ocean','Океан','dark',['#0b161b','#4cc2c4','#ff8a73']], ['forest','Лес','dark',['#0e1512','#74c98f','#ffae6b']],
  ['steel','Сталь','dark',['#17181b','#7aa7ff','#ff7a7a']], ['onyx','Оникс','dark',['#0d0d0f','#c9a96e','#ece7de']],
  ['night','Ночь','dark',['#15130f','#e8b923','#ff6a48']], ['graphite','Графит','dark',['#111214','#b8f34a','#ff4f8b']],
  ['winter','Зима','dark',['#0b1220','#6ea8ff','#ff6b9a']], ['autumn','Осень','dark',['#17100b','#ea7a36','#ff5e3a']], ['amber','Тёплая осень','dark',['#160f06','#ffb547','#ffd27a']],
] as const;
// Layout and type, independent of the colour theme.
export const STYLES = [
  ['glass','Стекло','Жидкое стекло, как в iOS 26'],
  ['atelier','Журнал','Антиква и тонкие линейки'],
  ['minimal','Минимал','Время, предмет, аудитория'],
  ['timeline','Лента','Шкала времени и карточки'],
  ['cards','Карточки','Как в приложениях iOS'],
] as const;
const themeKey='vmk114-theme',styleKey='vmk114-style';
// «Жидкое стекло»: matte ↔ clear, applied live while the thumb moves and saved when it is let go.
export function LiquidSlider(){
  const [value,setValue]=useState(loadLiquid);
  // The thumb moves with React's state; the photo follows through one variable on the wallpaper (lib/liquid.mjs).
  const change=(v:number)=>{setValue(v);applyLiquid(v);};
  // While the thumb is held, the settings window steps aside (glass.css, data-peek) so the change is seen.
  const peek=(on:boolean)=>{if(on)document.documentElement.setAttribute('data-peek','');else document.documentElement.removeAttribute('data-peek');};
  const save=(v:number)=>{peek(false);applyLiquid(v,true);};
  return <div className="liquid-slider">
    <div className="liquid-head"><strong>Фон</strong><span>{value<20?'светлый':value<45?'обычный':value<75?'приглушённый':'тёмный'}</span></div>
    <input type="range" min={0} max={100} step={1} value={value} aria-label="Фон: от светлого к тёмному"
      style={{'--v':`${value}%`} as React.CSSProperties}
      onPointerDown={()=>peek(true)} onPointerCancel={()=>peek(false)} onLostPointerCapture={()=>peek(false)}
      onChange={e=>change(Number(e.target.value))} onPointerUp={e=>save(Number(e.currentTarget.value))} onKeyUp={e=>save(Number(e.currentTarget.value))} onBlur={e=>save(Number(e.currentTarget.value))}/>
    <div className="liquid-ends"><span>Светлее</span><button className="text-button" onClick={()=>{change(LIQUID_DEFAULT);save(LIQUID_DEFAULT);}}>Сбросить</button><span>Темнее</span></div>
  </div>;
}
const loadStyle=()=>{try{const s=localStorage.getItem(styleKey);return STYLES.some(x=>x[0]===s)?s!:'glass';}catch{return 'glass';}};
// Older versions stored plain "light"/"dark".
// «МГУ классика» was the same as «МГУ ночь» and is gone.
const legacy=(value:string|null)=>value==='light'?'paper':value==='dark'?'night':value==='msu-classic'?'msu':value;
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
  // Dark / light / system: the dial shows only that scheme's themes. Switching the scheme puts on its МГУ theme.
  const schemeOf=(c:string)=>c==='auto'?'auto':(THEMES.find(t=>t[0]===c)?.[2]||'dark');
  const [scheme,setScheme]=useState(()=>schemeOf(choice));
  function chooseScheme(next:'dark'|'light'|'auto'){setScheme(next);if(next==='auto')pick('auto');else if(schemeOf(choice)!==next)pick(next==='dark'?'msu':'msu-light');}
  const themeItems=THEMES.filter(t=>t[2]===scheme).map(([name,label,,c])=>({key:name,title:label,node:<span className="dial-swatch" style={{'--a':c[0],'--b':c[1],'--c':c[2]} as React.CSSProperties}/>}));
  const styleItems=STYLES.map(([name,label])=>({key:name,title:label,node:<span>{label}</span>}));
  return <>
    <button className="icon-button" aria-label="Оформление" title="Оформление" onClick={()=>{setScheme(schemeOf(choice));setOpen(true);}}><Palette size={18}/></button>
    {/* A sheet at the bottom with no veil: the real page above it is the preview, and changes as the dials turn. */}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="changes-dialog settings-sheet">
      <DialogTitle className="sr-only">Оформление</DialogTitle><DialogDescription className="sr-only">Стиль и цветовая тема, сохраняются на этом устройстве</DialogDescription>
      <Dial className="style-dial" label="Стиль" items={styleItems} value={style} onPick={pickStyle}/>
      <div className="scheme-switch" role="radiogroup" aria-label="Тёмные или светлые темы">
        {([['dark','Тёмные'],['light','Светлые'],['auto','Авто']] as const).map(([k,label])=><button key={k} role="radio" aria-checked={scheme===k} onClick={()=>chooseScheme(k)}>{label}</button>)}
      </div>
      {scheme==='auto'
        ? <p className="dial-name">Как в системе</p>
        : <><Dial key={scheme} className="theme-dial" label="Тема" items={themeItems} value={choice} onPick={pick}/>
          <p className="dial-name">{THEMES.find(t=>t[0]===choice)?.[1]||''}</p></>}
      <IconPicker/>
      {style==='glass' && <LiquidSlider/>}
    </DialogContent></Dialog>
  </>;
}

// The app icon: the phone takes it when the site is added to the home screen, from the links index.html points at
// the chosen icon (manifest-<icon>.webmanifest for Android, apple-touch-icon-<icon>.png for iPhone).
const ICONS=[['night','МГУ ночью'],['day','МГУ днём'],['sunset','МГУ на закате'],['emblem','Эмблема МГУ'],['vmk','Знак ВМК']] as const;
function IconPicker(){
  const [icon,setIcon]=useState(()=>{try{return localStorage.getItem('vmk114-icon')||'night';}catch{return 'night';}});
  const [changed,setChanged]=useState(false);
  function choose(key:string){
    setIcon(key);setChanged(true);try{localStorage.setItem('vmk114-icon',key);}catch{}
    const base=import.meta.env.BASE_URL;
    document.querySelector('link[rel=manifest]')?.setAttribute('href',`${base}manifest-${key}.webmanifest`);
    document.querySelector('link[rel=apple-touch-icon]')?.setAttribute('href',`${base}icons/apple-touch-icon-${key}.png`);
  }
  return <div className="icon-picker">
    <div className="icon-row" role="radiogroup" aria-label="Иконка приложения">{ICONS.map(([key,label])=><button key={key} role="radio" aria-checked={icon===key} aria-label={label} onClick={()=>choose(key)}>
      <img src={`${import.meta.env.BASE_URL}icons/icon-${key}-192.png`} alt="" width={48} height={48} loading="lazy" decoding="async"/></button>)}</div>
    <p className="icon-note">{changed?'Чтобы иконка сменилась, добавь сайт на экран «Домой» заново.':'Иконка для экрана «Домой»'}</p>
  </div>;
}

// A horizontal dial like the iPhone camera's zoom or modes: a native snap scroller; whatever reaches the middle is the
// choice and is applied at once, so the page behind shows it. Items grow toward the middle (--near, 0…1), so the next
// one is seen coming. Item centres are measured once (and on resize), not on every scroll step.
function Dial({items,value,onPick,className,label}:{items:{key:string;title:string;node:ReactNode}[];value:string;onPick:(key:string)=>void;className:string;label:string}) {
  const ref=useRef<HTMLDivElement>(null),centers=useRef<number[]>([]),at=useRef(value),frame=useRef(0);
  const pick=useRef(onPick);pick.current=onPick;
  const keys=items.map(x=>x.key).join();
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    const kids=()=>[...el.children] as HTMLElement[];
    const measure=()=>{centers.current=kids().map(k=>k.offsetLeft+k.offsetWidth/2);};
    function paint(){
      frame.current=0;const mid=el!.scrollLeft+el!.clientWidth/2;let best=0,gap=Infinity;
      kids().forEach((k,i)=>{const d=Math.abs(centers.current[i]-mid);k.style.setProperty('--near',Math.max(0,1-d/140).toFixed(3));if(d<gap){gap=d;best=i;}});
      const key=items[best]?.key;
      if(key&&key!==at.current){at.current=key;navigator.vibrate?.(3);pick.current(key);}
    }
    measure();
    const i=Math.max(0,items.findIndex(x=>x.key===value));
    el.scrollLeft=centers.current[i]-el.clientWidth/2;at.current=items[i]?.key;paint();
    const scroll=()=>{if(!frame.current)frame.current=requestAnimationFrame(paint);};
    el.addEventListener('scroll',scroll,{passive:true});
    const resize=new ResizeObserver(()=>{measure();paint();});resize.observe(el);
    return()=>{el.removeEventListener('scroll',scroll);resize.disconnect();cancelAnimationFrame(frame.current);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[keys]);
  const center=(i:number)=>{const el=ref.current;if(el)el.scrollTo({left:centers.current[i]-el.clientWidth/2,behavior:'smooth'});};
  return <div className={`dial ${className}`} ref={ref} role="listbox" aria-label={label}>
    {items.map((x,i)=><button key={x.key} role="option" aria-selected={x.key===value} aria-label={x.title} onClick={()=>center(i)}>{x.node}</button>)}
  </div>;
}

// All classes of the group as an .ics file: the phone's calendar imports them with weekly repeats.
export function useCalendarExport(schedule:{group:number;year:number;lessons:unknown[];term?:{end:string}[]|null},subgroups:Record<string,string>){
  const end=useMemo(()=>new Date((schedule.term?.at(-1)?.end||`${schedule.year}-12-31`)+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}),[schedule.term,schedule.year]);
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
