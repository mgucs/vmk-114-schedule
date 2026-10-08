import {useLayoutEffect,useRef} from 'react';
import {BookOpen,CalendarClock,CalendarRange,GraduationCap} from 'lucide-react';

const items=[['schedule','Расписание',CalendarClock],['calendar','Календарь',CalendarRange],['session','Сессия',GraduationCap],['info','Полезное',BookOpen]] as const;
// The campus map is not a section: it opens from a room (page.tsx, openRoom) and goes back where it came from.
export type Section=typeof items[number][0];
export const sectionIndex=(s:Section)=>items.findIndex(i=>i[0]===s);

// The dock at the bottom. A tap moves the lens at once — its own style, a CSS transition the compositor runs — and
// the section opens a frame later, so drawing the section cannot hold the lens back. No dragging along the bar: it was
// where both the jumps and the stutter came from.
export function SectionTabs({value,onChange}:{value:Section;onChange:(value:Section)=>void}) {
  const index=sectionIndex(value);
  const nav=useRef<HTMLElement>(null),lens=useRef<HTMLSpanElement>(null);
  const shown=useRef(-1);
  // Lens and colours to section i, without React.
  function show(i:number,glide=true){
    const el=lens.current;if(!el||i===shown.current)return;
    if(!glide||shown.current<0){el.style.transition='none';el.style.transform=`translateX(${i*100}%)`;el.getBoundingClientRect();el.style.transition='';}
    else el.style.transform=`translateX(${i*100}%)`;
    nav.current?.querySelectorAll('button').forEach((b,k)=>b.toggleAttribute('data-on',k===i));
    shown.current=i;
  }
  useLayoutEffect(()=>show(index,shown.current>=0),[index]);
  function pick(i:number){
    if(i===index)return;
    show(i);
    const name=items[i][0];
    requestAnimationFrame(()=>setTimeout(()=>onChange(name)));
  }
  return <nav ref={nav} className="tabs dock" aria-label="Разделы"
    onKeyDown={e=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();e.stopPropagation();const last=items.length-1,n=e.key==='Home'?0:e.key==='End'?last:(index+(e.key==='ArrowRight'?1:last))%items.length;pick(n);e.currentTarget.querySelectorAll('button')[n].focus();}}>
    <span className="dock-lens" ref={lens} aria-hidden="true"/>
    {items.map(([name,label,Icon],i)=><button key={name} aria-pressed={value===name} onClick={()=>pick(i)}><Icon strokeWidth={1.8}/><span>{label}</span></button>)}
  </nav>;
}
