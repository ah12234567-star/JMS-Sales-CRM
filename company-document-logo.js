/* JMS official company logo for customer-facing documents. */
(function(){
  'use strict';
  const VERSION='20260816-company-logo-1';
  const LOGO=(location.origin||'')+'/assets/company-logo.svg?v='+VERSION;

  function setImage(img){
    if(!img||img.dataset.jmsCompanyLogo==='1')return;
    img.src=LOGO;
    img.alt='شعار شركة جدة النموذجي للصناعة';
    img.dataset.jmsCompanyLogo='1';
    img.style.objectFit='contain';
    img.style.background='#fff';
  }

  function replaceDocumentLogos(root){
    if(!root?.querySelectorAll)return;
    root.querySelectorAll('.quote-a4 img.quote-a4-logo,.quote-doc img.quote-a4-logo,.quote-a4 .quote-a4-logo img,.quote-doc .quote-a4-logo img').forEach(setImage);
    root.querySelectorAll('.rgn-pdf-doc .rgn-pdf-logo').forEach(function(box){
      if(box.dataset.jmsCompanyLogo==='1')return;
      box.dataset.jmsCompanyLogo='1';
      box.textContent='';
      box.style.cssText+=';width:118px!important;height:82px!important;border-radius:0!important;background:#fff!important;padding:0!important;overflow:visible!important;';
      const img=box.ownerDocument.createElement('img');
      img.src=LOGO;img.alt='شعار شركة جدة النموذجي للصناعة';
      img.style.cssText='display:block;width:118px;height:82px;object-fit:contain;background:#fff;';
      box.appendChild(img);
    });
  }

  function watchFrame(frame){
    if(!frame||frame.dataset.jmsCompanyLogoWatch==='1')return;
    frame.dataset.jmsCompanyLogoWatch='1';
    let tries=0;
    const run=function(){
      tries++;
      try{replaceDocumentLogos(frame.contentDocument)}catch(_){}
      if(tries<25)setTimeout(run,20);
    };
    run();
  }

  function scan(){
    replaceDocumentLogos(document);
    document.querySelectorAll('iframe').forEach(watchFrame);
  }

  const observer=new MutationObserver(function(records){
    scan();
    records.forEach(function(record){record.addedNodes.forEach(function(node){if(node?.tagName==='IFRAME')watchFrame(node)})});
  });
  function boot(){scan();observer.observe(document.documentElement,{childList:true,subtree:true});setInterval(scan,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.JMS_COMPANY_DOCUMENT_LOGO=LOGO;
})();