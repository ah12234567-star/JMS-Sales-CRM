/* JMS routes cloud sync: authenticated API, local-first, retry-safe, cross-device updates. */
(function(){
  'use strict';
  const VERSION='20260816-routes-cloud-2';
  const STORE='jms_factory_crm_pro_v4';
  const DIRTY_KEY='jms_routes_cloud_dirty_v1';
  const LAST_PULL_KEY='jms_routes_cloud_last_pull_v1';
  const POLL_MS=10000;
  let busy=false,timer=null;
  const dbRef=()=>{try{return db}catch(_){return window.db||null}};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const stamp=r=>String(r?.updated_at||r?._cloud_updated_at||r?.created_at||'');
  const token=()=>sessionStorage.getItem('jms_auth_token')||'';
  const headers=()=>({'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})});
  function saveLocal(){const d=dbRef();if(!d)return;try{localStorage.setItem(STORE,JSON.stringify(d))}catch(_){} }
  function dirty(){try{const x=JSON.parse(localStorage.getItem(DIRTY_KEY)||'[]');return new Set(Array.isArray(x)?x:[])}catch(_){return new Set()}}
  function writeDirty(set){try{localStorage.setItem(DIRTY_KEY,JSON.stringify([...set]))}catch(_){} }
  function markDirty(id){if(!id)return;const s=dirty();s.add(String(id));writeDirty(s)}
  function markAllDirty(){const d=dbRef();const s=dirty();(d?.routes||[]).forEach(r=>r?.id&&s.add(String(r.id)));writeDirty(s)}
  function mergeRemote(remote){
    const d=dbRef();if(!d)return false;d.routes ||= [];
    const local=new Map(d.routes.filter(Boolean).map(r=>[String(r.id),r]));let changed=false;
    for(const rr of remote||[]){if(!rr?.id)continue;const id=String(rr.id),lr=local.get(id);if(!lr||stamp(rr)>=stamp(lr)){local.set(id,{...(lr||{}),...rr});changed=true}}
    if(changed){d.routes=[...local.values()];saveLocal();try{window.JMSRouteCoreV2?.render?.();window.JMSDailyVisitReport?.refresh?.()}catch(_){}}
    return changed;
  }
  async function push(){
    if(busy||!navigator.onLine||!token())return false;const d=dbRef();if(!d)return false;const pending=dirty();if(!pending.size)return true;
    const items=(d.routes||[]).filter(r=>r?.id&&pending.has(String(r.id))).map(clone);if(!items.length){writeDirty(new Set());return true}
    busy=true;try{
      const res=await fetch('/api/routes-sync',{method:'POST',headers:headers(),body:JSON.stringify({items})});if(!res.ok)throw new Error(await res.text());
      const left=dirty();items.forEach(r=>left.delete(String(r.id)));writeDirty(left);return true;
    }catch(e){console.warn('JMS routes authenticated push failed',e);return false}finally{busy=false}
  }
  async function pull(){
    if(busy||!navigator.onLine||!token())return false;busy=true;try{
      const res=await fetch('/api/routes-sync',{headers:headers()});if(!res.ok)throw new Error(await res.text());const out=await res.json();mergeRemote(out.items||[]);
      try{localStorage.setItem(LAST_PULL_KEY,new Date().toISOString())}catch(_){}return true;
    }catch(e){console.warn('JMS routes authenticated pull failed',e);return false}finally{busy=false}
  }
  function routeChanged(route){if(route?.id)markDirty(route.id);else if(typeof route==='string')markDirty(route);else markAllDirty();clearTimeout(timer);timer=setTimeout(async()=>{await push();await pull()},500)}
  async function syncNow(){if(!navigator.onLine||!token())return false;await push();return pull()}
  function install(){
    markAllDirty();window.JMSRoutesCloud={version:VERSION,markDirty:routeChanged,push,pull,syncNow};
    window.addEventListener('online',()=>setTimeout(syncNow,200));window.addEventListener('pageshow',()=>setTimeout(syncNow,500));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(syncNow,300)});
    setInterval(()=>{if(navigator.onLine)syncNow()},POLL_MS);setTimeout(syncNow,800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
