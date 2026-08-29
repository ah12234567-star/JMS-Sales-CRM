/* JMS UPDATE 17: Factory representative master record */
(function(){
  'use strict';
  const REP_ID='rep-factory';
  const REP_NAME='مندوب المصنع';
  const REP_EMAIL='factory@jms.local';

  function getDb(){
    try{return (typeof db!=='undefined'?db:window.db)||null}catch(_){return window.db||null}
  }
  function persist(){
    try{ if(typeof save==='function') save(); else window.save?.(); }catch(e){ console.warn('Factory rep save failed',e); }
  }
  function ensureFactoryRep(){
    const store=getDb();
    if(!store) return false;
    store.reps ||= [];
    store.users ||= [];

    let rep=store.reps.find(r=>String(r.id||'')===REP_ID || String(r.name||'').trim()===REP_NAME);
    if(!rep){
      rep={id:REP_ID,name:REP_NAME,email:REP_EMAIL,role:'rep',status:'active',area:'المصنع',source:'system'};
      store.reps.push(rep);
    }else{
      Object.assign(rep,{id:REP_ID,name:REP_NAME,email:rep.email||REP_EMAIL,role:'rep',status:'active',area:rep.area||'المصنع'});
    }

    let user=store.users.find(u=>String(u.id||'')===REP_ID || String(u.email||'').toLowerCase()===REP_EMAIL);
    if(!user){
      store.users.push({id:REP_ID,name:REP_NAME,email:REP_EMAIL,role:'rep',status:'active'});
    }else{
      Object.assign(user,{id:REP_ID,name:REP_NAME,email:user.email||REP_EMAIL,role:'rep',status:'active'});
    }

    persist();
    try{
      if(typeof renderAll==='function') renderAll();
      if(typeof renderCustomers==='function') renderCustomers();
      if(typeof renderRepsControl==='function') renderRepsControl();
    }catch(_){ }
    return true;
  }

  window.JMS_FACTORY_REP={id:REP_ID,name:REP_NAME,email:REP_EMAIL};
  window.ensureFactoryRep=ensureFactoryRep;

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(ensureFactoryRep() || tries>20) clearInterval(timer);
  },500);
  window.addEventListener('load',()=>setTimeout(ensureFactoryRep,300));
})();
