import React, {Suspense, createContext, lazy, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {ArrowUpRight, CalendarClock, CalendarDays, CalendarRange, ChevronDown, GraduationCap, History, Map as MapIcon, ChevronLeft, ChevronRight, RefreshCw, Share2, WifiOff, X} from 'lucide-react';
import {Dialog, DialogContent, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import {DEFAULT_GROUP, cleanTitle, groupSchedule, isDisplayedLesson, teacherRows, validSnapshot, verification} from '@/lib/schedule-model.mjs';
import {ThemeButton,HomeworkButton,HomeworkEditor,useCalendarExport,useHomework,type Task} from '@/components/personal';
import {useSearch} from '@/components/search';
import {useSubgroups} from '@/components/subgroups';
import {dayGlance, duration, focusDate, lessonsOn, minutes, roomFor} from '@/lib/day-glance.mjs';
import {dayKind, isStacked, termEnd, validTerm, weekOf} from '@/lib/term.mjs';
import {SessionView, isCurrent, type Session} from '@/components/session';
import {OpenTeacher, TeacherName, useTeacherCard} from '@/components/teacher';
import {Onboarding, needsOnboarding} from '@/components/onboarding';
import {SectionTabs, sectionIndex, type Section} from '@/components/section-tabs';
import {TermCalendar} from '@/components/term-calendar';
import {StatsDialog} from '@/components/term-stats';
import {UsefulView} from '@/components/useful';
import {UpdateEntry, changeLabels, type Change, type HistoryEntry} from '@/components/changes';
import {weekDates} from '@/lib/term-stats.mjs';
import {DayPager} from '@/components/day-pager';
import {useDayLens} from '@/components/day-lens';
import {Wallpaper} from '@/components/wallpaper';
import {findRoom} from '@/lib/map-route.mjs';
import {PdfViewer} from '@/components/pdf-viewer';
// three.js is loaded only when the map is opened.
const CampusMap = lazy(() => import('@/components/campus-map').then(m => ({default:m.CampusMap})));
import seed from '@/public/source.json';

type Lesson = {id:string; day:number; start:string; end:string; title:string; detail:string; room:string; type:string; raw:string; rule:{from?:string; until?:string; dates?:string[]}|null};
type Schedule = {group:number; year:number; page:number; lessons:Lesson[]; sourceDate:string; sourceUrl:string; hash:string; savedAt:string};
type Table = {year:number; groups:Record<string,{page:number; lessons:Lesson[]}>; sourceDate:string; sourceUrl:string; hash:string; savedAt:string};
type Contacts = {room:string; phone:string; head:{name:string; email:string}|null; inspector:{name:string; email:string}|null};
type Faculty = {term?:{start:string; end:string; odd:boolean}[]; notices?:string[]; contacts?:Contacts; session?:Session; archive?:Session[]};
type ParseWarning = {group:string; id:string; title:string; day:number; start:string; text:string};
type Snapshot = {parseWarnings?:ParseWarning[]; schema:number; status:string; attemptedAt:string; checkedAt:string|null; error:string|null; date:string; url:string; hash:string; schedule:Table; history:HistoryEntry[]; faculty?:Faculty};
type Saved = {snapshot:Snapshot; syncedAt:string};
const dayNames = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const shortDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const typeNames:Record<string,string> = {lecture:'Лекция', class:'Семинар', consultation:'Консультация'};
const storageKey = 'vmk-v2';
const groupKey = 'vmk-group';
const RECENT = 7*86400000;
const dataCache = 'vmk114-data-v1';
const asset = (path:string) => import.meta.env.BASE_URL + path.replace(/^\//,'');
const pdfKey = (hash:string) => asset(`saved-schedule-${hash}.pdf`);
const isoMoscow = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clockMoscow = () => new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(new Date());
const addDays = (iso:string,n:number) => new Date(new Date(iso+'T12:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);
const weekday = (iso:string) => (new Date(iso+'T12:00:00Z').getUTCDay()+6)%7;
const formatDate = (iso:string,options:Intl.DateTimeFormatOptions={day:'numeric',month:'long'}) => new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{...options,timeZone:'Europe/Moscow'});
const stamp = (iso:string|null) => iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'нет данных';
const plural = (n:number,forms:[string,string,string]) => forms[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2];
const lessonCount = (n:number) => n ? `${n} ${plural(n,['пара','пары','пар'])}` : 'Без пар';
function ago(iso:string|null) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  const m = Math.max(0,Math.round((Date.now()-Date.parse(iso))/60000));
  if (m<1) return 'только что';
  if (m<60) return `${m} мин назад`;
  const h = Math.floor(m/60);
  if (h<24) return `${h} ${plural(h,['час','часа','часов'])} назад`;
  return stamp(iso);
}
// Data from other VMK pages; each part is checked so a malformed one is simply left out.
function readFaculty(snapshot:Snapshot) {
  const f = snapshot.faculty || {};
  const valid = (s:any):s is Session => !!s && typeof s.title==='string' && typeof s.year==='number' && !!s.exams && !!s.credits && !!s.lists && Array.isArray(s.sources);
  const session = valid(f.session) ? f.session : null;
  return {term:validTerm(f.term) ? f.term! : null, notices:Array.isArray(f.notices) ? f.notices.filter(n => typeof n==='string').slice(0,8) : [],
    contacts:f.contacts && typeof f.contacts.room==='string' ? f.contacts : null, session, archive:Array.isArray(f.archive) ? f.archive.filter(valid) : []};
}
const noticeKey = 'vmk-notices-read';
// detectedAt of the newest VMK update whose marks the user has hidden.
const seenKey = 'vmk-changes-seen';
const loadSeen = () => { try { return localStorage.getItem(seenKey) || ''; } catch { return ''; } };
const fold = (s:string) => s.toLowerCase().replace(/ё/g,'е');
const surnames = (detail:string) => (teacherRows(detail) as {teacher:string}[]).map(r => r.teacher.replace(/^(?:\S+\s+)*?([А-ЯЁ][а-яё]{3,})(?:\s+[А-ЯЁ].*)?$/, '$1')).filter(s => /^[А-ЯЁ][а-яё]{3,}$/.test(s));
const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
// A notice concerns a class when it names the class's teacher and, if it names a date, that date.
function noticeFor(notices:string[], lesson:Lesson, date:string) {
  return notices.find(n => {
    const text = fold(n);
    if (!surnames(lesson.detail).some(s => text.includes(fold(s)))) return false;
    const m = n.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
    return !m || date.slice(5) === `${String(months.indexOf(m[2].toLowerCase())+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  });
}
function initialState():Saved {
  const fallback = ():Saved => ({snapshot:seed as Snapshot, syncedAt:''});
  try {
    const old = JSON.parse(localStorage.getItem(storageKey)||'null');
    if (!validSnapshot(old?.snapshot)) return fallback();
    // Prefer the newer bundled version after an app update, while retaining newer offline data.
    if (Date.parse(old.snapshot.attemptedAt) < Date.parse(seed.attemptedAt)) return fallback();
    return {snapshot:old.snapshot, syncedAt:typeof old.syncedAt==='string'?old.syncedAt:''};
  } catch { return fallback(); }
}
// Groups that share lectures form a stream; in the PDF each stream has its own page.
function streams(table:Table) {
  const pages = new Map<number,string[]>();
  for (const [name, g] of Object.entries(table.groups)) pages.set(g.page, [...(pages.get(g.page) || []), name]);
  return [...pages].sort((a, b) => a[0]-b[0]).map(([page, groups], i, all) => {
    groups.sort();
    const counts = new Map<string,number>();
    for (const l of table.groups[groups[0]].lessons) if (l.type==='lecture' && l.room) counts.set(l.room, (counts.get(l.room) || 0)+1);
    const hall = [...counts].sort((a, b) => b[1]-a[1])[0]?.[0];
    const fiit = groups.every(g => g >= '140');
    return {page, groups, hall, title:fiit ? 'ФИИТ' : `${i+1} поток`, range:`${groups[0]}–${groups.at(-1)}`, total:all.length};
  });
}
function loadGroup() { try { return localStorage.getItem(groupKey) || DEFAULT_GROUP; } catch { return DEFAULT_GROUP; } }
function describeUpdate(entry:HistoryEntry, group:string) {
  const list = entry.changes[group] || [];
  if (!list.length) return entry.pdfChanged ? `ВМК обновил PDF (от ${entry.date}) — у группы ${group} ничего не поменялось.` : `На сайте ВМК новая дата расписания (${entry.date}), сам PDF не изменился.`;
  return `ВМК обновил расписание (от ${entry.date}): `+list.slice(0,3).map(c=>`${shortDays[c.day]} ${c.start} ${c.title||''} — ${(c.details||[]).join('; ')}`).join(' · ')+(list.length>3?` и ещё ${list.length-3}`:'');
}
function persist(value:Saved) {
  try { localStorage.setItem(storageKey,JSON.stringify(value)); }
  catch { throw Error('Не удалось сохранить расписание на устройстве. Освободи место и повтори обновление.'); }
}

// "МГУ" theme: photo of the Main Building behind the header and the emblem as a watermark.
function MsuDecor() {
  return <>
    <div className="msu-hero" aria-hidden="true" style={{'--photo':`url(${asset('brand/msu-main-building.jpg')})`, '--photo-day':`url(${asset('brand/msu-day.webp')})`} as CSSProperties}/>
    <i className="msu-emblem" aria-hidden="true" style={{maskImage:`url(${asset('brand/msu-emblem.png')})`, WebkitMaskImage:`url(${asset('brand/msu-emblem.png')})`}}/>
  </>;
}

// Tapping a room opens it on the campus map.
const OpenRoom = createContext<(room:string,date?:string,start?:string)=>void>(()=>{});
const LessonAt = createContext<{date?:string; start?:string}>({});
function Room({room,note=''}:{room:string; note?:string}) {
  const open = useContext(OpenRoom), at = useContext(LessonAt), onMap = !!findRoom(room.split(',')[0]);
  const content = <>{room}{note && <span className="room-note">{note}</span>}</>;
  return onMap ? <button className="room" aria-label={`Аудитория ${room}${note?', '+note:''}, показать на карте`} onClick={()=>open(room.split(',')[0],at.date,at.start)}>{content}</button>
    : <span className="room" aria-label={`Аудитория ${room}${note?', '+note:''}`}>{content}</span>;
}
type Editor = {task?:Task; editing:boolean; open:()=>void; editor:React.ReactNode};
function LessonCard({lesson,date,today,clock,change,next,hw,preferredTeacher,stacked,notice,check}:{check?:string[]; lesson:Lesson;date:string;today:string;clock:string;change?:Change;next:boolean;hw:Editor;preferredTeacher?:string;stacked:''|'odd'|'even'|'both';notice?:string}) {
  const now = date===today && !!clock && clock>=lesson.start && clock<lesson.end;
  const past = date<today || (date===today && !!clock && clock>=lesson.end);
  const left = clock ? minutes(now?lesson.end:lesson.start)-minutes(clock) : 0;
  const progress = now ? (minutes(clock)-minutes(lesson.start))/(minutes(lesson.end)-minutes(lesson.start)) : 0;
  const allRows = teacherRows(lesson.detail) as {teacher:string;room:string;note:string}[];
  const matched = allRows.filter(row=>row.teacher===preferredTeacher);
  const rows = allRows.length>1 && matched.length ? matched : allRows;
  const missingTeacher = !!preferredTeacher && allRows.length>0 && lesson.type!=='lecture' && !matched.length;
  const note = lesson.rule?.dates ? 'Только '+lesson.rule.dates.map(d=>formatDate(d,{day:'numeric',month:'short'})).join(', ') : lesson.rule?.from || lesson.rule?.until ? [lesson.rule.from && 'С '+formatDate(lesson.rule.from), lesson.rule.until && (lesson.rule.from ? 'по ' : 'По ')+formatDate(lesson.rule.until)].filter(Boolean).join(' ') : '';
  // Time left is in the bar under the header; the card only says the class is on.
  const label = now ? 'идёт' : next ? `через ${duration(left)}` : '';
  return <LessonAt.Provider value={{date,start:lesson.start}}><article className={`lesson ${lesson.type} ${now?'current':''} ${past?'past':''}`} onClick={event=>{if(!hw.editing && !(event.target as HTMLElement).closest('button,a,textarea,input,label'))hw.open();}}>
    <div className="lesson-time">
      <span className="range">{lesson.start}<span><i> – </i>{lesson.end}</span></span>
      {typeNames[lesson.type] && <span className={`tag ${lesson.type}`}>{typeNames[lesson.type]}</span>}
      {label && <span className="live">{label}</span>}
      <HomeworkButton task={hw.task} onClick={hw.open}/>
    </div>
    <h3>{cleanTitle(lesson)}</h3>
      {rows.map((row,i)=><div className="teacher-row" key={i}><span>{row.teacher ? <TeacherName name={row.teacher}/> : null}</span>{(row.room || (i===0 && lesson.room)) && <Room room={row.room || lesson.room} note={row.note}/>}</div>)}
      {!rows.length && lesson.room && <div className="teacher-row"><span/><Room room={lesson.room}/></div>}
      {now && <div className="progress" aria-hidden="true"><i style={{'--p':progress.toFixed(3)} as CSSProperties}/></div>}
      {change && <button className="changed-note" onClick={()=>window.dispatchEvent(new Event('vmk-open-changes'))}>{changeLabels(change)}<span>подробнее</span></button>}
      {missingTeacher && <p className="rule-note subgroup-warning">Преподаватель подгруппы изменился — показаны все варианты.</p>}
      {note && <p className="rule-note">{note}</p>}
      {stacked==='odd' && <p className="rule-note">По нечётным неделям</p>}
      {stacked==='even' && <p className="rule-note">По чётным неделям</p>}
      {stacked==='both' && <p className="rule-note">В PDF в этой клетке две записи одна под другой — обычно это чередование недель.</p>}
      {notice && <p className="notice-note">Объявление ВМК: {notice}</p>}
      {check && check.length>0 && <p className="check-note">Возможно, прочитано неточно ({check.join('; ')}). Сверь с PDF.</p>}
      {hw.task && !hw.editing && <button className={`hw-preview ${hw.task.done?'task-done':''}`} onClick={hw.open}>{hw.task.text}</button>}
      {hw.editing && hw.editor}
  </article></LessonAt.Provider>;
}

export default function Home() {
  const [saved,setSaved] = useState<Saved>(initialState);
  const current = useRef(saved);
  const [today,setToday] = useState(isoMoscow), [clock,setClock] = useState(clockMoscow);
  // null = follow the current time (today, or the next teaching day once today's classes are over).
  const [pinned,setPinned] = useState<string|null>(null);
  const [tab,setTab] = useState<'schedule'|'calendar'|'session'|'info'|'map'>('schedule'), [mapFrom,setMapFrom] = useState<Section>('schedule'), [mapTarget,setMapTarget] = useState<{to:string; from:string|null; n:number}|null>(null);
  const [view,setView] = useState('day'), [busy,setBusy] = useState(false), [online,setOnline] = useState(navigator.onLine);
  const [message,setMessage] = useState(''), [syncError,setSyncError] = useState(''), [offlineReady,setOfflineReady] = useState(false);
  const [appUpdated,setAppUpdated] = useState(false);
  const [changesOpen,setChangesOpen] = useState(false);
  useEffect(()=>{const open=()=>setChangesOpen(true);window.addEventListener('vmk-open-changes',open);return()=>window.removeEventListener('vmk-open-changes',open);},[]);
  const [statusOpen,setStatusOpen] = useState(false), [pdfUrl,setPdfUrl] = useState(''), [pdfOpen,setPdfOpen] = useState(false), [pdfError,setPdfError] = useState('');
  const checking = useRef(false), lastAttempt = useRef(0), scheduleArea = useRef<HTMLElement>(null);
  const [group,setGroupState] = useState(loadGroup), [groupsOpen,setGroupsOpen] = useState(false);
  const table = saved.snapshot.schedule;
  const faculty = readFaculty(saved.snapshot);
  const data = {...groupSchedule(table,group), term:faculty.term} as Schedule & {term:Faculty['term']|null};
  const groupName = String(data.group);
  const history = saved.snapshot.history;
  // Latest version of every class changed by a VMK update within the last week.
  const [seen,setSeen] = useState(loadSeen);
  // Updates of the last week that were not hidden: their classes are marked, and a banner names them.
  const unseen = history.filter(h=>Date.now()-Date.parse(h.detectedAt)<RECENT && (!seen || Date.parse(h.detectedAt)>Date.parse(seen)));
  const recent = unseen.flatMap(h=>h.changes[groupName]||[]);
  function hideChanges(){const at=history[0]?.detectedAt||'';setSeen(at);try{localStorage.setItem(seenKey,at);}catch{}}
  function showChanges(){setSeen('');try{localStorage.removeItem(seenKey);}catch{}}
  const changeFor = (id:string) => recent.find(c=>c.id===id);
  const subgroups=useSubgroups(data.lessons,groupName);
  const homework=useHomework(groupName,(date)=>{setView('day');go(date);});
  const calendar=useCalendarExport(data,subgroups.selected);
  // Search looks at the current teaching week; on Sunday that is the coming one.
  const searchWeek=Array.from({length:6},(_,i)=>addDays(today,i-weekday(today)+(weekday(today)===6?7:0)));
  const search=useSearch({table,term:faculty.term,dates:searchWeek,today,clock,group:groupName,room:(name,date,start)=><LessonAt.Provider value={{date,start}}><Room room={name}/></LessonAt.Provider>});
  function setGroup(name:string){setGroupState(name);setGroupsOpen(false);setMessage('');try{localStorage.setItem(groupKey,name);}catch{}}
  const focus = focusDate(data,today,clock) as string;
  const selected = pinned ?? focus;
  const monday = addDays(selected,-weekday(selected));
  const week = Array.from({length:7},(_,i)=>addDays(monday,i));
  const todayLessons = lessonsOn(data,today) as Lesson[];
  const nextId = todayLessons.find(l=>l.start>clock)?.id;
  const selectedLessons = lessonsOn(data,selected) as Lesson[];
  const weekCount = weekDates(today).reduce((n,date)=>n+lessonsOn(data,date).length,0);
  // "How long until the end of this class": shown on every tab and in the window title.
  const ongoing = todayLessons.find(l=>clock>=l.start && clock<l.end);
  const ongoingLeft = ongoing ? minutes(ongoing.end)-minutes(clock) : 0;
  const fiit = Number(groupName)>=140, parity = fiit ? weekOf(faculty.term,selected)?.odd : undefined;
  const [readNotices,setReadNotices] = useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem(noticeKey)||'[]');}catch{return [];}});
  const freshNotices = faculty.notices.filter(n=>!readNotices.includes(n));
  const [statsOpen,setStatsOpen] = useState(false);
  const [contactsOpen,setContactsOpen] = useState(false), [onboarding,setOnboarding] = useState(needsOnboarding), [shared,setShared] = useState('');
  // Lecturer of each subject this term, by the first letters of its name.
  const lecturers = Object.fromEntries(data.lessons.filter(l=>l.type==='lecture').flatMap(l=>{const t=(teacherRows(l.detail) as {teacher:string}[])[0]?.teacher;return t?[[cleanTitle(l).toLowerCase().replace(/ё/g,'е').replace(/[^а-я]/g,'').slice(0,12),t]]:[];}));
  const teacherCard = useTeacherCard({table, session:isCurrent(faculty.session,data.year) ? faculty.session : null, dates:searchWeek, term:faculty.term, room:(name,day,start)=><LessonAt.Provider value={{date:searchWeek[day],start}}><Room room={name}/></LessonAt.Provider>});
  const status = verification(saved.snapshot);
  // Places of this group's timetable the server could not read with confidence.
  const checks = (saved.snapshot.parseWarnings || []).filter(w => w.group===groupName);
  const glance = view==='day' && (selected===today || selected===focus) ? dayGlance(data,today,clock,subgroups.selected) : null;
  function dismissNotices(){const next=[...readNotices,...freshNotices].slice(-30);setReadNotices(next);try{localStorage.setItem(noticeKey,JSON.stringify(next));}catch{}}
  async function shareGroup(){
    const url=location.origin+import.meta.env.BASE_URL+'?g='+groupName;
    try{
      if(navigator.share){await navigator.share({title:`Расписание ВМК · группа ${groupName}`,url});return;}
      await navigator.clipboard.writeText(url);setShared('Ссылка скопирована');
    }catch(error){if(!(error instanceof DOMException && error.name==='AbortError'))setShared(url);}
  }
  // The strip already names the weekday and the number; the heading says only what the strip does not.
  const near = selected===today ? 'Сегодня' : selected===addDays(today,1) ? 'Завтра' : selected===addDays(today,-1) ? 'Вчера' : '';
  const monthOf = (iso:string) => { const m=new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{month:'long',timeZone:'Europe/Moscow'}); return m[0].toUpperCase()+m.slice(1); };
  const months = view==='day' ? monthOf(selected) : [...new Set([monthOf(monday),monthOf(week[6])])].join(' — ');
  const dayStart = selectedLessons.reduce((s,l)=>!s||l.start<s?l.start:s,''), dayEnd = selectedLessons.reduce((e,l)=>l.end>e?l.end:e,'');
  const checkedAgo = ago(saved.snapshot.checkedAt || null);
  const statusText = !online ? 'Без интернета' : busy ? 'Обновляем…' : syncError ? 'Не удалось получить обновления'
    : saved.snapshot.status==='error' ? 'Не удалось проверить ВМК' : checks.length ? 'Сверь с PDF' : checkedAgo ? `Сверено ${checkedAgo}` : status.title;
  const tone = !online ? 'offline' : syncError || checks.length ? 'warn' : status.tone;

  // The drop on the day strip starts moving here, in the input handler, before the new day is drawn (day-lens.ts).
  const lensCtl = useDayLens(weekday(selected), monday);
  const target = useRef(selected);
  useLayoutEffect(() => { target.current = selected; }, [selected]);
  function lensTo(date:string) { if (view==='day' && addDays(date,-weekday(date))===monday) lensCtl.glide(weekday(date)); }
  function go(date:string) { target.current=date; lensTo(date); setPinned(date===focus?null:date); }
  // From the latest target day, so two quick swipes move two days even before a re-render.
  function shift(direction:number) { const next=addDays(target.current,direction*(view==='week'?7:1)); target.current=next; lensTo(next); setPinned(next===focus?null:next); }
  // The week strip slides in from the side the new week lies on.
  const stripFrom = useRef({monday, side:0});
  if (stripFrom.current.monday!==monday) stripFrom.current = {monday, side:monday>stripFrom.current.monday?1:-1};
  const dateNav = useRef<HTMLElement>(null);
  // A swipe of the days: the finger holds the drop; on a turn shift() glides it on from there, otherwise it settles back.
  const followDrag = (fraction:number|null, turned=false) => { if (fraction!==null) lensCtl.follow(fraction); else if (!turned) lensCtl.settle(); };

  async function savePdf(hash:string) {
    if (!('caches' in window)) throw Error('Сохранение PDF недоступно в этом браузере.');
    const cache = await caches.open(dataCache);
    const key = pdfKey(hash);
    if (!await cache.match(key)) {
      const response = await fetch(asset('latest.pdf')+'?v='+hash,{cache:'no-store',signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw Error('PDF пока недоступен. Пары уже сохранены.');
      if (Number(response.headers.get('content-length'))>8_000_000) throw Error('PDF слишком большой.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength>8_000_000) throw Error('PDF слишком большой.');
      const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if (actual!==hash) throw Error('PDF ещё публикуется. Пары уже сохранены; PDF загрузится при следующем обновлении.');
      await cache.put(key,new Response(bytes,{headers:{'Content-Type':'application/pdf'}}));
    }
    setPdfUrl(key); setPdfError('');
    for (const request of await cache.keys()) if (new URL(request.url).pathname!==key) await cache.delete(request);
  }

  async function refresh(manual=false) {
    if (checking.current || (!manual && Date.now()-lastAttempt.current<5*60*1000)) return;
    if (!navigator.onLine) {setOnline(false); return;}
    checking.current=true; lastAttempt.current=Date.now(); setBusy(true); setSyncError(''); setMessage('');
    try {
      const response = await fetch(asset('source.json')+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw Error('Сервер обновлений недоступен. Показано сохранённое расписание.');
      const snapshot = await response.json() as Snapshot;
      if (!validSnapshot(snapshot)) throw Error('Не удалось проверить полученное расписание. Предыдущая версия оставлена.');
      const before = current.current;
      if (Date.parse(snapshot.attemptedAt)<Date.parse(before.snapshot.attemptedAt)) throw Error('Сервер вернул старую копию. Повтори обновление позже.');
      const next:Saved = {snapshot,syncedAt:new Date().toISOString()};
      persist(next);
      current.current=next; setSaved(next);
      if (before.snapshot.hash!==snapshot.hash) setPdfUrl('');
      // Everything VMK published since this device last synced, described for the chosen group.
      const fresh = snapshot.history.filter(h=>Date.parse(h.detectedAt)>Date.parse(before.snapshot.attemptedAt));
      const name = String(groupSchedule(snapshot.schedule,loadGroup()).group);
      if (fresh.length) setMessage(describeUpdate(fresh[0],name));
      else if (manual) setMessage('Изменений нет');
      try { await savePdf(snapshot.hash); }
      catch (error) { setPdfError(error instanceof Error?error.message:'Не удалось сохранить PDF. Пары сохранены.'); }
    } catch (error) { setSyncError(error instanceof Error?error.message:'Не удалось получить обновления. Сохранённая версия оставлена.'); }
    finally { checking.current=false; setBusy(false); }
  }

  useEffect(()=>{
    let disposed=false;
    const tick=()=>{setClock(clockMoscow());setToday(isoMoscow());};
    tick(); const timer=setInterval(tick,15000);
    const syncTimer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5*60*1000);
    const onOnline=()=>{setOnline(true);lastAttempt.current=0;void refresh();};
    const onOffline=()=>setOnline(false);
    // The saved app opens at once from the phone (sw.js), so a new version of the site arrives in the background.
    // When it takes over before the user touched anything since opening or returning to the app, nothing is lost
    // and the page reloads quietly; otherwise a banner offers to reload instead of interrupting.
    let touched=false, registration:ServiceWorkerRegistration|null=null;
    const onTouch=()=>{touched=true;};
    window.addEventListener('pointerdown',onTouch,{passive:true});window.addEventListener('keydown',onTouch);
    const hadController=!!navigator.serviceWorker?.controller;
    const onNewVersion=()=>{
      if(!hadController)return;
      const busy=!!document.querySelector('[data-slot=dialog-content]') || document.activeElement?.matches('input,textarea');
      if(!touched && !busy) location.reload(); else setAppUpdated(true);
    };
    navigator.serviceWorker?.addEventListener('controllerchange',onNewVersion);
    const onVisible=()=>{if(document.visibilityState==='visible'){touched=false;tick();void refresh();void registration?.update().catch(()=>{});}};
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);document.addEventListener('visibilitychange',onVisible);
    async function prepareOffline() {
      try {
        persist(current.current);
        if (!('serviceWorker' in navigator)) throw Error('Офлайн-доступ не поддерживается браузером.');
        registration=await navigator.serviceWorker.register(asset('sw.js'),{scope:import.meta.env.BASE_URL,updateViaCache:'none'});
        await navigator.serviceWorker.ready;
        if (!disposed) setOfflineReady(!!await caches.match(asset('offline-ready')));
        void registration?.update().catch(()=>{});
        if (await (await caches.open(dataCache)).match(pdfKey(current.current.snapshot.hash))) setPdfUrl(pdfKey(current.current.snapshot.hash));
      } catch { if(!disposed)setSyncError('Не удалось подготовить доступ без сети. Подключись к интернету и открой сайт ещё раз.'); }
    }
    void prepareOffline(); void refresh();
    return()=>{disposed=true;navigator.serviceWorker?.removeEventListener('controllerchange',onNewVersion);window.removeEventListener('pointerdown',onTouch);window.removeEventListener('keydown',onTouch);clearInterval(timer);clearInterval(syncTimer);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);document.removeEventListener('visibilitychange',onVisible);};
  // Initialization happens before the first update; refs always hold the last saved version.
  },[]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key==='ArrowLeft') shift(-1); else if (event.key==='ArrowRight') shift(1);
    };
    window.addEventListener('keydown',onKey); return()=>window.removeEventListener('keydown',onKey);
  });

  useEffect(()=>{document.title = ongoing ? `ещё ${duration(ongoingLeft)} · ${cleanTitle(ongoing)}` : 'Расписание ВМК';},[ongoing?.id,ongoingLeft]);
  useEffect(()=>{
    const params=new URLSearchParams(location.search), wanted=params.get('g');
    if(!wanted)return;
    if(table.groups[wanted]){setGroup(wanted);setOnboarding(false);}
    params.delete("g");window.history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
  },[]);
  // The new section slides in from the side it lies on in the tab bar.
  const [paneDir,setPaneDir] = useState('');
  function switchTab(next:Section){if(next===tab)return;if(tab==='map'){setTab(next);return;}stripFrom.current={monday,side:0};setPaneDir(sectionIndex(next)>sectionIndex(tab)?'right':'left');setTab(next);}
  const closePdf = React.useCallback(() => setPdfOpen(false), []);
  // The class before this one tells where the walk starts.
  function openRoom(room:string, date=today, start='') {
    const to=findRoom(room);
    if(!to)return;
    const day=(lessonsOn(data,date) as Lesson[]).filter(l=>!start || l.start<start);
    const prev=[...day].reverse().map(l=>findRoom(roomFor(l,subgroups.selected)||'')).find(Boolean);
    setMapTarget({to:to.key, from:start && prev && prev.key!==to.key ? prev.key : null, n:Date.now()});
    if (tab!=='map') setMapFrom(tab);
    setTab('map');
    scrollTo({top:0});
  }
  const nextLesson=todayLessons.find(l=>l.end>clock && findRoom(roomFor(l,subgroups.selected)||''));
  function editorFor(date:string,lesson:Lesson):Editor {
    const id=date+':'+lesson.id, task=homework.tasks.find(t=>t.id===id), editing=homework.editing===id;
    const draft:Task=task||{id,date,subject:cleanTitle(lesson),text:'',done:false};
    return {task,editing,open:()=>homework.setEditing(editing?'':id),
      editor:editing?<HomeworkEditor task={draft} error={homework.error} onSave={homework.save} onToggle={()=>homework.toggle(id)} onClose={()=>homework.setEditing('')}/>:null};
  }
  // The pager shows "day:<date>" or "week:<monday>".
  const pageId = view==='day' ? `day:${selected}` : `week:${monday}`;
  const pageDate = (id:string) => id.slice(id.indexOf(':')+1);
  // Drawn pages are reused while nothing they show has changed: turning a day used to redraw the current day and
  // both neighbours (twice, with the deferred neighbours), which froze the day lens for a moment on every turn.
  const pageDeps = [data.hash, groupName, faculty.term?.[0]?.start, today, clock, nextId, JSON.stringify(subgroups.selected), JSON.stringify(homework.tasks),
    homework.editing, homework.error, recent.map(c=>c.id).join(), faculty.notices.join('|'), checks.map(w=>w.id+w.text).join()].join('§');
  const pageCache = useRef(new Map<string,{deps:string; node:React.ReactNode}>());
  const renderPage = (id:string) => {
    const hit = pageCache.current.get(id);
    if (hit && hit.deps===pageDeps) return hit.node;
    const node = id.startsWith('day:') ? renderDay(pageDate(id)) : Array.from({length:7},(_,i)=>renderDay(addDays(pageDate(id),i),true));
    pageCache.current.set(id, {deps:pageDeps, node});
    if (pageCache.current.size > 12) pageCache.current.delete(pageCache.current.keys().next().value!);
    return node;
  };
  const neighbourPage = (id:string,d:number) => id.startsWith('day:') ? `day:${addDays(pageDate(id),d)}` : `week:${addDays(pageDate(id),7*d)}`;
  function renderDay(date:string,weekly=false) {
    const list=lessonsOn(data,date) as Lesson[];
    const kind=dayKind(faculty.term,date);
    const items:React.ReactNode[]=[];
    let until='';
    for (const l of list) {
      const gap=until ? minutes(l.start)-minutes(until) : 0;
      if (gap>=30) {
        const now=date===today && !!clock && clock>=until && clock<l.start;
        items.push(<div key={'gap'+l.id} className={`gap ${now?'now':''}`}><span>Окно</span><b>{now?`ещё ${duration(minutes(l.start)-minutes(clock))}`:duration(gap)}</b><small>{until}–{l.start}</small></div>);
      }
      items.push(<LessonCard key={l.id} lesson={l} date={date} today={today} clock={clock} change={changeFor(l.id)} next={date===today && l.id===nextId} hw={editorFor(date,l)} preferredTeacher={subgroups.selected[cleanTitle(l)]} stacked={!isStacked(l,data.lessons) ? '' : fiit && weekOf(faculty.term,date) ? (/-\d$/.test(l.id)?'even':'odd') : list.filter(o=>o.id.replace(/-\d$/,'')===l.id.replace(/-\d$/,'')).length>1 ? 'both' : ''} notice={noticeFor(faculty.notices,l,date)} check={checks.filter(w=>w.id===l.id).map(w=>w.text)}/>);
      if (l.end>until) until=l.end;
    }
    const density = weekly ? 'compact' : list.length<=2 ? 'roomy' : list.length===3 ? 'comfy' : 'compact';
    return <section className={weekly?'week-day':'day'} key={date} aria-label={formatDate(date)}>
      {weekly && <div className="day-title"><h2>{dayNames[weekday(date)]}<span> · {formatDate(date,{day:'numeric',month:'short'})}</span></h2><span>{lessonCount(list.length)}</span></div>}
      {list.length ? <div className={`list ${density} ${weekly?'':'fill'}`}>{items}</div>
        : kind.kind==='holiday' ? <div className="empty"><CalendarDays size={22}/><p>{kind.name}</p><small>Праздник, пар нет</small></div>
        : kind.kind==='after' ? <div className="empty"><GraduationCap size={22}/><p>Занятия закончились {formatDate(kind.end)}</p><small>Дальше — зачёты и экзамены.</small><button className="text-button" onClick={()=>setTab('session')}>Открыть сессию</button></div>
        : kind.kind==='before' ? <div className="empty"><CalendarDays size={22}/><p>Занятия начнутся {formatDate(kind.start)}</p></div>
        : <div className="empty"><CalendarDays size={22}/><p>Пар нет — отдыхай</p></div>}
    </section>;
  }

  return <OpenRoom.Provider value={openRoom}><OpenTeacher.Provider value={teacherCard.open}><Wallpaper/><div className="shell" data-pane={paneDir}>
    <MsuDecor/>
    <header className="topbar">
      <button className="brand" onClick={()=>setGroupsOpen(true)} aria-label={`Группа ${groupName}, сменить`}><span className="brandmark" aria-hidden="true"><i style={{maskImage:`url(${asset('brand/vmk-mark.png')})`, WebkitMaskImage:`url(${asset('brand/vmk-mark.png')})`}}/></span><span><small className="glass-only">МГУ · ВМК</small><strong>{groupName} группа <ChevronDown size={14}/></strong></span></button>
      <div className="header-actions">
        <a className="vmk-link" href="https://cs.msu.ru/studies/schedule" target="_blank" rel="noreferrer" aria-label="Расписание на сайте ВМК">ВМК<ArrowUpRight size={13}/></a>
        {search.button}
        <ThemeButton/>
      </div>
    </header>

    {ongoing && <div className="now-bar" role="status" aria-label={`Идёт пара, до конца ${duration(ongoingLeft)}`}>
      <b>ещё {duration(ongoingLeft)}</b><span>{cleanTitle(ongoing)}{roomFor(ongoing,subgroups.selected) ? ` · ${roomFor(ongoing,subgroups.selected)}` : ''}</span><small>до {ongoing.end}</small>
      <i style={{'--p':((minutes(clock)-minutes(ongoing.start))/(minutes(ongoing.end)-minutes(ongoing.start))).toFixed(3)} as CSSProperties}/>
    </div>}

    <SectionTabs value={tab==='map' ? mapFrom : tab} onChange={switchTab}/>

    {tab==='map' ? <Suspense fallback={<p className="personal-hint">Загружаем карту…</p>}><button className="map-back" onClick={()=>{setTab(mapFrom);scrollTo({top:0});}}><ChevronLeft size={18}/>{mapFrom==='calendar'?'Календарь':mapFrom==='session'?'Сессия':mapFrom==='info'?'Полезное':'Расписание'}</button><CampusMap target={mapTarget?.to ?? null} fromHint={mapTarget?.from ?? null} key={mapTarget?.n ?? 0}>
      {nextLesson && <button onClick={()=>openRoom(roomFor(nextLesson,subgroups.selected),today,nextLesson.start)}>К паре {nextLesson.start}: {roomFor(nextLesson,subgroups.selected)}</button>}
    </CampusMap></Suspense> : tab==='calendar' ? <main className="session-main pane" key="calendar">
      <TermCalendar term={faculty.term} sessions={[faculty.session, ...faculty.archive].filter((s):s is Session=>!!s)} group={groupName} today={today} academicYear={data.year}
        classesOn={date=>lessonsOn(data,date).length} openDay={date=>{setView('day');go(date);setTab('schedule');scrollTo({top:0});}}/>
      <button className="changes-button stats-open" onClick={()=>setStatsOpen(true)}><CalendarRange size={17}/><span><b>Сколько пар</b><small>за неделю и семестр, по предметам и в сравнении всех групп</small></span><ChevronRight size={18}/></button>
    </main> : tab==='info' ? <main className="session-main pane" key="info">
      <UsefulView table={table} group={groupName} streams={streams(table).map(s=>({title:s.title, groups:s.groups}))}/>
    </main> : tab==='session' ? <main className="session-main pane" key="session">
      <SessionView session={faculty.session} archive={faculty.archive} lecturers={lecturers} subjects={[...new Set(data.lessons.map(l=>cleanTitle(l)))]} group={groupName} today={today} academicYear={data.year} classesEnd={termEnd(faculty.term)}
        room={(name,date,start)=><LessonAt.Provider value={{date,start}}><Room room={name}/></LessonAt.Provider>} teacher={name=><TeacherName name={name}/>}/>
    </main> : <>
    <div className={`heading ${view}`}>
      <div className="heading-text">
        <p className="glass-only glass-date">{view==='day' ? `${dayNames[weekday(selected)]}, ${formatDate(selected,{day:'numeric',month:'long'})}` : 'Расписание на неделю'}</p>
        <h1><span className="h-lead">{view==='day' && near || months}</span><span className="h-month">{months}</span></h1>
        <p className="eyebrow">
          {view==='day' && near && <span className="e-rel">{near}</span>}
          {parity!=null && <span className="e-week">{parity?'нечётная':'чётная'} неделя</span>}
          {view==='day' && <span className="count">{lessonCount(selectedLessons.length)}{dayStart && <span className="day-end"> · {dayStart}–{dayEnd}</span>}</span>}
          {pinned!==null && <button className="text-button" onClick={()=>go(focus)}>{focus===today?'Сегодня':'К ближайшим'}</button>}
          <button className={`status ${tone}`} onClick={()=>setStatusOpen(true)} aria-label={`Статус проверки: ${statusText}`}>
            <span className="status-icon">{!online?<WifiOff size={12}/>:busy?<RefreshCw size={12} className="spin"/>:<span className="status-dot"/>}</span>
            <span aria-live="polite">{statusText}</span>
          </button>
        </p>
      </div>
    </div>

    <nav className="date-navigation" aria-label="Выбрать день" ref={dateNav}>
      <button className="icon-button" aria-label={view==='day'?'Предыдущий день':'Предыдущая неделя'} onClick={()=>shift(-1)}><ChevronLeft/></button>
      <div className="days" key={monday} data-from={stripFrom.current.side>0?'right':stripFrom.current.side<0?'left':undefined} style={{'--day':weekday(selected)} as CSSProperties}>
        {view==='day' && <i ref={lensCtl.ref} className={`day-lens ${selected===today?'today':''}`} aria-hidden="true"/>}
        {week.map((date,i)=><button key={date} className={`day-button ${date===today?'today':''}`} aria-pressed={view==='day' && date===selected} onClick={()=>{setView('day');go(date);}} aria-label={dayNames[i]+', '+formatDate(date)}><span>{shortDays[i]}</span><strong>{Number(date.slice(-2))}</strong><em>{dayNames[i]}</em></button>)}
      </div>
      <button className="icon-button" aria-label={view==='day'?'Следующий день':'Следующая неделя'} onClick={()=>shift(1)}><ChevronRight/></button>
    </nav>

    <main ref={scheduleArea}>
      {recent.length>0 && <section className="changes-banner" aria-label="Изменения расписания">
        <div><b>ВМК изменил расписание{unseen[0] ? ` · от ${unseen[0].date}` : ''}</b>
        <span>У группы {groupName}: {recent.length} {plural(recent.length,['изменение','изменения','изменений'])}. {[...new Set(recent.map(c=>shortDays[c.day]))].join(', ')} — отмечены в расписании.</span></div>
        <div className="changes-banner-actions"><button onClick={()=>setChangesOpen(true)}>Что поменялось</button><button className="quiet" onClick={hideChanges}>Убрать отметки</button></div>
      </section>}
      {freshNotices.length>0 && <section className="notices" aria-label="Объявления ВМК">
        <div className="notices-head"><strong>Объявление ВМК</strong><button className="dismiss-message" aria-label="Прочитано" onClick={dismissNotices}><X size={15}/></button></div>
        {freshNotices.map(n=><p key={n}>{n}</p>)}
      </section>}
      {glance && glance.kind!=='done' && glance.kind!=='now' && <section className={`glance-line ${glance.kind}`} aria-label="Мой день сейчас">
        <b>{glance.left!=null && (glance.left<60 ? `${glance.left} мин` : `${Math.floor(glance.left/60)}:${String(glance.left%60).padStart(2,'0')}`)}</b>
        <strong>{{now:'до конца пары',before:'до первой пары',break:'до следующей пары'}[glance.kind as 'now']}</strong>
        <span>{glance.kind==='now' ? (glance.detail.split('дальше ')[1] ? `· дальше ${glance.detail.split('дальше ')[1].split(' · ')[0]}` : '· последняя') : `· ${glance.detail.split(' · ')[0]}`}</span>
      </section>}
      {appUpdated && <div className="message" role="status"><span>Сайт обновился — новая версия готова.<button className="message-more" onClick={()=>location.reload()}>Обновить</button></span><button className="dismiss-message" aria-label="Позже" onClick={()=>setAppUpdated(false)}><X size={15}/></button></div>}
      {message && <div className="message" role="status"><span>{message}{history.length>0 && message!=='Изменений нет' && <button className="message-more" onClick={()=>setChangesOpen(true)}>Что поменялось у всех групп</button>}</span><button className="dismiss-message" aria-label="Закрыть уведомление" onClick={()=>setMessage('')}><X size={15}/></button></div>}
      <DayPager page={pageId} render={renderPage} neighbour={neighbourPage} onTurn={shift} surface={scheduleArea} onDrag={view==='day' ? followDrag : undefined}/>
    </main>

    <footer className="footer">
      <div className="footer-links"><button className={view==='week'?'fresh-view':''} aria-pressed={view==='week'} onClick={()=>{setView(view==='week'?'day':'week');scrollTo({top:0});}}>{view==='week'?'По дням':'Вся неделя'}</button><button className="footer-count" onClick={()=>setStatsOpen(true)}>{weekCount} {plural(weekCount,['пара','пары','пар'])} в неделю</button>{history.length>0 && <button className={Date.now()-Date.parse(history[0].detectedAt)<RECENT?'fresh-changes':''} onClick={()=>setChangesOpen(true)}>Изменения</button>}{subgroups.button}{faculty.contacts && <button onClick={()=>setContactsOpen(true)}>Учебная часть</button>}{calendar.button}{pdfUrl && <button onClick={()=>setPdfOpen(true)}>PDF</button>}</div>
    </footer>
    </>}

    <Dialog open={statusOpen} onOpenChange={setStatusOpen}><DialogContent className="changes-dialog">
      <DialogTitle>Актуальность расписания</DialogTitle>
      <DialogDescription>Сервер сам скачивает PDF с сайта ВМК, разбирает все группы первого курса и публикует пары. Телефон подхватывает их при открытии и заменяет старые пары — смотреть PDF вручную не нужно.</DialogDescription>
      {syncError && <p className="status-error" role="alert">{syncError}</p>}
      {saved.snapshot.status==='error' && <p className="status-error">{saved.snapshot.error} Показана последняя проверенная версия.</p>}
      {status.tone==='warn' && saved.snapshot.status!=='error' && <p className="status-error">Последняя сверка с ВМК была давно: сервер проверки запускается с опозданием. Пары показаны по последней проверенной версии.</p>}
      <dl className="status-list">
        <div><dt>Последняя сверка с ВМК</dt><dd>{stamp(saved.snapshot.checkedAt || null)}</dd></div>
        <div><dt>Последняя попытка</dt><dd>{stamp(saved.snapshot.attemptedAt || null)}</dd></div>
        <div><dt>Получено телефоном</dt><dd>{saved.syncedAt?stamp(saved.syncedAt):'ещё нет'}</dd></div>
        <div><dt>Расписание на сайте ВМК от</dt><dd>{data.sourceDate}</dd></div>
        <div><dt>Без интернета</dt><dd>{offlineReady?'работает':'ещё не готово'}</dd></div>
      </dl>
      {pdfError && <p className="personal-hint">{pdfError}</p>}
      {checks.length>0 && <div className="status-error check-list"><b>Стоит сверить с PDF</b>{checks.map(w=><p key={w.id+w.text}>{dayNames[w.day]}, {w.start} · {w.title}: {w.text}</p>)}</div>}
      <button className="save-task" onClick={()=>refresh(true)} disabled={busy || !online}><RefreshCw size={15} className={busy?'spin':''}/> {busy?'Обновляем…':'Обновить'}</button>
      {history.length>0 && <button className="changes-button" onClick={()=>{setStatusOpen(false);setChangesOpen(true);}}><History size={17}/><span><b>Изменения расписания</b><small>последнее — от {history[0].date}, по всем группам</small></span><ChevronRight size={18}/></button>}
      <div className="source-links"><a href="https://cs.msu.ru/studies/schedule" target="_blank" rel="noreferrer">Сайт ВМК<ArrowUpRight size={14}/></a><a href={`https://github.com/${import.meta.env.VITE_REPO || 'mgucs/vmk-schedule'}/actions/workflows/pages.yml`} target="_blank" rel="noreferrer">История проверок<ArrowUpRight size={14}/></a></div>
    </DialogContent></Dialog>
    <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} table={table} term={faculty.term} group={groupName} today={today} clock={clock}
      streams={streams(table).map(s=>({title:s.title, groups:s.groups}))}/>
    {pdfOpen && pdfUrl && <PdfViewer url={pdfUrl} onClose={closePdf}/>}
    {homework.dialogs}
    {subgroups.dialog}
    {calendar.dialog}
    {search.dialog}
    {teacherCard.dialog}
    {faculty.contacts && <Dialog open={contactsOpen} onOpenChange={setContactsOpen}><DialogContent className="changes-dialog contacts-card">
      <DialogTitle>Учебная часть 1 курса</DialogTitle>
      <DialogDescription>Справки, пропуски, вопросы по учёбе и сессии. Контакты с сайта ВМК.</DialogDescription>
      <dl className="status-list">
        {faculty.contacts.room && <div><dt>Где</dt><dd><LessonAt.Provider value={{}}><Room room={faculty.contacts.room}/></LessonAt.Provider></dd></div>}
        {faculty.contacts.phone && <div><dt>Телефон</dt><dd><a href={`tel:${faculty.contacts.phone.replace(/[^+\d]/g,'')}`}>{faculty.contacts.phone}</a></dd></div>}
        {faculty.contacts.head && <div><dt>Начальник курса</dt><dd>{faculty.contacts.head.name}<br/><a href={`mailto:${faculty.contacts.head.email}`}>{faculty.contacts.head.email}</a></dd></div>}
        {faculty.contacts.inspector && <div><dt>Инспектор курса</dt><dd>{faculty.contacts.inspector.name}<br/><a href={`mailto:${faculty.contacts.inspector.email}`}>{faculty.contacts.inspector.email}</a></dd></div>}
      </dl>
      <div className="source-links"><a href="https://cs.msu.ru/studies/contacts" target="_blank" rel="noreferrer">Страница на сайте ВМК<ArrowUpRight size={14}/></a></div>
    </DialogContent></Dialog>}
    {onboarding && <Onboarding streams={streams(table)} onGroup={name=>{setGroupState(name);try{localStorage.setItem(groupKey,name);}catch{}}} onDone={()=>setOnboarding(false)}/>}
    <Dialog open={changesOpen} onOpenChange={setChangesOpen}><DialogContent className="changes-dialog wide"><DialogTitle>Изменения расписания</DialogTitle><DialogDescription>Что ВМК поменял в каждой новой версии PDF: было → стало. Сначала твоя группа, остальные — кнопками.</DialogDescription>
      {history.length ? history.map((entry,i)=><UpdateEntry key={entry.detectedAt} open={i===0} entry={entry} group={groupName} all={Object.keys(table.groups)}
        pdf={entry.pdfChanged ? (i===0 ? 'latest.pdf' : history.slice(0,i).reverse().find(h=>h.pdfChanged)?.previousPdf) : undefined}/>)
        : <p className="personal-hint">С момента запуска проверки ВМК расписание не менял. Сейчас на сайте версия от {data.sourceDate}.</p>}
      {history.length>0 && (recent.length>0
        ? <button className="changes-button" onClick={()=>{hideChanges();setChangesOpen(false);}}><X size={17}/><span><b>Убрать отметки из расписания</b><small>карточки пар и баннер станут обычными; история останется здесь</small></span></button>
        : seen && Date.now()-Date.parse(history[0].detectedAt)<RECENT && <button className="changes-button" onClick={showChanges}><History size={17}/><span><b>Снова отметить изменённые пары</b><small>в расписании за последнюю неделю</small></span></button>)}
    </DialogContent></Dialog>
    <Dialog open={groupsOpen} onOpenChange={setGroupsOpen}><DialogContent className="changes-dialog"><DialogTitle>Группа</DialogTitle><DialogDescription>Первый курс ВМК по потокам. Доступно и без интернета.</DialogDescription>
      {streams(table).map(stream=><section className="stream" key={stream.page}>
        <div className="stream-head"><strong>{stream.title}</strong><span>{stream.range}</span></div>
        <div className="group-grid">{stream.groups.map(name=><button key={name} aria-pressed={name===groupName} onClick={()=>setGroup(name)}>{name}</button>)}</div>
      </section>)}
      <button className="share-group" onClick={shareGroup}><Share2 size={16}/> Поделиться ссылкой на группу {groupName}</button>
      {shared && <p className="personal-hint share-result">{shared}</p>}
    </DialogContent></Dialog>
  </div></OpenTeacher.Provider></OpenRoom.Provider>;
}
