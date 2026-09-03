/* JMS customer store administration: SKU price, stock, visibility and bulk pricing. */
(function(){
  'use strict';
  if(window.__JMS_STORE_ADMIN__)return;
  window.__JMS_STORE_ADMIN__='2026-09-03-store-1';
  const state={items:[],orders:[],search:'',status:'all',page:1,pageSize:25,loading:false};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money=value=>Number(value||0).toLocaleString('ar-SA',{maximumFractionDigits:2});
  const token=()=>sessionStorage.getItem('jms_auth_token')||'';
  const headers=()=>({'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})});
  const current=()=>{try{return currentUser}catch(_){return window.currentUser||null}};
  const isManager=()=>['admin','sales'].includes(current()?.role);

  function injectStyle(){
    if(document.getElementById('jmsStoreAdminStyle'))return;
    const style=document.createElement('style');style.id='jmsStoreAdminStyle';style.textContent=`
      .store-admin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}.store-admin-stat{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:15px}.store-admin-stat b{display:block;font-size:25px;color:#0f766e}.store-admin-stat span{color:#64748b;font-size:13px}.store-admin-tools{display:grid;grid-template-columns:2fr 1fr auto;gap:10px;margin-bottom:14px}.store-admin-tools input,.store-admin-tools select{border:1px solid #dbe3e8;border-radius:12px;padding:10px;background:#fff}.store-admin-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:12px;padding:10px 15px;background:#0f172a;color:#fff;font-weight:800}.store-admin-list{display:grid;gap:10px}.store-admin-row{display:grid;grid-template-columns:minmax(220px,2.2fr) 95px 95px 105px 105px 65px 75px;gap:10px;align-items:end;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:13px}.store-admin-name{align-self:center}.store-admin-name b,.store-admin-name small{display:block}.store-admin-name small{color:#64748b}.store-admin-row label{display:grid;gap:4px;color:#64748b;font-size:12px}.store-admin-row input{width:100%;border:1px solid #dbe3e8;border-radius:10px;padding:8px}.store-admin-row button{border:0;border-radius:11px;background:#0f766e;color:#fff;padding:9px;font-weight:800}.store-admin-row button:disabled{background:#94a3b8}.store-admin-visible{display:flex!important;align-items:center;gap:6px}.store-admin-visible input{width:auto}.store-admin-pages{display:flex;justify-content:center;gap:10px;align-items:center;margin-top:14px}.store-admin-pages button{border:1px solid #dbe3e8;background:#fff;border-radius:10px;padding:8px 13px}.store-admin-empty{text-align:center;padding:35px;color:#64748b;background:#fff;border-radius:16px}@media(max-width:900px){.store-admin-stats{grid-template-columns:repeat(2,1fr)}.store-admin-tools{grid-template-columns:1fr}.store-admin-row{grid-template-columns:repeat(2,1fr)}.store-admin-name{grid-column:1/-1}.store-admin-row button{grid-column:1/-1}}`;
    style.textContent+=`.store-admin-orders{display:grid;gap:10px;margin:14px 0 22px}.store-admin-orders h2{margin:0}.store-order-row{display:grid;grid-template-columns:1fr 1fr auto auto;gap:12px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px}.store-order-row b,.store-order-row small{display:block}.store-order-row small{color:#64748b}.store-order-status{color:#0f766e;font-weight:800}@media(max-width:700px){.store-order-row{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);
  }

  function injectPage(){
    if(document.getElementById('storeAdmin'))return;
    const nav=document.querySelector('.sidebar nav'),main=document.querySelector('main.main')||document.querySelector('.main');if(!nav||!main)return;
    const button=document.createElement('button');button.id='storeAdminNav';button.className='nav manager-only';button.dataset.page='storeAdmin';button.textContent='متجر العملاء';button.style.display=isManager()?'':'none';nav.appendChild(button);
    const page=document.createElement('section');page.id='storeAdmin';page.className='page';page.innerHTML=`
      <div class="page-head with-action"><div><h1>متجر العملاء</h1><p>إدارة أسعار ومخزون المنتجات المرتبطة بالـSKU.</p></div><div class="head-actions"><a class="store-admin-link" href="/store" target="_blank" rel="noopener">فتح متجر العملاء</a><button class="primary" type="button" onclick="JMSStoreAdmin.load()">تحديث البيانات</button></div></div>
      <div id="storeAdminOrders" class="store-admin-orders"></div><div id="storeAdminStats" class="store-admin-stats"></div>
      <div class="store-admin-tools"><input id="storeAdminSearch" placeholder="ابحث باسم الصنف أو SKU"><select id="storeAdminStatus"><option value="all">كل الأصناف</option><option value="available">المتوفر</option><option value="unavailable">غير المتوفر</option><option value="missing_price">بدون سعر</option><option value="hidden">مخفي</option></select><span id="storeAdminResult"></span></div>
      <div id="storeAdminList" class="store-admin-list"><div class="store-admin-empty">جارٍ تحميل المنتجات...</div></div><div id="storeAdminPages" class="store-admin-pages"></div>`;
    main.appendChild(page);
    button.addEventListener('click',()=>{document.querySelectorAll('.nav,.page').forEach(node=>node.classList.remove('active'));button.classList.add('active');page.classList.add('active');load()});
    page.addEventListener('input',event=>{if(event.target.id==='storeAdminSearch'){state.search=event.target.value;state.page=1;render()}});
    page.addEventListener('change',event=>{if(event.target.id==='storeAdminStatus'){state.status=event.target.value;state.page=1;render()}});
    page.addEventListener('click',event=>{const save=event.target.closest('[data-store-save]');if(save)saveItem(save.dataset.storeSave);const pager=event.target.closest('[data-store-page]');if(pager){state.page=Math.max(1,Number(pager.dataset.storePage));render()}});
  }

  async function load(){
    if(!isManager()||state.loading)return;state.loading=true;
    try{const [response,ordersResponse]=await Promise.all([fetch('/api/store-catalog?admin=1',{headers:headers()}),fetch('/api/store-orders',{headers:headers()})]);const [data,ordersData]=await Promise.all([response.json(),ordersResponse.json()]);if(!response.ok||!data.ok)throw new Error(data.error||'load_failed');state.items=data.items||[];state.orders=ordersResponse.ok&&ordersData.ok?ordersData.orders||[]:[];render()}
    catch(error){console.warn(error);const box=document.getElementById('storeAdminList');if(box)box.innerHTML='<div class="store-admin-empty">تعذر تحميل منتجات المتجر.</div>'}
    finally{state.loading=false}
  }

  function filtered(){
    const query=state.search.trim().toLowerCase();return state.items.filter(item=>{
      if(query&&!`${item.sku} ${item.original_name} ${item.product_name}`.toLowerCase().includes(query))return false;
      if(state.status==='available'&&!item.available)return false;
      if(state.status==='unavailable'&&item.available)return false;
      if(state.status==='missing_price'&&Number(item.price)>0)return false;
      if(state.status==='hidden'&&item.visible)return false;
      return true;
    });
  }

  function tierValue(item,min){return (item.tiers||[]).find(tier=>Number(tier.min_qty)===min)?.price||''}
  function render(){
    const stats=document.getElementById('storeAdminStats'),list=document.getElementById('storeAdminList'),pages=document.getElementById('storeAdminPages');if(!stats||!list||!pages)return;
    const orders=document.getElementById('storeAdminOrders');if(orders)orders.innerHTML=`<h2>طلبات المتجر الجديدة</h2>${state.orders.length?state.orders.slice(0,20).map(order=>`<article class="store-order-row"><div><b>طلب ${esc(String(order.id||'').slice(-8).toUpperCase())}</b><small>${esc(order.date||order.created_at||'')}</small></div><div><b>${esc(order.customer_name||'عميل المتجر')}</b><small>${esc(order.customer_phone||'')}</small></div><span class="store-order-status">${esc(order.status||'جديد')}</span><b>${money(order.total||order.amount_value)} ر.س</b></article>`).join(''):'<div class="store-admin-empty">لا توجد طلبات متجر حتى الآن.</div>'}`;
    stats.innerHTML=`<div class="store-admin-stat"><b>${money(state.items.length)}</b><span>إجمالي SKU</span></div><div class="store-admin-stat"><b>${money(state.items.filter(item=>item.available).length)}</b><span>متوفر للطلب</span></div><div class="store-admin-stat"><b>${money(state.items.filter(item=>Number(item.price)<=0).length)}</b><span>بدون سعر</span></div><div class="store-admin-stat"><b>${money(state.items.filter(item=>!item.visible).length)}</b><span>مخفي من المتجر</span></div>`;
    const items=filtered(),pageCount=Math.max(1,Math.ceil(items.length/state.pageSize));state.page=Math.min(state.page,pageCount);const slice=items.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
    document.getElementById('storeAdminResult').textContent=`${items.length} صنف`;
    list.innerHTML=slice.length?slice.map(item=>`<div class="store-admin-row" data-store-row="${esc(item.sku)}"><div class="store-admin-name"><b>${esc(item.product_name)}</b><small>${esc(item.original_name)}</small><small>SKU: ${esc(item.sku)} · ${esc(item.unit)} · ${item.available?'متوفر':'غير متوفر'}</small></div><label>سعر البيع<input data-field="price" type="number" min="0" step="0.01" value="${Number(item.price||0)}"></label><label>المخزون<input data-field="stock" type="number" step="0.01" value="${Number(item.stock||0)}"></label><label>سعر 10<input data-field="tier10" type="number" min="0" step="0.01" value="${tierValue(item,10)}" placeholder="اختياري"></label><label>سعر 50<input data-field="tier50" type="number" min="0" step="0.01" value="${tierValue(item,50)}" placeholder="اختياري"></label><label class="store-admin-visible"><input data-field="visible" type="checkbox" ${item.visible?'checked':''}> يظهر</label><button type="button" data-store-save="${esc(item.sku)}">حفظ</button></div>`).join(''):'<div class="store-admin-empty">لا توجد أصناف مطابقة.</div>';
    pages.innerHTML=`<button type="button" data-store-page="${state.page-1}" ${state.page<=1?'disabled':''}>السابق</button><span>${state.page} من ${pageCount}</span><button type="button" data-store-page="${state.page+1}" ${state.page>=pageCount?'disabled':''}>التالي</button>`;
  }

  async function saveItem(sku){
    const row=document.querySelector(`[data-store-row="${CSS.escape(String(sku))}"]`),button=row?.querySelector('[data-store-save]');if(!row||!button)return;
    const field=name=>row.querySelector(`[data-field="${name}"]`);const price=Number(field('price').value||0),stock=Number(field('stock').value||0);const tiers=[];if(Number(field('tier10').value)>0)tiers.push({min_qty:10,price:Number(field('tier10').value)});if(Number(field('tier50').value)>0)tiers.push({min_qty:50,price:Number(field('tier50').value)});
    button.disabled=true;button.textContent='يحفظ...';
    try{const response=await fetch('/api/store-catalog',{method:'POST',headers:headers(),body:JSON.stringify({action:'update',sku,price,stock,visible:field('visible').checked,tiers})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'save_failed');const index=state.items.findIndex(item=>String(item.sku)===String(sku));if(index>=0)state.items[index]={...state.items[index],...data.item};render();alert('تم تحديث السعر والمخزون في المتجر')}
    catch(error){button.disabled=false;button.textContent='حفظ';alert('تعذر حفظ التعديل: '+error.message)}
  }

  function syncAccess(){const button=document.getElementById('storeAdminNav');if(button)button.style.display=isManager()?'':'none'}
  function install(){injectStyle();injectPage();syncAccess();setInterval(syncAccess,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,350));else setTimeout(install,350);
  window.JMSStoreAdmin={load,render};
})();
