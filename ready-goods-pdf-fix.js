/* JMS Ready Goods PDF loader — Production v15 server PDF */
(function(){
  'use strict';
  const VERSION='20260819-production-v15';
  function load(){
    if(document.querySelector('script[data-jms-ready-v15]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v12.js?v='+VERSION;
    s.dataset.jmsReadyV15='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
