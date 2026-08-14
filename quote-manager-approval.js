(function(){
'use strict';
const VERSION='2026-08-14-two-stage-approval-1';
function database(){try{return db}catch(_){return window.db||{}}}
function user(){try{return currentUser}catch(_){return window.currentUser||null}}
function manager(){return ['admin','sales','manager','production_manager'].includes(user()?.role)}
function uid(){try{return crypto.randomUUID()}catch(_){return 'order-'+Date.now()+'-'+Math.random().toString(16).slice(2)}}
function persist(){try{if(typeof save==='function')save();else window.save?.()}catch(error){console.error('JMS approval save',error)}}
function customerName(id){return (database().customers||[]).find(item=>String(item.id)===String(id))?.name||'العميل'}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function createOrder(quote,now){
 const data=database();data.orders=data.orders||[];
 const orderId='quote-'+quote.id;
 let order=data.orders.find(item=>String(item.id)===String(orderId)||String(item.source_quote_id)===String(quote.id));
 const values={
  id:order?.id||orderId,date:now.slice(0,10),customer_id:quote.customer_id,rep_id:quote.rep_id,
  product:quote.product,material:quote.material,color:quote.color,print:quote.print,
  width:quote.width,length:quote.length,size_unit:quote.size_unit,thickness:quote.thickness,
  thickness_unit:quote.thickness_unit,total_kg:quote.total_kg,piece_weight:quote.piece_weight,pieces:quote.pieces,
  amount:String(quote.total_amount||0)+' ريال',amount_value:Number(quote.total_amount||0),
  status:'معتمد من الإدارة',source:'manager_approved_quote',source_quote_id:quote.id,source_quote_no:quote.quote_no,
  customer_signer_name:quote.customer_signer_name,customer_approved_at:quote.customer_approved_at,
  manager_approved_at:now,manager_approved_by:user()?.name||'مدير النظام',manager_approved_by_id:user()?.id||'',
  manager_approval_required:false,converted_at:now,notes:'تم إنشاء أمر التصنيع بعد اعتماد العميل ثم اعتماد الإدارة'
 };
 if(order)Object.assign(order,values);else{order=values;data.orders.unshift(order)}
 return order;
}
window.jmsManagerApproveSignedQuote=function(quoteId){
 const quote=(database().quotes||[]).find(item=>String(item.id)===String(quoteId));
 if(!quote)return alert('لم يتم العثور على عرض السعر');
 if(!manager())return alert('هذه الصلاحية للإدارة فقط');
 if(quote.status!=='customer_approved'&&quote.manager_review_status!=='pending')return alert('هذا العرض غير موجود في مرحلة انتظار اعتماد الإدارة');
 if(!quote.customer_signature)return alert('لا يوجد توقيع عميل محفوظ على هذا العرض');
 if(!confirm('هل راجعت العرض وتريد اعتماده وتحويله رسمياً إلى الإنتاج؟'))return;
 const now=new Date().toISOString(),order=createOrder(quote,now);
 quote.status='manager_approved';quote.manager_review_status='approved';quote.manager_approved_at=now;
 quote.manager_approved_by=user()?.name||'مدير النظام';quote.manager_approved_by_id=user()?.id||'';
 quote.converted_to_order=true;quote.converted_at=now;quote.production_order_id=order.id;quote.production_status='معتمد من الإدارة - جاري الإرسال للإنتاج';
 persist();
 window.renderAll?.();window.renderQuotes?.();
 setTimeout(function(){
  if(typeof window.jms11aSendOrderToProduction==='function'){
   window.jms11aSendOrderToProduction(order.id);
   quote.production_status='تم التحويل إلى خط الإنتاج';persist();window.renderQuotes?.();
  }else alert('تم اعتماد الإدارة وإنشاء أمر التصنيع، لكن تعذر فتح مسار الإنتاج');
 },120);
};
const oldStatus=window.quoteStatusText;
window.quoteStatusText=function(status){
 if(status==='customer_approved')return 'معتمد من العميل - بانتظار الإدارة';
 if(status==='manager_approved')return 'اعتمدته الإدارة - تم التحويل للإنتاج';
 return typeof oldStatus==='function'?oldStatus(status):String(status||'');
};
const oldCard=window.quoteCard;
window.quoteCard=function(quote){
 let html=typeof oldCard==='function'?oldCard(quote):'';
 if(!html)return html;
 let extra='';
 if(quote.status==='customer_approved'||quote.manager_review_status==='pending'){
  extra='<div class="jms-manager-review pending"><div><b>✓ موقّع من العميل</b><span>'+escapeHtml(quote.customer_signer_name||customerName(quote.customer_id))+' · بانتظار مراجعة الإدارة</span></div>'+(manager()?'<button type="button" onclick="jmsManagerApproveSignedQuote(\''+escapeHtml(quote.id)+'\')">اعتماد وتحويل للإنتاج</button>':'')+'</div>';
 }else if(quote.status==='manager_approved'||quote.manager_review_status==='approved'){
  extra='<div class="jms-manager-review approved"><div><b>✓ اعتمدته الإدارة</b><span>'+escapeHtml(quote.manager_approved_by||'مدير النظام')+' · تم تحويله للإنتاج</span></div></div>';
 }
 if(!extra)return html;
 const end=html.lastIndexOf('</div>');return end>=0?html.slice(0,end)+extra+html.slice(end):html+extra;
};
function enhanceFilter(){
 const select=document.getElementById('quoteStatusFilter');if(!select||select.querySelector('option[value="customer_approved"]'))return;
 const option=document.createElement('option');option.value='customer_approved';option.textContent='معتمد من العميل - بانتظار الإدارة';select.appendChild(option);
}
const oldRender=window.renderQuotes;
window.renderQuotes=function(){
 enhanceFilter();if(typeof oldRender==='function')oldRender.apply(this,arguments);
 const all=typeof window.allowedQuotes==='function'?window.allowedQuotes():(database().quotes||[]);
 const approved=document.getElementById('quotesApproved'),pending=document.getElementById('quotesPending');
 if(approved)approved.textContent=all.filter(q=>['approved','sent','customer_approved','manager_approved'].includes(q.status)).length;
 if(pending)pending.textContent=all.filter(q=>q.status==='pending'||q.status==='customer_approved'||q.manager_review_status==='pending').length;
};
function style(){
 if(document.getElementById('jmsTwoStageApprovalStyle'))return;
 const el=document.createElement('style');el.id='jmsTwoStageApprovalStyle';el.textContent=
 '.quote-status.customer_approved{background:#fff7ed!important;color:#c2410c!important}.quote-status.manager_approved{background:#dcfce7!important;color:#047857!important}.jms-manager-review{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:11px 0 0;padding:12px;border-radius:13px}.jms-manager-review div{display:grid;gap:3px}.jms-manager-review span{font-size:10px}.jms-manager-review.pending{border:1px solid #fdba74;background:#fff7ed;color:#9a3412}.jms-manager-review.approved{border:1px solid #86efac;background:#ecfdf5;color:#047857}.jms-manager-review button{border:0;border-radius:10px;padding:10px 12px;background:#1d4ed8;color:#fff;font-weight:900;cursor:pointer}@media(max-width:620px){.jms-manager-review{align-items:stretch;flex-direction:column}.jms-manager-review button{width:100%;min-height:44px}}';
 document.head.appendChild(el);
}
function boot(){style();enhanceFilter();window.renderQuotes?.()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.JMS_TWO_STAGE_APPROVAL=VERSION;
})();

(function loadQuoteSmartAssistant(){
 if(document.querySelector('script[data-jms-quote-ai]'))return;
 const script=document.createElement('script');
 script.src='quote-smart-assistant.js?v=20260814-1';
 script.dataset.jmsQuoteAi='1';
 script.defer=true;
 document.head.appendChild(script);
})();