type Stream = {page:number; groups:string[]; title:string; range:string};

const onboardedKey = 'vmk-onboarded';
export const needsOnboarding = () => { try { return !localStorage.getItem(onboardedKey) && !localStorage.getItem('vmk-group'); } catch { return false; } };

// First visit asks one thing: the group. Subgroups, style and colours wait in the settings until wanted.
export function Onboarding({streams, onGroup, onDone}:{streams:Stream[]; onGroup:(name:string)=>void; onDone:()=>void}) {
  function pick(name:string) { onGroup(name); try { localStorage.setItem(onboardedKey, '1'); } catch {} onDone(); }
  return <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
    <div className="onboarding-card">
      <h2 id="onboarding-title">Какая у тебя группа?</h2>
      <p>Расписание первого курса ВМК. Сменить группу можно в любой момент — нажми на её номер вверху.</p>
      <div className="onboarding-groups">{streams.map(s => <section key={s.page} className="stream">
        <div className="stream-head"><strong>{s.title}</strong><span>{s.range}</span></div>
        <div className="group-grid">{s.groups.map(name => <button key={name} onClick={()=>pick(name)}>{name}</button>)}</div>
      </section>)}</div>
    </div>
  </div>;
}
