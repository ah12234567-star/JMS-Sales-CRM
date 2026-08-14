(function(){
  'use strict';
  const STAGES=[
    ['pending_manager','موافقة المدير'],['manager_approved','اعتماد المدير'],['payment_confirmed','تسجيل التحويل'],
    ['sent_to_production','إرسال للإنتاج'],['production_received','استلام الإنتاج'],['technical_plan','الخطة الفنية'],
    ['film_production','إنتاج الفيلم'],['sent_to_cutting','إرسال للمقص'],['cutting','المقص'],
    ['packing','التغليف'],['ready_delivery','جاهز للتسليم'],['delivered','تم التسليم']
  ];
  function database(){try{return db}catch(_){return window.db||{}}}
  function user(){try{return currentUser}catch(_){return window.currentUser||null}}
  function allowed(){return ['admin','sales','production','production_manager','manager'].includes(user()?.role)}
  function label(key){return STAGES.find(function(stage){return stage[0]===key})?.[1]||key}
  function idFromCard(card){
    const text=card.querySelector('[onclick*="openProductionOrder"]')?.getAttribute('onclick')||'';
    return text.match(/openProductionOrder\(['"]([^'"]+)/)?.[1]||'';
  }
  function persist(){
    try{if(typeof save==='function')save();else window.save?.()}catch(error){console.error('JMS production save',error)}
  }
  function toast(message){
    if(typeof window.jmsShowTopBanner==='function')return window.jmsShowTopBanner(message,'success');
    const status=document.getElementById('cloudSyncStatus');
    if(status){status.textContent=message;status.classList.add('jms-toast-top','jms-toast-visible');setTimeout(function(){status.classList.remove('jms-toast-visible')},2000)}
  }
  function move(id,target){
    if(!allowed())return alert('هذه الصلاحية للمدير أو مدير الإنتاج فقط');
    const data=database();
    const production=(data.productionOrders||[]).find(function(item){return item.id===id});
    if(!production||production.stage===target)return;
    const from=production.stage||'pending_manager';
    production.stage=target;production.updated_at=new Date().toISOString();
    const order=(data.orders||[]).find(function(item){return item.id===production.order_id});
    if(order){order.status=label(target);order.production_stage=target;order.production_id=production.id}
    data.productionLogs=data.productionLogs||[];
    data.productionLogs.unshift({
      id:crypto.randomUUID?.()||('log-'+Date.now()),production_id:id,order_id:production.order_id||'',
      stage:target,action:'نقل سريع بين مراحل الإنتاج',note:'تم النقل من '+label(from)+' إلى '+label(target),
      by:user()?.name||'',by_id:user()?.id||'',at:new Date().toISOString()
    });
    persist();
    window.renderProductionWorkflow?.();
    toast('تم نقل أمر التصنيع إلى '+label(target));
  }
  window.jmsMoveProductionDirect=move;
  window.jmsQuickAdvanceProduction=function(id){
    const data=database(),production=(data.productionOrders||[]).find(function(item){return item.id===id});
    if(!production)return;
    const index=Math.max(0,STAGES.findIndex(function(stage){return stage[0]===production.stage}));
    const next=STAGES[Math.min(index+1,STAGES.length-1)];
    if(next[0]===production.stage)return toast('أمر التصنيع مكتمل');
    move(id,next[0]);
  };

  function enhance(){
    const board=document.getElementById('productionBoard');if(!board)return;
    const columns=Array.from(board.querySelectorAll('.jms-prod-col'));
    columns.forEach(function(column,index){
      const stage=STAGES[index];if(!stage)return;
      column.dataset.productionStage=stage[0];
      column.ondragover=function(event){event.preventDefault();column.classList.add('jms-production-drop')};
      column.ondragleave=function(){column.classList.remove('jms-production-drop')};
      column.ondrop=function(event){
        event.preventDefault();column.classList.remove('jms-production-drop');
        const id=event.dataTransfer.getData('text/jms-production');
        if(id)move(id,stage[0]);
      };
      Array.from(column.querySelectorAll('.jms-prod-card')).forEach(function(card){
        const id=idFromCard(card);if(!id)return;
        card.draggable=true;card.dataset.productionId=id;
        card.ondragstart=function(event){event.dataTransfer.setData('text/jms-production',id);card.classList.add('jms-production-dragging')};
        card.ondragend=function(){card.classList.remove('jms-production-dragging')};
        const buttons=Array.from(card.querySelectorAll('.jms-prod-actions button'));
        const advance=buttons.find(function(button){return button.getAttribute('onclick')?.includes('advanceProductionStage')});
        if(advance){
          const next=STAGES[index+1];
          if(next){advance.textContent='نقل إلى '+next[1];advance.setAttribute('onclick',"jmsQuickAdvanceProduction('"+id+"')");advance.classList.add('jms-quick-stage')}
        }
      });
    });
  }
  function install(){
    const old=window.renderProductionWorkflow;
    if(typeof old==='function'&&!old.jmsProductionUx){
      const wrapped=function(){const result=old.apply(this,arguments);requestAnimationFrame(enhance);return result};
      wrapped.jmsProductionUx=true;window.renderProductionWorkflow=wrapped;
    }
    enhance();
    document.addEventListener('click',function(event){
      if(event.target.closest('.nav[data-page="productionWorkflow"]'))setTimeout(enhance,160);
    },true);
  }
  function style(){
    if(document.getElementById('jmsProductionUxStyle'))return;
    const element=document.createElement('style');element.id='jmsProductionUxStyle';
    element.textContent='.jms-prod-card{content-visibility:auto;contain-intrinsic-size:260px;cursor:grab}.jms-prod-card.jms-production-dragging{opacity:.42}.jms-prod-col.jms-production-drop{outline:3px dashed #2563eb;background:#eff6ff}.jms-quick-stage{background:#16a34a!important;color:#fff!important;font-weight:900}.jms-prod-actions button{min-height:42px}@media(max-width:720px){.jms-prod-board{display:flex!important;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:10px}.jms-prod-col{min-width:84vw;scroll-snap-align:start}.jms-prod-card{cursor:default}}';
    document.head.appendChild(element);
  }
  function boot(){style();install();setTimeout(install,800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.JMS_PRODUCTION_UX='2026-08-14-v1';
})();