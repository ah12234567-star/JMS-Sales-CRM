/* Entry points only: no changes to legacy visit/customer data or AI answers. */
(()=>{
 function install(){
  if(!['rep','admin','sales'].includes(window.currentUser?.role))return;
  const nav=document.querySelector('.sidebar nav');
  if(nav&&!document.getElementById('fieldRoundsNav')){
   const a=document.createElement('a');a.id='fieldRoundsNav';a.className='field-rounds-nav';a.href='/field-rounds.html';a.textContent='جولة اليوم';a.style.cssText='display:block;padding:13px;border-radius:12px;background:#1d4ed8;color:white;text-decoration:none;font-weight:bold';nav.appendChild(a);
  }
  for(const page of ['repAiAssistant','jmsAI']){
   const host=document.querySelector('#'+page+' .page-head, #'+page);
   if(host&&!document.getElementById('fieldRoundsAiLink-'+page)){
    const a=document.createElement('a');a.id='fieldRoundsAiLink-'+page;a.href='/field-rounds.html';a.textContent='سجّل جولة على منشآت جديدة';a.className='primary';a.style.cssText='display:inline-block;margin:10px 0;text-decoration:none';host.appendChild(a);
   }
  }
 }
 let timer;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(install,150);});
 observer.observe(document.body,{childList:true,subtree:true});install();
})();
