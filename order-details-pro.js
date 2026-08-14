(function(){
  'use strict';
  const VERSION='2026-08-14-order-details-pro-3';
  const database=()=>{try{return db}catch(_){return window.db||{}}};
  const activeUser=()=>{try{return currentUser}catch(_){return window.currentUser||null}};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number=value=>Number(String(value??'').replace(/[^\d.-]/g,''))||0;
  const manager=()=>['admin','sales','manager','production','production_manager'].includes(activeUser()?.role);
  const visibleOrders=()=>{const all=database().orders||[],u=activeUser();return u?.role==='rep'?all.filter(order=>order.rep_id===u.id):all;};
  const customer=id=>(database().customers||[]).find(item=>String(item.id)===String(id))||{};
  const rep=id=>(database().reps||[]).find(item=>String(item.id)===String(id))||(database().users||[]).find(item=>String(item.id)===String(id))||{};
  const productionFor=id=>(database().productionOrders||[]).find(item=>String(item.order_id)===String(id));
  const value=(input,suffix='')=>String(input??'').trim()?esc(input)+suffix:'—';
  const money=input=>String(input??'').trim()?number(input).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2})+' ريال':'—';
  function statusTone(status=''){
    if(/تم التسليم|delivered|مكتمل/.test(status))return 'done';
    if(/إنتاج|production|تشغيل/.test(status))return 'work';
    if(/مرفوض|ملغي|cancel/.test(status))return 'danger';
    if(/اعتماد|تحويل|pending|انتظار/.test(status))return 'wait';
    return 'new';
  }
  function canAccess(order){const u=activeUser();return !!order&&(u?.role!=='rep'||order.rep_id===u.id);}
  function spec(label,data,wide=false){return `<div class="jms-order-spec${wide?' wide':''}"><span>${esc(label)}</span><b>${data}</b></div>`;}

  window.jmsApproveCustomerSignedOrder=function(orderId){
    const order=(database().orders||[]).find(item=>String(item.id)===String(orderId));
    if(!order)return alert('لم يتم العثور على الطلب');
    if(!manager())return alert('هذه الصلاحية للمدير فقط');
    if(!confirm('اعتماد الطلب وإرساله إلى خط الإنتاج؟'))return;
    order.manager_approved_at=new Date().toISOString();
    order.manager_approved_by=activeUser()?.name||'';
    order.manager_approved_by_id=activeUser()?.id||'';
    order.manager_approval_required=false;
    order.status='معتمد من المدير';
    const quote=(database().quotes||[]).find(item=>String(item.id)===String(order.source_quote_id||''));
    if(quote){
      quote.manager_approved_at=order.manager_approved_at;
      quote.manager_approved_by=order.manager_approved_by;
      quote.manager_approved_by_id=order.manager_approved_by_id;
      quote.production_status='تم اعتماد المدير وإرسال الطلب للإنتاج';
      quote.production_order_id=order.id;
    }
    try{if(typeof save==='function')save();else window.save?.()}catch(error){console.error('JMS manager approval save',error)}
    if(typeof window.closeModal==='function')window.closeModal();
    setTimeout(function(){
      if(typeof window.jms11aSendOrderToProduction==='function')return window.jms11aSendOrderToProduction(order.id);
      if(typeof window.createProductionFromOrder==='function')return window.createProductionFromOrder(order.id);
      alert('تم اعتماد الطلب، لكن تعذر فتح مسار الإنتاج');
    },100);
  };

  window.jmsOpenOrderDetails=function(orderId){
    const order=(database().orders||[]).find(item=>String(item.id)===String(orderId));
    if(!canAccess(order))return alert('لم يتم العثور على الطلب أو لا تملك صلاحية عرضه');
    const c=customer(order.customer_id),r=rep(order.rep_id),production=productionFor(order.id);
    const modal=document.getElementById('modal'),body=document.getElementById('modalBody');
    if(!modal||!body)return alert('تعذر فتح ملف الطلب');
    const kg=number(order.total_kg),price=number(order.price_kg)||(kg?number(order.amount_value||order.amount)/kg:0);
    const print=[order.print,order.print_type,order.printType].find(Boolean);
    const dates=[['إنشاء الطلب',order.created_at||order.date],['آخر تحديث',order.updated_at],['التحويل',order.converted_at||order.paid_at],['الإرسال للإنتاج',order.sent_to_production_at],['موعد التسليم',order.delivery_date||order.due_date]].filter(item=>item[1]);
    body.innerHTML=`<section class="jms-order-file">
      <header class="jms-order-file-head"><div><span>ملف طلب المبيعات</span><h2>${esc(c.name||'عميل غير محدد')}</h2><p>${value(order.order_no||order.production_no||order.id)} · ${value(order.date)}</p></div><i class="${statusTone(order.status)}">${esc(order.status||'جديد')}</i></header>
      <div class="jms-order-file-summary"><div><span>إجمالي الطلب</span><b>${money(order.amount_value||order.amount)}</b></div><div><span>الكمية</span><b>${value(order.total_kg,' كجم')}</b></div><div><span>المندوب</span><b>${esc(r.name||'—')}</b></div></div>
      <div class="jms-order-file-section"><h3>بيانات العميل</h3><div class="jms-order-specs">${spec('اسم العميل',esc(c.name||'—'))}${spec('الجوال',value(c.phone))}${spec('المدينة',value(c.city))}${spec('عنوان التسليم',value(order.delivery_address||order.deliveryAddress||c.address),true)}</div></div>
      <div class="jms-order-file-section"><h3>مواصفات الطلب</h3><div class="jms-order-specs">
        ${spec('المنتج',value(order.product))}${spec('الخامة',value(order.material))}${spec('اللون',value(order.color))}${spec('المقاس',`${value(order.width)} × ${value(order.length)}`)}
        ${spec('السماكة',value(order.thickness,' ميكرون'))}${spec('الكمية',value(order.total_kg,' كجم'))}${spec('سعر الكيلو',price?money(price):'—')}${spec('الإجمالي',money(order.amount_value||order.amount))}
        ${spec('وزن الحبة',value(order.piece_weight))}${spec('عدد الحبات',value(order.pieces))}${spec('الطباعة',value(print))}${spec('ألوان الطباعة',value(order.print_colors||order.printColors))}${spec('ملاحظات الطلب',value(order.notes||order.technical_notes),true)}
      </div></div>
      ${order.manager_approved_at?`<div class="jms-manager-approved"><b>✓ معتمد من المدير</b><span>${esc(order.manager_approved_by||'المدير')} · ${esc(String(order.manager_approved_at).replace('T',' ').slice(0,16))}</span></div>`:''}
      ${production?`<div class="jms-order-production-link"><div><span>مرتبط بأمر إنتاج</span><b>${esc(production.production_no||'أمر إنتاج')}</b><small>${esc(production.stage||order.production_stage||'قيد المتابعة')}</small></div><button type="button" onclick="closeModal();setTimeout(()=>openProductionOrder('${esc(production.id)}'),80)">فتح أمر الإنتاج</button></div>`:''}
      <div class="jms-order-file-section"><h3>مسار الطلب</h3><div class="jms-order-timeline">${dates.map(([label,date],index)=>`<div><i>${index+1}</i><span>${esc(label)}</span><b>${esc(String(date).replace('T',' ').slice(0,16))}</b></div>`).join('')||'<p>لا يوجد سجل زمني لهذا الطلب القديم.</p>'}</div></div>
      <footer class="jms-order-file-actions"><button type="button" onclick="closeModal()">إغلاق</button>${manager()?`<button type="button" class="edit" onclick="jmsEditSalesOrder('${esc(order.id)}')">تعديل البيانات</button>`:''}${manager()&&!production&&order.source==='customer_approved_quote'&&!order.manager_approved_at?`<button type="button" class="production" onclick="jmsApproveCustomerSignedOrder('${esc(order.id)}')">اعتماد المدير وإرسال للإنتاج</button>`:''}${manager()&&!production&&order.source!=='customer_approved_quote'&&typeof window.jms11aSendOrderToProduction==='function'?`<button type="button" class="production" onclick="closeModal();setTimeout(()=>jms11aSendOrderToProduction('${esc(order.id)}'),80)">إرسال للإنتاج</button>`:''}</footer>
    </section>`;
    modal.classList.remove('hidden');modal.scrollTop=0;body.scrollTop=0;
    requestAnimationFrame(()=>modal.querySelector('.modal-card')?.scrollTo({top:0,behavior:'auto'}));
  };

  function orderCard(order){
    const c=customer(order.customer_id),r=rep(order.rep_id),tone=statusTone(order.status);
    return `<article class="jms-order-list-card" data-jms-order-id="${esc(order.id)}"><div class="jms-order-list-top"><div><span>${value(order.order_no||order.date)}</span><h3>${esc(c.name||'عميل غير محدد')}</h3></div><i class="${tone}">${esc(order.status||'جديد')}</i></div><div class="jms-order-list-spec"><span>${value(order.product)}</span><span>${value(order.width)} × ${value(order.length)}</span><span>${value(order.total_kg,' كجم')}</span></div><div class="jms-order-list-foot"><span>${esc(r.name||'مندوب غير محدد')}</span><b>${money(order.amount_value||order.amount)}</b><button type="button" class="jms-open-order-details" data-order-id="${esc(order.id)}">فتح التفاصيل ‹</button></div></article>`;
  }
  function render(){
    const host=document.getElementById('ordersList');if(!host)return;
    const orders=visibleOrders().filter(order=>!order.archived_at).sort((a,b)=>String(b.created_at||b.date||'').localeCompare(String(a.created_at||a.date||'')));
    host.innerHTML=orders.length?`<div class="jms-order-list-grid">${orders.map(orderCard).join('')}</div>`:'<div class="jms-order-empty"><i>▣</i><b>لا توجد طلبات حتى الآن</b><span>عند حفظ أول طلب سيظهر هنا ويمكن فتح ملفه الكامل.</span></div>';
  }
  function install(){
    if(!document.__jmsOrderDetailsDelegated){
      document.__jmsOrderDetailsDelegated=true;
      document.addEventListener('click',function(event){
        const button=event.target.closest('.jms-open-order-details');
        const card=event.target.closest('.jms-order-list-card[data-jms-order-id]');
        const target=button||card;if(!target)return;
        event.preventDefault();event.stopPropagation();
        window.jmsOpenOrderDetails(button?.dataset.orderId||card?.dataset.jmsOrderId||'');
      },true);
    }
    const old=window.renderOrders;window.renderOrders=function(){if(typeof old==='function')old.apply(this,arguments);render();};render();document.addEventListener('click',event=>{if(event.target.closest('[data-page="orders"]'))setTimeout(render,80)},true);}
  const style=document.createElement('style');style.id='jmsOrderDetailsProStyle';style.textContent=`
    .jms-order-list-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px}.jms-order-list-card{padding:16px;border:1px solid #dbe4ef;border-radius:18px;background:#fff;box-shadow:0 9px 25px rgba(15,23,42,.055);cursor:pointer;transition:.18s}.jms-order-list-card:hover{transform:translateY(-2px);border-color:#94a3b8;box-shadow:0 14px 30px rgba(15,23,42,.1)}.jms-order-list-card:focus{outline:3px solid rgba(37,99,235,.2)}.jms-order-list-top,.jms-order-list-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}.jms-order-list-top span{color:#94a3b8;font-size:10px}.jms-order-list-top h3{margin:4px 0 0;font-size:15px}.jms-order-list-top>i,.jms-order-file-head>i{border-radius:999px;padding:7px 10px;font-size:10px;font-style:normal;font-weight:900;white-space:nowrap}.jms-order-list-top>i.new,.jms-order-file-head>i.new{background:#eff6ff;color:#1d4ed8}.jms-order-list-top>i.wait,.jms-order-file-head>i.wait{background:#fff7ed;color:#c2410c}.jms-order-list-top>i.work,.jms-order-file-head>i.work{background:#ede9fe;color:#6d28d9}.jms-order-list-top>i.done,.jms-order-file-head>i.done{background:#dcfce7;color:#15803d}.jms-order-list-top>i.danger,.jms-order-file-head>i.danger{background:#fee2e2;color:#b91c1c}.jms-order-list-spec{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:13px 0}.jms-order-list-spec span{padding:8px;border-radius:10px;background:#f8fafc;color:#475569;text-align:center;font-size:10px}.jms-order-list-foot{padding-top:11px;border-top:1px solid #edf2f7;color:#64748b;font-size:10px}.jms-order-list-foot b{color:#0f172a}.jms-order-list-foot .jms-open-order-details{border:0;background:transparent;color:#2563eb;font:inherit;font-weight:900;padding:8px;cursor:pointer}.jms-manager-approved{display:grid;gap:4px;padding:13px;border:1px solid #a7f3d0;border-radius:14px;background:#ecfdf5;color:#047857}.jms-manager-approved span{font-size:10px}.jms-order-empty{display:grid;place-items:center;min-height:220px;text-align:center;color:#64748b}.jms-order-empty i{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:#eff6ff;color:#2563eb;font-size:24px;font-style:normal}.jms-order-empty b{margin-top:10px;color:#0f172a}.jms-order-empty span{font-size:11px}
    .jms-order-file{display:grid;gap:14px}.jms-order-file-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-radius:18px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff}.jms-order-file-head span{color:#93c5fd;font-size:10px}.jms-order-file-head h2{margin:5px 0;color:#fff;font-size:21px}.jms-order-file-head p{margin:0;color:#cbd5e1;font-size:11px}.jms-order-file-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.jms-order-file-summary>div{padding:12px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.jms-order-file-summary span,.jms-order-file-summary b{display:block}.jms-order-file-summary span{color:#64748b;font-size:10px}.jms-order-file-summary b{margin-top:5px;font-size:13px}.jms-order-file-section{padding:15px;border:1px solid #e2e8f0;border-radius:16px}.jms-order-file-section h3{margin:0 0 11px;font-size:15px}.jms-order-specs{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.jms-order-spec{min-width:0;padding:10px;border-radius:11px;background:#f8fafc}.jms-order-spec.wide{grid-column:span 4}.jms-order-spec span,.jms-order-spec b{display:block}.jms-order-spec span{color:#64748b;font-size:9px}.jms-order-spec b{margin-top:4px;overflow-wrap:anywhere;font-size:11px}.jms-order-production-link{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border-radius:16px;background:#eef2ff;color:#312e81}.jms-order-production-link span,.jms-order-production-link b,.jms-order-production-link small{display:block}.jms-order-production-link span,.jms-order-production-link small{font-size:9px}.jms-order-production-link button{border:0;border-radius:11px;padding:10px;background:#4338ca;color:#fff;font-weight:900}.jms-order-timeline{display:grid;gap:7px}.jms-order-timeline>div{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;padding:8px;border-radius:11px;background:#f8fafc}.jms-order-timeline i{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#dbeafe;color:#1d4ed8;font-style:normal;font-size:9px}.jms-order-timeline span,.jms-order-timeline b{font-size:10px}.jms-order-timeline b{color:#64748b}.jms-order-file-actions{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:7px;padding:11px 0 0;background:#fff}.jms-order-file-actions button{border:1px solid #cbd5e1;border-radius:11px;padding:10px 13px;background:#fff;font-weight:900}.jms-order-file-actions button.edit{border-color:#f59e0b;background:#fff7ed;color:#9a3412}.jms-order-file-actions button.production{border-color:#2563eb;background:#2563eb;color:#fff}
    @media(max-width:620px){.jms-order-list-grid{grid-template-columns:1fr}.jms-order-list-card{padding:14px}.jms-order-file-head{padding:17px}.jms-order-file-summary{grid-template-columns:1fr 1fr}.jms-order-file-summary>div:first-child{grid-column:span 2}.jms-order-specs{grid-template-columns:1fr 1fr}.jms-order-spec.wide{grid-column:span 2}.jms-order-file-actions{display:grid;grid-template-columns:1fr 1fr}.jms-order-file-actions .production{grid-column:span 2}.jms-order-production-link{align-items:stretch;flex-direction:column}.jms-order-production-link button{width:100%}}
  `;document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JMS_ORDER_DETAILS_PRO_VERSION=VERSION;
})();
