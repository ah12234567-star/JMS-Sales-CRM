/* JMS route + visit unified local transaction: active visit on arrival, same record closed on completion. */
(function(){
  'use strict';
  const VERSION='20260816-route-visit-tx-2', STORE='jms_factory_crm_pro_v4', ROUTE_KEY='jms_daily_routes_v2';
  const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());
  const now=()=>new Date().toISOString();
  const localDate=()=>{const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
  function getDb(){try{return db}catch(_){return window.db||null}}
  function route(id){const d=getDb();return (d?.routes||[]).find(r=>String(r.id)===String(id))||null}
  function item(r,cid){return (r?.items||[]).find(i=>String(i.customer_id)===String(cid))||null}
  function persist(r){
    const d=getDb();if(!d||!r)return;r.updated_at=now();
    try{const rows=JSON.parse(localStorage.getItem(ROUTE_KEY)||'[]').filter(x=>String(x.id)!==String(r.id));rows.unshift(JSON.parse(JSON.stringify(r)));localStorage.setItem(ROUTE_KEY,JSON.stringify(rows));localStorage.setItem(STORE,JSON.stringify(d));}catch(e){console.error('JMS unified transaction local save failed',e)}
    try{if(typeof save==='function')save()}catch(_){}
    window.JMSRoutesCloud?.markDirty?.(r);setTimeout(()=>window.pushCloudData?.(),80);
  }
  function gps(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,captured_at:now()}),()=>resolve(null),{enableHighAccuracy:true,timeout:7000,maximumAge:30000})})}
  function refresh(r,cid,close){try{window.JMSRouteCoreV2?.render?.();if(close)window.JMSRouteCoreV2?.closeCustomerSheet?.();else window.JMSRouteCoreV2?.openCustomerSheet?.(r.id,cid);window.JMSDailyVisitReport?.refresh?.();window.renderVisits?.();window.renderSmartVisits?.()}catch(_){} }
  function upsertVisit(record){const d=getDb();d.visits ||= [];const existing=d.visits.find(v=>String(v.id)===String(record.id));if(existing)Object.assign(existing,record);else d.visits.unshift(record);return existing||record}
  function install(){
    const core=window.JMSRouteCoreV2;if(!core)return false;
    core.markArrived=async function(routeId,customerId){
      const u=window.currentUser,d=getDb(),r=route(routeId),it=item(r,customerId);if(!u||u.role!=='rep'||!d||!r||!it||String(r.rep_id)!==String(u.id))return;
      const t=now(),g=await gps(),visitId=it.visit_id||uid();it.status='arrived';it.arrived_at=t;it.visit_id=visitId;if(g)it.arrival_gps=g;
      upsertVisit({id:visitId,customer_id:customerId,rep_id:u.id,date:localDate(),route_id:r.id,route_item_order:it.order,visit_reason:it.visit_reason||'',visit_reason_note:it.visit_reason_note||'',checkin_at:t,checkout_at:null,arrive_time:new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),leave_time:'',duration:'',status:'active',result:'زيارة مفتوحة',source:'daily_route',arrival_gps:g||null,checkout_gps:null,updated_at:t});
      persist(r);refresh(r,customerId,false);
    };
    core.completeVisit=async function(routeId,customerId){
      const u=window.currentUser,d=getDb(),r=route(routeId),it=item(r,customerId);if(!u||u.role!=='rep'||!d||!r||!it||String(r.rep_id)!==String(u.id))return;
      const end=now(),g=await gps(),visitId=it.visit_id||uid();const existing=(d.visits||[]).find(v=>String(v.id)===String(visitId));const start=existing?.checkin_at||it.arrived_at||it.enroute_at||end;const mins=Math.max(0,Math.round((new Date(end)-new Date(start))/60000));
      upsertVisit({...(existing||{}),id:visitId,customer_id:customerId,rep_id:u.id,date:localDate(),route_id:r.id,route_item_order:it.order,visit_reason:it.visit_reason||'',visit_reason_note:it.visit_reason_note||'',checkin_at:start,checkout_at:end,arrive_time:new Date(start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),leave_time:new Date(end).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),duration:mins+' دقيقة',status:'completed',result:existing?.result&&existing.result!=='زيارة مفتوحة'?existing.result:'تمت الزيارة',source:'daily_route',arrival_gps:existing?.arrival_gps||it.arrival_gps||null,checkout_gps:g||null,updated_at:end});
      it.status='completed';it.completed_at=end;it.visit_id=visitId;if(g)it.completed_gps=g;persist(r);refresh(r,customerId,true);
    };
    document.documentElement.dataset.jmsRouteVisitTx=VERSION;return true;
  }
  function boot(){if(!install()){let n=0;const t=setInterval(()=>{if(install()||++n>30)clearInterval(t)},200)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
