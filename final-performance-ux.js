(function(){
  'use strict';
  const VERSION='2026-08-14-final-performance-ux-v1';
  const PAGE_SIZE=20;
  const dbRef=()=>{try{return db}catch(_){return window.db||{}}};
  const userRef=()=>{try{return currentUser}catch(_){return window.currentUser||null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const saveDb=()=>{try{if(typeof save==='function')save();else window.save?.()}catch(e){console.error(e)}};

  let customerLimit=PAGE_SIZE;
  let lastCustomerQuery='';
  let customerObserver=null;
  let navTimer=0;

  function allCustomers(){
    const all=typeof allowedCustomers==='function'?allowedCustomers():(dbRef().customers||[]);
    const q=(document.getElementById('customerSearch')?.value||'').trim().toLowerCase();
    return all.filter(c=>!q||[c.name,c.phone,c.city,c.district].some(v=>String(v||'').toLowerCase().includes(q)));
  }
  function customerTone(c){
    try{return typeof customerState==='function'?customerState(c):['نشط','ok']}catch(_){return ['نشط','ok']}
  }
  function lastVisitText(id){
    try{return typeof lastVisit==='function'?(lastVisit(id)||'لا توجد زيارة'):'لا توجد زيارة'}catch(_){return 'لا توجد زيارة'}
  }
  function repText(id){
    try{return typeof repName==='function'?repName(id):'—'}catch(_){return '—'}
  }
  function moneyText(v){
    try{return typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-SA')}catch(_){return String(v||0)}
  }
  function customerCard(c){
    const st=customerTone(c);
    return `<article class="customer-card jms-customer-compact" data-customer-id="${esc(c.id)}">
      <div class="customer-head"><div><h3>${esc(c.name||'عميل بدون اسم')}</h3><p>${esc(c.phone||'—')} · ${esc(c.city||'—')} · ${esc(repText(c.rep_id))}</p></div><span class="badge ${esc(st[1])}">${esc(st[0])}</span></div>
      <div class="metrics"><div><b>${moneyText(c.debt_balance)}</b><span>المديونية</span></div><div><b>${esc(lastVisitText(c.id))}</b><span>آخر زيارة</span></div><div><b>${esc(c.next_date||'—')}</b><span>الموعد القادم</span></div></div>
      <div class="jms-primary-customer-actions">
        <button type="button" class="visit" onclick="openVisitReportForm?.('${esc(c.id)}')||visit?.('${esc(c.id)}')">زيارة جديدة</button>
        <button type="button" class="quote" onclick="jmsStartQuoteForCustomer('${esc(c.id)}')">عرض سعر</button>
        <button type="button" class="collect" onclick="collect('${esc(c.id)}')">التحصيل</button>
        <details class="jms-more-actions"><summary>•••<span>المزيد</span></summary><div>
          <button type="button" onclick="appointment('${esc(c.id)}')">تحديد موعد</button>
          <button type="button" onclick="note('${esc(c.id)}')">الملاحظات</button>
          <button type="button" onclick="newOrder('${esc(c.id)}')">طلب تصنيع</button>
          <button type="button" onclick="jmsEditCustomerSafe('${esc(c.id)}')">تعديل العميل</button>
        </div></details>
      </div>
    </article>`;
  }
  function renderCustomersFast(reset=true){
    const host=document.getElementById('customersGrid');
    if(!host)return;
    const q=(document.getElementById('customerSearch')?.value||'').trim();
    if(reset||q!==lastCustomerQuery){customerLimit=PAGE_SIZE;lastCustomerQuery=q}
    const list=allCustomers(),visible=list.slice(0,customerLimit);
    host.innerHTML=visible.map(customerCard).join('')||'<div class="panel jms-empty-state">لا يوجد عملاء مطابقون للبحث</div>';
    if(visible.length<list.length){
      host.insertAdjacentHTML('beforeend',`<button id="jmsCustomerLoadMore" class="jms-load-more" type="button">عرض ${Math.min(PAGE_SIZE,list.length-visible.length)} عميل إضافي <small>${visible.length} من ${list.length}</small></button>`);
      const btn=document.getElementById('jmsCustomerLoadMore');
      btn.onclick=()=>{customerLimit+=PAGE_SIZE;renderCustomersFast(false)};
      customerObserver?.disconnect();
      customerObserver=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting){customerLimit+=PAGE_SIZE;renderCustomersFast(false)}},{rootMargin:'240px'});
      customerObserver.observe(btn);
    }
  }
  window.renderCustomers=()=>renderCustomersFast(true);
  window.jmsStartQuoteForCustomer=function(id){
    const nav=document.querySelector('.nav[data-page="quotes"]');nav?.click();
    setTimeout(()=>{window.openQuoteForm?.();setTimeout(()=>{const select=document.getElementById('mqCustomer');if(select)select.value=id},40)},80);
  };
  window.jmsEditCustomerSafe=function(id){
    if(typeof window.editCustomer==='function')return window.editCustomer(id);
    const c=(dbRef().customers||[]).find(x=>x.id===id);if(!c)return;
    const name=prompt('اسم العميل',c.name||'');if(name===null)return;
    const phone=prompt('رقم الجوال',c.phone||'');if(phone===null)return;
    c.name=name.trim()||c.name;c.phone=phone.trim();c.updated_at=new Date().toISOString();saveDb();renderCustomersFast(true);
  };

  function installSearch(){
    const input=document.getElementById('customerSearch');if(!input)return;
    let timer;input.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>renderCustomersFast(true),160)};
  }

  function showSkeleton(page){
    if(!page||page.classList.contains('jms-skeleton-active'))return;
    page.classList.add('jms-skeleton-active');
    clearTimeout(navTimer);
    navTimer=setTimeout(()=>page.classList.remove('jms-skeleton-active'),260);
  }
  function installSkeletons(){
    document.addEventListener('click',e=>{
      const nav=e.target.closest('.nav[data-page]');if(!nav)return;
      showSkeleton(document.getElementById(nav.dataset.page));
    },true);
  }

  function installTopToasts(){
    const move=()=>{
      const el=document.getElementById('cloudSyncStatus');if(!el)return;
      el.setAttribute('role','status');el.setAttribute('aria-live','polite');
      el.classList.add('jms-top-toast','show');
      clearTimeout(el.__jmsHide);el.__jmsHide=setTimeout(()=>el.classList.remove('show'),2000);
    };
    const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.target.id==='cloudSyncStatus'||m.target.querySelector?.('#cloudSyncStatus')))move()});
    observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});
    move();
  }

  const STAGES=[
    ['pending_manager','اعتماد المدير'],['approved_manager','تسجيل التحويل'],['payment_received','إرسال للإنتاج'],
    ['sent_to_production','استلام الإنتاج'],['production_received','الخطة الفنية'],['technical_plan','إنتاج الفيلم'],
    ['film_production','الإرسال للمقص'],['sent_to_cutting','المقص'],['cutting','التغليف'],
    ['packing','جاهز للتسليم'],['ready_delivery','تم التسليم'],['delivered','مكتمل']
  ];
  function productionId(card){
    const action=card.querySelector('[onclick*="openProductionOrder"]')?.getAttribute('onclick')||'';
    return action.match(/openProductionOrder\(['"]([^'"]+)/)?.[1]||'';
  }
  function moveProduction(id,stage){
    const data=dbRef(),p=(data.productionOrders||[]).find(x=>x.id===id);if(!p||p.stage===stage)return;
    const from=p.stage;p.stage=stage;p.updated_at=new Date().toISOString();p.updated_by=userRef()?.name||'';
    data.productionLogs||=[];data.productionLogs.unshift({id:(crypto.randomUUID?.()||String(Date.now())),production_id:id,order_id:p.order_id||'',stage,action:'نقل سريع بين مراحل الإنتاج',note:`${from||'—'} ← ${stage}`,by:userRef()?.name||'',by_id:userRef()?.id||'',at:new Date().toISOString()});
    const order=(data.orders||[]).find(x=>x.id===p.order_id);if(order){order.production_stage=stage;order.status=STAGES.find(x=>x[0]===stage)?.[1]||stage}
    saveDb();window.renderProductionWorkflow?.();window.jmsShowTopBanner?.('تم نقل أمر التصنيع إلى '+(STAGES.find(x=>x[0]===stage)?.[1]||stage),'success');
  }
  window.jmsMoveProduction=moveProduction;
  function enhanceProductionBoard(){
    const board=document.getElementById('productionBoard');if(!board)return;
    const cols=[...board.querySelectorAll('.jms-prod-col')];
    cols.forEach((col,index)=>{
      const stage=STAGES[index]?.[0];if(!stage)return;
      col.dataset.stage=stage;
      col.ondragover=e=>{e.preventDefault();col.classList.add('drag-over')};
      col.ondragleave=()=>col.classList.remove('drag-over');
      col.ondrop=e=>{e.preventDefault();col.classList.remove('drag-over');const id=e.dataTransfer.getData('text/jms-production');if(id)moveProduction(id,stage)};
      [...col.querySelectorAll('.jms-prod-card')].forEach((card,cardIndex)=>{
        const id=productionId(card);if(!id)return;
        card.draggable=true;card.dataset.productionId=id;
        card.ondragstart=e=>{e.dataTransfer.setData('text/jms-production',id);card.classList.add('dragging')};
        card.ondragend=()=>card.classList.remove('dragging');
        const next=STAGES[index+1];
        const btn=[...card.querySelectorAll('.jms-prod-actions button')].find(b=>b.textContent.includes('المرحلة التالية'));
        if(btn&&next)btn.textContent='نقل إلى: '+next[1];
        if(cardIndex>=20)card.hidden=true;
      });
    });
  }
  function wrapProduction(){
    const old=window.renderProductionWorkflow;if(typeof old!=='function'||old.jmsFinalUx)return;
    const wrapped=function(){showSkeleton(document.getElementById('productionWorkflow'));const result=old.apply(this,arguments);requestAnimationFrame(enhanceProductionBoard);return result};
    wrapped.jmsFinalUx=true;window.renderProductionWorkflow=wrapped;setTimeout(()=>window.renderProductionWorkflow?.(),100);
  }

  function banner(text,type='success'){
    let el=document.getElementById('jmsTopBanner');if(!el){el=document.createElement('div');el.id='jmsTopBanner';document.body.appendChild(el)}
    el.className='jms-top-banner '+type+' show';el.textContent=text;clearTimeout(el.__timer);el.__timer=setTimeout(()=>el.classList.remove('show'),2000);
  }
  window.jmsShowTopBanner=banner;

  function installPdfUpgrade(){
    const oldView=window.viewQuote;
    if(typeof oldView==='function'&&!oldView.jmsFinalPdf){
      const wrapped=function(id){const result=oldView.apply(this,arguments);setTimeout(()=>injectQuoteQr(id),30);return result};
      wrapped.jmsFinalPdf=true;window.viewQuote=wrapped;
    }
    window.downloadQuotePDF=async function(){
      const doc=document.querySelector('.quote-a4,.quote-doc');if(!doc)return banner('تعذر العثور على ملف العرض','error');
      const number=(doc.querySelector('.quote-a4-title p,.quote-title-box div')?.textContent||'عرض-سعر').replace(/[^\p{L}\p{N}-]+/gu,'-');
      if(typeof html2pdf==='undefined'){window.print();return}
      banner('جاري تجهيز ملف PDF...','success');
      await html2pdf().set({
        margin:[7,7,7,7],filename:number+'.pdf',
        image:{type:'jpeg',quality:.98},
        html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
        pagebreak:{mode:['avoid-all','css','legacy']}
      }).from(doc).save();
    };
  }
  function injectQuoteQr(id){
    const q=(dbRef().quotes||[]).find(x=>x.id===id);if(!q)return;
    const host=document.querySelector('.quote-a4-title,.quote-title-box');if(!host||host.querySelector('.jms-real-qr'))return;
    const box=document.createElement('div');box.className='jms-real-qr';host.appendChild(box);
    const payload=['JMS Factory CRM','Quote:'+String(q.quote_no||''),'Date:'+String(q.date||''),'Customer:'+String((dbRef().customers||[]).find(c=>c.id===q.customer_id)?.name||''),'TotalSAR:'+String(q.total_amount||'')].join('|');
    if(typeof QRCode!=='undefined')new QRCode(box,{text:payload,width:82,height:82,colorDark:'#0f172a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    else box.textContent='JMS · '+(q.quote_no||'');
  }

  function installGenericPagination(){
    const configs=[['ordersList','.jms-order-list-card,tbody tr'],['quotesList','.quote-card'],['visitNotesList','.visit-note-card']];
    const apply=()=>configs.forEach(([id,selector])=>{
      const host=document.getElementById(id);if(!host)return;
      const items=[...host.querySelectorAll(selector)];items.forEach((el,i)=>{if(i>=20)el.classList.add('jms-lazy-hidden')});
      if(items.length>20&&!host.querySelector('.jms-generic-load')){
        const btn=document.createElement('button');btn.className='jms-load-more jms-generic-load';btn.textContent=`عرض المزيد (${items.length-20})`;
        btn.onclick=()=>{host.querySelectorAll('.jms-lazy-hidden').forEach((el,i)=>{if(i<20)el.classList.remove('jms-lazy-hidden')});if(!host.querySelector('.jms-lazy-hidden'))btn.remove()};
        host.appendChild(btn);
      }
    });
    new MutationObserver(()=>{clearTimeout(window.__jmsPaginateTimer);window.__jmsPaginateTimer=setTimeout(apply,80)}).observe(document.body,{childList:true,subtree:true});
    apply();
  }

  function injectStyle(){
    if(document.getElementById('jmsFinalPerformanceUxStyle'))return;
    const s=document.createElement('style');s.id='jmsFinalPerformanceUxStyle';s.textContent=`
      .jms-customer-compact{content-visibility:auto;contain-intrinsic-size:320px}.jms-primary-customer-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 72px;gap:7px;margin-top:12px}.jms-primary-customer-actions>button,.jms-more-actions>summary{min-height:44px;border:0;border-radius:12px;padding:9px;font-weight:900;cursor:pointer}.jms-primary-customer-actions .visit{background:#2563eb;color:#fff}.jms-primary-customer-actions .quote{background:#7c3aed;color:#fff}.jms-primary-customer-actions .collect{background:#059669;color:#fff}.jms-more-actions{position:relative}.jms-more-actions>summary{display:grid;place-items:center;background:#f1f5f9;color:#334155;list-style:none}.jms-more-actions>summary::-webkit-details-marker{display:none}.jms-more-actions>summary span{font-size:8px}.jms-more-actions>div{position:absolute;z-index:40;left:0;bottom:50px;display:grid;min-width:180px;padding:7px;border:1px solid #dbe4ef;border-radius:13px;background:#fff;box-shadow:0 16px 38px rgba(15,23,42,.2)}.jms-more-actions>div button{border:0;border-radius:9px;padding:10px;background:#fff;text-align:right}.jms-more-actions>div button:hover{background:#f1f5f9}.jms-load-more{grid-column:1/-1;width:100%;margin:8px 0;padding:13px;border:1px solid #cbd5e1;border-radius:13px;background:#fff;color:#334155;font-weight:900}.jms-load-more small{display:block;margin-top:3px;color:#94a3b8}.jms-lazy-hidden{display:none!important}
      .jms-skeleton-active{position:relative;min-height:240px}.jms-skeleton-active:after{content:'';position:absolute;z-index:60;inset:0;border-radius:18px;background:linear-gradient(90deg,#eef2f7 25%,#f8fafc 37%,#eef2f7 63%);background-size:400% 100%;animation:jmsSkeleton 1.1s infinite;opacity:.92;pointer-events:none}@keyframes jmsSkeleton{0%{background-position:100% 0}100%{background-position:0 0}}
      #cloudSyncStatus.jms-top-toast,.jms-top-banner{position:fixed!important;z-index:99999!important;top:max(12px,env(safe-area-inset-top))!important;bottom:auto!important;left:50%!important;right:auto!important;transform:translate(-50%,-130%)!important;max-width:min(92vw,520px)!important;width:max-content!important;padding:11px 16px!important;border:1px solid #bbf7d0!important;border-radius:14px!important;background:#f0fdf4!important;color:#166534!important;box-shadow:0 14px 34px rgba(15,23,42,.18)!important;opacity:0!important;pointer-events:none!important;transition:.22s!important;font-weight:850!important}.jms-top-banner.error{border-color:#fecaca!important;background:#fef2f2!important;color:#b91c1c!important}#cloudSyncStatus.jms-top-toast.show,.jms-top-banner.show{transform:translate(-50%,0)!important;opacity:1!important}
      .jms-prod-card{content-visibility:auto;contain-intrinsic-size:250px;cursor:grab}.jms-prod-card.dragging{opacity:.4}.jms-prod-col.drag-over{outline:3px dashed #2563eb;background:#eff6ff}.jms-prod-actions button{min-height:40px}.jms-real-qr{display:grid;place-items:center;margin:9px auto 0;padding:5px;width:92px;min-height:92px;border:1px solid #dbe4ef;border-radius:9px;background:#fff}.jms-real-qr img,.jms-real-qr canvas{max-width:82px!important;max-height:82px!important}
      .quote-a4-table th,.quote-a4-table td,.quote-products-table th,.quote-products-table td{padding:10px 7px!important;font-size:10.5px!important;line-height:1.55!important}.quote-a4,.quote-doc{padding:16mm 12mm!important}.quote-a4-table,.quote-products-table{table-layout:auto!important}.quote-a4 tr,.quote-doc tr,.quote-a4-card,.quote-info-card,.quote-a4-summary{break-inside:avoid!important;page-break-inside:avoid!important}
      @media(max-width:620px){.jms-primary-customer-actions{grid-template-columns:1fr 1fr 1fr 58px;gap:5px}.jms-primary-customer-actions>button{font-size:10px;padding:7px 4px}.jms-more-actions>summary span{display:none}.quote-a4,.quote-doc{padding:10mm 7mm!important}}
      @media print{@page{size:A4;margin:0}.quote-toolbar,.quote-actions-print,.modal-close{display:none!important}body{margin:0!important}.quote-a4,.quote-doc{box-shadow:none!important;margin:0!important;width:210mm!important;min-height:297mm!important;padding:14mm 11mm!important}header,footer{display:none!important}}
    `;document.head.appendChild(s);
  }

  function install(){
    injectStyle();installSearch();installSkeletons();installTopToasts();installGenericPagination();wrapProduction();installPdfUpgrade();
    renderCustomersFast(true);
    document.addEventListener('click',e=>{if(!e.target.closest('.jms-more-actions'))document.querySelectorAll('.jms-more-actions[open]').forEach(x=>x.removeAttribute('open'))},true);
    setTimeout(()=>{wrapProduction();installPdfUpgrade();enhanceProductionBoard()},700);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JMS_FINAL_PERFORMANCE_UX_VERSION=VERSION;
})();