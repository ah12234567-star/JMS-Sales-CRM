/* JMS official company logo bridge: preserve the original quotation logo exactly. */
(function(){
  'use strict';
  const CACHE_KEY='jms_official_quote_logo_v1';

  function remember(src){
    if(!src || !/^data:image\/(jpeg|png);base64,/i.test(src)) return;
    window.JMS_COMPANY_DOCUMENT_LOGO=src;
    try{localStorage.setItem(CACHE_KEY,src)}catch(_){}
  }

  function scan(){
    document.querySelectorAll('.quote-a4-logo').forEach(function(img){
      if(img?.src) remember(img.src);
    });
  }

  try{
    const cached=localStorage.getItem(CACHE_KEY);
    if(cached) window.JMS_COMPANY_DOCUMENT_LOGO=cached;
  }catch(_){}

  const observer=new MutationObserver(scan);
  function boot(){
    scan();
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

/* Daily visit planner reason selector. */
(function(){
  if(document.querySelector('script[data-jms-visit-reason-planner]'))return;
  const script=document.createElement('script');
  script.src='visit-reason-planner.js?v=20260816-visit-reason-1';
  script.dataset.jmsVisitReasonPlanner='1';
  document.head.appendChild(script);
})();

/* Daily route save reliability fix. */
(function(){
  if(document.querySelector('script[data-jms-route-save-fix]'))return;
  const script=document.createElement('script');
  script.src='route-save-fix.js?v=20260816-route-save-1';
  script.dataset.jmsRouteSaveFix='1';
  document.head.appendChild(script);
})();
