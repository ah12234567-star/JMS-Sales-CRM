/* JMS Ready Goods PDF loader — Production v6 */
(function(){
  'use strict';
  const VERSION='20260818-production-v6';
  function load(){
    if(document.querySelector('script[data-jms-ready-v6]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v6.js?v='+VERSION;
    s.dataset.jmsReadyV6='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
