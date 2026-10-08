import {useEffect, useState} from 'react';

declare const __APP_DATE__: string;

// Which version of the site this page runs, and whether a newer one is published.
// The running version is the name of this script (Vite gives it a hash of the code); the published one is the script
// named in the server's index.html. The date is when the app's code last changed (vite.config.ts, appDate).
const own = (import.meta.url.match(/index-([\w-]+)\.js/) || [])[1] || 'dev';
export const appCode = own.slice(0, 6);
export const appDate = (() => {
  const d = new Date(__APP_DATE__);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('ru-RU', {timeZone:'Europe/Moscow', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'}) : '';
})();

// The script the server publishes now; null if it cannot be asked (offline, dev server).
export async function publishedCode() {
  try {
    const response = await fetch(import.meta.env.BASE_URL + '?version=' + Date.now(), {cache:'no-store', signal:AbortSignal.timeout(8000)});
    if (!response.ok) return null;
    return ((await response.text()).match(/assets\/index-([\w-]+)\.js/) || [])[1] || null;
  } catch { return null; }
}
export const isOutdated = async () => { const latest = await publishedCode(); return own !== 'dev' && !!latest && latest !== own; };

// «Версия от 8 октября, 21:49 · a1b2c3 · последняя», or a button when a newer one is out.
export function AppVersion() {
  const [state, setState] = useState<'checking'|'latest'|'outdated'|'unknown'>('checking');
  useEffect(() => {
    let live = true;
    const check = () => void publishedCode().then(latest => { if (live) setState(!latest || own === 'dev' ? 'unknown' : latest === own ? 'latest' : 'outdated'); });
    const back = () => { if (document.visibilityState === 'visible') check(); };
    check();
    document.addEventListener('visibilitychange', back);
    return () => { live = false; document.removeEventListener('visibilitychange', back); };
  }, []);
  return <p className="app-version">
    Версия{appDate ? ` от ${appDate}` : ''} · {appCode}
    {state === 'latest' && <span> · последняя</span>}
    {state === 'outdated' && <> · <button className="text-button" onClick={() => location.reload()}>есть новее — обновить</button></>}
  </p>;
}
