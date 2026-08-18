/* JMS Ready Goods PDF loader — Production v10 */
(function(){
  'use strict';
  const VERSION='20260818-production-v10';
  function load(){
    if(document.querySelector('script[data-jms-ready-v10]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v10.js?v='+VERSION;
    s.dataset.jmsReadyV10='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
