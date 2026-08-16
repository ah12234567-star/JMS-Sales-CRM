/* Ready Goods Notice — admin visibility and company/bank settings control. */
(function(){
  'use strict';
  const ENABLE_KEY='jms_ready_goods_rep_enabled_v1';
  const COMPANY_KEY='jms_company_profile_v1';
  const BANK_KEY='jms_company_bank_v1';
  const ADMIN_PANEL_ID='rgnAdminControlPanel';
  const isAdmin=()=>window.currentUser?.role==='admin';
  const isRep=()=>window.currentUser?.role==='rep';
  function dbRef(){try{return db}catch(_){return window.db||null}}
  function enabled(){
    const d=dbRef();
    if(typeof d?.systemSettings?.readyGoodsRepEnabled==='boolean')return d.systemSettings.readyGoodsRepEnabled;
    const raw=localStorage.getItem(ENABLE_KEY);return raw===null?true:raw==='true';
  }
  function persistEnabled(value){
    localStorage.setItem(ENABLE_KEY,String(!!value));
    const d=dbRef();
    if(d){d.systemSettings=d.systemSettings||{};d.systemSettings.readyGoodsRepEnabled=!!value;try{if(typeof save==='function')save()}catch(_){}}
    applyVisibility();
  }
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value||{}))}
  function ensureModule(){
    if(window.JMSReadyGoods)return;
    if(document.querySelector('script[data-jms-ready-goods-admin-loader]'))return;
    const s=document.createElement('script');s.src='ready-goods-notice.js?v=20260816-official-2';s.dataset.jmsReadyGoodsAdminLoader='1';document.head.appendChild(s);
  }
  function applyVisibility(){
    const allow=enabled();
    const sidebar=document.getElementById('readyGoodsNoticeNav');
    if(sidebar)sidebar.style.display=(isAdmin()||(isRep()&&allow))?'block':'none';
    const bottom=document.querySelector('#repBottomNav button[data-go="readyGoodsNotice"]');
    if(bottom)bottom.style.display=(isRep()&&allow)?'block':'none';
    if(isRep()&&!allow&&document.querySelector('#readyGoodsNotice.page.active')){
      document.querySelector('#repBottomNav button[data-go="repHome"]')?.click();
    }
  }
  function val(id){return document.getElementById(id)?.value?.trim()||''}
  function saveCompanyBank(){
    const company={
      name:val('rgnCompanyName')||'شركة جدة النموذجية للصناعة',
      commercial_registration:val('rgnCompanyCR'),vat_number:val('rgnCompanyVAT'),address:val('rgnCompanyAddress'),phone:val('rgnCompanyPhone'),email:val('rgnCompanyEmail')
    };
    const bank={bank_name:val('rgnBankName'),account_name:val('rgnAccountName'),iban:val('rgnIBAN'),account_number:val('rgnAccountNo')};
    writeJson(COMPANY_KEY,company);writeJson(BANK_KEY,bank);
    const d=dbRef();if(d){d.companyProfile={...(d.companyProfile||{}),...company};d.companyBank={...(d.companyBank||{}),...bank};try{if(typeof save==='function')save()}catch(_){}}
    alert('تم حفظ بيانات الشركة والتحويل البنكي للإشعار');
  }
  function injectAdminPanel(){
    if(!isAdmin())return;
    const page=document.getElementById('readyGoodsNotice');if(!page||document.getElementById(ADMIN_PANEL_ID))return;
    const c=readJson(COMPANY_KEY),b=readJson(BANK_KEY);
    const panel=document.createElement('div');panel.id=ADMIN_PANEL_ID;panel.className='rgn-card';panel.style.marginBottom='14px';
    panel.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h3 style="margin:0 0 4px">إعدادات إشعار البضاعة الجاهزة</h3><small style="color:#64748b">مدير النظام يتحكم في ظهور الميزة للمناديب وبيانات المستند.</small></div><label style="display:flex;align-items:center;gap:8px;font-weight:900"><input id="rgnRepEnabled" type="checkbox" ${enabled()?'checked':''}> إظهار «جاهزة» للمناديب</label></div><hr style="border:0;border-top:1px solid #e2e8f0;margin:14px 0"><h3>بيانات الشركة والتحويل البنكي</h3><div class="rgn-grid"><div><div class="rgn-field"><span>اسم الشركة</span><input id="rgnCompanyName" value="${(c.name||'شركة جدة النموذجية للصناعة').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>السجل التجاري</span><input id="rgnCompanyCR" value="${(c.commercial_registration||c.cr||'').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>الرقم الضريبي</span><input id="rgnCompanyVAT" value="${(c.vat_number||c.vat||'').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>العنوان</span><input id="rgnCompanyAddress" value="${(c.address||'').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>الهاتف</span><input id="rgnCompanyPhone" value="${(c.phone||'').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>البريد</span><input id="rgnCompanyEmail" value="${(c.email||'').replace(/"/g,'&quot;')}"></div></div><div><div class="rgn-field"><span>اسم البنك</span><input id="rgnBankName" value="${(b.bank_name||'').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>اسم الحساب</span><input id="rgnAccountName" value="${(b.account_name||'').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>IBAN</span><input id="rgnIBAN" dir="ltr" value="${(b.iban||'').replace(/"/g,'&quot;')}"></div><div class="rgn-field"><span>رقم الحساب</span><input id="rgnAccountNo" dir="ltr" value="${(b.account_number||'').replace(/"/g,'&quot;')}"></div></div></div><button type="button" class="rgn-primary" id="rgnSaveAdminSettings" style="margin-top:10px">حفظ الإعدادات</button>`;
    page.insertBefore(panel,page.firstChild);
    document.getElementById('rgnRepEnabled').addEventListener('change',e=>persistEnabled(e.target.checked));
    document.getElementById('rgnSaveAdminSettings').addEventListener('click',saveCompanyBank);
  }
  function sync(){
    if(!window.currentUser)return;
    if(isAdmin())ensureModule();
    applyVisibility();injectAdminPanel();
  }
  function install(){sync();setInterval(sync,1200);document.addEventListener('click',()=>setTimeout(sync,50),true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JMSReadyGoodsAdmin={enabled,persistEnabled,sync};
})();