import {useSyncExternalStore, type ReactNode} from 'react';

// The day a swipe is passing through right now, before the page has settled and React has drawn it.
// Only the light parts of the page listen to it — the month, the line about the day, «К ближайшим», the strip —
// so they follow the finger at once; the heavy redraw of the page waits for the swipe to end.
let live:string|null = null;
const listeners = new Set<()=>void>();
export function setLiveDay(date:string|null) {
  if (date === live) return;
  live = date;
  listeners.forEach(f => f());
}
const subscribe = (f:()=>void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useLiveDay = () => useSyncExternalStore(subscribe, () => live);

// <LiveDay selected={…}>{day => …}</LiveDay>: draws with the day in view, live or settled.
export function LiveDay({selected, children}:{selected:string; children:(day:string)=>ReactNode}) {
  return <>{children(useLiveDay() ?? selected)}</>;
}
