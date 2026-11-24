/* JMS authenticated core cloud sync: no browser Supabase credentials. */
(function(){
  'use strict';
  const VERSION='20260910-auth-cloud-stable-3';
  const STORE='jms_factory_crm_pro_v4';
  const KEYS=['customers','quotes','visits','orders','collections'];
  let busy=false,timer=null;
  const getDb=()=>{try{return db}catch(_){return window.db||null}};
  const token=()=>sessionStorage.getItem('jms_auth_token')||'';
  const headers=()=>({'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})});
  const stamp=x=>String(x?.updated_at||x?._cloud_updated_at||x?.created_at||x?.date||'');
  function saveLocal(){const d=getDb();if(d)try{localStorage.setItem(STORE,JSON.stringify(d))}catch(_){} }
  function merge(key,remote){const d=getDb();if(!d)return;d[key] ||= [];const map=new Map(d[key].filter(Boolean).map(x=>[String(x.id),x]));for(const r of remote||[]){if(!r?.id)continue;const old=map.get(String(r.id));if(!old||stamp(r)>=stamp(old))map.set(String(r.id),{...(old||{}),...r})}d[key]=[...map.values()]}
  // Ignore sync timestamps when deciding whether the visible data changed.
  function visibleSnapshot(){
    const d=getDb()||{};
    const data={};for(const key of [...KEYS,'users','reps'])data[key]=d[key]||[];
    return JSON.stringify(data,(key,value)=>['updated_at','_cloud_updated_at'].includes(key)?undefined:value);
  }
  let renderPending=false,renderTimer=null,lastInteraction=0;
  function renderWhenIdle(){
    clearTimeout(renderTimer);
    if(!renderPending)return;
    const active=document.activeElement;
    if(document.hidden || Date.now()-lastInteraction<700 ||
       (active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) ||
       document.querySelector('.modal:not(.hidden)')){
      renderTimer=setTimeout(renderWhenIdle,800);return;
    }
    const x=window.scrollX,y=window.scrollY;
    renderPending=false;
    try{window.renderAll?.();window.scrollTo(x,y);}catch(_){}
  }
  function syncStatus(kind,message){
    let el=document.getElementById('cloudSyncStatus');
    if(!el){el=document.createElement('div');el.id='cloudSyncStatus';document.body.appendChild(el)}
    el.className='cloud-sync-status '+kind;
    if(window.JMSI18n)window.JMSI18n.setText(el,message);else el.textContent=message;
  }
  function openRequestedQuote(rows){
    const url=new URL(location.href),number=url.searchParams.get('openQuote');
    if(!number||typeof window.viewQuote!=='function')return;
    const quote=(rows||[]).find(row=>row.quote_no===number);
    if(!quote)return;
    window.viewQuote(quote.id);
    url.searchParams.delete('openQuote');
    history.replaceState(history.state,'',url);
  }
  async function pull(){
    if(busy)return false;
    if(!navigator.onLine){syncStatus('local','لا يوجد اتصال بالإنترنت');return false}
    if(!token()){syncStatus('local','سجّل الدخول لمزامنة البيانات');return false}
    busy=true;
    try{const r=await fetch('/api/data-sync',{headers:headers()});if(r.status===401){syncStatus('local','انتهت الجلسة، سجّل الدخول للمزامنة');return false}if(!r.ok)throw new Error('HTTP '+r.status);const out=await r.json();const before=visibleSnapshot();for(const k of KEYS)merge(k,out.data?.[k]||[]);const d=getDb();if(d&&Array.isArray(out.data?.reps)){for(const rep of out.data.reps){if(!rep?.id)continue;for(const key of ['users','reps']){d[key] ||= [];const i=d[key].findIndex(u=>String(u.id)===String(rep.id));if(i<0)d[key].push({...rep});else d[key][i]={...d[key][i],...rep};}}}saveLocal();if(before!==visibleSnapshot()){renderPending=true;renderWhenIdle();}syncStatus('cloud','تم تحديث البيانات من الخادم');openRequestedQuote(out.data?.quotes);return true}catch(e){syncStatus('error','تعذر تحديث البيانات من الخادم');console.warn('JMS authenticated cloud pull failed',e);return false}finally{busy=false}
  }
  async function push(){
    if(busy||!navigator.onLine||!token())return false;const d=getDb();if(!d)return false;busy=true;
    try{const data={};for(const k of KEYS)data[k]=Array.isArray(d[k])?d[k]:[];const r=await fetch('/api/data-sync',{method:'POST',headers:headers(),body:JSON.stringify({data})});if(!r.ok)throw new Error(await r.text());return true}catch(e){console.warn('JMS authenticated cloud push failed',e);return false}finally{busy=false}
  }
  async function sync(){const ok=await push();await pull();return ok}
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,700)}
  function install(){
    for(const event of ['scroll','touchstart','touchmove','pointerdown','input'])window.addEventListener(event,()=>{lastInteraction=Date.now();},{passive:true});
    // Replace legacy browser-to-Supabase sync with authenticated same-origin APIs.
    window.pushCloudData=push;window.pullCloudData=pull;window.JMSAuthenticatedCloud={version:VERSION,push,pull,sync};
    window.addEventListener('online',()=>setTimeout(sync,250));window.addEventListener('pageshow',()=>setTimeout(pull,500));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(pull,300)});
    setInterval(pull,15000);setTimeout(pull,900);
    document.addEventListener('jms:data-changed',schedule);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
