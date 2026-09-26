import {cleanTitle,isDisplayedLesson,teacherRows} from './schedule-model.mjs';

// The PDF writes one person several ways: "доцент Чубыкин Игорь Валерьевич", "Чубыкин И.В.", "Перцева З.Н..".
const ranks=/^(?:академик\s+РАН|член-корр(?:еспондент)?\.?\s+РАН|профессор|доцент|ассистент|ст\.\s*преп(?:одаватель)?\.?|старший\s+преподаватель|преподаватель)\s+/i;
export function person(raw){
  let name=raw.replace(/\s+/g,' ').replace(/\s*МЗ\s*-\s*\d+$/,'').replace(/\.{2,}/g,'.').replace(/[,\s]+$/,'').trim();
  while(ranks.test(name))name=name.replace(ranks,'');
  const full=name.match(/^([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\s+([А-ЯЁ])[а-яё]+\s+([А-ЯЁ])[а-яё]+$/);
  if(full)return `${full[1]} ${full[2]}.${full[3]}.`;
  const short=name.match(/^([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\s+([А-ЯЁ])\.\s*([А-ЯЁ])\.?$/);
  return short?`${short[1]} ${short[2]}.${short[3]}.`:name;
}
const fold=text=>text.toLowerCase().replace(/ё/g,'е').replace(/[\s.,-]+/g,' ').trim();

// One row per class and person; groups that sit in the same room together are merged.
export function searchIndex(table){
  const rows=new Map();
  for(const [group,{lessons}] of Object.entries(table.groups))for(const lesson of lessons){
    if(!isDisplayedLesson(lesson))continue;
    const title=cleanTitle(lesson),people=teacherRows(lesson.detail);
    const list=people.length?people.map((p,i)=>({teacher:person(p.teacher),room:p.room||(i===0?lesson.room:'')})):[{teacher:'',room:lesson.room}];
    for(const {teacher,room} of list){
      const key=[lesson.day,lesson.start,title,teacher,room,JSON.stringify(lesson.rule)].join('|');
      const row=rows.get(key);
      if(row){row.groups.push(group);continue;}
      rows.set(key,{key,day:lesson.day,start:lesson.start,end:lesson.end,title,type:lesson.type,teacher,room,rule:lesson.rule,groups:[group],
        text:fold(`${title} ${teacher} ${lesson.detail}`)});
    }
  }
  return [...rows.values()].map(row=>({...row,groups:row.groups.sort()}));
}

// "ким", "матем анализ", "606", "118". A number of three digits is a group or a room.
export function searchLessons(index,query,day){
  const q=fold(query);
  if(!q)return [];
  const words=q.split(' ');
  return index.filter(row=>(day==null||row.day===day)&&words.every(word=>/^\d+$/.test(word)
    ? row.groups.includes(word)||row.room.split(', ').some(r=>r.match(/\d+/)?.[0]===word)
    : row.text.includes(word)||fold(row.room).includes(word)))
    .sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)||a.groups[0].localeCompare(b.groups[0]));
}

