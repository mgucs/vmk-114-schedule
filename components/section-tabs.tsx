import {useLayoutEffect,useRef,type PointerEvent} from 'react';
import {BookOpen,CalendarClock,CalendarRange,GraduationCap} from 'lucide-react';

const items=[['schedule','Расписание',CalendarClock],['calendar','Календарь',CalendarRange],['session','Сессия',GraduationCap],['info','Полезное',BookOpen]] as const;
// The campus map is not a section: it opens from a room (page.tsx, openRoom) and goes back where it came from.
export type Section=typeof items[number][0];
export const sectionIndex=(s:Section)=>items.findIndex(i=>i[0]===s);

// Slide a finger along the bar: the lens moves by exactly as much as the finger, from where it stood (it used to jump
// under the finger first), and glides to the nearest section when let go; the section opens a frame later, so its
// drawing does not hold the glide back. The lens is moved by its own style, not through React: nothing is redrawn
// while the finger moves. In Стекло the section opens on release; other styles switch live. A tap is a tap.
export function SectionTabs({value,onChange}:{value:Section;onChange:(value:Section)=>void}) {
  const index=sectionIndex(value);
  const nav=useRef<HTMLElement>(null),lens=useRef<HTMLSpanElement>(null);
  const gesture=useRef<{id:number;x:number;y:number;dragged:boolean;base:number;cell:number;at:number;live:number;lastX:number;lastT:number}|null>(null);
  const suppressClick=useRef(false);
  const glass=()=>document.documentElement.dataset.style==='glass';
  const cell=()=>lens.current?.offsetWidth||0;
  const place=(x:number)=>{if(lens.current)lens.current.style.transform=`translateX(${x}px)`;};
  const hover=(n:number|null)=>nav.current?.querySelectorAll('button').forEach((b,i)=>{if(i===n)b.setAttribute('data-hovered','');else b.removeAttribute('data-hovered');});

  // The section changed (a tap, a key, or the release of a drag): the lens glides there from wherever it is (CSS transition).
  useLayoutEffect(()=>{if(!gesture.current?.dragged)place(index*cell());},[index]);
  // The bar's width changes with the window.
  useLayoutEffect(()=>{const el=nav.current;if(!el)return;const o=new ResizeObserver(()=>{if(!gesture.current?.dragged){const l=lens.current;if(l){l.style.transition='none';place(index*cell());l.getBoundingClientRect();l.style.transition='';}}});o.observe(el);return()=>o.disconnect();},[index]);

  function finish(e:PointerEvent<HTMLElement>,cancel=false){
    const g=gesture.current;if(!g||g.id!==e.pointerId)return;
    gesture.current=null;
    nav.current?.classList.remove('dragging','pressing');hover(null);
    lens.current?.style.removeProperty('--stretch');
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(!g.dragged)return;
    suppressClick.current=!cancel;
    const n=cancel?index:Math.round(g.at/(g.cell||1));
    place(n*g.cell);
    if(n!==index){const name=items[n][0];requestAnimationFrame(()=>setTimeout(()=>onChange(name)));}
  }
  return <nav ref={nav} className="tabs drag-tabs" aria-label="Разделы"
    onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;suppressClick.current=false;nav.current?.classList.add('pressing');
      const w=cell();gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false,base:index*w,cell:w,at:index*w,live:index,lastX:e.clientX,lastT:e.timeStamp};}}
    onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;
      if(!g.dragged){
        if(Math.abs(e.clientX-g.x)<=6||Math.abs(e.clientX-g.x)<=Math.abs(e.clientY-g.y))return;
        g.dragged=true;e.currentTarget.setPointerCapture(e.pointerId);
        nav.current?.classList.add('dragging');
        g.x=e.clientX;   // from here the lens moves with the finger, starting where it is
      }
      e.preventDefault();
      g.at=Math.max(0,Math.min((items.length-1)*g.cell,g.base+e.clientX-g.x));
      place(g.at);   // a 90 ms transition (glass.css) smooths the steps between finger events
      // Stretched along the way by the finger's speed, like a drop of gel.
      const speed=Math.abs(e.clientX-g.lastX)/Math.max(8,e.timeStamp-g.lastT);g.lastX=e.clientX;g.lastT=e.timeStamp;
      lens.current?.style.setProperty('--stretch',String(1+Math.min(.3,speed*.3)));
      const n=Math.round(g.at/(g.cell||1));
      if(n!==g.live){g.live=n;hover(n);navigator.vibrate?.(4);if(!glass())onChange(items[n][0]);}
    }}
    onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)}
    onLostPointerCapture={e=>{if(e.target===e.currentTarget&&gesture.current?.id===e.pointerId)finish(e as unknown as PointerEvent<HTMLElement>,true);}}
    onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}
    onKeyDown={e=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();if(glass())e.stopPropagation();const last=items.length-1,n=e.key==='Home'?0:e.key==='End'?last:(index+(e.key==='ArrowRight'?1:last))%items.length;onChange(items[n][0]);e.currentTarget.querySelectorAll('button')[n].focus();}}>
    <span className="tab-lens" ref={lens} aria-hidden="true"/>
    {items.map(([name,label,Icon])=><button key={name} aria-pressed={value===name} onClick={()=>onChange(name)}><Icon/><span>{label}</span></button>)}
  </nav>;
}
