/* JMS Ready Goods PDF loader — Official Brand Edition */
(function(){
  'use strict';
  const VERSION='20260818-official-brand-assets-1';
  function loadOfficial(){
    if(document.querySelector('script[data-jms-ready-official-brand]'))return;
    const o=document.createElement('script');
    o.src='/ready-goods-pdf-official-brand.js?v='+VERSION;
    o.dataset.jmsReadyOfficialBrand='1';
    o.async=false;
    document.head.appendChild(o);
  }
  function load(){
    if(document.querySelector('script[data-jms-ready-premium]')){loadOfficial();return;}
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-premium.js?v='+VERSION;
    s.dataset.jmsReadyPremium='1';
    s.async=false;
    s.onload=loadOfficial;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
