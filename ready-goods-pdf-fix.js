/* JMS Ready Goods PDF loader — Production v9 */
(function(){
  'use strict';
  const VERSION='20260818-production-v9';
  function load(){
    if(document.querySelector('script[data-jms-ready-v9]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v9.js?v='+VERSION;
    s.dataset.jmsReadyV9='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
