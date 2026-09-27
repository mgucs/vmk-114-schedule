import {useEffect,useRef,useState} from 'react';
import {WALLPAPER} from './wallpaper';

// An isolated miniature of the actual app CSS, so previews cannot inherit a
// different layout from the currently selected style. No scripts or interaction.
export function StylePreview({name}:{name:string}) {
  const host=useRef<HTMLSpanElement>(null);
  const [scale,setScale]=useState(.5),[documentHtml,setDocumentHtml]=useState('');
  useEffect(()=>{
    const update=()=>{
      const root=document.documentElement;
      const styles=[...document.querySelectorAll('head style, head link[rel="stylesheet"]')].map(e=>e.outerHTML).join('');
      const base=new URL(import.meta.env.BASE_URL,location.origin).href;
      setDocumentHtml(`<!doctype html><html lang="ru" data-theme="${root.dataset.theme||'msu'}" data-scheme="${root.dataset.scheme||'dark'}" data-style="${name}"><head><base href="${base}">${styles}<style>
        html,body{margin:0!important;width:320px!important;height:350px!important;min-height:0!important;overflow:hidden!important;pointer-events:none}
        *,*::before,*::after{animation:none!important;transition:none!important}
        .shell{width:100%!important;min-height:0!important;padding:16px!important;max-width:none!important}
        .heading{margin:12px 0!important;display:block!important}.heading h1{font-size:29px!important}.list{gap:10px!important}.lesson{cursor:default!important}
        .preview-brand{font-size:12px;font-weight:650;letter-spacing:.02em;opacity:.7}.preview-date{font-size:11px;color:var(--muted-foreground)}
        .lesson h3{font-size:18px!important}.lesson-time{font-size:11px!important}.room{font-size:13px!important}.preview-person{font-size:11px;opacity:.7;margin-top:7px}
      </style></head><body>${name==='glass'?`<div class="wallpaper" aria-hidden="true">${WALLPAPER}</div>`:''}<div class="shell"><div class="preview-brand">114 группа · ВМК</div><div class="heading"><h1>Понедельник</h1><div class="preview-date">28 сентября · 2 пары</div></div><div class="list comfy">
        <article class="lesson lecture"><div class="lesson-time"><span class="range">10:30 – 12:05</span><span class="tag">Лекция</span></div><h3>Математический анализ</h3><div class="preview-person">Лектор · <span class="room">П-14</span></div></article>
        <article class="lesson"><div class="lesson-time"><span class="range">12:50 – 14:25</span></div><h3>Алгебра и геометрия</h3><div class="preview-person">Семинар · <span class="room">624</span></div></article>
      </div></div></body></html>`);
    };
    update();const theme=new MutationObserver(update);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-scheme']});
    const size=new ResizeObserver(([entry])=>setScale(entry.contentRect.width/320));size.observe(host.current!);
    return()=>{theme.disconnect();size.disconnect();};
  },[name]);
  return <span className="style-live-preview" ref={host} aria-hidden="true"><iframe title={`Пример стиля ${name}`} tabIndex={-1} sandbox="allow-same-origin" srcDoc={documentHtml} width="320" height="350" style={{transform:`scale(${scale})`}}/></span>;
}
