(function(){
  'use strict';
  const INK_PERMISSION='manage_ink';
  const QUOTE_PERMISSION='manage_quotes';

  function getUser(){
    return window.currentUser || (typeof currentUser!=='undefined'?currentUser:null);
  }

  // Quotation creation now uses the EXISTING "إدارة عروض الأسعار" permission.
  // Admin always has access. Sales managers keep access unless explicitly disabled.
  // Representatives must have manage_quotes=true.
  function canManageQuotes(){
    const u=getUser();
    if(!u) return false;
    if(u.role==='admin') return true;
    if(u.role==='sales') return u.permissions?.[QUOTE_PERMISSION] !== false;
    return u.permissions?.[QUOTE_PERMISSION] === true;
  }
  window.jmsCanCreateQuote=canManageQuotes;
  window.jmsCanManageQuotes=canManageQuotes;

  function addWarehouseOption(select){
    if(!select || select.querySelector('option[value="warehouse"]')) return;
    const option=document.createElement('option');
    option.value='warehouse'; option.textContent='مسؤول الأحبار فقط';
    const sales=select.querySelector('option[value="sales"]');
    select.insertBefore(option,sales||null);
  }

  function addInkPermission(){
    const grid=document.querySelector('.jms-permission-grid');
    if(!grid || grid.querySelector(`[data-perm="${INK_PERMISSION}"]`)) return;
    const label=document.createElement('label');
    label.style.cssText='display:flex;gap:6px;align-items:center;background:#ecfdf5;border:1px solid #86efac;border-radius:10px;padding:8px;font-weight:900';
    label.innerHTML=`<input type="checkbox" class="jmsPerm" data-perm="${INK_PERMISSION}"> إدارة مخزون الأحبار`;
    grid.prepend(label);
    const role=document.getElementById('muRole')?.value || document.getElementById('epRole')?.value;
    if(role==='warehouse') label.querySelector('input').checked=true;
  }

  function enhancePermissionForm(){
    addWarehouseOption(document.getElementById('muRole'));
    addWarehouseOption(document.getElementById('epRole'));
    addInkPermission();
  }

  const originalPreset=window.jmsFillPermissionPreset;
  window.jmsFillPermissionPreset=function(role){
    if(role==='warehouse'){
      document.querySelectorAll('.jmsPerm').forEach(x=>x.checked=x.dataset.perm===INK_PERMISSION);
      setTimeout(enhancePermissionForm,0);
      return;
    }
    if(typeof originalPreset==='function') originalPreset(role);
    setTimeout(enhancePermissionForm,0);
  };

  // Persist the existing permission checkboxes to the server.
  window.saveUserPermissions=async function(userId){
    let store;
    try{store=(typeof db!=='undefined'?db:window.db)||{};}catch(_){store=window.db||{};}
    const u=(store.users||[]).find(x=>String(x.id)===String(userId));
    if(!u) return alert('تعذر العثور على المستخدم');

    const permissions={};
    document.querySelectorAll('.jmsPerm').forEach(x=>permissions[x.dataset.perm]=!!x.checked);
    const field=id=>document.getElementById(id);
    const updated={
      ...u,
      name:(field('epName')?.value||u.name||'').trim(),
      email:(field('epEmail')?.value||u.email||'').trim().toLowerCase(),
      phone:(field('epPhone')?.value||u.phone||'').trim(),
      role:field('epRole')?.value||u.role||'rep',
      status:field('epStatus')?.value||u.status||'active',
      permissions
    };

    try{
      if(typeof jmsPostJson!=='function') throw new Error('missing_api_client');
      await jmsPostJson('/api/auth-create-user',{
        id:updated.id,name:updated.name,email:updated.email,phone:updated.phone,
        role:updated.role,status:updated.status,permissions:updated.permissions
      });
      Object.assign(u,updated);
      const rep=(store.reps||[]).find(r=>String(r.id)===String(u.id)||String(r.email||'')===String(u.email||''));
      if(rep) Object.assign(rep,{name:u.name,email:u.email,phone:u.phone,status:u.status,permissions:u.permissions});
      if(typeof save==='function') save();
      if(typeof closeModal==='function') closeModal();
      if(typeof renderAll==='function') renderAll();
      alert('تم حفظ الصلاحيات بنجاح');
    }catch(error){
      console.error('JMS permission save failed',error);
      alert('تعذر حفظ الصلاحيات على السيرفر. لم يتم تطبيق التغيير.');
    }
  };

  function applyInkAccess(){
    const u=getUser();
    if(!u) return;
    const inkButton=document.querySelector('.nav[data-page="inkStock"]');
    const inkPage=document.getElementById('inkStock');
    const allowed=!!u.permissions?.[INK_PERMISSION] || ['admin','sales','warehouse'].includes(u.role);
    if(inkButton) inkButton.style.display=allowed?'block':'none';
    if(u.role!=='warehouse') return;
    document.querySelectorAll('.sidebar .nav').forEach(btn=>btn.style.display=btn.dataset.page==='inkStock'?'block':'none');
    document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
    inkButton?.classList.add('active'); inkPage?.classList.add('active');
    const roleBox=document.getElementById('currentUserRole');
    if(roleBox) roleBox.textContent='مسؤول مخزون الأحبار';
  }

  function isCreateQuoteControl(el){
    if(!el) return false;
    const clickable=el.closest('button,a,[role="button"]');
    if(!clickable) return false;
    const onclick=String(clickable.getAttribute('onclick')||'');
    const text=String(clickable.textContent||'').trim();
    if(/openQuoteForm\s*\(|forceQuoteForm\s*\(|jmsRepeatLastQuote\s*\(|createQuoteFromVisit\s*\(/.test(onclick)) return true;
    return /(إنشاء عرض سعر|عرض سعر جديد|إضافة عرض سعر)/.test(text);
  }

  function applyQuoteAccess(){
    const u=getUser();
    if(!u) return;
    const allowed=canManageQuotes();
    document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      if(!isCreateQuoteControl(el)) return;
      el.dataset.jmsQuoteCreateControl='1';
      el.style.display=allowed?'':'none';
      el.setAttribute('aria-hidden',allowed?'false':'true');
      if(!allowed) el.setAttribute('tabindex','-1');
      else el.removeAttribute('tabindex');
    });
  }

  function installQuoteGuards(){
    const guard=(name)=>{
      const original=window[name];
      if(typeof original!=='function' || original.__jmsManageQuoteGuarded) return;
      const wrapped=function(){
        if(!canManageQuotes()){
          alert('لا تملك صلاحية إدارة عروض الأسعار.');
          return false;
        }
        return original.apply(this,arguments);
      };
      wrapped.__jmsManageQuoteGuarded=true;
      window[name]=wrapped;
    };

    // Protect every known programmatic entry point into quotation creation.
    ['openQuoteForm','forceQuoteForm','saveQuote','jmsRepeatLastQuote','createQuoteFromVisit'].forEach(guard);
    applyQuoteAccess();
  }

  const oldShow=window.showApp;
  if(typeof oldShow==='function') window.showApp=function(){
    const r=oldShow.apply(this,arguments);
    setTimeout(()=>{applyInkAccess();installQuoteGuards();applyQuoteAccess();},80);
    return r;
  };

  const oldRender=window.renderAll;
  if(typeof oldRender==='function') window.renderAll=function(){
    const r=oldRender.apply(this,arguments);
    setTimeout(()=>{applyInkAccess();installQuoteGuards();applyQuoteAccess();},80);
    return r;
  };

  document.addEventListener('click',event=>{
    if(!canManageQuotes() && isCreateQuoteControl(event.target)){
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('لا تملك صلاحية إدارة عروض الأسعار.');
      return;
    }
    if(event.target.closest('[data-page="users"],button[onclick*="User"],button[onclick*="Permission"]')){
      setTimeout(()=>{enhancePermissionForm();applyInkAccess();applyQuoteAccess();},40);
    }
  },true);

  const observer=new MutationObserver(()=>{
    enhancePermissionForm();
    applyQuoteAccess();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  enhancePermissionForm();
  applyInkAccess();
  installQuoteGuards();
  setTimeout(()=>{applyInkAccess();installQuoteGuards();applyQuoteAccess();},900);
  window.addEventListener('load',()=>setTimeout(()=>{installQuoteGuards();enhancePermissionForm();applyQuoteAccess();},0));
})();
