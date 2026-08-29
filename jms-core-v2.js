/* JMS Core 2.0 - Phase 1: data integrity, ownership normalization, diagnostics */
(function(){
  'use strict';
  const VERSION='2026-08-29-core-v2-phase1';
  const CHILD_COLLECTIONS=['quotes','visits','orders','collections'];
  const STORE_KEY='jms_factory_crm_pro_v4';

  function getDb(){try{return (typeof db!=='undefined'?db:window.db)||null}catch(_){return window.db||null}}
  function getUser(){try{return window.currentUser||(typeof currentUser!=='undefined'?currentUser:null)}catch(_){return window.currentUser||null}}
  function clean(v){return String(v??'').trim()}
  function normalizePhone(v){let p=clean(v);if(/e\+?/i.test(p)){const n=Number(p);if(Number.isFinite(n))p=String(Math.trunc(n));}p=p.replace(/\D/g,'');if(!p)return'';if(p.startsWith('00966'))p=p.slice(2);if(p.startsWith('966'))return p;if(p.startsWith('05')&&p.length===10)return'966'+p.slice(1);if(p.startsWith('5')&&p.length===9)return'966'+p;return p}
  function saveLocal(){const s=getDb();if(!s)return;try{localStorage.setItem(STORE_KEY,JSON.stringify(s))}catch(_){}try{if(typeof save==='function')save();else window.save?.()}catch(_){}}
  function emit(){try{document.dispatchEvent(new CustomEvent('jms:data-changed',{detail:{source:'core-v2'}}))}catch(_){}}

  function repRegistry(){
    const s=getDb()||{}, map=new Map();
    for(const r of [...(s.reps||[]),...(s.users||[]).filter(x=>x.role==='rep')]){
      if(!r?.id)continue; const id=String(r.id); const prev=map.get(id)||{};
      map.set(id,{...prev,...r,id,role:'rep'});
    }
    return map;
  }
  function customerMap(){return new Map(((getDb()?.customers)||[]).filter(x=>x?.id).map(x=>[String(x.id),x]))}

  function normalizeOwnership(){
    const s=getDb();if(!s)return {changed:0,issues:[]};
    const customers=customerMap(), reps=repRegistry(), issues=[];let changed=0;

    for(const c of s.customers||[]){
      if(c.phone){const p=normalizePhone(c.phone);if(p&&p!==c.phone){c.phone=p;changed++}}
      if(!clean(c.rep_id)) issues.push({type:'customer_without_rep',collection:'customers',id:c.id,name:c.name||''});
      else if(!reps.has(String(c.rep_id))) issues.push({type:'customer_unknown_rep',collection:'customers',id:c.id,name:c.name||'',rep_id:c.rep_id});
    }

    for(const key of CHILD_COLLECTIONS){
      for(const row of s[key]||[]){
        const customer=customers.get(String(row.customer_id||''));
        if(!clean(row.rep_id)&&customer?.rep_id){row.rep_id=customer.rep_id;changed++}
        if(row.phone){const p=normalizePhone(row.phone);if(p&&p!==row.phone){row.phone=p;changed++}}
        if(customer?.rep_id&&row.rep_id&&String(customer.rep_id)!==String(row.rep_id)){
          issues.push({type:'owner_mismatch',collection:key,id:row.id,customer_id:row.customer_id,record_rep_id:row.rep_id,customer_rep_id:customer.rep_id});
        }
        if(!clean(row.rep_id))issues.push({type:'record_without_rep',collection:key,id:row.id,customer_id:row.customer_id||''});
      }
    }
    if(changed){saveLocal();emit()}
    return {changed,issues};
  }

  function audit(){
    const s=getDb()||{}, reps=repRegistry(), customers=s.customers||[], issues=[];
    const seenPhone=new Map(), seenName=new Map();
    for(const c of customers){
      const p=normalizePhone(c.phone);if(p){if(seenPhone.has(p))issues.push({type:'duplicate_phone',customer_a:seenPhone.get(p),customer_b:c.id,phone:p});else seenPhone.set(p,c.id)}
      const n=clean(c.name).replace(/\s+/g,' ').toLowerCase();if(n){const k=n+'|'+clean(c.city).toLowerCase();if(seenName.has(k))issues.push({type:'duplicate_name_city',customer_a:seenName.get(k),customer_b:c.id,name:c.name,city:c.city||''});else seenName.set(k,c.id)}
      if(!clean(c.rep_id))issues.push({type:'customer_without_rep',id:c.id,name:c.name||''});
      else if(!reps.has(String(c.rep_id)))issues.push({type:'customer_unknown_rep',id:c.id,name:c.name||'',rep_id:c.rep_id});
    }
    const ownership=normalizeOwnership();issues.push(...ownership.issues);
    return {
      version:VERSION,
      counts:{reps:reps.size,customers:customers.length,quotes:(s.quotes||[]).length,visits:(s.visits||[]).length,orders:(s.orders||[]).length,collections:(s.collections||[]).length,routes:(s.routes||[]).length},
      auto_fixed:ownership.changed,
      issues
    };
  }

  function enforceRepScope(){
    const u=getUser();if(u?.role!=='rep')return;
    const s=getDb();if(!s)return;
    window.JMS_ALLOWED_REP_ID=String(u.id||'');
    window.jmsOwnedRows=function(key){return (s[key]||[]).filter(x=>String(x.rep_id||'')===String(u.id||''));};
  }

  function boot(){
    let tries=0;const t=setInterval(()=>{
      tries++;if(!getDb()){if(tries>30)clearInterval(t);return}
      clearInterval(t);normalizeOwnership();enforceRepScope();window.JMS_CORE_V2={version:VERSION,audit,normalizeOwnership,normalizePhone,repRegistry};
      console.info('JMS Core 2.0 Phase 1 active',audit());
    },250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
