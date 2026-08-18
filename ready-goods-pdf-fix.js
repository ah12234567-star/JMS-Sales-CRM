/* JMS Ready Goods PDF loader — Production v8 */
(function(){
  'use strict';
  const VERSION='20260818-production-v8';
  function load(){
    if(document.querySelector('script[data-jms-ready-v8]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v8.js?v='+VERSION;
    s.dataset.jmsReadyV8='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
