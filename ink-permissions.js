(function(){
  const INK_PERMISSION='manage_ink';
  const QUOTE_CREATE_PERMISSION='create_quotes';

  function getUser(){
    return window.currentUser || (typeof currentUser!=='undefined'?currentUser:null);
  }

  function canCreateQuote(){
    const u=getUser();
    if(!u) return false;
    if(u.role==='admin') return true;
    if(u.role==='sales') return u.permissions?.[QUOTE_CREATE_PERMISSION] !== false;
    return u.permissions?.[QUOTE_CREATE_PERMISSION] === true;
  }
  window.jmsCanCreateQuote=canCreateQuote;

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

  function addQuoteCreatePermission(){
    if(document.querySelector(`.jmsPerm[data-perm="${QUOTE_CREATE_PERMISSION}"]`)) return;
    const manage=document.querySelector('.jmsPerm[data-perm="manage_quotes"]');
    if(!manage) return;
    const sourceLabel=manage.closest('label');
    if(!sourceLabel || !sourceLabel.parentElement) return;
    const label=document.createElement('label');
    label.style.cssText='display:flex;gap:6px;align-items:center;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:8px;font-weight:900';
    label.innerHTML=`<input type="checkbox" class="jmsPerm" data-perm="${QUOTE_CREATE_PERMISSION}"> إنشاء عرض سعر`;
    sourceLabel.insertAdjacentElement('beforebegin',label);

    const role=document.getElementById('muRole')?.value || document.getElementById('epRole')?.value || '';
    const editingId=document.getElementById('editUserId')?.value || document.getElementById('muId')?.value || '';
    let existingUser=null;
    try{
      const store=(typeof db!=='undefined'?db:window.db)||{};
      existingUser=(store.users||[]).find(x=>String(x.id)===String(editingId));
    }catch(_){}
    if(existingUser?.permissions && Object.prototype.hasOwnProperty.call(existingUser.permissions,QUOTE_CREATE_PERMISSION)){
      label.querySelector('input').checked=!!existingUser.permissions[QUOTE_CREATE_PERMISSION];
    }else{
      label.querySelector('input').checked=['admin','sales'].includes(role);
    }
  }

  function enhancePermissionForm(){
    addWarehouseOption(document.getElementById('muRole'));
    addWarehouseOption(document.getElementById('epRole'));
    addInkPermission();
    addQuoteCreatePermission();
  }

  const originalPreset=window.jmsFillPermissionPreset;
  window.jmsFillPermissionPreset=function(role){
    if(role==='warehouse'){
      document.querySelectorAll('.jmsPerm').forEach(x=>x.checked=x.dataset.perm===INK_PERMISSION);
      setTimeout(enhancePermissionForm,0);
      return;
    }
    if(typeof originalPreset==='function') originalPreset(role);
    setTimeout(()=>{
      enhancePermissionForm();
      const createQuote=document.querySelector(`.jmsPerm[data-perm="${QUOTE_CREATE_PERMISSION}"]`);
      if(createQuote) createQuote.checked=['admin','sales'].includes(role);
    },0);
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
    if(/openQuoteForm\s*\(|jmsRepeatLastQuote\s*\(/.test(onclick)) return true;
    return /^(إنشاء|إضافة|عرض سعر جديد|إنشاء عرض سعر)/.test(text) && /عرض/.test(text);
  }

  function applyQuoteCreateAccess(){
    const u=getUser();
    if(!u) return;
    const allowed=canCreateQuote();
    document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      if(!isCreateQuoteControl(el)) return;
      el.dataset.jmsQuoteCreateControl='1';
      el.style.display=allowed?'':'none';
      el.setAttribute('aria-hidden',allowed?'false':'true');
    });
  }

  function installQuoteGuards(){
    if(window.__jmsQuoteCreateGuardsInstalled) return;
    window.__jmsQuoteCreateGuardsInstalled=true;

    const guard=(name)=>{
      const original=window[name];
      if(typeof original!=='function' || original.__jmsQuoteGuarded) return;
      const wrapped=function(){
        if(!canCreateQuote()){
          alert('لا تملك صلاحية إنشاء عرض سعر. راجع مدير النظام.');
          return false;
        }
        return original.apply(this,arguments);
      };
      wrapped.__jmsQuoteGuarded=true;
      window[name]=wrapped;
    };
    ['openQuoteForm','saveQuote','jmsRepeatLastQuote'].forEach(guard);
    applyQuoteCreateAccess();
  }

  const oldShow=window.showApp;
  if(typeof oldShow==='function') window.showApp=function(){const r=oldShow.apply(this,arguments);setTimeout(()=>{applyInkAccess();applyQuoteCreateAccess();},80);return r;};
  const oldRender=window.renderAll;
  if(typeof oldRender==='function') window.renderAll=function(){const r=oldRender.apply(this,arguments);setTimeout(()=>{applyInkAccess();applyQuoteCreateAccess();},80);return r;};

  document.addEventListener('click',event=>{
    if(!canCreateQuote() && isCreateQuoteControl(event.target)){
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('لا تملك صلاحية إنشاء عرض سعر. راجع مدير النظام.');
      return;
    }
    if(event.target.closest('[data-page="users"],button[onclick*="User"],button[onclick*="Permission"]')){
      setTimeout(()=>{enhancePermissionForm();applyInkAccess();applyQuoteCreateAccess();},40);
    }
  },true);

  const observer=new MutationObserver(()=>{
    enhancePermissionForm();
    applyQuoteCreateAccess();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  enhancePermissionForm();
  applyInkAccess();
  setTimeout(applyInkAccess,900);
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      // Run after every later feature script has finished defining quote functions.
      window.__jmsQuoteCreateGuardsInstalled=false;
      installQuoteGuards();
      enhancePermissionForm();
    },0);
  });
})();
