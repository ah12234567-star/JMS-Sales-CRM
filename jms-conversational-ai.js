/* One authenticated conversation path for manager and representative assistants. */
(function(){
 'use strict';
 const sessions=new Map();
 const user=()=>window.currentUser||(typeof currentUser!=='undefined'?currentUser:null);
 const token=()=>sessionStorage.getItem('jms_auth_token')||'';
 function state(channel){const key=(user()?.id||'')+':'+channel;let s=sessions.get(key);if(!s){for(const oldKey of sessions.keys())if(!oldKey.startsWith((user()?.id||'')+':'))sessions.delete(oldKey);s={history:[],context:{},busy:false,token:token()};sessions.set(key,s);}if(s.token!==token()){s.history=[];s.context={};s.token=token();}return s;}
 function message(body,role,text){const node=document.createElement('div');node.className='jms-ai-msg '+role;node.style.whiteSpace='pre-wrap';node.textContent=text;body.appendChild(node);body.scrollTop=body.scrollHeight;return node;}
 const FIELD_LABELS={total_kg:'الكمية بالكيلو',price_kg:'سعر الكيلو',print_colors:'ألوان الطباعة',width:'العرض',length:'الطول',thickness:'السماكة'};
 function addSources(node,sources){
  const refs=(sources||[]).filter(s=>['customer','quote'].includes(s.type)).slice(0,10);if(!refs.length)return;
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='السجلات المرتبطة';details.appendChild(summary);
  for(const ref of refs){const b=document.createElement('button');b.type='button';b.textContent=ref.label;b.style.margin='4px';b.onclick=()=>{const fn=ref.type==='customer'?window.openCustomer360:window.viewQuote;if(typeof fn==='function')fn(ref.id);else alert('افتح السجل من صفحة '+(ref.type==='customer'?'العملاء':'العروض')+'.');};details.appendChild(b);}
  node.appendChild(details);
 }
 function field(id,value){const el=document.getElementById(id);if(!el||value===undefined||value===null)return false;if(el.tagName==='SELECT'&&![...el.options].some(o=>String(o.value)===String(value)))return false;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;}
 function openDraft(draft){
  if(typeof window.openQuoteForm!=='function')return alert('تعذر فتح نموذج العرض.');
  window.openQuoteForm();
  const started=Date.now();
  function apply(){
   if(!document.getElementById('mqCustomer')){if(Date.now()-started<2500)setTimeout(apply,80);else alert('تعذر تجهيز النموذج. أعد فتح العرض.');return;}
   const map={customer_id:'mqCustomer',rep_id:'mqRep',product:'mqProduct',material:'mqMaterial',color:'mqColor',print:'mqPrint',width:'mqWidth',length:'mqLength',size_unit:'mqSizeUnit',thickness:'mqThickness',thickness_unit:'mqThicknessUnit',total_kg:'mqKg',price_kg:'mqPriceKg',print_colors:'mqPrintColors',payment_terms:'mqPayment',delivery_terms:'mqDelivery',fold_bottom:'mqFoldBottom',fold_top:'mqFoldTop',fold_side:'mqFoldSide',handle_type:'mqHandleType',handle_color:'mqHandleColor'};
   const failed=[];for(const [key,id] of Object.entries(map))if(draft[key]!==undefined&&!field(id,draft[key]))failed.push(FIELD_LABELS[key]||key);
   // New form only. Never copy the previous quote's IDs, signatures, approvals or items.
   if(window.JMS_QUOTE_DRAFT_ITEMS!==undefined)window.JMS_QUOTE_DRAFT_ITEMS=[];
   window.calcQuoteForm?.();window.jmsCalcQuote?.();
   const note=document.createElement('p');note.textContent='مسودة جديدة: راجع السعر والمواصفات والتسليم قبل الحفظ.'+(failed.length?' حقول تحتاج تعبئة يدوية: '+failed.join('، '):'');
   document.getElementById('modalBody')?.prepend(note);
  }
  setTimeout(apply,300);
 }
 async function ask(channel,q){
  const prefix=channel==='rep'?'repAi':'jmsAi',input=document.getElementById(prefix+'Input'),body=document.getElementById(prefix+'Body');
  q=String(q||input?.value||'').trim();if(!q||!body)return;
  const s=state(channel);if(s.busy)return;
  if(!token()){message(body,'bot','سجل الدخول مجددًا لاستخدام المساعد.');return;}
  s.busy=true;const startToken=token();message(body,'user',q);if(input)input.value='';
  const thinking=message(body,'bot','أراجع سؤالك والبيانات…'),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
  try {
   const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+startToken},signal:controller.signal,body:JSON.stringify({question:q,context:s.context,conversation:s.history})});
   const result=await response.json();if(startToken!==token()){thinking.remove();return;}
   thinking.textContent=result.answer||'تعذر إكمال الإجابة. أعد المحاولة.';
   if(response.ok&&result.ok){
    s.context=result.context||s.context;s.history.push({role:'user',content:q},{role:'assistant',content:result.answer||''});s.history=s.history.slice(-8);
    addSources(thinking,result.sources);
    if(result.draft){const button=document.createElement('button');button.type='button';button.textContent='مراجعة المسودة في نموذج العرض';button.style.display='block';button.style.marginTop='12px';button.onclick=()=>openDraft(result.draft);thinking.appendChild(button);}
    if(result.notice){const note=document.createElement('p');note.textContent=result.notice;thinking.appendChild(note);}
    if(result.updatedAt){const stamp=document.createElement('small');stamp.style.display='block';stamp.textContent='قراءة البيانات: '+new Date(result.updatedAt).toLocaleTimeString('ar-SA',{timeZone:'Asia/Riyadh'});thinking.appendChild(stamp);}
   }
  } catch {thinking.textContent='تعذر الاتصال بالمساعد. أعد المحاولة؛ لم أستخدم بيانات قديمة لإعطائك إجماليًا.';}
  finally{clearTimeout(timer);s.busy=false;body.scrollTop=body.scrollHeight;}
 }
 window.JMSConversationalAI={version:'20260914',ask,clear:()=>sessions.clear()};
 window.askJmsAI=q=>ask('manager',q);
 window.jmsRepAiAsk=q=>ask('rep',q);
 window.askRepAI=q=>ask('rep',q);
 function setup(){
  for(const id of ['jmsAiInput','repAiInput']){const el=document.getElementById(id);if(el){el.placeholder='اكتب سؤالك بطريقتك، ثم أكمل على نفس الإجابة';el.style.fontSize='16px';}}
  // Keep the conversation uncluttered; actions appear only with relevant results.
  document.querySelectorAll('.jms-rep-ai-actions,#repAiAssistant .head-actions').forEach(el=>el.hidden=true);
 }
 document.addEventListener('keydown',event=>{if(['jmsAiInput','repAiInput'].includes(event.target?.id)&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();ask(event.target.id==='repAiInput'?'rep':'manager');}},true);
 document.addEventListener('focusin',setup);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
