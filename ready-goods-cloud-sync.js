/* JMS ready-goods authenticated cloud sync + centralized company/bank settings. */
(function(){
  'use strict';
  const VERSION='20260818-ready-cloud-settings-1', STORE='jms_factory_crm_pro_v4', DIRTY='jms_ready_goods_dirty_v1';
  const COMPANY_KEY='jms_company_profile_v1', BANK_KEY='jms_company_bank_v1', ENABLE_KEY='jms_ready_goods_rep_enabled_v1';
  let busy=false;
  const getDb=()=>{try{return db}catch(_){return window.db||null}};
  function token(){return sessionStorage.getItem('jms_auth_token')||''}
  function headers(){const t=token();return {'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})}}
  function readJson(k){try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(_){return {}}}
  function mark(id){try{const s=new Set(JSON.parse(localStorage.getItem(DIRTY)||'[]'));if(id)s.add(String(id));else(getDb()?.readyGoodsNotices||[]).forEach(x=>x?.id&&s.add(String(x.id)));localStorage.setItem(DIRTY,JSON.stringify([...s]))}catch(_){}}
  function applySettings(settings){
    if(!settings)return;
    const d=getDb();const company={...(settings.company||{})},bank={...(settings.bank||{})};
    if(d){d.companyProfile={...(d.companyProfile||{}),...company};d.companyBank={...(d.companyBank||{}),...bank};d.systemSettings=d.systemSettings||{};d.systemSettings.readyGoodsRepEnabled=settings.readyGoodsRepEnabled!==false;try{localStorage.setItem(STORE,JSON.stringify(d))}catch(_){}}
    try{localStorage.setItem(COMPANY_KEY,JSON.stringify(company));localStorage.setItem(BANK_KEY,JSON.stringify(bank));localStorage.setItem(ENABLE_KEY,String(settings.readyGoodsRepEnabled!==false))}catch(_){}
    window.JMSCompanySettings={...(window.JMSCompanySettings||{}),...settings,company,bank,source:'cloud'};
    try{window.JMSReadyGoodsAdmin?.sync?.()}catch(_){}
  }
  function localSettings(){
    const d=getDb()||{};return {
      company:{...(d.companyProfile||{}),...readJson(COMPANY_KEY)},
      bank:{...(d.companyBank||{}),...readJson(BANK_KEY)},
      readyGoodsRepEnabled:typeof d.systemSettings?.readyGoodsRepEnabled==='boolean'?d.systemSettings.readyGoodsRepEnabled:(localStorage.getItem(ENABLE_KEY)!=='false')
    };
  }
  async function pushSettings(){
    if(!navigator.onLine||!token()||window.currentUser?.role!=='admin')return false;
    const r=await fetch('/api/ready-goods-sync',{method:'POST',headers:headers(),body:JSON.stringify({settings:localSettings()})});
    if(!r.ok)throw new Error(await r.text());const out=await r.json();if(out.settings)applySettings(out.settings);return true;
  }
  async function push(){
    if(busy||!navigator.onLine||!token())return false;const d=getDb();if(!d)return false;
    let ids=[];try{ids=JSON.parse(localStorage.getItem(DIRTY)||'[]')}catch(_){}
    if(!ids.length)return true;const set=new Set(ids),items=(d.readyGoodsNotices||[]).filter(x=>x?.id&&set.has(String(x.id)));
    if(!items.length){localStorage.removeItem(DIRTY);return true}
    busy=true;try{const r=await fetch('/api/ready-goods-sync',{method:'POST',headers:headers(),body:JSON.stringify({items})});if(!r.ok)throw new Error(await r.text());localStorage.removeItem(DIRTY);return true}catch(e){console.warn('ready goods cloud push failed',e);return false}finally{busy=false}
  }
  async function pull(){
    if(busy||!navigator.onLine||!token())return false;const d=getDb();if(!d)return false;busy=true;
    try{const r=await fetch('/api/ready-goods-sync',{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(await r.text());const out=await r.json(),remote=out.items||[];applySettings(out.settings);d.readyGoodsNotices ||= [];const map=new Map(d.readyGoodsNotices.map(x=>[String(x.id),x]));for(const x of remote){const old=map.get(String(x.id));if(!old||String(x.updated_at||x._cloud_updated_at||'')>=String(old.updated_at||''))map.set(String(x.id),x)}d.readyGoodsNotices=[...map.values()];localStorage.setItem(STORE,JSON.stringify(d));window.JMSReadyGoods?.renderList?.();return true}catch(e){console.warn('ready goods cloud pull failed',e);return false}finally{busy=false}
  }
  async function sync(){await push();return pull()}
  function hook(){
    if(window.JMSReadyGoods&&!window.JMSReadyGoods.__cloudWrapped){const old=window.JMSReadyGoods.save;window.JMSReadyGoods.save=function(){const before=new Set((getDb()?.readyGoodsNotices||[]).map(x=>x.id));const result=old.apply(this,arguments);const added=(getDb()?.readyGoodsNotices||[]).find(x=>!before.has(x.id));if(added){added.updated_at=new Date().toISOString();mark(added.id);setTimeout(sync,80)}return result};window.JMSReadyGoods.__cloudWrapped=true}
    const saveBtn=document.getElementById('rgnSaveAdminSettings');if(saveBtn&&!saveBtn.dataset.cloudHook){saveBtn.dataset.cloudHook='1';saveBtn.addEventListener('click',()=>setTimeout(()=>pushSettings().then(()=>pull()).catch(e=>{console.error('company settings cloud save failed',e);alert('تم الحفظ محليًا لكن تعذر تحديث البيانات السحابية. تحقق من الاتصال وحاول مرة أخرى.')}),120))}
  }
  function boot(){mark();hook();setTimeout(async()=>{if(window.currentUser?.role==='admin'){try{await pushSettings()}catch(e){console.warn('initial company settings cloud seed failed',e)}}await sync()},700);setInterval(()=>{hook();if(navigator.onLine)sync()},12000);window.addEventListener('online',()=>setTimeout(sync,250));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(pull,300)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.JMSReadyGoodsCloud={version:VERSION,markDirty:mark,push,pull,sync,pushSettings,applySettings};
})();
