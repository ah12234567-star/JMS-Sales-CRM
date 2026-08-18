/* JMS Ready Goods PDF loader — Production v11 */
(function(){
  'use strict';
  const VERSION='20260818-production-v11';
  function load(){
    if(document.querySelector('script[data-jms-ready-v11]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v11.js?v='+VERSION;
    s.dataset.jmsReadyV11='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
