/* JMS Ready Goods PDF loader — Production v5 */
(function(){
  'use strict';
  const VERSION='20260818-production-v5';
  function load(){
    if(document.querySelector('script[data-jms-ready-v5]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-v5.js?v='+VERSION;
    s.dataset.jmsReadyV5='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
