/* JMS Ready Goods PDF loader — Production v14 server PDF */
(function(){
  'use strict';
  const VERSION='20260818-production-v14';
  function load(){
    if(document.querySelector('script[data-jms-ready-v14]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v12.js?v='+VERSION;
    s.dataset.jmsReadyV14='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
