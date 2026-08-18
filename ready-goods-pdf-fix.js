/* JMS Ready Goods PDF loader — Final Electronic Renderer */
(function(){
  'use strict';
  const VERSION='20260818-final-electronic-v3';
  function load(){
    if(document.querySelector('script[data-jms-ready-final]'))return;
    const s=document.createElement('script');
    s.src='/ready-goods-pdf-final.js?v='+VERSION;
    s.dataset.jmsReadyFinal='1';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
