(function(){
  'use strict';

  function customerId(card){
    if(card.dataset.customerId)return card.dataset.customerId;
    const action=card.querySelector('[onclick]');
    const match=action?.getAttribute('onclick')?.match(/\(['"]([^'"]+)['"]\)/);
    return match?.[1]||'';
  }
  function esc(value){return String(value||'').replace(/['\\]/g,'\\$&')}

  window.jmsStartQuoteForCustomer=function(id){
    const nav=document.querySelector('.nav[data-page="quotes"]');
    if(nav)nav.click();
    setTimeout(function(){
      if(typeof window.openQuoteForm==='function')window.openQuoteForm();
      setTimeout(function(){
        const select=document.getElementById('mqCustomer');
        if(select){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}))}
        const hidden=document.getElementById('mqCustomer');
        if(hidden)hidden.value=id;
      },80);
    },120);
  };

  function removeLegacyActions(card){
    card.querySelectorAll('.customer-actions,.customer-actions-clean,.field-upgrade-actions,.customer-more-menu').forEach(function(element){
      if(!element.classList.contains('jms-customer-actions-v2'))element.remove();
    });
    card.querySelectorAll('.jms-wow-btn,.jms-growth-btn').forEach(function(button){
      if(!button.closest('.jms-customer-actions-v2'))button.remove();
    });
    card.querySelectorAll('button[onclick]').forEach(function(button){
      if(button.closest('.jms-customer-actions-v2'))return;
      const action=button.getAttribute('onclick')||'';
      if(/visit\(|newOrder\(|appointment\(|collect\(|note\(|editCustomer|openCustomer360|jmsOpenCustomer360/.test(action))button.remove();
    });
  }
  function rebuildCard(card){
    const id=customerId(card);if(!id)return;
    const existing=card.querySelector('.jms-customer-actions-v2');
    removeLegacyActions(card);
    if(existing){card.dataset.jmsActionsV2='2';return}
    const safe=esc(id);
    const actions=document.createElement('div');
    actions.className='jms-customer-actions-v2';
    actions.innerHTML=
      '<button type="button" class="jms-action-visit" onclick="visit(\''+safe+'\')">زيارة جديدة</button>'+
      '<button type="button" class="jms-action-quote" onclick="jmsStartQuoteForCustomer(\''+safe+'\')">عرض سعر</button>'+
      '<button type="button" class="jms-action-collect" onclick="collect(\''+safe+'\')">التحصيل</button>'+
      '<details class="jms-action-more"><summary aria-label="المزيد">•••<small>المزيد</small></summary><div>'+
        '<button type="button" onclick="newOrder(\''+safe+'\')">طلب تصنيع</button>'+
        '<button type="button" onclick="appointment(\''+safe+'\')">تحديد موعد</button>'+
        '<button type="button" onclick="note(\''+safe+'\')">الملاحظات</button>'+
        (typeof window.editCustomer==='function'?'<button type="button" onclick="editCustomer(\''+safe+'\')">تعديل العميل</button>':'')+
        (typeof window.openCustomer360==='function'?'<button type="button" onclick="openCustomer360(\''+safe+'\')">ملف العميل 360°</button>':'')+
      '</div></details>';
    card.appendChild(actions);
    card.dataset.jmsActionsV2='2';
    removeLegacyActions(card);
  }
  function rebuildCards(){
    document.querySelectorAll('#customersGrid .customer-card').forEach(rebuildCard);
  }

  function showToast(element){
    if(!element)return;
    element.classList.add('jms-toast-top','jms-toast-visible');
    clearTimeout(element.__jmsToastTimer);
    element.__jmsToastTimer=setTimeout(function(){element.classList.remove('jms-toast-visible')},2000);
  }
  function installToasts(){
    const cloud=document.getElementById('cloudSyncStatus');
    if(cloud){
      cloud.setAttribute('role','status');
      cloud.setAttribute('aria-live','polite');
      showToast(cloud);
      new MutationObserver(function(mutations){
        if(mutations.some(function(item){return item.type==='characterData'||item.type==='childList'}))showToast(cloud);
      }).observe(cloud,{subtree:true,childList:true,characterData:true});
    }
    const observer=new MutationObserver(function(mutations){
      mutations.forEach(function(mutation){
        mutation.addedNodes.forEach(function(node){
          if(node.nodeType!==1)return;
          if(node.matches?.('.toast,.jms-toast,.jms-pro-toast,.campaign-toast'))showToast(node);
          node.querySelectorAll?.('.toast,.jms-toast,.jms-pro-toast,.campaign-toast').forEach(showToast);
        });
      });
      rebuildCards();
    });
    observer.observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
  }

  function closeMenus(event){
    document.querySelectorAll('.jms-action-more[open]').forEach(function(menu){
      if(!menu.contains(event.target))menu.removeAttribute('open');
    });
  }
  function injectStyle(){
    if(document.getElementById('jmsCustomerUiCoreStyle'))return;
    const style=document.createElement('style');style.id='jmsCustomerUiCoreStyle';
    style.textContent=
      '.jms-customer-actions-v2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 68px;gap:7px;margin-top:12px;align-items:stretch}'+
      '.jms-customer-actions-v2>button,.jms-action-more>summary{min-height:44px;border:0;border-radius:12px;padding:8px 6px;font-weight:900;cursor:pointer}'+
      '.jms-action-visit{background:#2563eb!important;color:#fff!important}.jms-action-quote{background:#7c3aed!important;color:#fff!important}.jms-action-collect{background:#059669!important;color:#fff!important}'+
      '.jms-action-more{position:relative}.jms-action-more>summary{display:grid;place-items:center;background:#eef2f7;color:#334155;list-style:none}.jms-action-more>summary::-webkit-details-marker{display:none}.jms-action-more>summary small{font-size:8px}'+
      '.jms-action-more>div{position:absolute;z-index:900;left:0;bottom:51px;display:grid;min-width:190px;padding:7px;border:1px solid #dbe4ef;border-radius:14px;background:#fff;box-shadow:0 18px 40px rgba(15,23,42,.24)}'+
      '.jms-action-more>div button{border:0;border-radius:9px;padding:11px;background:#fff;color:#1e293b;text-align:right;font-weight:750}.jms-action-more>div button:active{background:#f1f5f9}'+
      '#cloudSyncStatus.jms-toast-top,.jms-toast-top{position:fixed!important;z-index:100000!important;top:max(12px,env(safe-area-inset-top))!important;bottom:auto!important;left:50%!important;right:auto!important;transform:translate(-50%,-140%)!important;max-width:min(92vw,520px)!important;width:max-content!important;padding:11px 16px!important;border:1px solid #bbf7d0!important;border-radius:14px!important;background:#f0fdf4!important;color:#166534!important;box-shadow:0 14px 34px rgba(15,23,42,.2)!important;opacity:0!important;pointer-events:none!important;transition:transform .22s ease,opacity .22s ease!important;font-weight:850!important}'+
      '#cloudSyncStatus.jms-toast-visible,.jms-toast-top.jms-toast-visible{transform:translate(-50%,0)!important;opacity:1!important}'+
      '@media(max-width:620px){.jms-customer-actions-v2{grid-template-columns:repeat(3,minmax(0,1fr)) 56px;gap:5px}.jms-customer-actions-v2>button{font-size:10px;padding:7px 3px}.jms-action-more>summary small{display:none}}';
    document.head.appendChild(style);
  }
  function install(){
    injectStyle();rebuildCards();installToasts();
    document.addEventListener('click',closeMenus,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JMS_CUSTOMER_UI_CORE='2026-08-14-v2';
})();