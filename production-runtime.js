(function(){
  'use strict';
  const VERSION='2026-08-14-production-runtime-1';
  let renderRunning=false;
  let renderQueued=false;
  let lastRenderAt=0;

  function installRenderScheduler(){
    const original=window.renderAll;
    if(typeof original!=='function'||original.__jmsScheduled)return;
    function run(context,args){
      renderRunning=true;
      try{return original.apply(context,args);}
      catch(error){report(error,'render');}
      finally{
        renderRunning=false;
        lastRenderAt=performance.now();
        if(renderQueued){renderQueued=false;requestAnimationFrame(()=>scheduled.apply(window,args));}
      }
    }
    function scheduled(){
      const args=arguments;
      if(renderRunning){renderQueued=true;return;}
      if(performance.now()-lastRenderAt<80){
        if(!renderQueued){renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;run(this,args);});}
        return;
      }
      return run(this,args);
    }
    scheduled.__jmsScheduled=true;
    scheduled.flush=()=>run(window,[]);
    window.renderAll=scheduled;
    try{renderAll=scheduled;}catch(_){}
  }

  function toast(message){
    let host=document.getElementById('jmsRuntimeNotice');
    if(!host){host=document.createElement('div');host.id='jmsRuntimeNotice';host.setAttribute('role','status');document.body.appendChild(host);}
    host.textContent=message;host.classList.add('show');
    clearTimeout(host._timer);host._timer=setTimeout(()=>host.classList.remove('show'),4500);
  }
  function report(error,source){
    console.error('[JMS '+source+']',error);
    if(navigator.onLine===false)toast('الاتصال بالإنترنت منقطع؛ بياناتك المحلية ما زالت محفوظة.');
    else toast('تعذر إكمال العملية. لم تفقد بياناتك، جرّب مرة أخرى.');
  }
  function installErrors(){
    addEventListener('unhandledrejection',event=>{event.preventDefault();report(event.reason||new Error('Unhandled promise'),'async');});
    addEventListener('offline',()=>toast('أنت الآن دون اتصال؛ سيجري الحفظ السحابي عند عودة الشبكة.'));
    addEventListener('online',()=>toast('عاد الاتصال بالإنترنت، جارٍ تحديث البيانات.'));
  }
  function installLifecycle(){
    addEventListener('pagehide',()=>{clearTimeout(window.__jmsCloudPollTimer);});
  }
  const style=document.createElement('style');style.textContent=`#jmsRuntimeNotice{position:fixed;z-index:200000;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));max-width:min(90vw,480px);padding:11px 16px;border-radius:14px;background:#0f172a;color:#fff;box-shadow:0 12px 35px #0f172a40;font:700 12px/1.6 system-ui;opacity:0;pointer-events:none;transform:translate(-50%,18px);transition:.2s}#jmsRuntimeNotice.show{opacity:1;transform:translate(-50%,0)}`;document.head.appendChild(style);
  function install(){installRenderScheduler();installErrors();installLifecycle();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.JMS_PRODUCTION_RUNTIME_VERSION=VERSION;
})();
