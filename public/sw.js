const CACHE='vmk114-shell-__BUILD_ID__';
const DATA='vmk114-data-v1';
const scope=self.registration.scope;
const inScope=url=>url.origin===self.location.origin&&url.pathname.startsWith(new URL(scope).pathname);
const local=path=>new URL(path.replace(/^\//,''),scope).href;
// precache.json maps every file of this version to a hash of its content. Files that did not change since a version
// already on the phone are copied from that version's cache instead of downloaded: an update brings only what is
// new (usually the app's scripts), not the floor models, photos and the PDF viewer again.
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const listResponse=await fetch(local('precache.json'),{cache:'no-store'});
 if(!listResponse.ok)throw Error('Offline asset list unavailable');
 const list=await listResponse.json();
 const cache=await caches.open(CACHE);
 const older=[];
 for(const key of await caches.keys())if(key.startsWith('vmk114-shell-')&&key!==CACHE){const c=await caches.open(key),m=await c.match(local('precache.json'));if(m)try{older.push({cache:c,list:await m.json()});}catch{}}
 for(const [path,hash] of Object.entries(list)){
  const url=local(path);
  const same=older.find(o=>o.list[path]===hash);
  const kept=same&&await same.cache.match(url);
  if(kept){await cache.put(url,kept);continue;}
  const response=await fetch(url,{cache:'reload'});if(!response.ok)throw Error('Offline asset unavailable: '+path);await cache.put(url,response);
 }
 await cache.put(local('precache.json'),new Response(JSON.stringify(list),{headers:{'Content-Type':'application/json'}}));
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
 // Opening the app asks the network for the page first, so a new version shows up on the first open after it was
 // published; if the network is slow (2 s) or absent, the saved page opens instead. Its scripts are hashed files:
 // the new page's ones come from the network, the saved page's ones from the cache.
 // (The timetable itself, source.json, is always fetched fresh by the page.)
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cached=await (await caches.open(CACHE)).match(local('index.html'));
   const network=fetch(request,{cache:'no-store'}).then(r=>r.ok?r:Promise.reject(r));
   if(!cached)try{return await network;}catch{return new Response('Для первого открытия нужен интернет.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
   const slow=new Promise(resolve=>setTimeout(()=>resolve(cached),2000));
   return Promise.race([network.catch(()=>cached),slow]);
  })());return;
 }
 // A page in place of a file (a server's fallback to index.html) is never kept as that file.
 event.respondWith((async()=>{const cached=await caches.match(request);if(cached&&!(cached.headers.get('content-type')||'').includes('text/html'))return cached;const response=await fetch(request);if(response.ok&&!(response.headers.get('content-type')||'').includes('text/html')){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;})());
});
