/* iOS keyboard stability fix for Ready Goods Notice.
   Prevents per-keystroke row re-rendering from dismissing the keyboard / jumping scroll.
*/
(function(){
  'use strict';
  const ROOT_ID='rgnItems';

  function stabilizeInputs(){
    const root=document.getElementById(ROOT_ID);
    if(!root)return;
    root.querySelectorAll('input[oninput*="JMSReadyGoods.patch"]').forEach(input=>{
      if(input.dataset.rgnKeyboardStable==='1')return;
      const handler=input.getAttribute('oninput');
      if(!handler)return;
      input.removeAttribute('oninput');
      input.setAttribute('onchange',handler);
      input.dataset.rgnKeyboardStable='1';
    });
  }

  function install(){
    stabilizeInputs();
    const observer=new MutationObserver(()=>requestAnimationFrame(stabilizeInputs));
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('focusin',e=>{
      if(e.target?.closest?.('#'+ROOT_ID))stabilizeInputs();
    },true);
    setTimeout(stabilizeInputs,300);
    setTimeout(stabilizeInputs,1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
