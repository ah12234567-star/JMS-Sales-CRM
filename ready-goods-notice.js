/* JMS Ready Goods Notice — standalone trial module, isolated for easy rollback. */
(function(){
  'use strict';
  const PAGE_ID='readyGoodsNotice';
  const NAV_ID='readyGoodsNoticeNav';
  const STYLE_ID='readyGoodsNoticeStyle';
  const BANK_STORE='jms_company_bank_v1';
  let draftItems=[];

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Number(v)||0);
  const fmt=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const isRep=()=>window.currentUser?.role==='rep';
  const notices=()=>{ db.readyGoodsNotices=db.readyGoodsNotices||[]; return db.readyGoodsNotices; };
  const mine=()=>notices().filter(n=>!isRep()||n.rep_id===window.currentUser?.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const bank=()=>{ try{return JSON.parse(localStorage.getItem(BANK_STORE)||'{}')}catch(_){return {}} };
  const makeNo=()=>`RGN-${new Date().getFullYear()}-${String(notices().length+1).padStart(4,'0')}`;

  function css(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style'); s.id=STYLE_ID; s.textContent=`
      #${NAV_ID}{width:100%;border:0;background:transparent;color:inherit;text-align:right;padding:12px 14px;border-radius:12px;font:inherit;font-weight:800;cursor:pointer}
      #${NAV_ID}:hover,#${NAV_ID}.active{background:rgba(37,99,235,.12);color:#2563eb}
      .rgn-hero{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:18px;border-radius:20px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;margin-bottom:16px}
      .rgn-hero h2{margin:0 0 5px}.rgn-hero p{margin:0;color:#dbeafe}.rgn-badge{padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.13);font-size:12px;font-weight:900;white-space:nowrap}
      .rgn-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rgn-card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(15,23,42,.05)}
      .rgn-card h3{margin:0 0 12px}.rgn-field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.rgn-field span{font-size:12px;font-weight:800;color:#475569}
      .rgn-field input,.rgn-field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font-family:inherit;background:#fff}
      .rgn-items{display:grid;gap:10px}.rgn-item{border:1px solid #e2e8f0;background:#f8fafc;border-radius:15px;padding:12px}.rgn-item-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr .8fr .8fr 1fr auto;gap:8px;align-items:end}
      .rgn-item-grid .rgn-field{margin:0}.rgn-remove{height:42px;border:0;border-radius:11px;background:#fee2e2;color:#b91c1c;font-weight:900;padding:0 12px}
      .rgn-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.rgn-kpi{padding:14px;border-radius:15px;background:#f8fafc;border:1px solid #e2e8f0}.rgn-kpi span{display:block;font-size:12px;color:#64748b;font-weight:800}.rgn-kpi b{display:block;font-size:20px;margin-top:4px}.rgn-kpi.remaining{background:#eff6ff;border-color:#bfdbfe}.rgn-kpi.remaining b{color:#1d4ed8}
      .rgn-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.rgn-actions button{border:0;border-radius:12px;padding:11px 15px;font-family:inherit;font-weight:900;cursor:pointer}.rgn-primary{background:#2563eb;color:#fff}.rgn-secondary{background:#e2e8f0;color:#0f172a}.rgn-whatsapp{background:#16a34a;color:#fff}
      .rgn-list{display:grid;gap:10px}.rgn-row{display:grid;grid-template-columns:1.4fr .8fr .8fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:14px;padding:12px}.rgn-row small{color:#64748b}.rgn-empty{padding:24px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:14px}
      .rgn-print{direction:rtl;font-family:Cairo,Arial,sans-serif;color:#0f172a;background:#fff;padding:26px;width:760px;box-sizing:border-box}.rgn-print-head{display:flex;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:18px}.rgn-print-title h1{font-size:23px;margin:0}.rgn-print-title p{margin:4px 0 0;color:#64748b}.rgn-print-meta{text-align:left;font-size:12px}.rgn-print table{width:100%;border-collapse:collapse;margin:18px 0}.rgn-print th,.rgn-print td{border:1px solid #cbd5e1;padding:9px;text-align:center;font-size:12px}.rgn-print th{background:#f1f5f9}.rgn-print-total{margin-right:auto;width:340px}.rgn-print-total div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0}.rgn-print-total .due{font-size:17px;font-weight:900;color:#1d4ed8}.rgn-bank{margin-top:18px;padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px}.rgn-note{margin-top:18px;font-size:11px;color:#64748b}
      @media(max-width:920px){.rgn-grid{grid-template-columns:1fr}.rgn-item-grid{grid-template-columns:1fr 1fr}.rgn-summary{grid-template-columns:1fr}.rgn-row{grid-template-columns:1fr 1fr}.rgn-hero{align-items:flex-start;flex-direction:column}.rgn-actions button{flex:1;min-width:140px}}
    `; document.head.appendChild(s);
  }

  function customers(){
    try{return typeof allowedCustomers==='function'?allowedCustomers():((db&&db.customers)||[])}catch(_){return []}
  }
  function options(selected=''){
    return `<option value="">اختر العميل</option>`+customers().map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}${c.phone?` — ${esc(c.phone)}`:''}</option>`).join('');
  }
  function newItem(type='أكياس بلاستيك'){
    return {id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),type,description:'',size:'',qty:1,unit:type==='كليشة'?'قطعة':'كجم',unit_price:0};
  }
  function itemTotal(it){return num(it.qty)*num(it.unit_price)}
  function total(){return draftItems.reduce((s,it)=>s+itemTotal(it),0)}

  function pageHtml(){return `
    <div class="rgn-hero"><div><h2>إشعار بضاعة جاهزة</h2><p>إشعار مستقل للبضاعة الجاهزة والكليشة — غير مرتبط بأوامر التصنيع</p></div><div class="rgn-badge">نسخة تجريبية قابلة للإلغاء</div></div>
    <div class="rgn-grid">
      <div class="rgn-card">
        <h3>إنشاء إشعار جديد</h3>
        <div class="rgn-field"><span>العميل</span><select id="rgnCustomer">${options()}</select></div>
        <div class="rgn-items" id="rgnItems"></div>
        <button type="button" class="rgn-secondary" onclick="JMSReadyGoods.addItem()">+ إضافة صنف</button>
        <div class="rgn-summary">
          <div class="rgn-kpi"><span>إجمالي قيمة الأصناف شامل الضريبة</span><b id="rgnTotal">0.00 ريال</b></div>
          <div class="rgn-kpi"><span>المدفوع سابقًا</span><input id="rgnPaid" type="number" min="0" step="0.01" value="0" oninput="JMSReadyGoods.recalc()" style="width:100%;margin-top:7px"></div>
          <div class="rgn-kpi remaining"><span>المبلغ المتبقي</span><b id="rgnRemaining">0.00 ريال</b></div>
        </div>
        <div class="rgn-actions"><button class="rgn-primary" onclick="JMSReadyGoods.save()">حفظ الإشعار</button><button class="rgn-secondary" onclick="JMSReadyGoods.reset()">تفريغ</button></div>
      </div>
      <div class="rgn-card"><h3>الإشعارات السابقة</h3><div id="rgnList" class="rgn-list"></div></div>
    </div>`}

  function ensure(){
    css();
    const main=document.querySelector('.main'); const nav=document.querySelector('.sidebar nav');
    if(main&&!document.getElementById(PAGE_ID)){const sec=document.createElement('section');sec.id=PAGE_ID;sec.className='page';sec.innerHTML=pageHtml();main.appendChild(sec)}
    if(nav&&!document.getElementById(NAV_ID)){
      const b=document.createElement('button');b.id=NAV_ID;b.type='button';b.textContent='إشعار بضاعة جاهزة';b.style.display=isRep()?'block':'none';
      const q=nav.querySelector('[data-page="quotes"]'); if(q)q.insertAdjacentElement('afterend',b); else nav.appendChild(b);
      b.addEventListener('click',openPage);
    }
    const b=document.getElementById(NAV_ID); if(b)b.style.display=isRep()?'block':'none';
    if(document.getElementById(PAGE_ID)&&!draftItems.length){draftItems=[newItem()];renderItems();renderList();recalc()}
  }
  function openPage(){
    document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('#'+NAV_ID).forEach(x=>x.classList.add('active'));
    document.getElementById(PAGE_ID)?.classList.add('active');
    const select=document.getElementById('rgnCustomer'); if(select)select.innerHTML=options(select.value);
    renderList(); renderItems(); recalc();
    const main=document.querySelector('.main'); if(main)main.scrollTop=0; window.scrollTo(0,0);
  }
  function renderItems(){
    const root=document.getElementById('rgnItems'); if(!root)return;
    root.innerHTML=draftItems.map((it,i)=>`<div class="rgn-item"><div class="rgn-item-grid">
      <div class="rgn-field"><span>الصنف</span><select onchange="JMSReadyGoods.patch('${it.id}','type',this.value)"><option ${it.type==='أكياس بلاستيك'?'selected':''}>أكياس بلاستيك</option><option ${it.type==='رول بلاستيك'?'selected':''}>رول بلاستيك</option><option ${it.type==='كليشة'?'selected':''}>كليشة</option><option ${it.type==='أخرى'?'selected':''}>أخرى</option></select></div>
      <div class="rgn-field"><span>الوصف</span><input value="${esc(it.description)}" placeholder="مثال: كيس تي شيرت" oninput="JMSReadyGoods.patch('${it.id}','description',this.value)"></div>
      <div class="rgn-field"><span>المقاس</span><input value="${esc(it.size)}" placeholder="مثال: 32 × 40 سم" oninput="JMSReadyGoods.patch('${it.id}','size',this.value)"></div>
      <div class="rgn-field"><span>الكمية</span><input type="number" min="0" step="0.01" value="${it.qty}" oninput="JMSReadyGoods.patch('${it.id}','qty',this.value)"></div>
      <div class="rgn-field"><span>الوحدة</span><select onchange="JMSReadyGoods.patch('${it.id}','unit',this.value)">${['كجم','حبة','رول','قطعة'].map(u=>`<option ${it.unit===u?'selected':''}>${u}</option>`).join('')}</select></div>
      <div class="rgn-field"><span>سعر الوحدة شامل الضريبة</span><input type="number" min="0" step="0.01" value="${it.unit_price}" oninput="JMSReadyGoods.patch('${it.id}','unit_price',this.value)"></div>
      <button class="rgn-remove" type="button" onclick="JMSReadyGoods.removeItem('${it.id}')">حذف</button>
    </div><div style="margin-top:8px;font-size:12px;color:#64748b">إجمالي الصنف: <b>${fmt(itemTotal(it))} ريال</b></div></div>`).join('');
  }
  function recalc(){
    const t=total(),p=num(document.getElementById('rgnPaid')?.value),r=Math.max(0,t-p);
    const a=document.getElementById('rgnTotal'),b=document.getElementById('rgnRemaining'); if(a)a.textContent=fmt(t)+' ريال'; if(b)b.textContent=fmt(r)+' ريال';
    return {total:t,paid:p,remaining:r};
  }
  function patch(itemId,key,value){const it=draftItems.find(x=>x.id===itemId);if(!it)return;it[key]=['qty','unit_price'].includes(key)?num(value):value;if(key==='type'&&value==='كليشة'&&it.unit==='كجم')it.unit='قطعة';renderItems();recalc()}
  function addItem(type){draftItems.push(newItem(type||'أكياس بلاستيك'));renderItems();recalc()}
  function removeItem(itemId){if(draftItems.length===1)return alert('يجب وجود صنف واحد على الأقل');draftItems=draftItems.filter(x=>x.id!==itemId);renderItems();recalc()}
  function reset(){draftItems=[newItem()];const c=document.getElementById('rgnCustomer');if(c)c.value='';const p=document.getElementById('rgnPaid');if(p)p.value='0';renderItems();recalc()}

  function saveNotice(){
    const customerId=document.getElementById('rgnCustomer')?.value; const customer=customers().find(c=>c.id===customerId); const sums=recalc();
    if(!customer)return alert('اختر العميل أولًا');
    if(!draftItems.length||draftItems.some(x=>!x.type||num(x.qty)<=0))return alert('راجع الأصناف والكميات');
    if(sums.paid>sums.total)return alert('المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي قيمة البضاعة');
    const n={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),number:makeNo(),created_at:new Date().toISOString(),date:new Date().toLocaleDateString('ar-SA'),customer_id:customer.id,customer_name:customer.name,customer_phone:customer.phone||'',rep_id:window.currentUser?.id,rep_name:window.currentUser?.name||'',items:draftItems.map(x=>({...x,line_total:itemTotal(x)})),total:sums.total,paid:sums.paid,remaining:sums.remaining,status:'draft'};
    notices().push(n); save(); renderList(); reset(); alert('تم حفظ إشعار '+n.number); return n;
  }
  function renderList(){
    const root=document.getElementById('rgnList'); if(!root)return; const list=mine();
    if(!list.length){root.innerHTML='<div class="rgn-empty">لا توجد إشعارات حتى الآن</div>';return}
    root.innerHTML=list.slice(0,30).map(n=>`<div class="rgn-row"><div><b>${esc(n.customer_name)}</b><br><small>${esc(n.number)} • ${esc(n.date||'')}</small></div><div><small>الإجمالي</small><br><b>${fmt(n.total)} ريال</b></div><div><small>المتبقي</small><br><b>${fmt(n.remaining)} ريال</b></div><div class="rgn-actions" style="margin:0"><button class="rgn-secondary" onclick="JMSReadyGoods.exportPdf('${n.id}')">PDF</button><button class="rgn-whatsapp" onclick="JMSReadyGoods.share('${n.id}')">واتساب</button></div></div>`).join('');
  }
  function getNotice(noticeId){return notices().find(x=>x.id===noticeId)}
  function printHtml(n){
    const b=bank(); const bankReady=b.bank_name||b.iban||b.account_name;
    return `<div class="rgn-print" id="rgnPrint"><div class="rgn-print-head"><div class="rgn-print-title"><h1>إشعار قيمة البضاعة الجاهزة</h1><p>شركة جدة النموذجية للصناعة</p></div><div class="rgn-print-meta"><b>${esc(n.number)}</b><br>${esc(n.date)}<br>المندوب: ${esc(n.rep_name)}</div></div>
      <div><b>العميل:</b> ${esc(n.customer_name)}${n.customer_phone?` &nbsp; | &nbsp; <b>الجوال:</b> ${esc(n.customer_phone)}`:''}</div>
      <table><thead><tr><th>#</th><th>الصنف</th><th>الوصف</th><th>المقاس</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${n.items.map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.type)}</td><td>${esc(it.description||'-')}</td><td>${esc(it.size||'-')}</td><td>${fmt(it.qty)}</td><td>${esc(it.unit)}</td><td>${fmt(it.unit_price)}</td><td>${fmt(it.line_total)}</td></tr>`).join('')}</tbody></table>
      <div class="rgn-print-total"><div><span>إجمالي قيمة البضاعة شامل الضريبة</span><b>${fmt(n.total)} ريال</b></div><div><span>المدفوع سابقًا</span><b>${fmt(n.paid)} ريال</b></div><div class="due"><span>المبلغ المتبقي</span><b>${fmt(n.remaining)} ريال</b></div></div>
      <div class="rgn-bank"><b>بيانات التحويل البنكي</b><br>${bankReady?`${b.bank_name?`البنك: ${esc(b.bank_name)}<br>`:''}${b.account_name?`اسم الحساب: ${esc(b.account_name)}<br>`:''}${b.iban?`IBAN: ${esc(b.iban)}<br>`:''}${b.account_number?`رقم الحساب: ${esc(b.account_number)}`:''}`:'سيتم إضافة بيانات الحساب البنكي من إعدادات الشركة بعد اعتماد شكل الإشعار.'}</div>
      <div class="rgn-note">يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة. هذا المستند إشعار بضاعة جاهزة وليس فاتورة ضريبية.</div></div>`;
  }
  async function pdfBlob(n){
    if(typeof html2pdf!=='function')throw new Error('PDF engine unavailable'); const wrap=document.createElement('div');wrap.style.position='fixed';wrap.style.left='-10000px';wrap.style.top='0';wrap.innerHTML=printHtml(n);document.body.appendChild(wrap);
    try{return await html2pdf().set({margin:0.2,filename:`${n.number}.pdf`,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'in',format:'a4',orientation:'portrait'}}).from(wrap.firstElementChild).outputPdf('blob')}finally{wrap.remove()}
  }
  async function exportPdf(noticeId){const n=getNotice(noticeId);if(!n)return;const blob=await pdfBlob(n);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${n.number}-${n.customer_name}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
  async function shareNotice(noticeId){
    const n=getNotice(noticeId);if(!n)return; const text=`عميلنا العزيز ${n.customer_name}\nنفيدكم بأن البضاعة الخاصة بكم جاهزة.\nإجمالي القيمة: ${fmt(n.total)} ريال\nالمدفوع: ${fmt(n.paid)} ريال\nالمتبقي: ${fmt(n.remaining)} ريال\nرقم الإشعار: ${n.number}`;
    try{const blob=await pdfBlob(n);const file=new File([blob],`${n.number}.pdf`,{type:'application/pdf'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({title:'إشعار بضاعة جاهزة',text,files:[file]});return}}catch(e){console.warn('Ready goods native share fallback',e)}
    const phone=String(n.customer_phone||'').replace(/\D/g,'').replace(/^0/,'966'); window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');
  }

  window.JMSReadyGoods={ensure,open:openPage,addItem,removeItem,patch,recalc,reset,save:saveNotice,exportPdf,share:shareNotice,renderList};
  function boot(){ensure();setTimeout(ensure,800);setTimeout(ensure,2500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  document.addEventListener('click',()=>setTimeout(()=>{const b=document.getElementById(NAV_ID);if(b)b.style.display=isRep()?'block':'none'},60),true);
})();
