/* JMS daily route save reliability fix - Core 2.0 coordinated. */
(function(){
  'use strict';
  const VERSION='20260829-route-save-core2';
  const BACKUP_KEY='jms_daily_routes_backup_v1';
  const user=()=>window.currentUser||null;
  const dbRef=()=>{try{return db}catch(_){return window.db||null}};
  const localDate=()=>{const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
  const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random());

  function backupRoutes(){
    const d=dbRef();if(!d||!Array.isArray(d.routes))return;
    try{localStorage.setItem(BACKUP_KEY,JSON.stringify(d.routes))}catch(e){console.warn('JMS route backup failed',e)}
  }
  function restoreRoutes(){
    const d=dbRef();if(!d)return;d.routes ||= [];
    let stored=[];try{stored=JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]')}catch(_){stored=[]}
    if(!Array.isArray(stored)||!stored.length)return;
    const ids=new Set(d.routes.map(r=>r.id));
    stored.forEach(r=>{if(r&&r.id&&!ids.has(r.id)){d.routes.push(r);ids.add(r.id)}});
  }
  function todayRoute(repId){const d=dbRef();return (d?.routes||[]).find(r=>String(r.rep_id)===String(repId)&&String(r.date||'').slice(0,10)===localDate())||null}
  function selectedRows(){
    return [...document.querySelectorAll('#jmsSelectedVisits .jms-selected-item')].map((row,index)=>{
      const remove=[...row.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').includes('JMSVisitPlanner.remove'));
      const cid=String(remove?.getAttribute('onclick')||'').match(/remove\(['"]([^'"]+)['"]\)/)?.[1]||'';
      const reason=row.querySelector('.jms-visit-reason-select')?.value||'';
      const reasonNote=row.querySelector('.jms-visit-reason-note')?.value||'';
      return cid?{customer_id:cid,order:index+1,status:'pending',visit_reason:reason,visit_reason_note:reasonNote}:null;
    }).filter(Boolean);
  }
  function cloudMark(route){
    if(!route?.id)return;
    try{window.JMSRoutesCloud?.markDirty?.(route)}catch(_){}
    try{window.JMS_CORE_WORKFLOWS?.syncRoutesIfChanged?.()}catch(_){}
  }
  function persistRouteFromDom(){
    const u=user(),d=dbRef();if(!u||u.role!=='rep'||!d)return null;
    const items=selectedRows();if(!items.length)return null;
    d.routes ||= [];
    let route=todayRoute(u.id);
    if(route){
      const old=new Map((route.items||[]).map(i=>[i.customer_id,i]));
      route.items=items.map(i=>({...old.get(i.customer_id),...i}));
      route.updated_at=new Date().toISOString();route.source='rep_daily_plan';
    }else{
      route={id:uid(),date:localDate(),rep_id:u.id,items,source:'rep_daily_plan',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      d.routes.unshift(route);
    }
    try{if(typeof save==='function')save()}catch(e){console.error('JMS route direct save failed',e)}
    backupRoutes();cloudMark(route);return route;
  }
  function verifyRoute(expected){
    if(!expected)return false;restoreRoutes();
    const saved=todayRoute(expected.rep_id);
    const ok=!!saved&&Array.isArray(saved.items)&&saved.items.length===expected.items.length;
    if(ok){try{if(typeof save==='function')save()}catch(_){}backupRoutes();cloudMark(saved)}
    return ok;
  }
  function patch(){
    const planner=window.JMSVisitPlanner;if(!planner||planner.__routeSaveFixed)return false;
    planner.__routeSaveFixed=true;
    const originalSave=planner.save;
    planner.save=function(){
      const direct=persistRouteFromDom();const result=originalSave?.apply(this,arguments);
      setTimeout(()=>{if(!verifyRoute(direct))persistRouteFromDom();try{window.renderRoutes?.();window.JMSDailyVisitReport?.refresh?.()}catch(_){}},100);
      return result;
    };
    const oldRender=window.renderRoutes;
    if(typeof oldRender==='function')window.renderRoutes=function(){restoreRoutes();return oldRender.apply(this,arguments)};
    window.JMSRouteSaveFix={version:VERSION,restore:restoreRoutes,backup:backupRoutes};
    restoreRoutes();try{window.renderRoutes?.()}catch(_){}return true;
  }
  restoreRoutes();
  const timer=setInterval(()=>{if(patch())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),15000);
  window.addEventListener('pageshow',()=>{restoreRoutes();setTimeout(()=>{try{window.renderRoutes?.()}catch(_){}},50)});
})();
