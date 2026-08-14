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
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
setTimeout(install,1200);
window.JMS_QUOTE_PUBLIC_LINK='2026-08-14-v1';
})();