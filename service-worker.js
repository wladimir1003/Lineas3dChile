const CACHE='leca-3dar-v2.5.0';
const LOCAL=[
  './','./index.html','./3d-lab.html','./ar.html','./diagnostico.html','./manifest.json',
  './css/app.css','./css/3d.css','./js/app.js','./js/3d-lab.js','./js/ar-scene.js',
  './js/modules/db.js','./js/modules/data-sources.js','./js/modules/install.js',
  './config/model-catalog.json','./config/electrical-rules.json','./assets/icon.svg',
  './models/towers/torre_6fases_a.glb','./models/towers/torre_6fases_b.glb',
  './models/towers/torre_3fases_1cg.glb','./models/towers/torre_6fases_con_cg.glb',
  './models/wind/aerogenerador.glb'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(LOCAL)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  const appCode=request.mode==='navigate'||/\.(html|js|css|json|webmanifest)$/.test(url.pathname);
  if(appCode){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
