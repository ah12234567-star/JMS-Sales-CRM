/* JMS representative mobile application shell: persistent navigation and safe overlays. */
(function () {
  'use strict';
  const STYLE_ID='jmsRepMobileAppShellStyle';
  const isRep=()=>window.currentUser?.role==='rep';
  const tabs=[['repHome','⌂','الرئيسية'],['customers','◎','العملاء'],['smartVisits','⌖','الزيارات'],['quotes','▤','العروض'],['readyGoodsNotice','▣','جاهزة']];

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @media(max-width:920px){
        body.jms-rep-app-shell .jms-mobile-topbar{z-index:100900!important}
        body.jms-rep-app-shell .main{padding:calc(env(safe-area-inset-top,0px) + 88px) 12px calc(env(safe-area-inset-bottom,0px) + 100px)!important;overflow-x:hidden!important}
        body.jms-rep-app-shell .page.active{scroll-margin-top:calc(env(safe-area-inset-top,0px) + 88px)}
        body.jms-rep-app-shell #repBottomNav{position:fixed!important;z-index:100900!important;display:grid!important;grid-template-columns:repeat(5,1fr)!important;right:10px!important;left:10px!important;bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;padding:7px!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:22px!important;background:rgba(15,23,42,.97)!important;box-shadow:0 16px 45px rgba(15,23,42,.34)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
        body.jms-rep-app-shell #repBottomNav button{min-width:0!important;border:0!important;background:transparent!important;color:#94a3b8!important;border-radius:15px!important;padding:7px 3px!important;font-size:9px!important;font-weight:900!important}
        body.jms-rep-app-shell #repBottomNav button i{display:block!important;margin-bottom:2px!important;font-style:normal!important;font-size:18px!important}
        body.jms-rep-app-shell #repBottomNav button.active{background:#2563eb!important;color:#fff!important}
        body.jms-rep-app-shell .modal:not(.hidden){z-index:100500!important;padding:calc(env(safe-area-inset-top,0px) + 86px) 10px calc(env(safe-area-inset-bottom,0px) + 98px)!important;align-items:flex-start!important;overflow-y:auto!important}
        body.jms-rep-app-shell .modal:not(.hidden) .modal-card{width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 184px)!important;margin:0 auto!important;overflow-y:auto!important;overscroll-behavior:contain!important}
        body.jms-rep-app-shell .modal:not(.hidden) #modalBody{padding-bottom:14px!important}
        body.jms-rep-app-shell.jms-mobile-menu-open .sidebar{z-index:101000!important}
        body.jms-rep-app-shell.jms-mobile-menu-open #repBottomNav{opacity:0!important;pointer-events:none!important}
        body.jms-rep-app-shell .cloud-sync-status{bottom:calc(env(safe-area-inset-bottom,0px) + 88px)!important;z-index:100200!important}
      }
    `;
    document.head.appendChild(style);
  }

  function officializeReadyGoods(){
    const badge=document.querySelector('#readyGoodsNotice .rgn-badge');
    if(badge) badge.textContent='معتمد بالنظام';
    const heroText=document.querySelector('#readyGoodsNotice .rgn-hero p');
    if(heroText) heroText.textContent='إشعار مستقل للبضاعة الجاهزة والكليشة — غير مرتبط بأوامر التصنيع';
  }

  function activePage(){return document.querySelector('.page.active')?.id||'repHome'}
  function closeOverlay(){
    document.body.classList.remove('jms-mobile-menu-open');
    const modal=document.getElementById('modal');
    if(modal&&!modal.classList.contains('hidden')){
      if(typeof window.closeModal==='function')window.closeModal();
      else modal.classList.add('hidden');
    }
  }
  function go(page){
    closeOverlay();
    if(page==='readyGoodsNotice'){
      if(window.JMSReadyGoods?.open){ window.JMSReadyGoods.open(); officializeReadyGoods(); }
      else {
        const loader=document.createElement('script');
        loader.src='ready-goods-notice.js?v=20260816-official-1';
        loader.onload=()=>{window.JMSReadyGoods?.open?.();setTimeout(officializeReadyGoods,30)};
        document.head.appendChild(loader);
      }
    } else if(typeof window.jmsRepGo==='function')window.jmsRepGo(page);
    else document.querySelector(`.sidebar .nav[data-page="${page}"]`)?.click();
    resetPagePosition();
    setTimeout(()=>{ensureNav();officializeReadyGoods()},80);
  }
  function ensureNav(){
    if(!isRep())return;
    let nav=document.getElementById('repBottomNav');
    if(!nav){nav=document.createElement('nav');nav.id='repBottomNav';document.body.appendChild(nav)}
    nav.className='rep-bottom-nav';
    if(nav.dataset.shell!=='4'){
      nav.dataset.shell='4';
      nav.innerHTML=tabs.map(([page,icon,label])=>`<button type="button" data-go="${page}"><i>${icon}</i>${label}</button>`).join('');
      nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>go(button.dataset.go)));
    }
    const current=activePage();
    nav.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.go===current));
  }
  function resetPagePosition(){
    const main=document.querySelector('.main');
    if(main)main.scrollTop=0;
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch(_){window.scrollTo(0,0)}
  }
  function normalizeModal(){
    if(!isRep())return;
    const modal=document.getElementById('modal');
    if(!modal||modal.classList.contains('hidden'))return;
    requestAnimationFrame(()=>{
      modal.scrollTop=0;
      const card=modal.querySelector('.modal-card');
      if(card)card.scrollTop=0;
      const body=modal.querySelector('#modalBody');
      if(body)body.scrollTop=0;
    });
  }
  function sync(){
    if(!isRep())return;
    injectStyle();
    document.body.classList.add('jms-rep-app-shell');
    ensureNav();
    normalizeModal();
    officializeReadyGoods();
  }
  function install(){
    sync();
    document.addEventListener('click',event=>{
      if(!isRep())return;
      if(event.target.closest('button,[role="button"],a,.nav'))setTimeout(()=>{sync();normalizeModal()},40);
    },true);
    window.addEventListener('pageshow',()=>{sync();if(activePage()==='repHome')resetPagePosition()});
    window.addEventListener('orientationchange',()=>setTimeout(sync,120));
    setTimeout(sync,500);setTimeout(sync,1800);setTimeout(sync,4200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* Ready Goods Notice is an official representative module. */
(function(){
  if(document.querySelector('script[data-jms-ready-goods]'))return;
  const script=document.createElement('script');
  script.src='ready-goods-notice.js?v=20260816-official-1';
  script.dataset.jmsReadyGoods='1';
  document.head.appendChild(script);
})();

/* iOS keyboard stability patch for Ready Goods Notice. */
(function(){
  if(document.querySelector('script[data-jms-ready-goods-keyboard-fix]'))return;
  const script=document.createElement('script');
  script.src='ready-goods-keyboard-fix.js?v=20260816-ios-keyboard-1';
  script.dataset.jmsReadyGoodsKeyboardFix='1';
  document.head.appendChild(script);
})();

/* Production PDF renderer for Ready Goods Notice. */
(function(){
  if(document.querySelector('script[data-jms-ready-goods-pdf-fix]'))return;
  const script=document.createElement('script');
  script.src='ready-goods-pdf-fix.js?v=20260816-production-1';
  script.dataset.jmsReadyGoodsPdfFix='1';
  document.head.appendChild(script);
})();

/* Resolve persisted notice records for the production PDF renderer. */
(function(){
  if(document.querySelector('script[data-jms-ready-goods-pdf-storage-fix]'))return;
  const script=document.createElement('script');
  script.src='ready-goods-pdf-storage-fix.js?v=20260816-1';
  script.dataset.jmsReadyGoodsPdfStorageFix='1';
  document.head.appendChild(script);
})();
