(function(){
  'use strict';
  let qrPromise=null;
  function database(){try{return db}catch(_){return window.db||{}}}
  function loadQr(){
    if(window.QRCode)return Promise.resolve(window.QRCode);
    if(qrPromise)return qrPromise;
    qrPromise=new Promise(function(resolve,reject){
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script.async=true;script.onload=function(){resolve(window.QRCode)};script.onerror=reject;
      document.head.appendChild(script);
    });
    return qrPromise;
  }
  function quoteById(id){return (database().quotes||[]).find(function(quote){return String(quote.id)===String(id)})}
  function customerNameFor(quote){
    return (database().customers||[]).find(function(customer){return customer.id===quote?.customer_id})?.name||quote?.customer_name||'';
  }
  function fingerprint(quote){
    const text=[quote?.id,quote?.quote_no,quote?.date,quote?.customer_id,quote?.total_amount].join('|');
    let hash=2166136261;
    for(let index=0;index<text.length;index++){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619)}
    return (hash>>>0).toString(16).toUpperCase().padStart(8,'0');
  }
  function qrPayload(quote){
    const query=new URLSearchParams({quote:String(quote?.quote_no||quote?.id||''),date:String(quote?.date||''),total:String(quote?.total_amount||''),ref:fingerprint(quote)});
    return location.origin+'/?verifyQuote='+encodeURIComponent(query.toString());
  }
  async function addQr(id){
    const quote=quoteById(id);if(!quote)return;
    const documentBox=document.querySelector('.quote-a4,.quote-doc');
    if(!documentBox)return;
    const header=documentBox.querySelector('.quote-a4-title,.quote-title-box,.quote-header')||documentBox.firstElementChild;
    if(!header||header.querySelector('.jms-quote-qr'))return;
    const wrapper=document.createElement('div');wrapper.className='jms-quote-qr';
    wrapper.innerHTML='<div class="jms-quote-qr-canvas"></div><small>تحقق من صحة العرض</small><b>REF '+fingerprint(quote)+'</b>';
    header.appendChild(wrapper);
    try{
      await loadQr();
      const canvas=wrapper.querySelector('.jms-quote-qr-canvas');
      new window.QRCode(canvas,{text:qrPayload(quote),width:86,height:86,colorDark:'#111827',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
    }catch(error){
      wrapper.querySelector('.jms-quote-qr-canvas').textContent='JMS';
      console.warn('JMS QR unavailable',error);
    }
  }
  function currentQuoteId(){
    const box=document.querySelector('.quote-a4,.quote-doc');
    const direct=box?.dataset.quoteId;if(direct)return direct;
    const openButton=document.querySelector('[onclick*="downloadQuotePDF"]');
    const text=openButton?.getAttribute('onclick')||'';
    return text.match(/['"]([^'"]+)['"]/)?.[1]||window.__jmsCurrentQuoteId||'';
  }
  function wrapQuoteViewer(){
    const old=window.viewQuote;if(typeof old!=='function'||old.jmsPdfCore)return;
    const wrapped=function(id){
      window.__jmsCurrentQuoteId=id;
      const result=old.apply(this,arguments);
      setTimeout(function(){addQr(id)},90);
      return result;
    };
    wrapped.jmsPdfCore=true;window.viewQuote=wrapped;
  }
  function fileName(documentBox){
    const raw=documentBox.querySelector('.quote-a4-title p,.quote-title-box div,h1,h2')?.textContent||'JMS-Quotation';
    return raw.replace(/[^\p{L}\p{N}-]+/gu,'-').replace(/^-|-$/g,'')+'.pdf';
  }
  window.downloadQuotePDF=async function(){
    const documentBox=document.querySelector('.quote-a4,.quote-doc');
    if(!documentBox)return alert('تعذر العثور على ملف عرض السعر');
    const id=currentQuoteId();if(id)await addQr(id);
    if(typeof window.html2pdf!=='function'){
      window.print();return;
    }
    const controls=Array.from(documentBox.querySelectorAll('button,.quote-toolbar,.quote-actions-print'));
    controls.forEach(function(element){element.dataset.oldDisplay=element.style.display;element.style.display='none'});
    try{
      await window.html2pdf().set({
        margin:[8,8,8,8],filename:fileName(documentBox),
        image:{type:'jpeg',quality:.99},
        html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
        pagebreak:{mode:['css','legacy'],avoid:['tr','.quote-info-card','.quote-a4-summary']}
      }).from(documentBox).save();
    }finally{
      controls.forEach(function(element){element.style.display=element.dataset.oldDisplay||'';delete element.dataset.oldDisplay});
    }
  };
  function style(){
    if(document.getElementById('jmsQuotePdfCoreStyle'))return;
    const element=document.createElement('style');element.id='jmsQuotePdfCoreStyle';
    element.textContent=
      '.quote-a4,.quote-doc{padding:15mm 11mm!important;background:#fff!important}'+
      '.quote-a4 table th,.quote-a4 table td,.quote-doc table th,.quote-doc table td{padding:10px 8px!important;font-size:11px!important;line-height:1.65!important;vertical-align:middle!important}'+
      '.quote-a4 table,.quote-doc table{table-layout:auto!important;border-collapse:collapse!important}'+
      '.quote-a4 tr,.quote-doc tr,.quote-info-card,.quote-a4-summary{break-inside:avoid!important;page-break-inside:avoid!important}'+
      '.jms-quote-qr{display:grid;justify-items:center;align-content:start;gap:3px;min-width:102px;padding:7px;border:1px solid #d9e1ea;border-radius:10px;background:#fff;color:#334155}'+
      '.jms-quote-qr-canvas{display:grid;place-items:center;width:86px;height:86px}.jms-quote-qr img,.jms-quote-qr canvas{width:86px!important;height:86px!important}.jms-quote-qr small{font-size:8px}.jms-quote-qr b{font:700 8px monospace}'+
      '@media(max-width:620px){.quote-a4,.quote-doc{padding:10mm 7mm!important}.quote-a4 table th,.quote-a4 table td,.quote-doc table th,.quote-doc table td{padding:8px 5px!important;font-size:10px!important}}'+
      '@media print{@page{size:A4;margin:0}html,body{margin:0!important;padding:0!important}.quote-toolbar,.quote-actions-print,.modal-close,button{display:none!important}.quote-a4,.quote-doc{box-shadow:none!important;margin:0!important;width:210mm!important;min-height:297mm!important;padding:14mm 11mm!important}tr,.quote-info-card,.quote-a4-summary{break-inside:avoid!important;page-break-inside:avoid!important}}';
    document.head.appendChild(element);
  }
  function boot(){style();wrapQuoteViewer();setTimeout(wrapQuoteViewer,900)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.JMS_QUOTE_PDF_CORE='2026-08-14-v1';
})();