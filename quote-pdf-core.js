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
  async function qrPayload(quote){
    if(typeof window.jmsGetQuotePublicUrl==='function')return window.jmsGetQuotePublicUrl(quote);
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
      const payload=await qrPayload(quote);
      new window.QRCode(canvas,{text:payload,width:86,height:86,colorDark:'#111827',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
    }catch(error){
      wrapper.querySelector('.jms-quote-qr-canvas').textContent='JMS';
      console.warn('JMS QR unavailable',error);
    }
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]})}
  function approvedAt(value){
    if(!value)return '';
    const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});
  }
  function enhanceCustomerApproval(id){
    const quote=quoteById(id);if(!quote)return;
    const documentBox=document.querySelector('.quote-a4,.quote-doc');if(!documentBox)return;
    documentBox.dataset.quoteId=String(id||'');
    documentBox.querySelector('.jms-customer-approval-banner')?.remove();
    const signed=quote.status==='customer_approved'&&/^data:image\/png;base64,/i.test(String(quote.customer_signature||''));
    if(!signed)return;
    const head=documentBox.querySelector('.quote-a4-head,.quote-header')||documentBox.firstElementChild;
    const banner=document.createElement('div');banner.className='jms-customer-approval-banner';
    banner.innerHTML='<div><i>✓</i><span><b>معتمد وموقّع من العميل</b><small>'+esc(quote.customer_signer_name||'العميل')+' · '+esc(approvedAt(quote.customer_approved_at))+'</small></span></div><em>اعتماد إلكتروني موثّق</em>';
    if(head?.nextSibling)head.parentNode.insertBefore(banner,head.nextSibling);else documentBox.prepend(banner);
    const approval=documentBox.querySelector('.quote-a4-approval');
    const customerBox=approval?.querySelector('.quote-a4-sign');
    if(customerBox){
      customerBox.classList.add('jms-customer-signed');
      customerBox.innerHTML='<b>اعتماد العميل ✓</b><img src="'+String(quote.customer_signature)+'" alt="توقيع العميل"><strong>'+esc(quote.customer_signer_name||'العميل')+'</strong><small>'+esc(approvedAt(quote.customer_approved_at))+'</small>';
    }
    const statusCard=Array.from(documentBox.querySelectorAll('.quote-a4-card p')).find(function(p){return p.textContent.includes('الحالة:')});
    if(statusCard)statusCard.innerHTML=statusCard.innerHTML.replace(/(<b>الحالة:<\/b>)\s*[^<]*/,'$1 <span class="jms-approved-status">معتمد من العميل ✓</span><br>');
  }
  function currentQuoteId(){
    const box=document.querySelector('.quote-a4,.quote-doc');
    const direct=box?.dataset.quoteId;if(direct)return direct;
    const openButton=document.querySelector('[onclick*="downloadQuotePDF"]');
    const text=openButton?.getAttribute('onclick')||'';
    return text.match(/['"]([^'"]+)['"]/)?.[1]||window.__jmsCurrentQuoteId||'';
  }
  function closePreview(){
    if(typeof window.closeModal==='function')window.closeModal();
    else document.getElementById('modal')?.classList.add('hidden');
  }
  function enhancePreview(){
    const shell=document.querySelector('.quote-print-shell,.quote-print');
    if(!shell||shell.querySelector('.jms-quote-preview-nav'))return;
    const nav=document.createElement('div');nav.className='jms-quote-preview-nav';
    nav.innerHTML='<button type="button" class="jms-quote-back" aria-label="الرجوع إلى التطبيق">← رجوع للتطبيق</button><button type="button" class="jms-quote-close" aria-label="إغلاق معاينة عرض السعر">×</button>';
    nav.querySelectorAll('button').forEach(function(button){button.onclick=closePreview});
    shell.prepend(nav);
  }
  function wrapQuoteViewer(){
    const old=window.viewQuote;if(typeof old!=='function'||old.jmsPdfCore)return;
    const wrapped=function(id){
      window.__jmsCurrentQuoteId=id;
      const result=old.apply(this,arguments);
      setTimeout(function(){enhancePreview();addQr(id);enhanceCustomerApproval(id)},90);
      setTimeout(function(){enhanceCustomerApproval(id)},500);
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
      '.jms-quote-preview-nav{position:sticky;z-index:10020;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding:max(10px,env(safe-area-inset-top)) 12px 10px;border-bottom:1px solid #dbe4ef;background:rgba(255,255,255,.98);backdrop-filter:blur(12px)}.jms-quote-preview-nav button{display:grid;place-items:center;min-height:44px;border:0;border-radius:12px;font-weight:900;cursor:pointer}.jms-quote-back{padding:0 16px;background:#111827;color:#fff}.jms-quote-close{width:44px;padding:0;background:#fee2e2;color:#991b1b;font-size:26px}'+
      '.quote-a4,.quote-doc{padding:15mm 11mm!important;background:#fff!important}'+
      '.quote-a4 table th,.quote-a4 table td,.quote-doc table th,.quote-doc table td{padding:10px 8px!important;font-size:11px!important;line-height:1.65!important;vertical-align:middle!important}'+
      '.quote-a4 table,.quote-doc table{table-layout:auto!important;border-collapse:collapse!important}'+
      '.quote-a4 tr,.quote-doc tr,.quote-info-card,.quote-a4-summary{break-inside:avoid!important;page-break-inside:avoid!important}'+
      '.jms-quote-qr{display:grid;justify-items:center;align-content:start;gap:3px;min-width:102px;padding:7px;border:1px solid #d9e1ea;border-radius:10px;background:#fff;color:#334155}'+
      '.jms-quote-qr-canvas{display:grid;place-items:center;width:86px;height:86px}.jms-quote-qr img,.jms-quote-qr canvas{width:86px!important;height:86px!important}.jms-quote-qr small{font-size:8px}.jms-quote-qr b{font:700 8px monospace}'+
      '.jms-customer-approval-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:13px 15px;border:1px solid #86efac;border-radius:14px;background:#ecfdf5;color:#047857;break-inside:avoid}.jms-customer-approval-banner>div{display:flex;align-items:center;gap:10px}.jms-customer-approval-banner i{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#059669;color:#fff;font-size:20px;font-style:normal}.jms-customer-approval-banner span,.jms-customer-approval-banner b,.jms-customer-approval-banner small{display:block}.jms-customer-approval-banner small{margin-top:3px;color:#166534;font-size:9px}.jms-customer-approval-banner em{font-size:9px;font-style:normal}.jms-approved-status{display:inline-block;padding:3px 8px;border-radius:999px;background:#dcfce7;color:#047857;font-weight:900}.quote-a4-sign.jms-customer-signed{display:grid!important;justify-items:center;gap:5px;border:2px solid #86efac!important;background:#f0fdf4!important}.quote-a4-sign.jms-customer-signed img{display:block;width:150px;max-width:100%;height:62px;object-fit:contain;border-bottom:1px solid #bbf7d0}.quote-a4-sign.jms-customer-signed strong{color:#065f46;font-size:11px}.quote-a4-sign.jms-customer-signed small{color:#64748b;font-size:8px}'+
      '@media(max-width:620px){.quote-a4,.quote-doc{padding:10mm 7mm!important}.quote-a4 table th,.quote-a4 table td,.quote-doc table th,.quote-doc table td{padding:8px 5px!important;font-size:10px!important}}'+
      '@media print{@page{size:A4;margin:0}html,body{margin:0!important;padding:0!important}.quote-toolbar,.quote-actions-print,.modal-close,.jms-quote-preview-nav,button{display:none!important}.quote-a4,.quote-doc{box-shadow:none!important;margin:0!important;width:210mm!important;min-height:297mm!important;padding:14mm 11mm!important}tr,.quote-info-card,.quote-a4-summary{break-inside:avoid!important;page-break-inside:avoid!important}}';
    document.head.appendChild(element);
  }
  function boot(){style();wrapQuoteViewer();setTimeout(wrapQuoteViewer,900)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.JMS_QUOTE_PDF_CORE='2026-08-14-v4';
})();