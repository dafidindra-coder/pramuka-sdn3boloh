/* Service worker sederhana: selalu ambil versi terbaru dari internet,
   dan pakai salinan tersimpan hanya bila sedang offline. Data Supabase tidak disimpan. */
const CACHE='pramuka-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;   // API Supabase & CDN tidak disentuh
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}
    return r;
  }).catch(()=>caches.match(e.request,{ignoreSearch:true})));
});
