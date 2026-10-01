// Local, deterministic extraction: the column is selected by actual PDF cell borders.
export const DAYS = ['понедельник','вторник','среда','четверг','пятница','суббота'];
const clean = s => s.replace(/\s+/g,' ').replace(/\s+([,.])/g,'$1').trim();
const transformPoint = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];

export function borders(op,OPS,height) {
  let matrix=[1,0,0,1,0,0],stack=[],path=[],segments=[];
  const paint=new Set([OPS.stroke,OPS.closeStroke,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke,OPS.fill,OPS.eoFill]);
  const segment=(x,y,u,v)=>{const a=transformPoint(matrix,x,y),b=transformPoint(matrix,u,v);path.push({x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),y0:height-Math.max(a[1],b[1]),y1:height-Math.min(a[1],b[1])});};
  for(let k=0;k<op.fnArray.length;k++) {
    const fn=op.fnArray[k],args=op.argsArray[k];
    if(fn===OPS.save)stack.push([...matrix]);
    else if(fn===OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(fn===OPS.transform)matrix=multiply(matrix,args);
    else if(fn===OPS.constructPath) {
      const [commands,coords]=args;let p=0,x=0,y=0,sx=0,sy=0;
      for(const c of commands) {
        if(c===OPS.moveTo){x=sx=coords[p++];y=sy=coords[p++];}
        else if(c===OPS.lineTo){const u=coords[p++],v=coords[p++];segment(x,y,u,v);x=u;y=v;}
        else if(c===OPS.rectangle){const u=coords[p++],v=coords[p++],w=coords[p++],h=coords[p++];segment(u,v,u+w,v);segment(u+w,v,u+w,v+h);segment(u+w,v+h,u,v+h);segment(u,v+h,u,v);}
        else if(c===OPS.closePath){segment(x,y,sx,sy);x=sx;y=sy;}
        else if(c===OPS.curveTo){p+=6;x=coords[p-2];y=coords[p-1];}
        else if(c===OPS.curveTo2||c===OPS.curveTo3){p+=4;x=coords[p-2];y=coords[p-1];}
      }
    }else if(paint.has(fn)){segments.push(...path);path=[];}
    else if(fn===OPS.endPath)path=[];
  }
  return {horizontal:segments.filter(s=>s.y1-s.y0<1.5&&s.x1-s.x0>20),vertical:segments.filter(s=>s.x1-s.x0<1.5&&s.y1-s.y0>5)};
}
function linesOf(items) {
  const lines=[];
  for(const item of [...items].sort((a,b)=>a.y-b.y||a.x-b.x)) {
    let line=lines.find(l=>Math.abs(l.y-item.y)<3);
    if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);
  }
  return lines.map(l=>({...l,text:clean(l.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' '))}));
}
// "Ляховенко О.И.", "Горячая И.В. П-6", "доцент Ким Галина Динховна 624".
const TEACHER_ONLY=/^(?:(?:доцент|профессор|академик|ассистент)\s+)?[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+(?:[А-ЯЁ]\.\s*[А-ЯЁ]\.|[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)(?:\s*,?\s*(?:П\s*[-–]\s*\d+|\d{2,3}(?:\s*-\s*[а-я])?))*[.,]?$/;
// Words VMK's PDF prints with their first letters lost.
const TYPOS=[[/(^|\s)актикум(?=\s|$)/g,'$1Практикум'],[/\sгосуд\.(?=\s|$)/,' государственности']];
// A teacher printed on the subject line: "История России П-5 Меркулова Анастасия Михайловна", "Английский язык Перцева З..Н.".
const INLINE_TEACHER=/^(.*?[а-яё)])\.?\s+(?:(П\s*[-–]\s*\d+|\d{3})\s+)?((?:доцент|профессор)?\s*[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+(?:[А-ЯЁ]\.+\s*(?:[А-ЯЁ]\.*)?|[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:вич|вна|ич)))$/;
const ROOM=/\s+(П\s*[-–]\s*\d+|\d{2,3}(?:\s*-\s*[а-я])?(?:\/\d)?)\s*$/i;
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
// Dates and times VMK writes into a subject line, at its start, end or in brackets:
// "16.50-18.20", "с 12.15", "9.00", "с 10.09", "с 3 октября", "с октября", "до 15 октября", "по 20.10",
// "только 5.09", "5, 12, 19.09", "5.09, 12.09 и 3.10", "12 и 19 сентября". Returns the title without them.
const MONTH='(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)';
const monthOf=name=>MONTHS.indexOf(name.toLowerCase())+1;
const hhmm=(h,m)=>`${String(h).padStart(2,'0')}:${m}`;
export function readQualifiers(text,year,start,end){
  const iso=(d,m)=>{d=Number(d);m=Number(m);if(!(m>=1&&m<=12&&d>=1&&d<=31))return null;return `${m<8?year+1:year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;};
  // A number pair is a time when it cannot be a date: minutes 00 or above 12, or written with a colon.
  const isTime=(h,m,sep=':')=>Number(h)>=8&&Number(h)<=21&&Number(m)<60&&(sep===':'||m==='00'||Number(m)>12);
  let title=text,from=null,until=null,dates=null,startAt=null;
  const take=re=>{const m=title.match(re);if(m)title=(title.slice(0,m.index)+' '+title.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim();return m;};
  const B=String.raw`(?:^|[\s(,;])`,E=String.raw`(?=$|[\s),;.])`;
  let m;
  // Time range of a class that does not follow the rows: "16.50-18.20 Физическая культура".
  if((m=take(/^(\d{1,2})[.:](\d{2})\s*[–—-]\s*(\d{1,2})[.:](\d{2})/))){start=hhmm(m[1],m[2]);end=hhmm(m[3],m[4]);}
  // Lists of dates: only these days.
  if((m=take(new RegExp(B+String.raw`(?:только\s+)?((?:\d{1,2}\s*\.\s*\d{1,2}\s*(?:,|и)\s*)+\d{1,2}\s*\.\s*\d{1,2})`+E,'i')))){
    const list=[...m[1].matchAll(/(\d{1,2})\s*\.\s*(\d{1,2})/g)].map(x=>iso(x[1],x[2]));if(list.every(Boolean))dates=list;}
  if(!dates&&(m=take(new RegExp(B+String.raw`(?:только\s+)?((?:\d{1,2}\s*\.?\s*(?:,|и)\s*)+\d{1,2})\s*\.\s*(\d{2})`+E,'i')))){
    const list=m[1].match(/\d+/g).map(d=>iso(d,m[2]));if(list.every(Boolean))dates=list;}
  if(!dates&&(m=take(new RegExp(B+String.raw`(?:только\s+)?((?:\d{1,2}\s*(?:,|и)\s*)+\d{1,2})\s+`+MONTH+E,'i')))){
    const list=m[1].match(/\d+/g).map(d=>iso(d,monthOf(m[2])));if(list.every(Boolean))dates=list;}
  if(!dates&&(m=take(new RegExp(B+String.raw`только\s+(\d{1,2})(?:\s*\.\s*(\d{2})|\s+`+MONTH+String.raw`)`+E,'i')))){
    const d=iso(m[1],m[2]||monthOf(m[3]));if(d)dates=[d];}
  // First and last dates.
  if((m=take(new RegExp(B+String.raw`(?:до|по)\s+(\d{1,2})(?:\s*\.\s*(\d{2})(?!\s*[-–])|\s+`+MONTH+String.raw`)`+E,'i'))))until=iso(m[1],m[2]||monthOf(m[3]));
  if((m=take(new RegExp(B+String.raw`со?\s+(\d{1,2})\s+`+MONTH+E,'i'))))from=iso(m[1],monthOf(m[2]));
  if(!from&&(m=title.match(new RegExp(B+String.raw`со?\s+(\d{1,2})\s*([.:])\s*(\d{2})`+E,'i')))&&!isTime(m[1],m[3],m[2])){take(new RegExp(B+String.raw`со?\s+\d{1,2}\s*[.:]\s*\d{2}`+E,'i'));from=iso(m[1],m[3]);}
  if(!from&&(m=take(new RegExp(B+String.raw`со?\s+`+MONTH+E,'i'))))from=iso(1,monthOf(m[1]));
  // A start time: "с 12.15", "9.00", "в 9:00". VMK may copy one cell into two rows: the time moves the start
  // only in the row it falls in (or an hour before it); elsewhere it is dropped from the title.
  if((m=title.match(/^(?:с|в)?\s*(\d{1,2})([.:])(\d{2})(?=\s|$)/i))&&isTime(m[1],m[3],m[2])){take(/^(?:с|в)?\s*\d{1,2}[.:]\d{2}/i);startAt=hhmm(m[1],m[3]);}
  // A bare "10.09 Title" marks the first date of a weekly class.
  if(!from&&!dates&&(m=title.match(/^(\d{1,2})\.(\d{2})(?=\s)/))&&iso(m[1],m[2])){take(/^\d{1,2}\.\d{2}/);from=iso(m[1],m[2]);}
  if(startAt&&minutes(startAt)>=minutes(start)-60&&minutes(startAt)<minutes(end))start=startAt;
  // A bracket whose partner went away with a date.
  if(!title.includes('('))title=title.replace(/\)/g,' ');
  if(!title.includes(')'))title=title.replace(/\(/g,' ');
  title=title.replace(/\(\s*\)/g,'').replace(/^[\s,;.:–—-]+|[\s,;:–—-]+$/g,'').replace(/\s+/g,' ');
  const rule=dates?{dates}:from||until?{...(from?{from}:{}),...(until?{until}:{})}:null;
  return {title,start,end,rule};
}
function lesson(day,rowId,start,end,cell,shared,year,suffix){
  const raw=cell.map(l=>l.text).join('\n');
  const titleParts=[];let split=0;
  for(const l of cell){if(titleParts.length&&(/(?:[А-ЯЁ]\.\s*){2}/.test(l.text)||/^(доцент|профессор|академик)\s/i.test(l.text)))break;titleParts.push(l.text);split++;}
  let title=TYPOS.reduce((t,[from,to])=>t.replace(from,to),titleParts.join(' ').replace(/^\.?\s*/,''));
  let rule;
  ({title,start,end,rule}=readQualifiers(title,year,start,end));
  let room=title.match(ROOM)?.[1]?.replace(/\s/g,'').replace('–','-')||'';
  if(room)title=title.replace(ROOM,'');
  let detail=cell.slice(split).map(l=>l.text).join('\n');
  // Two consultations in one cell: the second one goes to the details.
  const second=title.search(/\s+Консультация\.\s/i);
  if(second>0){detail=[title.slice(second).trim(),detail].filter(Boolean).join('\n');title=title.slice(0,second);}
  const trailing=title.match(/\s+(\d{3})$/);
  if(trailing){room||=trailing[1];title=title.slice(0,trailing.index);}
  const inline=title.match(INLINE_TEACHER);
  if(inline){title=inline[1];room||=inline[2]?.replace(/\s/g,'').replace('–','-')||'';detail=[inline[3].replace(/\.{2,}/g,'.'),detail].filter(Boolean).join('\n');}
  title=title.replace(/(язык|России)\.$/,'$1');
  const type=/^Конс/i.test(title)?'consultation':/Физическая/.test(title)?'sport':(room&&(shared||/^П/.test(room)))||(shared&&/^(доцент|профессор|академик)/im.test(detail))?'lecture':'class';
  return {id:`${day}-${rowId}${suffix}`,day,start,end,title,detail,room,type,rule,raw};
}
function uniqueRows(items){
  const rows=[];
  for(const item of [...items].sort((a,b)=>a.y-b.y||a.x-b.x)) if(!rows.some(r=>Math.abs(r.y-item.y)<6)) rows.push(item);
  return rows;
}
// Parses every group column of every page: {year, groups:{"101":{page,lessons}, …}}.
export async function parseAll(pdfjs,data) {
  const task=pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false,useSystemFonts:true,verbosity:0});
  const doc=await task.promise;
  try {
    const groups={},prevCells=new Map();let year=0;
    for(let pageNo=1;pageNo<=doc.numPages;pageNo++) {
      const page=await doc.getPage(pageNo),content=await page.getTextContent();
      const height=page.view[3],items=content.items.filter(i=>i.str?.trim()).map(i=>({str:i.str,x:i.transform[4],y:height-i.transform[5],width:i.width}));
      const headers=uniqueRows(items.filter(i=>DAYS.includes(i.str.trim().toLowerCase())));
      if(!headers.length)continue;
      if(headers.length!==6)throw Error(`Страница ${pageNo}: в PDF изменилась структура дней.`);
      year||=Number(items.map(i=>i.str).join(' ').match(/(20\d{2})\s*\/\s*20\d{2}/)?.[1]);
      if(!year)throw Error('Не удалось определить учебный год PDF.');
      const {horizontal,vertical}=borders(await page.getOperatorList(),pdfjs.OPS,height);
      for(let day=0;day<6;day++) {
        const head=headers[day],bottom=headers[day+1]?.y??height;
        const cols=items.filter(i=>/^1\d\d$/.test(i.str.trim())&&Math.abs(i.y-head.y)<6).sort((a,b)=>a.x-b.x).map(i=>({group:i.str.trim(),x:i.x+i.width/2}));
        if(!cols.length)throw Error(`Страница ${pageNo}: не найдены номера групп.`);
        const contentLeft=Math.max(...vertical.filter(v=>v.x0<cols[0].x-10&&v.y0<head.y&&v.y1>head.y).map(v=>v.x0));
        if(!Number.isFinite(contentLeft))throw Error('Не найдена граница таблицы.');
        const times=linesOf(items.filter(i=>i.x<contentLeft-2&&i.y>head.y+5&&i.y<bottom-4));
        let validTimes=0;
        for(const t of times){
          const match=t.text.match(/(\d{1,2})[.:](\d{2})\s*[–—-]\s*(\d{1,2})[.:](\d{2})/);
          if(!match)continue;
          validTimes++;
          const start=`${match[1].padStart(2,'0')}:${match[2]}`,end=`${match[3].padStart(2,'0')}:${match[4]}`;
          const tx=contentLeft-6;
          const rowLines=horizontal.filter(h=>h.x0<tx&&h.x1>tx);
          const top=Math.max(...rowLines.filter(h=>h.y0<t.y-4).map(h=>h.y0));
          const rowEnd=Math.min(...rowLines.filter(h=>h.y0>t.y+1).map(h=>h.y0));
          if(!Number.isFinite(top)||!Number.isFinite(rowEnd)||rowEnd-top>200)throw Error('Не удалось прочитать строки PDF.');
          for(const col of cols){
            const inner=horizontal.filter(h=>h.x0<col.x&&h.x1>col.x&&h.y0>top+3&&h.y0<rowEnd-3).map(h=>h.y0).sort((a,b)=>a-b);
            const bounds=[top];for(const y of inner)if(y-bounds.at(-1)>3)bounds.push(y);bounds.push(rowEnd);
            let n=0;
            for(let k=0;k<bounds.length-1;k++){
              const a=bounds[k],b=bounds[k+1],mid=(a+b)/2;
              const vs=vertical.filter(v=>v.y0<mid&&v.y1>mid);
              const left=Math.max(contentLeft,...vs.filter(v=>v.x0<col.x).map(v=>v.x0));
              const right=Math.min(...vs.filter(v=>v.x0>col.x).map(v=>v.x0));
              if(!Number.isFinite(right))throw Error('Не найдена правая граница ячейки.');
              const cell=linesOf(items.filter(i=>i.x+i.width/2>left+1&&i.x+i.width/2<right-1&&i.y>a+2&&i.y<b));
              if(!cell.length)continue;
              const shared=cols.filter(c=>c.x>left&&c.x<right).length>1;
              const list=(groups[col.group]||={page:pageNo,lessons:[]}).lessons;
              // A part holding only a teacher (and a room) belongs to the class above it: VMK sometimes fills
              // one cell as two coloured blocks, and the edge between them is not a split into odd/even weeks.
              const prev=list.at(-1);
              if(n&&prev?.day===day&&prev.start===start&&cell.every(l=>TEACHER_ONLY.test(l.text))){
                const merged=[...prevCells.get(prev),...cell];prevCells.delete(prev);
                const again=lesson(day,start,start,end,merged,shared,year,prev.id.slice(`${day}-${start}`.length));
                list[list.length-1]=again;prevCells.set(again,merged);continue;
              }
              // The same text repeated in the lower part of a cell is one class, not two.
              if(n&&prev?.day===day&&prev.start===start&&prev.raw===cell.map(l=>l.text).join('\n'))continue;
              const made=lesson(day,start,start,end,cell,shared,year,n++?`-${n}`:'');
              list.push(made);prevCells.set(made,cell);
            }
          }
        }
        if(validTimes<3||validTimes>8)throw Error('Не удалось проверить время занятий.');
      }
    }
    const names=Object.keys(groups);
    if(!names.includes('114'))throw Error('В PDF не найдена группа 114.');
    for(const name of names){const lessons=groups[name].lessons;if(lessons.length<8||lessons.length>45)throw Error(`Не удалось проверить полноту расписания группы ${name}.`);}
    return {year,groups};
  }finally{await doc.destroy();}
}
export async function parseSchedule(pdfjs,data,group='114'){const all=await parseAll(pdfjs,data);return {group:Number(group),year:all.year,...all.groups[group]};}
export function isActive(lesson,date){const day=date.slice(0,10),r=lesson.rule;return !r||((!r.from||day>=r.from)&&(!r.until||day<=r.until)&&(!r.dates||r.dates.includes(day)));}
