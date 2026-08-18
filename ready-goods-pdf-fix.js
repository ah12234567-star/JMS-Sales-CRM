/* JMS Ready Goods PDF loader — Production v7 */
(function(){
  'use strict';
  const VERSION='20260818-production-v7';
  function load(){
    if(document.querySelector('script[data-jms-ready-v7]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v7.js?v='+VERSION;
    s.dataset.jmsReadyV7='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
