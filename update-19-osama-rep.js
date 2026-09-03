/* JMS UPDATE 19: Osama representative - same standard rep scope as Yaser */
(function(){
  'use strict';
  const REP_ID='rep-osama';
  const REP_NAME='أسامة';
  const REP_EMAIL='osama@jms.local';

  function getDb(){
    try{return (typeof db!=='undefined'?db:window.db)||null}catch(_){return window.db||null}
  }
  function persist(){
    try{ if(typeof save==='function') save(); else window.save?.(); }catch(e){ console.warn('Osama rep save failed',e); }
  }
  function ensureOsamaRep(){
    const store=getDb();
    if(!store) return false;
    store.reps ||= [];
    store.users ||= [];

    let rep=store.reps.find(r=>String(r.id||'')===REP_ID || String(r.name||'').trim()===REP_NAME);
    if(!rep){
      rep={id:REP_ID,name:REP_NAME,email:REP_EMAIL,role:'rep',status:'active',area:'',source:'system'};
      store.reps.push(rep);
    }else{
      Object.assign(rep,{id:REP_ID,name:REP_NAME,email:rep.email||REP_EMAIL,role:'rep',status:'active'});
    }

    let user=store.users.find(u=>String(u.id||'')===REP_ID || String(u.email||'').toLowerCase()===REP_EMAIL);
    if(!user){
      store.users.push({id:REP_ID,name:REP_NAME,email:REP_EMAIL,role:'rep',status:'active'});
    }else{
      Object.assign(user,{id:REP_ID,name:REP_NAME,email:user.email||REP_EMAIL,role:'rep',status:'active'});
    }

    persist();
    try{
      if(typeof window.jmsCoreNormalize==='function') window.jmsCoreNormalize();
      if(typeof renderAll==='function') renderAll();
      if(typeof renderCustomers==='function') renderCustomers();
      if(typeof renderRepsControl==='function') renderRepsControl();
    }catch(_){ }
    return true;
  }

  window.JMS_OSAMA_REP={id:REP_ID,name:REP_NAME,email:REP_EMAIL,role:'rep'};
  window.ensureOsamaRep=ensureOsamaRep;

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(ensureOsamaRep() || tries>20) clearInterval(timer);
  },500);
  window.addEventListener('load',()=>setTimeout(ensureOsamaRep,300));
})();
