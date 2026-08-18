/* JMS Ready Goods PDF loader — Executive Edition */
(function(){
  'use strict';
  const VERSION='20260818-executive-edition-1';
  function load(){
    if(document.querySelector('script[data-jms-ready-premium]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-premium.js?v='+VERSION;
    s.dataset.jmsReadyPremium='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
