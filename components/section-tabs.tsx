import {useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import {CalendarClock,CalendarRange,GraduationCap,Map} from 'lucide-react';

const items=[['schedule','Расписание',CalendarClock],['calendar','Календарь',CalendarRange],['session','Сессия',GraduationCap],['map','Карта',Map]] as const;
type Section=typeof items[number][0];

export function SectionTabs({value,onChange}:{value:Section;onChange:(value:Section)=>void}) {
  const index=items.findIndex(i=>i[0]===value);
  const [position,setPosition]=useState<number|null>(null);
  const gesture=useRef<{id:number;x:number;y:number;index:number;dragged:boolean}|null>(null);
  const suppressClick=useRef(false);
  const locate=(e:PointerEvent<HTMLElement>)=>{
    const buttons=[...e.currentTarget.querySelectorAll('button')];
    const first=buttons[0].getBoundingClientRect(),last=buttons.at(-1)!.getBoundingClientRect();
    return Math.max(0,Math.min(items.length-1,(e.clientX-first.left-first.width/2)/((last.left-first.left)/(items.length-1))));
  };
  function end(e:PointerEvent<HTMLElement>,cancel=false) {
    const g=gesture.current;if(!g||g.id!==e.pointerId)return;
    gesture.current=null;setPosition(null);
    if(g.dragged){suppressClick.current=!cancel;if(!cancel)onChange(items[Math.round(locate(e))][0]);}
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return <nav className={`tabs drag-tabs ${position!==null?'dragging':''}`} aria-label="Разделы"
    style={{'--tab-position':position??index} as CSSProperties}
    onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;suppressClick.current=false;gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,index,dragged:false};}}
    onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;
      if(!g.dragged&&Math.abs(e.clientX-g.x)>7&&Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y)){g.dragged=true;e.currentTarget.setPointerCapture(e.pointerId);}
      if(g.dragged){e.preventDefault();setPosition(locate(e));}}}
    onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>{if(e.target===e.currentTarget&&gesture.current?.id===e.pointerId){gesture.current=null;setPosition(null);}}}
    onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}
    onKeyDown={e=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?3:(index+(e.key==='ArrowRight'?1:3))%4;onChange(items[n][0]);e.currentTarget.querySelectorAll('button')[n].focus();}}>
    <span className="tab-lens" aria-hidden="true"/>
    {items.map(([name,label,Icon],i)=><button key={name} aria-pressed={value===name} data-hovered={position!==null&&Math.round(position)===i||undefined} onClick={()=>onChange(name)}><Icon/><span>{label}</span></button>)}
  </nav>;
}
