(function(){
'use strict';
let promptEvent=null;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
function register(){if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js?v=3').catch(error=>console.warn('SW registration failed',error))}
function close(){document.getElementById('jmsInstallSheet')?.remove()}
function show(){
  close();
  const sheet=document.createElement('div');sheet.id='jmsInstallSheet';sheet.className='jms-install-sheet';
  sheet.innerHTML=`<div class="jms-install-card"><button class="jms-install-x">×</button><img src="/assets/jms-icon-192.png" alt="JMS"><h2>ثبّت JMS CRM على الجوال</h2>${ios()?'<p>في Safari اضغط <b>المشاركة</b> ثم <b>إضافة إلى الشاشة الرئيسية</b> وبعدها <b>إضافة</b>.</p><div class="jms-install-steps"><span>1</span> مشاركة ↑ <i>←</i><span>2</span> الشاشة الرئيسية <i>←</i><span>3</span> إضافة</div>':'<p>اضغط تثبيت ليظهر التطبيق على الشاشة الرئيسية.</p><button class="jms-install-now">تثبيت التطبيق</button>'}<small>لا توجد رسوم، ويمكن حذفه في أي وقت.</small></div>`;
  document.body.appendChild(sheet);sheet.querySelector('.jms-install-x').onclick=close;
  sheet.addEventListener('click',event=>{if(event.target===sheet)close()});
  sheet.querySelector('.jms-install-now')?.addEventListener('click',async()=>{if(promptEvent){promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;close()}else alert('اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية من قائمة المتصفح.')});
}
function addButton(){if(standalone()||document.getElementById('jmsInstallAppButton'))return;const button=document.createElement('button');button.id='jmsInstallAppButton';button.className='jms-install-app-button';button.innerHTML='<img src="/assets/jms-icon-192.png" alt=""> تثبيت التطبيق';button.onclick=show;document.body.appendChild(button)}
const installStyle=document.createElement('style');installStyle.textContent=`.jms-install-app-button{position:fixed;left:16px;bottom:16px;z-index:9000;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:9px 14px;background:#0f172a;color:#fff;box-shadow:0 12px 30px rgba(15,23,42,.25);font-weight:800}.jms-install-app-button img{width:27px;height:27px;border-radius:8px}.jms-install-sheet{position:fixed;inset:0;z-index:100000;display:grid;place-items:end center;padding:16px;background:rgba(15,23,42,.62);backdrop-filter:blur(4px)}.jms-install-card{position:relative;width:min(460px,100%);padding:25px 20px 22px;border-radius:24px;background:#fff;color:#0f172a;text-align:center}.jms-install-card>img{width:76px;height:76px;border-radius:20px}.jms-install-card h2{margin:12px 0 7px}.jms-install-card p{color:#475569;line-height:1.8}.jms-install-card small{display:block;margin-top:14px;color:#64748b}.jms-install-x{position:absolute;left:14px;top:14px;width:34px;height:34px;border:0;border-radius:50%;background:#f1f5f9;font-size:21px}.jms-install-steps{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px;padding:12px;border-radius:14px;background:#f8fafc;font-size:12px}.jms-install-steps span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#0f172a;color:#fff}.jms-install-now{width:100%;border:0;border-radius:13px;padding:13px;background:#0f172a;color:#fff;font-weight:900}@media(max-width:920px){.jms-install-app-button{bottom:15px;left:12px;padding:8px 11px;font-size:12px}.jms-install-sheet{padding:10px}}@media(display-mode:standalone){.jms-install-app-button{display:none!important}}`;document.head.appendChild(installStyle);
addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;addButton()});addEventListener('appinstalled',close);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{register();addButton()});else{register();addButton()}
window.jmsShowInstallInstructions=show;
})();

/* JMS AI: authoritative cloud balances + authoritative app ownership + responsive composer */
(function(){
'use strict';
const history=[];let busy=false;
const el=id=>document.getElementById(id);
function currentDb(){try{return db||window.db||{}}catch(_){return window.db||{}}}
function current(){try{return currentUser||window.currentUser||null}catch(_){return window.currentUser||null}}
function localScoped(){
  const source=currentDb(),u=current(),isRep=u&&u.role==='rep',uid=u&&u.id;
  const own=row=>!isRep||String(row&&row.rep_id)===String(uid);
  const customers=(source.customers||[]).filter(own);const ids=new Set(customers.map(c=>String(c.id)));
  const related=row=>!isRep||(String(row&&row.rep_id)===String(uid)&&(!row.customer_id||ids.has(String(row.customer_id))));
  return {customers,reps:isRep?(source.reps||[]).filter(r=>String(r.id)===String(uid)):(source.reps||[]),visits:(source.visits||[]).filter(related),quotes:(source.quotes||[]).filter(related),orders:(source.orders||[]).filter(related),collections:(source.collections||[]).filter(related)};
}
function setCloudBadge(ok,text){
  const badge=el('cloudSyncStatus');if(!badge)return;
  badge.textContent=text;badge.dataset.jmsBackend=ok?'ok':'error';
}
function mergeCustomerOwnership(remoteCustomers,localCustomers){
  const localById=new Map((localCustomers||[]).map(c=>[String(c.id),c]));
  return (remoteCustomers||[]).map(remote=>{
    const local=localById.get(String(remote.id));
    if(!local)return remote;
    const localRep=local.sales_rep_id||local.representative_id||local.agent_id||local.salesman_id||local.repId||local.rep_id||'';
    if(!localRep)return remote;
    return {...remote,rep_id:localRep,_jms_owner_source:'local-crm'};
  });
}
async function freshCloudData(){
  if(!navigator.onLine)throw new Error('OFFLINE');
  const token=sessionStorage.getItem('jms_auth_token')||'';if(!token)throw new Error('AUTH');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('/api/data-sync?ts='+Date.now(),{method:'GET',headers:{Authorization:'Bearer '+token,'Cache-Control':'no-cache'},cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(response.status===401?'AUTH':'SYNC');
    const result=await response.json();if(!result?.ok||!result.data)throw new Error('SYNC');
    const local=localScoped(),remote=result.data;
    const cloud={
      customers:mergeCustomerOwnership(Array.isArray(remote.customers)?remote.customers:[],local.customers),
      visits:Array.isArray(remote.visits)?remote.visits:[],
      quotes:Array.isArray(remote.quotes)?remote.quotes:[],
      orders:Array.isArray(remote.orders)?remote.orders:[],
      collections:Array.isArray(remote.collections)?remote.collections:[],
      reps:local.reps
    };
    if(cloud.customers.length===0&&local.customers.length>0)throw new Error('INCOMPLETE');
    setCloudBadge(true,'متصل · البيانات السحابية محدثة');
    return cloud;
  }finally{clearTimeout(timer)}
}
function addMessage(role,text){const body=el('jmsAiBody');if(!body)return;const node=document.createElement('div');node.className='jms-ai-msg '+(role==='user'?'user':'bot');node.textContent=String(text||'');body.appendChild(node);body.scrollTop=body.scrollHeight}
function setBusy(on){busy=on;const input=el('jmsAiInput'),button=input?.parentElement?.querySelector('button');if(input)input.disabled=on;if(button){button.disabled=on;button.textContent=on?'جاري جلب البيانات...':'إرسال'}}
function isDebtQuestion(q){return /(دين|ديون|مديوني|مديونيات|مستحق)/.test(String(q||''))}
function debtTotal(data){return (data?.customers||[]).reduce((s,c)=>s+Number(c.debt_balance||0),0)}
window.renderJmsAI=function(){const counter=el('jmsAiCustomers');if(counter)counter.textContent=localScoped().customers.length};
window.askJmsAI=async function(raw){
  const question=String(raw??el('jmsAiInput')?.value??'').trim();if(!question||busy)return;
  const input=el('jmsAiInput');if(input)input.value='';addMessage('user',question);setBusy(true);
  try{
    let data;
    try{data=await freshCloudData()}catch(syncError){
      const code=syncError?.message||'SYNC';
      const msg=code==='OFFLINE'?'البيانات غير محدثة لعدم وجود اتصال بالإنترنت. لن أعرض أرقاماً قديمة أو صفرية.':code==='AUTH'?'انتهت جلسة الدخول. سجّل الدخول من جديد حتى أقرأ البيانات السحابية الصحيحة.':code==='INCOMPLETE'?'البيانات السحابية غير مكتملة حالياً، لذلك لن أعرض أرقاماً صفرية قد تكون خاطئة. انتظر اكتمال المزامنة ثم أعد المحاولة.':'تعذر تحديث البيانات من الخادم الآن. لن أعرض أرقاماً غير مؤكدة.';
      setCloudBadge(false,'البيانات غير محدثة');addMessage('assistant',msg);return;
    }
    const local=localScoped();
    if(isDebtQuestion(question)&&debtTotal(data)===0&&debtTotal(local)>0){addMessage('assistant','توقفت عن الإجابة لأن المديونيات في السحابة تظهر صفراً بينما توجد مديونيات محلية. يلزم اكتمال المزامنة أولاً حتى لا أعطيك رقماً خاطئاً.');setCloudBadge(false,'اختلاف بين المحلي والسحابي');return;}
    const token=sessionStorage.getItem('jms_auth_token')||'';
    const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({question,data,conversation:history.slice(-8),allowWeb:false})});
    const result=await response.json().catch(()=>({ok:false,error:'bad_response'}));
    if(!response.ok||result.ok===false){addMessage('assistant',String(result.answer||result.error||'تعذر الحصول على رد من JMS AI'));return;}
    const answer=String(result.answer||'لم يصل رد واضح من الذكاء الاصطناعي.');history.push({role:'user',content:question},{role:'assistant',content:answer});if(history.length>16)history.splice(0,history.length-16);addMessage('assistant',answer);
  }catch(error){console.error('JMS AI send failed',error);addMessage('assistant','تعذر الاتصال بـ JMS AI الآن. لن أعرض بيانات غير مؤكدة.');}
  finally{setBusy(false);if(input)input.focus()}
};

function installAiUiFix(){
  if(el('jmsAiResponsiveFix'))return;
  const style=document.createElement('style');style.id='jmsAiResponsiveFix';style.textContent=`
#cloudSyncStatus,#jmsOfflineBadge{pointer-events:none!important;max-width:calc(100vw - 24px)!important}
#cloudSyncStatus{z-index:8500!important}
#cloudSyncStatus[data-jms-backend="ok"]{background:#dcfce7!important;color:#166534!important}
#cloudSyncStatus[data-jms-backend="error"]{background:#fef3c7!important;color:#92400e!important}
#jmsAI.page.active{padding-bottom:120px!important}
#jmsAI.page.active .jms-ai-chat{padding-bottom:96px!important}
#jmsAI.page.active .jms-ai-input{position:fixed!important;z-index:20000!important;right:310px!important;left:24px!important;bottom:18px!important;display:flex!important;gap:10px!important;align-items:center!important;padding:12px!important;border:1px solid #e2e8f0!important;border-radius:22px!important;background:rgba(255,255,255,.98)!important;box-shadow:0 16px 40px rgba(15,23,42,.18)!important;backdrop-filter:blur(12px)!important}
#jmsAI.page.active .jms-ai-input input{position:relative!important;z-index:20001!important;flex:1!important;min-width:0!important}
#jmsAI.page.active .jms-ai-input button{position:relative!important;z-index:20002!important;pointer-events:auto!important;touch-action:manipulation!important;flex:0 0 auto!important}
@media(max-width:850px){
 #jmsAI.page.active{padding-bottom:170px!important}
 #jmsAI.page.active .jms-ai-chat{padding-bottom:150px!important}
 #jmsAI.page.active .jms-ai-input{right:12px!important;left:12px!important;bottom:calc(92px + env(safe-area-inset-bottom))!important;border-radius:18px!important;padding:10px!important}
 #cloudSyncStatus,#jmsOfflineBadge{top:calc(72px + env(safe-area-inset-top))!important;bottom:auto!important;left:8px!important;right:auto!important;z-index:8500!important}
}
@media(max-width:430px){#jmsAI.page.active .jms-ai-input{gap:8px!important}#jmsAI.page.active .jms-ai-input button{padding-inline:16px!important}}
`;
  document.head.appendChild(style);
}
function boot(){installAiUiFix();window.renderJmsAI();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();