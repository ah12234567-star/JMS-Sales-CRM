(function(){
  const INK_PERMISSION='manage_ink';
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
    if(role!=='warehouse'){
      if(typeof originalPreset==='function') originalPreset(role);
      setTimeout(enhancePermissionForm,0);
      return;
    }
    document.querySelectorAll('.jmsPerm').forEach(x=>x.checked=x.dataset.perm===INK_PERMISSION);
  };
  function applyInkAccess(){
    const u=window.currentUser || (typeof currentUser!=='undefined'?currentUser:null);
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
  const oldShow=window.showApp;
  if(typeof oldShow==='function') window.showApp=function(){const r=oldShow.apply(this,arguments);setTimeout(applyInkAccess,80);return r;};
  const oldRender=window.renderAll;
  if(typeof oldRender==='function') window.renderAll=function(){const r=oldRender.apply(this,arguments);setTimeout(applyInkAccess,80);return r;};
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-page="users"],button[onclick*="User"],button[onclick*="Permission"]'))setTimeout(()=>{enhancePermissionForm();applyInkAccess()},40);
  },true);
  enhancePermissionForm(); applyInkAccess(); setTimeout(applyInkAccess,900);
})();
