const CACHE_NAME='jms-crm-app-v32-cart-experience';
const SHELL=[
  '/','/index.html','/style.css','/manifest.json','/app.js','/config.js',
  '/store','/store.html','/store.css','/store.js','/store-manifest.json','/store-admin.js',
  '/assets/store/bags.webp','/assets/store/tableware.webp','/assets/store/packaging.webp',
  '/assets/store/cleaning.webp','/assets/store/general.webp',
  '/assets/store/categories/tableware.webp','/assets/store/categories/cups.webp',
  '/assets/store/categories/paper-bags.webp','/assets/store/categories/safety.webp',
  '/assets/store/categories/trash-bags.webp','/assets/store/categories/plates.webp',
  '/assets/store/categories/containers.webp','/assets/store/categories/wrapping.webp',
  '/assets/store/categories/picnic.webp','/assets/store/categories/cleaning.webp',
  '/assets/store/categories/tissues.webp','/assets/store/categories/general.webp',
  '/offline-sync.js','/authenticated-cloud-sync.js','/radar-lead-ownership.js',
  '/jms-core-v2.js','/jms-core-v2-workflows.js','/quote-manager-approval.js',
  '/quote-product-specs.js','/quote-smart-assistant.js','/automatic-role-login.js',
  '/rep-live-location.js','/rep-mobile-pro.js','/customer-ui-core.js',
  '/rep-mobile-app-shell.js','/mobile-menu-close-fix.js','/route-core-fix-v2.js',
  '/routes-cloud-sync.js','/route-save-fix.js','/route-visit-transaction.js',
  '/today-visit-planner.js','/ready-goods-notice.js','/ready-goods-keyboard-fix.js',
  '/ready-goods-pdf-fix.js','/ready-goods-pdf-premium.js',
  '/ready-goods-pdf-official-brand.js','/ready-goods-pdf-storage-fix.js',
  '/ready-goods-admin-control.js','/ready-goods-cloud-sync.js','/security-hardening.js',
  '/vendor-local-loader.js','/logo.png','/stamp.png','/assets/jms-icon-192.png',
  '/assets/jms-icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(async cache=>{
    for(const url of SHELL){
      try{await cache.add(new Request(url,{cache:'reload'}))}catch(_){}
    }
  }));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.pathname.startsWith('/api/')) return;

  if(request.mode==='navigate'){
    const storePage=url.pathname==='/store'||url.pathname==='/store.html'||url.pathname.startsWith('/store/');
    const fallback=storePage?'/store.html':'/index.html';
    event.respondWith(
      fetch(request,{cache:'no-store'}).then(response=>{
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(fallback,copy));
        return response;
      }).catch(()=>caches.match(fallback))
    );
    return;
  }

  if(url.pathname.endsWith('.js')){
    event.respondWith(
      fetch(request,{cache:'no-store'}).then(response=>{
        if(response.ok&&url.origin===self.location.origin){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
        }
        return response;
      }).catch(()=>caches.match(request).then(cached=>cached||caches.match(url.pathname)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response.ok&&url.origin===self.location.origin){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
      }
      return response;
    }).catch(()=>cached))
  );
});
