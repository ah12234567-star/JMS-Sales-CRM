/* JMS routes cloud sync: local-first, retry-safe, cross-device updates. */
(function(){
  'use strict';
  const VERSION='20260816-routes-cloud-1';
  const TABLE='jms_routes';
  const STORE='jms_factory_crm_pro_v4';
  const DIRTY_KEY='jms_routes_cloud_dirty_v1';
  const LAST_PULL_KEY='jms_routes_cloud_last_pull_v1';
  const POLL_MS=10000;
  let client=null,busy=false,timer=null,tableAvailable=null;
  const dbRef=()=>{try{return db}catch(_){return window.db||null}};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const stamp=r=>String(r?.updated_at||r?.created_at||'');
  function saveLocal(){const d=dbRef();if(!d)return;try{localStorage.setItem(STORE,JSON.stringify(d))}catch(_){} }
  function dirty(){try{const x=JSON.parse(localStorage.getItem(DIRTY_KEY)||'[]');return new Set(Array.isArray(x)?x:[])}catch(_){return new Set()}}
  function writeDirty(set){try{localStorage.setItem(DIRTY_KEY,JSON.stringify([...set]))}catch(_){} }
  function markDirty(id){if(!id)return;const s=dirty();s.add(String(id));writeDirty(s)}
  function markAllDirty(){const d=dbRef();const s=dirty();(d?.routes||[]).forEach(r=>r?.id&&s.add(String(r.id)));writeDirty(s)}
  function initClient(){
    if(client)return client;
    if(!window.supabase?.createClient||!window.JMS_CLOUD?.SUPABASE_URL||!window.JMS_CLOUD?.SUPABASE_ANON_KEY)return null;
    client=window.supabase.createClient(window.JMS_CLOUD.SUPABASE_URL,window.JMS_CLOUD.SUPABASE_ANON_KEY);
    return client;
  }
  function mergeRemote(remote){
    const d=dbRef();if(!d)return false;d.routes ||= [];
    const local=new Map(d.routes.filter(Boolean).map(r=>[String(r.id),r]));let changed=false;
    for(const rr of remote||[]){
      if(!rr?.id)continue;const id=String(rr.id),lr=local.get(id);
      if(!lr||stamp(rr)>stamp(lr)){local.set(id,{...(lr||{}),...rr});changed=true}
    }
    if(changed){d.routes=[...local.values()];saveLocal();try{window.JMSRouteCoreV2?.render?.();window.JMSDailyVisitReport?.refresh?.()}catch(_){}}
    return changed;
  }
  async function probe(){
    const c=initClient();if(!c)return false;
    try{const {error}=await c.from(TABLE).select('id').limit(1);tableAvailable=!error;if(error)console.warn('JMS routes cloud table unavailable',error.message);return !error}catch(e){tableAvailable=false;return false}
  }
  async function push(){
    if(busy||!navigator.onLine)return false;const c=initClient();if(!c)return false;if(tableAvailable===false&&!(await probe()))return false;
    const d=dbRef();if(!d)return false;const pending=dirty();if(!pending.size)return true;
    busy=true;
    try{
      const rows=(d.routes||[]).filter(r=>r?.id&&pending.has(String(r.id))).map(r=>({id:String(r.id),data:{...clone(r),updated_at:r.updated_at||new Date().toISOString()},updated_at:r.updated_at||new Date().toISOString()}));
      if(!rows.length){writeDirty(new Set());return true}
      const {error}=await c.from(TABLE).upsert(rows,{onConflict:'id'});if(error)throw error;
      const left=dirty();rows.forEach(r=>left.delete(String(r.id)));writeDirty(left);tableAvailable=true;return true;
    }catch(e){console.error('JMS routes cloud push failed',e);if(/Could not find the table|PGRST205/i.test(String(e?.message||e)))tableAvailable=false;return false}
    finally{busy=false}
  }
  async function pull(){
    if(busy||!navigator.onLine)return false;const c=initClient();if(!c)return false;if(tableAvailable===false&&!(await probe()))return false;
    busy=true;
    try{
      const {data,error}=await c.from(TABLE).select('id,data,updated_at').order('updated_at',{ascending:false});if(error)throw error;
      const routes=(data||[]).map(row=>({...row.data,id:row.data?.id||row.id,_cloud_updated_at:row.updated_at}));
      mergeRemote(routes);try{localStorage.setItem(LAST_PULL_KEY,new Date().toISOString())}catch(_){}tableAvailable=true;return true;
    }catch(e){console.error('JMS routes cloud pull failed',e);if(/Could not find the table|PGRST205/i.test(String(e?.message||e)))tableAvailable=false;return false}
    finally{busy=false}
  }
  function routeChanged(route){if(route?.id)markDirty(route.id);else markAllDirty();clearTimeout(timer);timer=setTimeout(async()=>{await push();await pull()},500)}
  async function syncNow(){if(!navigator.onLine)return false;await push();return pull()}
  function install(){
    initClient();markAllDirty();
    window.JMSRoutesCloud={version:VERSION,markDirty:routeChanged,push,pull,syncNow,get tableAvailable(){return tableAvailable}};
    window.addEventListener('online',()=>setTimeout(syncNow,200));
    window.addEventListener('pageshow',()=>setTimeout(syncNow,500));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(syncNow,300)});
    setInterval(()=>{if(navigator.onLine)syncNow()},POLL_MS);
    setTimeout(syncNow,800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
