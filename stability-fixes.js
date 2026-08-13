(function(){
  'use strict';
  const VERSION='2026-08-13-full-audit-1';
  const number=v=>Number(String(v??'').replace(/[^\d.-]/g,''))||0;
  const text=v=>String(v??'').trim();
  const isRealCustomer=id=>{
    const c=(window.db?.customers||[]).find(x=>x.id===id);
    return !!c && text(c.name) && !['الاسم','اسم العميل','-'].includes(text(c.name));
  };
  const validOrder=o=>!!o && isRealCustomer(o.customer_id) && text(o.product) &&
    number(o.width)>0 && number(o.length)>0 && number(o.thickness)>0 &&
    number(o.total_kg)>0 && number(o.amount_value)>0;
  const validQuote=q=>!!q && isRealCustomer(q.customer_id) && text(q.product) &&
    number(q.width)>0 && number(q.length)>0 && number(q.thickness)>0 &&
    number(q.total_kg)>0 && number(q.price_kg)>0 && number(q.total_amount)>0;
  const invalidMessage='البيانات ناقصة. أكمل العميل والمنتج والمقاس والسماكة والكمية والسعر قبل المتابعة.';

  function markInvalidRecords(){
    document.querySelectorAll('.quote-card,.quote-card-pro').forEach(card=>{
      const no=card.querySelector('h3')?.textContent?.match(/Q-\d+/)?.[0];
      const q=(window.db?.quotes||[]).find(x=>x.quote_no===no);
      if(!q || validQuote(q)) return;
      card.classList.add('jms-record-incomplete');
      if(!card.querySelector('.jms-incomplete-note')){
        card.insertAdjacentHTML('afterbegin','<div class="jms-incomplete-note">⚠ عرض قديم ناقص — عدّله قبل الاعتماد أو الإرسال أو التحويل</div>');
      }
      card.querySelectorAll('.approve,.send,.convert,.accept').forEach(b=>{b.disabled=true;b.title=invalidMessage});
    });
  }

  function cleanupUi(){
    const users=document.getElementById('users');
    if(users){
      const add=[...users.querySelectorAll('button')].filter(b=>/إضافة مستخدم/.test(b.textContent));
      add.slice(1).forEach(b=>b.remove());
    }
    document.querySelectorAll('select').forEach(s=>{
      if(s.dataset.searchTitle) return;
      if(s.options.length>25){s.dataset.searchTitle='1';s.title='اكتب أول حرف من اسم العميل للانتقال إليه بسرعة';}
    });
    markInvalidRecords();
  }

  function validateOrderForm(e){
    const f=e.target;
    if(f?.id!=='orderForm') return;
    const required=[
      ['orderCustomer','اختر العميل الصحيح'],
      ['width','اكتب العرض'],['length','اكتب الطول'],['thickness','اكتب السماكة'],
      ['totalKg','اكتب الكمية بالكيلو'],['priceKg','اكتب سعر الكيلو']
    ];
    const missing=required.filter(([id])=>{
      const el=document.getElementById(id);
      return id==='orderCustomer' ? !isRealCustomer(el?.value) : number(el?.value)<=0;
    });
    if(missing.length){
      e.preventDefault();e.stopImmediatePropagation();
      missing.forEach(([id])=>document.getElementById(id)?.classList.add('jms-field-error'));
      alert('لا يمكن حفظ الطلب:\n- '+missing.map(x=>x[1]).join('\n- '));
      return;
    }
    if(f.dataset.submitting==='1'){e.preventDefault();e.stopImmediatePropagation();return;}
    f.dataset.submitting='1';
    setTimeout(()=>{f.dataset.submitting='0'},1200);
  }

  function wrap(name,guard){
    const old=window[name];
    if(typeof old!=='function'||old.__jmsStable) return;
    const fn=function(){
      const result=guard.apply(this,arguments);
      if(result===false) return;
      return old.apply(this,arguments);
    };
    fn.__jmsStable=true;window[name]=fn;
  }

  function installGuards(){
    wrap('approveQuote',qid=>{
      const q=window.db?.quotes?.find(x=>x.id===qid);
      if(!validQuote(q)){alert(invalidMessage);return false;}
    });
    wrap('sendQuote',qid=>{
      const q=window.db?.quotes?.find(x=>x.id===qid);
      if(!validQuote(q)){alert(invalidMessage);return false;}
    });
    wrap('convertQuoteToOrder',qid=>{
      const q=window.db?.quotes?.find(x=>x.id===qid);
      if(!validQuote(q)){alert(invalidMessage);return false;}
      if(q.converted_to_order || (window.db?.orders||[]).some(o=>o.quote_id===qid||o.source_quote_id===qid)){
        alert('تم تحويل هذا العرض مسبقًا، ولن يتم إنشاء طلب مكرر.');return false;
      }
    });
    wrap('jms11aQuoteToProduction',qid=>{
      const q=window.db?.quotes?.find(x=>x.id===qid);
      if(!validQuote(q)){alert(invalidMessage);return false;}
    });
    wrap('jms11aApproveOrder',oid=>{
      const o=window.db?.orders?.find(x=>x.id===oid);
      if(!validOrder(o)){alert(invalidMessage);return false;}
    });
    wrap('jms11aMarkPaid',oid=>{
      const o=window.db?.orders?.find(x=>x.id===oid);
      if(!validOrder(o)){alert(invalidMessage);return false;}
      const p=(window.db?.productionOrders||[]).find(x=>x.order_id===oid);
      if(!p || !['approved_manager','payment_received'].includes(p.stage)){
        alert('اعتمد المدير الطلب أولًا قبل تسجيل التحويل.');return false;
      }
    });
    wrap('jms11aSendOrderToProduction',oid=>{
      const o=window.db?.orders?.find(x=>x.id===oid);
      if(!validOrder(o)){alert(invalidMessage);return false;}
      const p=(window.db?.productionOrders||[]).find(x=>x.order_id===oid);
      if(!p || !['payment_received','sent_to_production'].includes(p.stage)){
        alert('سجّل تحويل العميل أولًا قبل إرسال الطلب للإنتاج.');return false;
      }
    });
    wrap('saveCustomer',()=>{
      const name=text(document.getElementById('mcName')?.value);
      if(!name || ['الاسم','اسم العميل'].includes(name)){alert('اكتب اسم العميل الصحيح');return false;}
    });
  }

  document.addEventListener('submit',validateOrderForm,true);
  const observer=new MutationObserver(()=>{cleanupUi();installGuards()});
  document.addEventListener('DOMContentLoaded',()=>{
    installGuards();cleanupUi();
    observer.observe(document.body,{childList:true,subtree:true});
  });
  setTimeout(()=>{installGuards();cleanupUi()},800);
  window.JMS_STABILITY_FIXES_VERSION=VERSION;
})();
