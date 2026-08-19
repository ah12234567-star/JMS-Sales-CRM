/* JMS Ready Goods PDF loader — Production v15 server PDF + packaging + revisions */
(function(){
  'use strict';
  const VERSION='20260819-production-v15-revision-1';
  function add(src,attr){
    if(document.querySelector(`script[${attr}]`))return;
    const s=document.createElement('script');
    s.src=src+'?v='+VERSION;
    s.setAttribute(attr,'1');
    s.async=false;
    document.head.appendChild(s);
  }
  function load(){
    add('/ready-goods-pdf-v12.js','data-jms-ready-v15');
    add('/ready-goods-packaging-ui.js','data-jms-rgn-packaging');
    add('/ready-goods-edit-revision.js','data-jms-rgn-revisions');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
