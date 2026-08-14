(function(){
'use strict';
function database(){try{return db}catch(_){return window.db||{}}}
function quoteById(id){return (database().quotes||[]).find(q=>String(q.id)===String(id))}
function token(){const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
async function persist(){if(typeof window.save==='function')window.save();if(typeof window.pushCloudData==='function'){try{await window.pushCloudData()}catch(error){console.warn('JMS quote link sync delayed',error)}}}
window.jmsGetQuotePublicUrl=async function(quoteOrId){
  const quote=typeof quoteOrId==='object'?quoteOrId:quoteById(quoteOrId);
  if(!quote)throw new Error('لم يتم العثور على عرض السعر');
  if(!quote.public_token){quote.public_token=token();quote.public_token_created_at=new Date().toISOString()}
  quote.customer_name=quote.customer_name||(database().customers||[]).find(c=>String(c.id)===String(quote.customer_id))?.name||'';
  await persist();
  return location.origin+'/quote?id='+encodeURIComponent(quote.id)+'&token='+encodeURIComponent(quote.public_token);
};
function currentQuoteId(){
  if(window.__jmsCurrentQuoteId)return window.__jmsCurrentQuoteId;
  const root=document.querySelector('#modalBody .quote-a4,.quote-print-shell .quote-a4,.quote-doc');
  if(root?.dataset.quoteId)return root.dataset.quoteId;
  const action=document.querySelector('#modalBody [onclick*="Quote("],#modalBody [onclick*="sendQuote("]');
  return (action?.getAttribute('onclick')||'').match(/['"]([^'"]+)['"]/)?.[1]||'';
}
function enhancePreview(){
  const toolbar=document.querySelector('#modalBody .quote-toolbar,.quote-print-shell .quote-toolbar,#modalBody .quote-actions-print');
  if(!toolbar||toolbar.querySelector('.jms-send-quote-link'))return;
  const button=document.createElement('button');button.type='button';button.className='jms-send-quote-link';
  button.innerHTML='<span>↗</span> إرسال رابط التوقيع واتساب';
  button.addEventListener('click',function(event){
    event.preventDefault();event.stopPropagation();
    const id=currentQuoteId();
    if(!id)return alert('تعذر تحديد عرض السعر. أغلق المعاينة وافتحها مرة أخرى.');
    window.sendQuote(id);
  });
  toolbar.prepend(button);
}
function install(){
  const previous=window.sendQuote;
  if(typeof previous!=='function'||previous.jmsPublicLink)return;
  const wrapped=async function(qid){
    const q=quoteById(qid);if(!q)return alert('لم يتم العثور على عرض السعر');
    if(q.status!=='approved'&&q.status!=='sent'&&q.status!=='customer_approved')return alert('لا يمكن إرسال العرض قبل اعتماد المدير');
    try{
      const link=await window.jmsGetQuotePublicUrl(q);
      q.status=q.status==='customer_approved'?q.status:'sent';q.sent_at=new Date().toISOString();await persist();
      if(typeof window.renderQuotes==='function')window.renderQuotes();
      const customer=q.customer_name||'عميلنا الكريم';
      const message=['السلام عليكم '+customer,'مرفق عرض السعر رقم '+(q.quote_no||''),'يمكنكم فتح العرض من الرابط الآمن التالي:',link].join('\n');
      window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener');
    }catch(error){console.error(error);alert('تعذر إنشاء رابط عرض السعر، حاول مرة أخرى')}
  };
  wrapped.jmsPublicLink=true;window.sendQuote=wrapped;
  if(!document.__jmsQuoteLinkObserver){
    document.__jmsQuoteLinkObserver=new MutationObserver(function(){enhancePreview()});
    document.__jmsQuoteLinkObserver.observe(document.getElementById('modalBody')||document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(event){if(event.target.closest('button[onclick*="viewQuote"],button[onclick*="Quote"]'))setTimeout(enhancePreview,120)},true);
  }
  if(!document.getElementById('jmsQuoteLinkButtonStyle')){
    const style=document.createElement('style');style.id='jmsQuoteLinkButtonStyle';
    style.textContent='.jms-send-quote-link{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;min-height:46px!important;padding:10px 16px!important;border:0!important;border-radius:13px!important;background:#16a34a!important;color:#fff!important;font-weight:900!important;white-space:nowrap}.jms-send-quote-link span{font-size:18px}@media(max-width:620px){.jms-send-quote-link{width:100%!important;order:-10!important}}@media print{.jms-send-quote-link{display:none!important}}';
    document.head.appendChild(style);
  }
  setTimeout(enhancePreview,80);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
setTimeout(install,1200);setTimeout(enhancePreview,1500);
window.JMS_QUOTE_PUBLIC_LINK='2026-08-14-v2';
})();