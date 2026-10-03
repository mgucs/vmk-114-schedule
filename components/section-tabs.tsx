import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import {CalendarClock,CalendarRange,GraduationCap} from 'lucide-react';

const items=[['schedule','Расписание',CalendarClock],['calendar','Календарь',CalendarRange],['session','Сессия',GraduationCap]] as const;
// The campus map is not a section: it opens from a room (page.tsx, openRoom) and goes back where it came from.
export type Section=typeof items[number][0];
export const sectionIndex=(s:Section)=>items.findIndex(i=>i[0]===s);

// Slide a finger along the bar: the lens follows it, stretches with speed, and the section
// opens on release in glass mode, avoiding mounting expensive panes mid-gesture.
// Other styles keep their existing live switching. A tap still works as a tap.
export function SectionTabs({value,onChange}:{value:Section;onChange:(value:Section)=>void}) {
  const index=sectionIndex(value);
  const [position,setPosition]=useState<number|null>(null),[stretch,setStretch]=useState(1),[pressing,setPressing]=useState(false);
  const gesture=useRef<{id:number;x:number;y:number;dragged:boolean;lastX:number;lastT:number;live:number}|null>(null);
  const suppressClick=useRef(false);
  // Like the iOS 26 tab bar: scrolling down shrinks it to a small pill of icons, scrolling up (or reaching the top) opens it.
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    let last=scrollY,frame=0;
    const check=()=>{frame=0;const y=scrollY,d=y-last;
      if(y<80||d<-10){setCompact(false);last=y;}else if(d>14&&y>140){setCompact(true);last=y;}else if(Math.abs(d)>40)last=y;};
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(check);};
    addEventListener('scroll',onScroll,{passive:true});return()=>{removeEventListener('scroll',onScroll);cancelAnimationFrame(frame);};
  },[]);
  // Each move of the lens restarts its squish (two identical animations, alternating).
  const moves=useRef({index,n:0});
  if(moves.current.index!==index)moves.current={index,n:moves.current.n+1};
  const locate=(e:PointerEvent<HTMLElement>)=>{
    const buttons=[...e.currentTarget.querySelectorAll('button')];
    const first=buttons[0].getBoundingClientRect(),last=buttons.at(-1)!.getBoundingClientRect();
    return Math.max(0,Math.min(items.length-1,(e.clientX-first.left-first.width/2)/((last.left-first.left)/(items.length-1))));
  };
  function end(e:PointerEvent<HTMLElement>,cancel=false) {
    const g=gesture.current;if(!g||g.id!==e.pointerId)return;
    gesture.current=null;setPosition(null);setStretch(1);setPressing(false);
    if(g.dragged){suppressClick.current=!cancel;if(!cancel)onChange(items[Math.round(locate(e))][0]);}
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return <nav className={`tabs drag-tabs ${position!==null?'dragging':''} ${pressing?'pressing':''} ${compact&&position===null?'compact':''}`} aria-label="Разделы"
    style={{'--tab-position':position??index,'--tab-stretch':stretch} as CSSProperties}
    onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;suppressClick.current=false;setPressing(true);gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false,lastX:e.clientX,lastT:e.timeStamp,live:index};}}
    onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;
      if(!g.dragged&&Math.abs(e.clientX-g.x)>6&&Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y)){g.dragged=true;e.currentTarget.setPointerCapture(e.pointerId);}
      if(!g.dragged)return;
      e.preventDefault();
      const pos=locate(e),speed=Math.abs(e.clientX-g.lastX)/Math.max(8,e.timeStamp-g.lastT);
      g.lastX=e.clientX;g.lastT=e.timeStamp;
      setPosition(pos);setStretch(1+Math.min(.45,speed*.35));
      const n=Math.round(pos);
      if(n!==g.live){g.live=n;if(document.documentElement.dataset.style!=='glass')onChange(items[n][0]);navigator.vibrate?.(4);}
    }}
    onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>{if(e.target===e.currentTarget&&gesture.current?.id===e.pointerId){gesture.current=null;setPosition(null);setStretch(1);setPressing(false);}}}
    onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}
    onKeyDown={e=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();if(document.documentElement.dataset.style==='glass')e.stopPropagation();const last=items.length-1,n=e.key==='Home'?0:e.key==='End'?last:(index+(e.key==='ArrowRight'?1:last))%items.length;onChange(items[n][0]);e.currentTarget.querySelectorAll('button')[n].focus();}}>
    <span className="tab-lens" aria-hidden="true" data-squish={moves.current.n&&position===null?moves.current.n%2:undefined}/>
    {items.map(([name,label,Icon],i)=><button key={name} aria-pressed={value===name} data-hovered={position!==null&&Math.round(position)===i||undefined} onClick={()=>onChange(name)}><Icon/><span>{label}</span></button>)}
  </nav>;
}
