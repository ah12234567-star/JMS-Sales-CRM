/* JMS authenticated core cloud sync: no browser Supabase credentials. */
(function(){
  'use strict';
  const VERSION='20260816-auth-cloud-1';
  const STORE='jms_factory_crm_pro_v4';
  const KEYS=['customers','quotes','visits','orders','collections'];
  let busy=false,timer=null;
  const getDb=()=>{try{return db}catch(_){return window.db||null}};
  const token=()=>sessionStorage.getItem('jms_auth_token')||'';
  const headers=()=>({'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})});
  const stamp=x=>String(x?.updated_at||x?._cloud_updated_at||x?.created_at||x?.date||'');
  function saveLocal(){const d=getDb();if(d)try{localStorage.setItem(STORE,JSON.stringify(d))}catch(_){} }
  function merge(key,remote){const d=getDb();if(!d)return;d[key] ||= [];const map=new Map(d[key].filter(Boolean).map(x=>[String(x.id),x]));for(const r of remote||[]){if(!r?.id)continue;const old=map.get(String(r.id));if(!old||stamp(r)>=stamp(old))map.set(String(r.id),{...(old||{}),...r})}d[key]=[...map.values()]}
  async function pull(){
    if(busy||!navigator.onLine||!token())return false;busy=true;
    try{const r=await fetch('/api/data-sync',{headers:headers()});if(!r.ok)throw new Error(await r.text());const out=await r.json();for(const k of KEYS)merge(k,out.data?.[k]||[]);saveLocal();try{window.renderAll?.()}catch(_){}return true}catch(e){console.warn('JMS authenticated cloud pull failed',e);return false}finally{busy=false}
  }
  async function push(){
    if(busy||!navigator.onLine||!token())return false;const d=getDb();if(!d)return false;busy=true;
    try{const data={};for(const k of KEYS)data[k]=Array.isArray(d[k])?d[k]:[];const r=await fetch('/api/data-sync',{method:'POST',headers:headers(),body:JSON.stringify({data})});if(!r.ok)throw new Error(await r.text());return true}catch(e){console.warn('JMS authenticated cloud push failed',e);return false}finally{busy=false}
  }
  async function sync(){const ok=await push();await pull();return ok}
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,700)}
  function install(){
    // Replace legacy browser-to-Supabase sync with authenticated same-origin APIs.
    window.pushCloudData=push;window.pullCloudData=pull;window.JMSAuthenticatedCloud={version:VERSION,push,pull,sync};
    window.addEventListener('online',()=>setTimeout(sync,250));window.addEventListener('pageshow',()=>setTimeout(pull,500));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(pull,300)});
    setInterval(()=>{if(navigator.onLine&&token())pull()},15000);setTimeout(()=>{if(token())pull()},900);
    document.addEventListener('jms:data-changed',schedule);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
