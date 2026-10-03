const CACHE='vmk114-shell-__BUILD_ID__';
const DATA='vmk114-data-v1';
const scope=self.registration.scope;
const inScope=url=>url.origin===self.location.origin&&url.pathname.startsWith(new URL(scope).pathname);
const local=path=>new URL(path.replace(/^\//,''),scope).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const listResponse=await fetch(local('precache.json'),{cache:'no-store'});
 if(!listResponse.ok)throw Error('Offline asset list unavailable');
 const list=await listResponse.json();
 const cache=await caches.open(CACHE);
 for(const path of list){const url=local(path);const response=await fetch(url,{cache:'reload'});if(!response.ok)throw Error('Offline asset unavailable: '+path);await cache.put(url,response);}
 await cache.put(local('offline-ready'),new Response('ready'));
 await cache.put(local('cache-created'),new Response(String(Date.now())));
 await self.skipWaiting();
})()));
// The previous version's files stay one more release: a page opened from it while this version installed must
// still find its scripts (the deploy removed them from the server). Only older versions are deleted.
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const old=[];
 for(const key of await caches.keys())if(key.startsWith('vmk114-shell-')&&key!==CACHE){const created=await (await caches.open(key)).match(local('cache-created'));old.push({key,at:created?Number(await created.text()):0});}
 old.sort((a,b)=>b.at-a.at);
 for(const {key} of old.slice(1))await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||!inScope(url))return;
 if(url.pathname.endsWith('/source.json')||url.pathname.endsWith('/latest.pdf'))return;
 if(/\/saved-schedule-[a-f0-9]{64}\.pdf$/.test(url.pathname)){event.respondWith((async()=>await (await caches.open(DATA)).match(url.href)||new Response('PDF не сохранён',{status:404}))());return;}
 // The saved app opens at once, without waiting for a slow network; a new version arrives with the next service worker
 // (the timetable itself, source.json, is always fetched fresh by the page).
 if(request.mode==='navigate'){
  event.respondWith((async()=>{const cached=await (await caches.open(CACHE)).match(local('index.html'));if(cached)return cached;try{return await fetch(request);}catch{return new Response('Для первого открытия нужен интернет.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());return;
 }
 // A page in place of a file (a server's fallback to index.html) is never kept as that file.
 event.respondWith((async()=>{const cached=await caches.match(request);if(cached&&!(cached.headers.get('content-type')||'').includes('text/html'))return cached;const response=await fetch(request);if(response.ok&&!(response.headers.get('content-type')||'').includes('text/html')){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;})());
});
