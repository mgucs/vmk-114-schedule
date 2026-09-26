import {useEffect, useState} from 'react';
import {StylePicker,useStyleChoice} from './personal';
import {Share, SquarePlus, EllipsisVertical, Download} from 'lucide-react';

type Stream = {page:number; groups:string[]; title:string; range:string};
type Subgroups = {subjects:Map<string,Set<string>>; selected:Record<string,string>; store:(value:Record<string,string>)=>boolean};

const onboardedKey = 'vmk-onboarded';
export const needsOnboarding = () => { try { return !localStorage.getItem(onboardedKey) && !localStorage.getItem('vmk-group'); } catch { return false; } };
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as {standalone?:boolean}).standalone === true;

// Chrome on Android offers its own install dialog; the event arrives once, early, so it is caught at startup.
let installPrompt:any = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });

// First visit: which group, which subgroup, and how to put the site on the home screen.
export function Onboarding({streams, group, preset, onGroup, subgroups, onDone}:{streams:Stream[]; group:string; preset:boolean; onGroup:(name:string)=>void; subgroups:Subgroups; onDone:()=>void}) {
  const [step, setStep] = useState<'group'|'subgroups'|'style'|'install'>(preset ? 'subgroups' : 'group');
  const [style,pickStyle]=useStyleChoice();
  const [draft, setDraft] = useState<Record<string,string>>({});
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  useEffect(() => setDraft({...subgroups.selected}), [group]);
  function finish() { try { localStorage.setItem(onboardedKey, '1'); } catch {} onDone(); }
  // The next step that applies: subgroups only if the group has them, install only in a browser tab.
  function advance(from:typeof step) {
    const order = ['group','subgroups','style','install'] as const;
    let i = order.indexOf(from)+1;
    while (i < order.length && ((order[i]==='subgroups' && !subgroups.subjects.size) || (order[i]==='install' && standalone()))) i++;
    if (i >= order.length) finish(); else setStep(order[i]);
  }
  // Subjects of a just-chosen group are known only after it renders.
  useEffect(() => { if (step==='subgroups' && !subgroups.subjects.size) advance('subgroups'); }, [step, subgroups.subjects.size]);
  const steps = ['group','subgroups','style','install'].filter(s => s!=='subgroups' || subgroups.subjects.size).filter(s => s!=='install' || !standalone());
  const dots = <div className="onboarding-dots" aria-hidden="true">{steps.map(s => <i key={s} className={s===step ? 'on' : ''}/>)}</div>;

  return <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
    <div className="onboarding-card">
      {dots}
      {step==='group' && <>
        <h2 id="onboarding-title">Какая у тебя группа?</h2>
        <p>Расписание первого курса ВМК. Группу можно сменить в любой момент — нажми на её номер вверху.</p>
        <div className="onboarding-groups">{streams.map(s => <section key={s.page} className="stream">
          <div className="stream-head"><strong>{s.title}</strong><span>{s.range}</span></div>
          <div className="group-grid">{s.groups.map(name => <button key={name} aria-pressed={preset && name===group} onClick={()=>{onGroup(name);setStep("subgroups");}}>{name}</button>)}</div>
        </section>)}</div>
      </>}
      {step==='subgroups' && <>
        <h2 id="onboarding-title">Группа {group}: твои преподаватели</h2>
        <p>Где группа делится на подгруппы, выбери своего преподавателя — останутся только твои аудитории. Можно пропустить.</p>
        {[...subgroups.subjects].map(([subject, names], i) => <div className="subgroup-field" key={subject}>
          <label htmlFor={`first-subgroup-${i}`}>{subject}</label>
          <select id={`first-subgroup-${i}`} value={draft[subject] || ''} onChange={e => setDraft({...draft, [subject]:e.target.value})}>
            <option value="">Все подгруппы</option>{[...names].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>)}
        <div className="onboarding-actions">
          <button className="text-button" onClick={()=>advance('subgroups')}>Пропустить</button>
          <button className="small-primary" onClick={()=>{subgroups.store(draft); advance('subgroups');}}>Дальше</button>
        </div>
      </>}
      {step==='style' && <>
        <h2 id="onboarding-title">Твоё расписание. Твой стиль.</h2>
        <p>Посмотри, как будут выглядеть пары. Цветовую тему можно настроить позже через «Оформление».</p>
        <StylePicker value={style} onChange={pickStyle}/>
        <div className="onboarding-actions style-continue"><span>Можно изменить в любой момент</span><button className="small-primary" onClick={()=>advance('style')}>Продолжить</button></div>
      </>}
      {step==='install' && <>
        <h2 id="onboarding-title">Добавь на экран «Домой»</h2>
        <p>Откроется как приложение, без адресной строки, и будет работать без интернета.</p>
        {installPrompt ? <button className="save-task" onClick={async()=>{await installPrompt.prompt(); installPrompt = null; finish();}}><Download size={16}/> Установить</button>
          : ios ? <ol className="onboarding-how"><li>Нажми <Share size={16} aria-label="Поделиться"/> внизу Safari</li><li>Выбери <SquarePlus size={16} aria-hidden="true"/> «На экран „Домой“»</li></ol>
          : <ol className="onboarding-how"><li>Открой меню браузера <EllipsisVertical size={16} aria-label="меню"/></li><li>Выбери «Установить приложение» или «Добавить на главный экран»</li></ol>}
        <div className="onboarding-actions"><span/><button className="small-primary" onClick={finish}>Готово</button></div>
      </>}
    </div>
  </div>;
}
