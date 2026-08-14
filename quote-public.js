(function(){
'use strict';
const card=document.getElementById('quoteCard'),params=new URLSearchParams(location.search);
const id=params.get('id'),token=params.get('token');
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
const status=v=>({approved:'معتمد من الإدارة',sent:'مرسل للعميل',customer_approved:'معتمد من العميل'}[v]||'عرض سعر');
function fail(message){card.innerHTML='<div class="state"><h2>تعذر فتح عرض السعر</h2><p>'+esc(message)+'</p><small>يرجى طلب رابط جديد من مندوب المبيعات.</small></div>'}
async function ensureProduction(){
 const state=document.querySelector('[data-production-state]');
 try{
  const response=await fetch('/api/quote-production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token})});
  const body=await response.json();if(!response.ok)throw new Error(body.error||'conversion_failed');
  if(state){state.textContent='✓ تم تحويل العرض تلقائياً إلى طلب تصنيع';state.classList.add('done')}
 }catch(error){console.error(error);if(state)state.textContent='تم الاعتماد، وسيُعاد إرسال الطلب للتصنيع تلقائياً عند فتح الرابط.'}
}
function approvalBlock(q){
 if(q.status==='customer_approved')return '<div class="approved-box"><b>✓ تم اعتماد وتوقيع العرض بنجاح</b><span>بواسطة '+esc(q.customer_signer_name||'العميل')+' · '+esc(q.customer_approved_at?new Date(q.customer_approved_at).toLocaleString('ar-SA'):'')+'</span><span>بانتظار مراجعة الإدارة وتأكيد أمر التصنيع</span></div>';
 return '<div class="next"><button type="button" id="openSignature">اعتماد وتوقيع العرض</button><p>بإتمام التوقيع فإنك توافق على مواصفات العرض وشروطه الموضحة أعلاه.</p></div>';
}
function render(q){const vat=Number(q.total_amount||0)*.15,grand=Number(q.total_amount||0)+vat;document.title='عرض سعر '+(q.quote_no||'')+' | JMS Factory';card.innerHTML=
'<div class="hero"><div><h1>عرض سعر رقم '+esc(q.quote_no||'-')+'</h1><span>تاريخ الإصدار: '+esc(q.date||'-')+' · صالح حتى: '+esc(q.valid_until||'-')+'</span></div><span class="pill">'+esc(status(q.status))+'</span></div>'+
'<div class="grid"><div class="box"><small>المنتج</small><b>'+esc(q.product||'-')+'</b></div><div class="box"><small>الخامة واللون</small><b>'+esc(q.material||'-')+' · '+esc(q.color||'-')+'</b></div></div>'+
'<div class="specs"><div class="item"><small>المقاس</small><b>'+esc(q.width||'-')+' × '+esc(q.length||'-')+' '+esc(q.size_unit||'')+'</b></div><div class="item"><small>السماكة</small><b>'+esc(q.thickness||'-')+' '+esc(q.thickness_unit||'')+'</b></div><div class="item"><small>الكمية</small><b>'+esc(q.total_kg||'-')+' كجم</b></div><div class="item"><small>سعر الكيلو</small><b>'+money(q.price_kg)+' ريال</b></div><div class="item"><small>الضريبة 15%</small><b>'+money(vat)+' ريال</b></div></div>'+
'<div class="total"><span>الإجمالي شامل الضريبة</span><b>'+money(grand)+' ريال</b></div>'+
'<div class="terms"><b>شروط العرض</b><br>الدفع: '+esc(q.payment_terms||'-')+'<br>التسليم: '+esc(q.delivery_terms||'-')+'<br>الملاحظات: '+esc(q.notes||'لا توجد ملاحظات')+'</div>'+approvalBlock(q);
 document.getElementById('openSignature')?.addEventListener('click',openSignature);
 if(q.status==='customer_approved')return;
}
function openSignature(){
 const layer=document.createElement('div');layer.className='signature-layer';layer.innerHTML='<section class="signature-sheet"><div class="handle"></div><header><div><small>اعتماد عرض السعر</small><h2>التوقيع الرقمي</h2></div><button type="button" id="closeSignature">×</button></header><label>اسم الشخص المعتمد<input id="signerName" maxlength="100" autocomplete="name" placeholder="اكتب الاسم الكامل"></label><label>وقّع بإصبعك داخل المربع<div class="canvas-wrap"><canvas id="signatureCanvas"></canvas><span id="signHint">التوقيع هنا</span></div></label><div class="signature-actions"><button type="button" id="clearSignature">مسح التوقيع</button><button type="button" id="submitSignature">اعتماد العرض</button></div><p id="signatureMessage" role="status"></p></section>';
 document.body.appendChild(layer);requestAnimationFrame(()=>layer.classList.add('open'));
 const canvas=layer.querySelector('canvas'),ctx=canvas.getContext('2d'),wrap=canvas.parentElement,hint=layer.querySelector('#signHint');let drawing=false,hasInk=false,last=null;
 function resize(){const rect=wrap.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(210*ratio);canvas.style.width=rect.width+'px';canvas.style.height='210px';ctx.setTransform(ratio,0,0,ratio,0,0);ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#111827'}
 resize();
 function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);drawing=true;last=point(e)});
 canvas.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();const p=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;hasInk=true;hint.hidden=true});
 const stop=()=>{drawing=false;last=null};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
 function close(){layer.classList.remove('open');setTimeout(()=>layer.remove(),220)}
 layer.querySelector('#closeSignature').onclick=close;
 layer.querySelector('#clearSignature').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;hint.hidden=false};
 layer.querySelector('#submitSignature').onclick=async function(){
   const name=layer.querySelector('#signerName').value.trim(),msg=layer.querySelector('#signatureMessage');
   if(name.length<2){msg.textContent='يرجى كتابة اسم الشخص المعتمد.';return}
   if(!hasInk){msg.textContent='يرجى التوقيع داخل المربع.';return}
   this.disabled=true;this.textContent='جاري حفظ الاعتماد…';msg.textContent='';
   try{
     const signature=canvas.toDataURL('image/png');
     const response=await fetch('/api/quote-signature',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token,name,signature})});
     const body=await response.json();
     if(!response.ok)throw new Error(body.error||'save_failed');
     close();card.querySelector('.pill').textContent='معتمد من العميل';
     card.querySelector('.next').outerHTML='<div class="approved-box"><b>✓ تم اعتماد وتوقيع العرض بنجاح</b><span>بواسطة '+esc(name)+' · '+new Date(body.approvedAt||Date.now()).toLocaleString('ar-SA')+'</span><span>بانتظار مراجعة الإدارة وتأكيد أمر التصنيع</span></div>';
   }catch(error){console.error(error);msg.textContent='تعذر حفظ التوقيع. تأكد من الاتصال وحاول مرة أخرى.';this.disabled=false;this.textContent='اعتماد العرض'}
 };
}
(async function(){if(!id||!token)return fail('الرابط غير مكتمل أو غير صالح.');try{const r=await fetch('/api/public-quote?id='+encodeURIComponent(id)+'&token='+encodeURIComponent(token),{cache:'no-store'});if(!r.ok)throw new Error(r.status===404?'الرابط غير صالح أو انتهت صلاحيته.':'تعذر الاتصال بالخدمة.');const body=await r.json();render(body.quote)}catch(e){fail(e.message)}})();
})();