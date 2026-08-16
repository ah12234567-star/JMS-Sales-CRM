/* JMS production security hardening. */
(function(){
  'use strict';
  const VERSION='20260816-security-1';
  const isManager=()=>['admin','sales'].includes(window.currentUser?.role);
  async function post(url,payload){
    const token=sessionStorage.getItem('jms_auth_token')||'';
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload||{})});
    const data=await res.json().catch(()=>({ok:false,error:'bad_response'}));
    if(!res.ok||data.ok===false) throw new Error(data.error||'request_failed');
    return data;
  }
  function install(){
    window.approveQuote=async function(qid){
      if(!isManager()) return alert('غير مصرح لك باعتماد عروض الأسعار');
      try{
        const data=await post('/api/quote-status',{id:qid,action:'approve'});
        const q=(db.quotes||[]).find(x=>String(x.id)===String(qid)); if(q)Object.assign(q,data.quote||{});
        if(typeof save==='function')save(); if(typeof renderQuotes==='function')renderQuotes();
        alert('تم اعتماد عرض السعر');
      }catch(e){console.error(e);alert('تعذر اعتماد العرض. تحقق من الصلاحية والاتصال.');}
    };
    window.rejectQuote=async function(qid){
      if(!isManager()) return alert('غير مصرح لك برفض عروض الأسعار');
      const reason=prompt('سبب الرفض'); if(!reason)return;
      try{
        const data=await post('/api/quote-status',{id:qid,action:'reject',reason});
        const q=(db.quotes||[]).find(x=>String(x.id)===String(qid)); if(q)Object.assign(q,data.quote||{});
        if(typeof save==='function')save(); if(typeof renderQuotes==='function')renderQuotes();
        alert('تم رفض عرض السعر');
      }catch(e){console.error(e);alert('تعذر رفض العرض. تحقق من الصلاحية والاتصال.');}
    };
    document.documentElement.dataset.jmsSecurity=VERSION;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100));else setTimeout(install,100);
  setTimeout(install,1200);
})();
