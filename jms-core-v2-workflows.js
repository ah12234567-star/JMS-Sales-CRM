/* JMS Core 2.0 - Phase 3: workflow integrity, route cloud coordination, canonical statuses */
(function(){
  'use strict';
  const VERSION='2026-08-29-core-v2-phase3';
  const STORE='jms_factory_crm_pro_v4';
  const now=()=>new Date().toISOString();
  const dbRef=()=>{try{return (typeof db!=='undefined'?db:window.db)||null}catch(_){return window.db||null}};
  const user=()=>window.currentUser||null;
  const clean=v=>String(v??'').trim();
  const hash=v=>{let h=2166136261,s=String(v||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
  let lastRouteHash='';

  const quoteCanonical=s=>({draft:'draft',pending:'manager_pending',approved:'manager_approved',sent:'sent_to_customer',customer_approved:'customer_approved',manager_approved:'manager_final_approved',rejected:'rejected',cancelled:'cancelled'}[String(s||'')]||String(s||'unknown'));
  const visitCanonical=s=>({open:'active',active:'active',started:'active',in_progress:'active','قيد الزيارة':'active',arrived:'active',completed:'completed',done:'completed','تمت الزيارة':'completed',cancelled:'cancelled'}[String(s||'')]||String(s||'unknown'));
  const orderCanonical=s=>({جديد:'new','بانتظار اعتماد المدير':'manager_pending','معتمد من الإدارة':'approved','قيد الإنتاج':'production','جاهز للتسليم':'ready','تم التسليم':'delivered',new:'new',pending:'manager_pending',approved:'approved',production:'production',ready:'ready',delivered:'delivered'}[String(s||'')]||String(s||'unknown'));

  function customerMap(){return new Map((dbRef()?.customers||[]).filter(x=>x?.id).map(x=>[String(x.id),x]))}
  function persist(){const d=dbRef();if(!d)return;try{localStorage.setItem(STORE,JSON.stringify(d))}catch(_){}try{if(typeof save==='function')save()}catch(_){}try{document.dispatchEvent(new CustomEvent('jms:data-changed',{detail:{source:'core-v2-workflows'}}))}catch(_){}}

  function normalizeRecords(){
    const d=dbRef();if(!d)return {changed:0,issues:[]};
    const customers=customerMap(),issues=[];let changed=0;
    const specs=[['quotes',quoteCanonical],['visits',visitCanonical],['orders',orderCanonical],['collections',()=> 'posted']];
    for(const [key,statusFn] of specs){
      d[key] ||= [];
      for(const r of d[key]){
        const c=customers.get(String(r.customer_id||''));
        if(!clean(r.rep_id)&&c?.rep_id){r.rep_id=c.rep_id;changed++}
        if(!r.created_at){r.created_at=r.date?String(r.date)+'T00:00:00.000Z':now();changed++}
        if(!r.updated_at){r.updated_at=r.created_at||now();changed++}
        const canonical=statusFn(r.status);
        if(r.canonical_status!==canonical){r.canonical_status=canonical;changed++}
        if(c?.rep_id&&r.rep_id&&String(c.rep_id)!==String(r.rep_id))issues.push({type:'owner_mismatch',collection:key,id:r.id,customer_id:r.customer_id,customer_rep_id:c.rep_id,record_rep_id:r.rep_id});
      }
    }
    d.routes ||= [];
    for(const r of d.routes){
      if(!r.updated_at){r.updated_at=r.created_at||now();changed++}
      if(!r.rep_id)issues.push({type:'route_without_rep',id:r.id});
      for(const it of r.items||[]){
        const c=customers.get(String(it.customer_id||''));
        if(!c)issues.push({type:'route_missing_customer',route_id:r.id,customer_id:it.customer_id});
        if(!it.status){it.status='pending';changed++}
      }
    }
    if(changed)persist();
    return {changed,issues};
  }

  function routeSignature(){const d=dbRef();return hash(JSON.stringify((d?.routes||[]).map(r=>({id:r.id,updated_at:r.updated_at,rep_id:r.rep_id,items:r.items,cancelled_items:r.cancelled_items}))));}
  function syncRoutesIfChanged(){
    const sig=routeSignature();if(sig===lastRouteHash)return;lastRouteHash=sig;
    const routes=dbRef()?.routes||[];
    routes.forEach(r=>window.JMSRoutesCloud?.markDirty?.(r));
  }

  function enforceRepVisibility(){
    const u=user(),d=dbRef();if(!u||!d||u.role!=='rep')return;
    window.JMS_CORE_ALLOWED={
      customers:(d.customers||[]).filter(x=>String(x.rep_id||'')===String(u.id)),
      quotes:(d.quotes||[]).filter(x=>String(x.rep_id||'')===String(u.id)),
      visits:(d.visits||[]).filter(x=>String(x.rep_id||'')===String(u.id)),
      orders:(d.orders||[]).filter(x=>String(x.rep_id||'')===String(u.id)),
      collections:(d.collections||[]).filter(x=>String(x.rep_id||'')===String(u.id)),
      routes:(d.routes||[]).filter(x=>String(x.rep_id||'')===String(u.id))
    };
  }

  function health(){
    const d=dbRef()||{}, core=window.JMS_CORE_V2?.audit?.()||{};
    const wf=normalizeRecords();
    return {version:VERSION,core,workflow_issues:wf.issues,counts:{routes:(d.routes||[]).length,route_opportunities:(d.route_opportunities||[]).length,quotes:(d.quotes||[]).length,visits:(d.visits||[]).length,orders:(d.orders||[]).length}};
  }

  function boot(){
    let n=0;const t=setInterval(()=>{
      if(!dbRef()){if(++n>40)clearInterval(t);return}
      clearInterval(t);
      normalizeRecords();enforceRepVisibility();
      lastRouteHash=routeSignature();
      setInterval(()=>{normalizeRecords();enforceRepVisibility();syncRoutesIfChanged()},4000);
      window.JMS_CORE_WORKFLOWS={version:VERSION,health,normalizeRecords,syncRoutesIfChanged};
      console.info('JMS Core 2.0 Phase 3 active',health());
    },250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
