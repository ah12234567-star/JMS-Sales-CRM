(function(){'use strict';let promptEvent=null;const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);function register(){if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js?v=3').catch(error=>console.warn('SW registration failed',error))}function close(){document.getElementById('jmsInstallSheet')?.remove()}function show(){close();const sheet=document.createElement('div');sheet.id='jmsInstallSheet';sheet.className='jms-install-sheet';sheet.innerHTML=`<div class="jms-install-card"><button class="jms-install-x">×</button><img src="/assets/jms-icon-192.png" alt="JMS"><h2>ثبّت JMS CRM على الجوال</h2>${ios()?'<p>في Safari اضغط <b>المشاركة</b> ثم <b>إضافة إلى الشاشة الرئيسية</b> وبعدها <b>إضافة</b>.</p><div class="jms-install-steps"><span>1</span> مشاركة ↑ <i>←</i><span>2</span> الشاشة الرئيسية <i>←</i><span>3</span> إضافة</div>':'<p>اضغط تثبيت ليظهر التطبيق على الشاشة الرئيسية.</p><button class="jms-install-now">تثبيت التطبيق</button>'}<small>لا توجد رسوم، ويمكن حذفه في أي وقت.</small></div>`;document.body.appendChild(sheet);sheet.querySelector('.jms-install-x').onclick=close;sheet.addEventListener('click',event=>{if(event.target===sheet)close()});sheet.querySelector('.jms-install-now')?.addEventListener('click',async()=>{if(promptEvent){promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;close()}else alert('اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية من قائمة المتصفح.')})}function addButton(){if(standalone()||document.getElementById('jmsInstallAppButton'))return;const button=document.createElement('button');button.id='jmsInstallAppButton';button.className='jms-install-app-button';button.innerHTML='<img src="/assets/jms-icon-192.png" alt=""> تثبيت التطبيق';button.onclick=show;document.body.appendChild(button)}const style=document.createElement('style');style.textContent=`.jms-install-app-button{position:fixed;left:16px;bottom:16px;z-index:9000;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:9px 14px;background:#0f172a;color:#fff;box-shadow:0 12px 30px rgba(15,23,42,.25);font-weight:800}.jms-install-app-button img{width:27px;height:27px;border-radius:8px}.jms-install-sheet{position:fixed;inset:0;z-index:100000;display:grid;place-items:end center;padding:16px;background:rgba(15,23,42,.62);backdrop-filter:blur(4px)}.jms-install-card{position:relative;width:min(460px,100%);padding:25px 20px 22px;border-radius:24px;background:#fff;color:#0f172a;text-align:center}.jms-install-card>img{width:76px;height:76px;border-radius:20px}.jms-install-card h2{margin:12px 0 7px}.jms-install-card p{color:#475569;line-height:1.8}.jms-install-card small{display:block;margin-top:14px;color:#64748b}.jms-install-x{position:absolute;left:14px;top:14px;width:34px;height:34px;border:0;border-radius:50%;background:#f1f5f9;font-size:21px}.jms-install-steps{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px;padding:12px;border-radius:14px;background:#f8fafc;font-size:12px}.jms-install-steps span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#0f172a;color:#fff}.jms-install-now{width:100%;border:0;border-radius:13px;padding:13px;background:#0f172a;color:#fff;font-weight:900}@media(max-width:920px){.jms-install-app-button{bottom:15px;left:12px;padding:8px 11px;font-size:12px}.jms-install-sheet{padding:10px}}@media(display-mode:standalone){.jms-install-app-button{display:none!important}}`;document.head.appendChild(style);addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;addButton()});addEventListener('appinstalled',close);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{register();addButton()});else{register();addButton()}window.jmsShowInstallInstructions=show})();

/* JMS AI live API wiring */
(function(){
  'use strict';
  const history=[];
  let busy=false;
  const el=id=>document.getElementById(id);
  function currentDb(){try{return db||window.db||{}}catch(_){return window.db||{}}}
  function current(){try{return currentUser||window.currentUser||null}catch(_){return window.currentUser||null}}
  function scopedData(){
    const source=currentDb(),u=current(),isRep=u&&u.role==='rep',uid=u&&u.id;
    const own=row=>!isRep||String(row&&row.rep_id)===String(uid);
    const customers=(source.customers||[]).filter(own);
    const customerIds=new Set(customers.map(c=>String(c.id)));
    const related=row=>!isRep||(String(row&&row.rep_id)===String(uid)&&(!row.customer_id||customerIds.has(String(row.customer_id))));
    return {
      customers,
      reps:isRep?(source.reps||[]).filter(r=>String(r.id)===String(uid)):(source.reps||[]),
      visits:(source.visits||[]).filter(related),
      quotes:(source.quotes||[]).filter(related),
      orders:(source.orders||[]).filter(related),
      collections:(source.collections||[]).filter(related)
    };
  }
  function addMessage(role,text){
    const body=el('jmsAiBody');if(!body)return;
    const node=document.createElement('div');node.className='jms-ai-msg '+(role==='user'?'user':'bot');node.textContent=String(text||'');body.appendChild(node);body.scrollTop=body.scrollHeight;
  }
  function setBusy(on){
    busy=on;const input=el('jmsAiInput');const button=input?.parentElement?.querySelector('button');
    if(input)input.disabled=on;if(button){button.disabled=on;button.textContent=on?'جاري التحليل...':'إرسال'}
  }
  window.renderJmsAI=function(){
    const counter=el('jmsAiCustomers');if(counter)counter.textContent=scopedData().customers.length;
  };
  window.askJmsAI=async function(raw){
    const question=String(raw??el('jmsAiInput')?.value??'').trim();
    if(!question||busy)return;
    const input=el('jmsAiInput');if(input)input.value='';
    addMessage('user',question);setBusy(true);
    try{
      const token=sessionStorage.getItem('jms_auth_token')||'';
      const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({question,data:scopedData(),conversation:history.slice(-8),allowWeb:false})});
      const result=await response.json().catch(()=>({ok:false,error:'bad_response'}));
      if(!response.ok||result.ok===false)throw new Error(result.error||result.answer||'تعذر الحصول على رد من JMS AI');
      const answer=String(result.answer||'لم يصل رد واضح من الذكاء الاصطناعي.');
      history.push({role:'user',content:question},{role:'assistant',content:answer});
      if(history.length>16)history.splice(0,history.length-16);
      addMessage('assistant',answer);
    }catch(error){
      console.error('JMS AI send failed',error);
      addMessage('assistant','تعذر الاتصال بـ JMS AI الآن. تحقق من الاتصال وحاول مرة أخرى.');
    }finally{setBusy(false);if(input)input.focus()}
  };
  document.addEventListener('DOMContentLoaded',()=>window.renderJmsAI());
})();