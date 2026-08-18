/* JMS Ready Goods PDF loader — Production v13 direct print */
(function(){
  'use strict';
  const VERSION='20260818-production-v13';
  function load(){
    if(document.querySelector('script[data-jms-ready-v13]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v12.js?v='+VERSION;
    s.dataset.jmsReadyV13='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
