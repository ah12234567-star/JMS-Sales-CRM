/* JMS ready-goods authenticated cloud sync. */
(function(){
  'use strict';
  const VERSION='20260816-ready-cloud-1', STORE='jms_factory_crm_pro_v4', DIRTY='jms_ready_goods_dirty_v1';
  let busy=false;
  const getDb=()=>{try{return db}catch(_){return window.db||null}};
  function token(){return sessionStorage.getItem('jms_auth_token')||''}
  function headers(){const t=token();return {'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})}}
  function mark(id){try{const s=new Set(JSON.parse(localStorage.getItem(DIRTY)||'[]'));if(id)s.add(String(id));else(getDb()?.readyGoodsNotices||[]).forEach(x=>x?.id&&s.add(String(x.id)));localStorage.setItem(DIRTY,JSON.stringify([...s]))}catch(_){}}
  async function push(){
    if(busy||!navigator.onLine||!token())return false;const d=getDb();if(!d)return false;
    let ids=[];try{ids=JSON.parse(localStorage.getItem(DIRTY)||'[]')}catch(_){}
    if(!ids.length)return true;const set=new Set(ids),items=(d.readyGoodsNotices||[]).filter(x=>x?.id&&set.has(String(x.id)));
    if(!items.length){localStorage.removeItem(DIRTY);return true}
    busy=true;try{const r=await fetch('/api/ready-goods-sync',{method:'POST',headers:headers(),body:JSON.stringify({items})});if(!r.ok)throw new Error(await r.text());localStorage.removeItem(DIRTY);return true}catch(e){console.warn('ready goods cloud push failed',e);return false}finally{busy=false}
  }
  async function pull(){
    if(busy||!navigator.onLine||!token())return false;const d=getDb();if(!d)return false;busy=true;
    try{const r=await fetch('/api/ready-goods-sync',{headers:headers()});if(!r.ok)throw new Error(await r.text());const out=await r.json(),remote=out.items||[];d.readyGoodsNotices ||= [];const map=new Map(d.readyGoodsNotices.map(x=>[String(x.id),x]));for(const x of remote){const old=map.get(String(x.id));if(!old||String(x.updated_at||x._cloud_updated_at||'')>=String(old.updated_at||''))map.set(String(x.id),x)}d.readyGoodsNotices=[...map.values()];localStorage.setItem(STORE,JSON.stringify(d));window.JMSReadyGoods?.renderList?.();return true}catch(e){console.warn('ready goods cloud pull failed',e);return false}finally{busy=false}
  }
  async function sync(){await push();return pull()}
  function hook(){
    if(window.JMSReadyGoods&&!window.JMSReadyGoods.__cloudWrapped){const old=window.JMSReadyGoods.save;window.JMSReadyGoods.save=function(){const before=new Set((getDb()?.readyGoodsNotices||[]).map(x=>x.id));const result=old.apply(this,arguments);const added=(getDb()?.readyGoodsNotices||[]).find(x=>!before.has(x.id));if(added){added.updated_at=new Date().toISOString();mark(added.id);setTimeout(sync,80)}return result};window.JMSReadyGoods.__cloudWrapped=true}
  }
  function boot(){mark();hook();setTimeout(sync,700);setInterval(()=>{hook();if(navigator.onLine)sync()},12000);window.addEventListener('online',()=>setTimeout(sync,250));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(sync,300)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.JMSReadyGoodsCloud={version:VERSION,markDirty:mark,push,pull,sync};
})();
