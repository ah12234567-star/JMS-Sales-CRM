/* JMS Ready Goods PDF loader — Production v12 direct print */
(function(){
  'use strict';
  const VERSION='20260818-production-v12';
  function load(){
    if(document.querySelector('script[data-jms-ready-v12]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v12.js?v='+VERSION;
    s.dataset.jmsReadyV12='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
