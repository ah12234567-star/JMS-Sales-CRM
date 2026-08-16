/* JMS local vendor fallback loader for offline PDF/XLSX support. */
(function(){
  'use strict';
  const VERSION='20260816-vendor-local-1';
  function load(src,flag){return new Promise(resolve=>{if(flag())return resolve(true);const existing=document.querySelector(`script[data-jms-vendor="${src}"]`);if(existing){existing.addEventListener('load',()=>resolve(flag()),{once:true});existing.addEventListener('error',()=>resolve(false),{once:true});return;}const s=document.createElement('script');s.src=src;s.dataset.jmsVendor=src;s.onload=()=>resolve(flag());s.onerror=()=>resolve(false);document.head.appendChild(s)})}
  async function ensure(){
    const results={};
    results.xlsx=await load('/vendor/xlsx.min.js',()=>Boolean(window.XLSX));
    results.html2pdf=await load('/vendor/html2pdf.bundle.min.js',()=>Boolean(window.html2pdf));
    document.documentElement.dataset.jmsVendorLocal=VERSION;
    return results;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,200));else setTimeout(ensure,200);
  window.JMSVendorLocal={version:VERSION,ensure};
})();
