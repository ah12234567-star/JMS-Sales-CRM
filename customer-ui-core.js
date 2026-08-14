(function(){
  'use strict';
  function database(){try{return db}catch(_){return window.db||{}}}
  function customerId(card){
    if(card?.dataset.customerId)return card.dataset.customerId;
    const actions=Array.from(card?.querySelectorAll('[onclick]')||[]);
    for(const element of actions){
      const match=(element.getAttribute('onclick')||'').match(/(?:visit|newOrder|appointment|collect|note|editCustomerPro|openCustomerMap|openAssignCustomer|openCustomer360)\(['"]([^'"]+)['"]\)/);
      if(match)return match[1];
    }
    return '';
  }
  function esc(value){return String(value||'').replace(/['\\]/g,'\\$&')}
  function customerById(id){return (database().customers||[]).find(function(customer){return String(customer.id)===String(id)})}

  window.jmsStartQuoteForCustomer=function(id){
    const nav=document.querySelector('.nav[data-page="quotes"]');if(nav)nav.click();
    setTimeout(function(){
      window.openQuoteForm?.();
      setTimeout(function(){
        const select=document.getElementById('mqCustomer');
        if(select){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}))}
      },80);
    },120);
  };

  function removeLegacyActions(card){
    card.querySelectorAll('.customer-actions,.customer-actions-clean,.field-upgrade-actions,.customer-more-menu').forEach(function(element){
      if(!element.classList.contains('jms-customer-actions-v3'))element.remove();
    });
    card.querySelectorAll('.jms-wow-btn,.jms-growth-btn').forEach(function(button){
      if(!button.closest('.jms-customer-actions-v3'))button.remove();
    });
    card.querySelectorAll('button[onclick]').forEach(function(button){
      if(button.closest('.jms-customer-actions-v3'))return;
      const action=button.getAttribute('onclick')||'';
      if(/visit\(|newOrder\(|appointment\(|collect\(|note\(|editCustomer|openCustomerMap|openAssignCustomer|openCustomer360|jmsOpenCustomer360/.test(action))button.remove();
    });
  }

  function rebuildCard(card){
    const id=customerId(card);if(!id)return;
    card.dataset.customerId=id;
    const existing=card.querySelector('.jms-customer-actions-v3');
    removeLegacyActions(card);
    if(existing)return;
    card.querySelector('.jms-customer-actions-v2')?.remove();
    const safe=esc(id),actions=document.createElement('div');
    actions.className='jms-customer-actions-v3';
    actions.innerHTML=
      '<button type="button" class="jms-action-visit" onclick="event.stopPropagation();visit(\''+safe+'\')">زيارة جديدة</button>'+
      '<button type="button" class="jms-action-quote" onclick="event.stopPropagation();jmsStartQuoteForCustomer(\''+safe+'\')">عرض سعر</button>'+
      '<button type="button" class="jms-action-collect" onclick="event.stopPropagation();collect(\''+safe+'\')">التحصيل</button>'+
      '<button type="button" class="jms-action-more-button" data-customer-id="'+safe+'" aria-label="المزيد من خيارات العميل" onclick="jmsOpenCustomerBottomSheet(this.dataset.customerId,event);return false"><b>•••</b><small>المزيد</small></button>';
    card.appendChild(actions);removeLegacyActions(card);
  }
  function rebuildCards(){document.querySelectorAll('#customersGrid .customer-card').forEach(rebuildCard)}

  function ensureSheet(){
    let layer=document.getElementById('jmsCustomerBottomSheet');
    if(layer)return layer;
    layer=document.createElement('div');layer.id='jmsCustomerBottomSheet';layer.className='jms-customer-sheet-layer';
    layer.innerHTML='<div class="jms-customer-sheet-backdrop" data-close-sheet></div><section class="jms-customer-sheet" role="dialog" aria-modal="true" aria-labelledby="jmsCustomerSheetTitle"><div class="jms-sheet-handle"></div><header><div><small>خيارات العميل</small><h2 id="jmsCustomerSheetTitle">العميل</h2></div><button type="button" class="jms-sheet-close" data-close-sheet aria-label="إغلاق">×</button></header><div class="jms-sheet-options"><button type="button" data-sheet-action="edit"><span>✎</span><div><b>تعديل العميل</b><small>تعديل البيانات الأساسية</small></div><i>‹</i></button><button type="button" data-sheet-action="notes"><span>📝</span><div><b>الملاحظات</b><small>إضافة ملاحظة جديدة</small></div><i>‹</i></button><button type="button" data-sheet-action="location"><span>⌖</span><div><b>موقع العميل</b><small>فتح الموقع والمسار</small></div><i>‹</i></button><button type="button" data-sheet-action="transfer"><span>⇄</span><div><b>نقل لمندوب</b><small>تغيير مسؤول العميل</small></div><i>‹</i></button><button type="button" data-sheet-action="profile"><span>◉</span><div><b>ملف العميل 360°</b><small>عرض الملف الذكي الكامل</small></div><i>‹</i></button></div></section>';
    layer.addEventListener('click',function(event){
      if(event.target.closest('[data-close-sheet]'))return window.jmsCloseCustomerBottomSheet();
      const button=event.target.closest('[data-sheet-action]');
      if(button)window.jmsRunCustomerSheetAction(button.dataset.sheetAction);
    });
    document.body.appendChild(layer);return layer;
  }
  window.jmsOpenCustomerBottomSheet=function(id,event){
    event?.preventDefault();event?.stopPropagation();event?.stopImmediatePropagation?.();
    const customer=customerById(id);
    if(!customer){console.error('JMS customer sheet invalid id',id);return}
    const layer=ensureSheet();layer.dataset.customerId=String(customer.id);
    layer.querySelector('#jmsCustomerSheetTitle').textContent=customer.name||'العميل';
    layer.classList.add('open');document.body.classList.add('jms-sheet-open');
    setTimeout(function(){layer.querySelector('.jms-sheet-close')?.focus()},180);
  };
  window.jmsCloseCustomerBottomSheet=function(){
    const layer=document.getElementById('jmsCustomerBottomSheet');
    if(layer)layer.classList.remove('open');document.body.classList.remove('jms-sheet-open');
  };
  window.jmsRunCustomerSheetAction=function(action){
    const layer=document.getElementById('jmsCustomerBottomSheet'),id=layer?.dataset.customerId||'';
    const customer=customerById(id);if(!customer){window.jmsCloseCustomerBottomSheet();return}
    window.jmsCloseCustomerBottomSheet();
    setTimeout(function(){
      if(action==='edit'){
        if(typeof window.editCustomerPro==='function')return window.editCustomerPro(id);
        if(typeof window.jmsEditCustomerSafe==='function')return window.jmsEditCustomerSafe(id);
        return window.editCustomer?.(id);
      }
      if(action==='notes')return window.note?.(id);
      if(action==='location')return window.openCustomerMap?.(id);
      if(action==='transfer')return window.openAssignCustomer?.(id);
      if(action==='profile'){
        if(typeof window.openCustomer360==='function')return window.openCustomer360(id);
        return window.jmsOpenCustomer360Growth?.(id);
      }
    },180);
  };

  function showToast(element){
    if(!element)return;element.classList.add('jms-toast-top','jms-toast-visible');
    clearTimeout(element.__jmsToastTimer);element.__jmsToastTimer=setTimeout(function(){element.classList.remove('jms-toast-visible')},2000);
  }
  function installObservers(){
    const cloud=document.getElementById('cloudSyncStatus');
    if(cloud){cloud.setAttribute('role','status');cloud.setAttribute('aria-live','polite');showToast(cloud);new MutationObserver(function(){showToast(cloud)}).observe(cloud,{subtree:true,childList:true,characterData:true})}
    let timer=0;
    new MutationObserver(function(mutations){
      mutations.forEach(function(mutation){mutation.addedNodes.forEach(function(node){if(node.nodeType===1&&node.matches?.('.toast,.jms-toast,.jms-pro-toast,.campaign-toast'))showToast(node)})});
      clearTimeout(timer);timer=setTimeout(rebuildCards,40);
    }).observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
  }
  function injectStyle(){
    if(document.getElementById('jmsCustomerUiCoreStyle'))document.getElementById('jmsCustomerUiCoreStyle').remove();
    const style=document.createElement('style');style.id='jmsCustomerUiCoreStyle';
    style.textContent=
      '.jms-customer-actions-v3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 64px;gap:7px;margin-top:12px}.jms-customer-actions-v3>button{min-height:44px;border:0;border-radius:12px;padding:8px 6px;font-weight:900}.jms-action-visit{background:#2563eb!important;color:#fff!important}.jms-action-quote{background:#7c3aed!important;color:#fff!important}.jms-action-collect{background:#059669!important;color:#fff!important}.jms-action-more-button{display:grid;place-items:center;background:#eef2f7!important;color:#334155!important}.jms-action-more-button b{font-size:16px;line-height:12px}.jms-action-more-button small{font-size:8px}'+
      '.jms-customer-sheet-layer{position:fixed;z-index:200000;inset:0;visibility:hidden;pointer-events:none}.jms-customer-sheet-layer.open{visibility:visible;pointer-events:auto}.jms-customer-sheet-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.54);opacity:0;transition:opacity .25s}.jms-customer-sheet-layer.open .jms-customer-sheet-backdrop{opacity:1}.jms-customer-sheet{position:absolute;right:0;bottom:0;left:0;width:min(620px,100%);max-height:min(82vh,720px);margin:auto;padding:10px 16px calc(18px + env(safe-area-inset-bottom));border-radius:26px 26px 0 0;background:#fff;box-shadow:0 -24px 60px rgba(15,23,42,.28);transform:translateY(105%);transition:transform .28s cubic-bezier(.2,.8,.2,1);overflow:auto}.jms-customer-sheet-layer.open .jms-customer-sheet{transform:translateY(0)}.jms-sheet-handle{width:46px;height:5px;margin:2px auto 14px;border-radius:999px;background:#cbd5e1}.jms-customer-sheet header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.jms-customer-sheet header small{color:#64748b}.jms-customer-sheet header h2{margin:3px 0 0;color:#0f172a;font-size:20px}.jms-sheet-close{display:grid;place-items:center;width:42px;height:42px;border:0;border-radius:50%;background:#f1f5f9;color:#334155;font-size:25px}.jms-sheet-options{display:grid;gap:8px}.jms-sheet-options>button{display:grid;grid-template-columns:46px 1fr 20px;align-items:center;gap:11px;width:100%;min-height:64px;padding:9px 11px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;color:#0f172a;text-align:right}.jms-sheet-options>button>span{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#eff6ff;color:#2563eb;font-size:20px}.jms-sheet-options>button div b,.jms-sheet-options>button div small{display:block}.jms-sheet-options>button div small{margin-top:3px;color:#64748b;font-size:11px}.jms-sheet-options>button>i{color:#94a3b8;font-size:25px;font-style:normal}.jms-sheet-open{overflow:hidden!important}'+
      '#cloudSyncStatus.jms-toast-top,.jms-toast-top{position:fixed!important;z-index:100000!important;top:max(12px,env(safe-area-inset-top))!important;bottom:auto!important;left:50%!important;right:auto!important;transform:translate(-50%,-140%)!important;max-width:min(92vw,520px)!important;width:max-content!important;padding:11px 16px!important;border:1px solid #bbf7d0!important;border-radius:14px!important;background:#f0fdf4!important;color:#166534!important;box-shadow:0 14px 34px rgba(15,23,42,.2)!important;opacity:0!important;pointer-events:none!important;transition:.22s!important;font-weight:850!important}#cloudSyncStatus.jms-toast-visible,.jms-toast-top.jms-toast-visible{transform:translate(-50%,0)!important;opacity:1!important}'+
      '@media(max-width:620px){.jms-customer-actions-v3{grid-template-columns:repeat(3,minmax(0,1fr)) 56px;gap:5px}.jms-customer-actions-v3>button{font-size:10px;padding:7px 3px}.jms-action-more-button small{display:none}}';
    document.head.appendChild(style);
  }
  function install(){injectStyle();ensureSheet();rebuildCards();installObservers();document.addEventListener('keydown',function(event){if(event.key==='Escape')window.jmsCloseCustomerBottomSheet()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JMS_CUSTOMER_UI_CORE='2026-08-14-v3';
})();