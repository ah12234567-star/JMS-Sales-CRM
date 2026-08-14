(function(){
  'use strict';
  const PAGE_SIZE=20;
  let customerLimit=PAGE_SIZE;
  let lastQuery='';
  let searchTimer=0;

  function safeText(value){
    return String(value??'').replace(/[&<>"']/g,function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }
  function customers(){
    try{return typeof allowedCustomers==='function'?allowedCustomers():(window.db?.customers||[])}
    catch(_){return window.db?.customers||[]}
  }
  function rep(id){try{return typeof repName==='function'?repName(id):'—'}catch(_){return '—'}}
  function amount(value){try{return typeof money==='function'?money(value):Number(value||0).toLocaleString('ar-SA')}catch(_){return String(value||0)}}
  function visitDate(id){try{return typeof lastVisit==='function'?(lastVisit(id)||'—'):'—'}catch(_){return '—'}}
  function state(customer){try{return typeof customerState==='function'?customerState(customer):['نشط','ok']}catch(_){return ['نشط','ok']}}

  function card(customer){
    const tone=state(customer);
    const id=safeText(customer.id);
    return '<div class="customer-card jms-lazy-card" data-customer-id="'+id+'">'+
      '<div class="customer-head"><div><h3>'+safeText(customer.name||'عميل بدون اسم')+'</h3><p>'+safeText(customer.phone||'—')+' · '+safeText(customer.city||'—')+' · '+safeText(rep(customer.rep_id))+'</p></div><span class="badge '+safeText(tone[1])+'">'+safeText(tone[0])+'</span></div>'+
      '<div class="metrics"><div><b>'+amount(customer.debt_balance)+'</b><span>مديونية</span></div><div><b>'+safeText(visitDate(customer.id))+'</b><span>آخر زيارة</span></div><div><b>'+safeText(customer.next_date||'—')+'</b><span>موعد</span></div></div>'+
      '<div class="customer-actions"><button onclick="visit(\''+id+'\')">تمت الزيارة</button><button onclick="newOrder(\''+id+'\')">طلب جديد</button><button onclick="appointment(\''+id+'\')">موعد</button><button onclick="collect(\''+id+'\')">تحصيل</button><button onclick="note(\''+id+'\')">ملاحظة</button></div>'+
    '</div>';
  }

  function render(reset){
    const grid=document.getElementById('customersGrid');
    const input=document.getElementById('customerSearch');
    if(!grid||!input)return;
    const query=(input.value||'').trim().toLowerCase();
    if(reset||query!==lastQuery){customerLimit=PAGE_SIZE;lastQuery=query}
    const list=customers().filter(function(customer){
      if(!query)return true;
      return [customer.name,customer.phone,customer.city,customer.district].some(function(value){return String(value||'').toLowerCase().includes(query)});
    });
    const visible=list.slice(0,customerLimit);
    grid.innerHTML=visible.map(card).join('')||'<div class="panel">لا يوجد عملاء</div>';
    if(visible.length<list.length){
      const button=document.createElement('button');
      button.type='button';button.className='jms-load-more';
      button.innerHTML='عرض المزيد <small>'+visible.length+' من '+list.length+'</small>';
      button.onclick=function(){customerLimit+=PAGE_SIZE;render(false)};
      grid.appendChild(button);
    }
  }

  function installCustomerPagination(){
    window.renderCustomers=function(){render(true)};
    const input=document.getElementById('customerSearch');
    if(input)input.oninput=function(){
      clearTimeout(searchTimer);
      searchTimer=setTimeout(function(){render(true)},180);
    };
    render(true);
  }

  function skeleton(page){
    if(!page)return;
    page.classList.add('jms-loading-shell');
    clearTimeout(page.__jmsSkeletonTimer);
    page.__jmsSkeletonTimer=setTimeout(function(){page.classList.remove('jms-loading-shell')},240);
  }
  function installSkeletons(){
    document.addEventListener('click',function(event){
      const nav=event.target.closest('.nav[data-page]');
      if(nav)skeleton(document.getElementById(nav.dataset.page));
    },true);
  }

  function paginateRenderedLists(){
    const definitions=[
      ['ordersList','.order-card,.jms-order-list-card,tbody tr'],
      ['quotesList','.quote-card'],
      ['visitNotesList','.visit-note-card']
    ];
    definitions.forEach(function(definition){
      const host=document.getElementById(definition[0]);if(!host)return;
      const rows=Array.from(host.querySelectorAll(definition[1]));
      rows.forEach(function(row,index){row.classList.toggle('jms-page-hidden',index>=PAGE_SIZE)});
      const old=host.querySelector('.jms-list-more');if(old)old.remove();
      if(rows.length>PAGE_SIZE){
        const button=document.createElement('button');button.type='button';button.className='jms-load-more jms-list-more';
        button.textContent='عرض 20 عنصر إضافي';
        button.onclick=function(){
          const hidden=Array.from(host.querySelectorAll('.jms-page-hidden')).slice(0,PAGE_SIZE);
          hidden.forEach(function(row){row.classList.remove('jms-page-hidden')});
          if(!host.querySelector('.jms-page-hidden'))button.remove();
        };
        host.appendChild(button);
      }
    });
  }
  function installListPagination(){
    let timer=0;
    const observer=new MutationObserver(function(){
      clearTimeout(timer);timer=setTimeout(paginateRenderedLists,100);
    });
    observer.observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
    paginateRenderedLists();
  }

  function injectStyle(){
    if(document.getElementById('jmsPerformanceCoreStyle'))return;
    const style=document.createElement('style');style.id='jmsPerformanceCoreStyle';
    style.textContent='.jms-lazy-card{content-visibility:auto;contain-intrinsic-size:300px}.jms-page-hidden{display:none!important}.jms-load-more{grid-column:1/-1;width:100%;margin:10px 0;padding:13px;border:1px solid #cbd5e1;border-radius:13px;background:#fff;color:#334155;font-weight:900}.jms-load-more small{display:block;margin-top:3px;color:#94a3b8}.jms-loading-shell{position:relative;min-height:220px}.jms-loading-shell:after{content:"";position:absolute;z-index:80;inset:0;border-radius:18px;background:linear-gradient(90deg,#e8edf4 25%,#f8fafc 37%,#e8edf4 63%);background-size:400% 100%;animation:jmsPerfSkeleton 1.1s infinite;pointer-events:none;opacity:.94}@keyframes jmsPerfSkeleton{0%{background-position:100% 0}100%{background-position:0 0}}';
    document.head.appendChild(style);
  }

  function install(){injectStyle();installCustomerPagination();installSkeletons();installListPagination()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JMS_PERFORMANCE_CORE_VERSION='2026-08-14-v1';
})();