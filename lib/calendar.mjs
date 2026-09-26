import {cleanTitle,isDisplayedLesson,teacherRows} from './schedule-model.mjs';
import {roomFor} from './day-glance.mjs';

const typeNames={lecture:'лекция',consultation:'консультация',sport:'физкультура'};
const plus=(iso,n)=>new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday=iso=>(new Date(iso+'T12:00:00Z').getUTCDay()+6)%7;
const stamp=(iso,time)=>iso.replace(/-/g,'')+'T'+time.replace(':','')+'00';
const escape=text=>text.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/([,;])/g,'\\$1');
// RFC 5545: lines longer than 75 octets continue on the next line after a space.
function fold(line){
  const bytes=new TextEncoder().encode(line);
  if(bytes.length<=75)return line;
  const out=[];let chunk='',size=0;
  for(const char of line){
    const n=new TextEncoder().encode(char).length;
    if(size+n>(out.length?74:75)){out.push(chunk);chunk='';size=0;}
    chunk+=char;size+=n;
  }
  return [...out,chunk].join('\r\n ');
}

// Autumn term: classes run from 1 September to the end of December; January is the exam session.
export function calendarFile(schedule,subgroups={},now=new Date()){
  const first=`${schedule.year}-09-01`,last=`${schedule.year}-12-31`;
  const created=now.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
  const events=[];
  for(const lesson of schedule.lessons){
    if(!isDisplayedLesson(lesson))continue;
    const title=cleanTitle(lesson),room=roomFor(lesson,subgroups);
    const rows=teacherRows(lesson.detail),chosen=subgroups[title];
    const teachers=(chosen&&rows.some(r=>r.teacher===chosen)?[chosen]:rows.map(r=>r.teacher)).filter(Boolean);
    const summary=title+(typeNames[lesson.type]?` (${typeNames[lesson.type]})`:'');
    const event=(uid,date,extra=[])=>['BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${created}`,
      `DTSTART;TZID=Europe/Moscow:${stamp(date,lesson.start)}`,`DTEND;TZID=Europe/Moscow:${stamp(date,lesson.end)}`,...extra,
      `SUMMARY:${escape(summary)}`,...(room?[`LOCATION:${escape('ВМК МГУ, ауд. '+room)}`]:[]),
      ...(teachers.length?[`DESCRIPTION:${escape(teachers.join('\n'))}`]:[]),'END:VEVENT'];
    const uid=`vmk-${schedule.group}-${lesson.id}`;
    if(lesson.rule?.dates){for(const date of lesson.rule.dates)events.push(...event(`${uid}-${date}@vmk-schedule`,date));continue;}
    let start=lesson.rule?.from&&lesson.rule.from>first?lesson.rule.from:first;
    while(weekday(start)!==lesson.day)start=plus(start,1);
    if(start>last)continue;
    events.push(...event(`${uid}@vmk-schedule`,start,[`RRULE:FREQ=WEEKLY;UNTIL=${last.replace(/-/g,'')}T205959Z`]));
  }
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VMK schedule//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(`ВМК · группа ${schedule.group}`)}`,'X-WR-TIMEZONE:Europe/Moscow',
    'BEGIN:VTIMEZONE','TZID:Europe/Moscow','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0300','TZOFFSETTO:+0300','TZNAME:MSK','END:STANDARD','END:VTIMEZONE',
    ...events,'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
