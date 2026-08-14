(function(){
'use strict';
const card=document.getElementById('quoteCard');
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
const status=v=>({approved:'معتمد من الإدارة',sent:'مرسل للعميل',customer_approved:'معتمد من العميل'}[v]||'عرض سعر');
function fail(message){card.innerHTML='<div class="state"><h2>تعذر فتح عرض السعر</h2><p>'+esc(message)+'</p><small>يرجى طلب رابط جديد من مندوب المبيعات.</small></div>'}
function render(q){const vat=Number(q.total_amount||0)*.15,grand=Number(q.total_amount||0)+vat;document.title='عرض سعر '+(q.quote_no||'')+' | JMS Factory';card.innerHTML=
'<div class="hero"><div><h1>عرض سعر رقم '+esc(q.quote_no||'-')+'</h1><span>تاريخ الإصدار: '+esc(q.date||'-')+' · صالح حتى: '+esc(q.valid_until||'-')+'</span></div><span class="pill">'+esc(status(q.status))+'</span></div>'+
'<div class="grid"><div class="box"><small>المنتج</small><b>'+esc(q.product||'-')+'</b></div><div class="box"><small>الخامة واللون</small><b>'+esc(q.material||'-')+' · '+esc(q.color||'-')+'</b></div></div>'+
'<div class="specs"><div class="item"><small>المقاس</small><b>'+esc(q.width||'-')+' × '+esc(q.length||'-')+' '+esc(q.size_unit||'')+'</b></div><div class="item"><small>السماكة</small><b>'+esc(q.thickness||'-')+' '+esc(q.thickness_unit||'')+'</b></div><div class="item"><small>الكمية</small><b>'+esc(q.total_kg||'-')+' كجم</b></div><div class="item"><small>سعر الكيلو</small><b>'+money(q.price_kg)+' ريال</b></div><div class="item"><small>الضريبة 15%</small><b>'+money(vat)+' ريال</b></div></div>'+
'<div class="total"><span>الإجمالي شامل الضريبة</span><b>'+money(grand)+' ريال</b></div>'+
'<div class="terms"><b>شروط العرض</b><br>الدفع: '+esc(q.payment_terms||'-')+'<br>التسليم: '+esc(q.delivery_terms||'-')+'<br>الملاحظات: '+esc(q.notes||'لا توجد ملاحظات')+'</div>'+
'<div class="next"><button type="button" disabled>اعتماد وتوقيع العرض — المرحلة التالية</button><p>هذه الصفحة للعرض الآمن حالياً، وسيتم تفعيل التوقيع الرقمي بعد اعتماد تجربة الرابط.</p></div>'}
(async function(){const p=new URLSearchParams(location.search),id=p.get('id'),token=p.get('token');if(!id||!token)return fail('الرابط غير مكتمل أو غير صالح.');try{const r=await fetch('/api/public-quote?id='+encodeURIComponent(id)+'&token='+encodeURIComponent(token),{cache:'no-store'});if(!r.ok)throw new Error(r.status===404?'الرابط غير صالح أو انتهت صلاحيته.':'تعذر الاتصال بالخدمة.');const body=await r.json();render(body.quote)}catch(e){fail(e.message)}})();
})();