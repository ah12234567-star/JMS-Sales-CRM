/* Ready Goods Notice PDF renderer - production 5 */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Number(v)||0);
  const fmt=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const bank=()=>{try{return JSON.parse(localStorage.getItem('jms_company_bank_v1')||'{}')}catch(_){return {}}};
  const getNotice=id=>(window.db?.readyGoodsNotices||[]).find(x=>x.id===id);

  function noticeHtml(n){
    const b=bank();
    const bankReady=b.bank_name||b.iban||b.account_name||b.account_number;
    const rows=(n.items||[]).map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.type)}</td><td>${esc(it.description||'-')}</td><td>${esc(it.size||'-')}</td><td>${fmt(it.qty)}</td><td>${esc(it.unit||'')}</td><td>${fmt(it.unit_price)}</td><td>${fmt(it.line_total)}</td></tr>`).join('');
    return `<main class="rgn-pdf-doc" dir="rtl">
      <header class="rgn-pdf-head"><div class="rgn-pdf-brand"><div class="rgn-pdf-logo">JMS</div><div><h1>إشعار قيمة البضاعة الجاهزة</h1><p>شركة جدة النموذجية للصناعة</p></div></div><div class="rgn-pdf-meta"><b>${esc(n.number)}</b><span>${esc(n.date||'')}</span><span>المندوب: ${esc(n.rep_name||'-')}</span></div></header>
      <section class="rgn-pdf-customer"><div><span>العميل</span><b>${esc(n.customer_name||'-')}</b></div>${n.customer_phone?`<div><span>الجوال</span><b>${esc(n.customer_phone)}</b></div>`:''}</section>
      <table class="rgn-pdf-table"><thead><tr><th>#</th><th>الصنف</th><th>الوصف</th><th>المقاس</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="rgn-pdf-summary"><div><span>إجمالي قيمة الأصناف شامل الضريبة</span><b>${fmt(n.total)} ريال</b></div><div><span>المدفوع سابقًا</span><b>${fmt(n.paid)} ريال</b></div><div class="due"><span>المبلغ المتبقي</span><b>${fmt(n.remaining)} ريال</b></div></section>
      <section class="rgn-pdf-bank"><h3>بيانات التحويل البنكي</h3>${bankReady?`<div class="rgn-pdf-bank-grid">${b.bank_name?`<p><span>البنك</span><b>${esc(b.bank_name)}</b></p>`:''}${b.account_name?`<p><span>اسم الحساب</span><b>${esc(b.account_name)}</b></p>`:''}${b.iban?`<p class="wide"><span>IBAN</span><b dir="ltr">${esc(b.iban)}</b></p>`:''}${b.account_number?`<p><span>رقم الحساب</span><b dir="ltr">${esc(b.account_number)}</b></p>`:''}</div>`:'<p class="rgn-pdf-bank-empty">بيانات الحساب البنكي غير مضافة بعد في إعدادات الشركة.</p>'}</section>
      <footer class="rgn-pdf-note">يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة. هذا المستند إشعار بضاعة جاهزة وليس فاتورة ضريبية.</footer>
    </main>`;
  }

  function css(){return `
    html,body{margin:0!important;padding:0!important;width:794px!important;height:1123px!important;background:#fff!important;overflow:hidden!important;direction:ltr!important}
    *{box-sizing:border-box}
    .rgn-pdf-doc{width:794px!important;height:1123px!important;background:#fff!important;color:#0f172a!important;padding:42px 44px 36px!important;margin:0!important;font-family:Arial,Tahoma,sans-serif!important;direction:rtl!important;position:relative!important;left:0!important;right:auto!important;transform:none!important}
    .rgn-pdf-head{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;gap:22px!important;border-bottom:4px solid #1d4ed8!important;padding-bottom:18px!important;margin-bottom:20px!important;width:100%!important}
    .rgn-pdf-brand{display:flex!important;align-items:center!important;gap:14px!important}.rgn-pdf-logo{width:58px!important;height:58px!important;border-radius:14px!important;background:#111827!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;font-weight:900!important;font-size:21px!important}
    .rgn-pdf-head h1{margin:0 0 5px!important;font-size:24px!important;line-height:1.35!important}.rgn-pdf-head p{margin:0!important;color:#64748b!important;font-size:13px!important}.rgn-pdf-meta{display:flex!important;flex-direction:column!important;gap:4px!important;text-align:left!important;font-size:12px!important;color:#475569!important;min-width:155px!important}.rgn-pdf-meta b{font-size:15px!important;color:#0f172a!important}
    .rgn-pdf-customer{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;margin-bottom:18px!important;width:100%!important}.rgn-pdf-customer>div{border:1px solid #dbe3ef!important;border-radius:12px!important;padding:12px 14px!important;background:#f8fafc!important}.rgn-pdf-customer span{display:block!important;font-size:11px!important;color:#64748b!important;font-weight:700!important;margin-bottom:3px!important}.rgn-pdf-customer b{font-size:14px!important}
    .rgn-pdf-table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;margin:0 0 20px!important}.rgn-pdf-table th,.rgn-pdf-table td{border:1px solid #cbd5e1!important;padding:8px 5px!important;text-align:center!important;font-size:10.5px!important;vertical-align:middle!important;word-break:break-word!important}.rgn-pdf-table th{background:#eff6ff!important;color:#1e3a8a!important;font-weight:900!important}.rgn-pdf-table th:nth-child(1){width:4%!important}.rgn-pdf-table th:nth-child(2){width:14%!important}.rgn-pdf-table th:nth-child(3){width:17%!important}.rgn-pdf-table th:nth-child(4){width:13%!important}.rgn-pdf-table th:nth-child(5){width:10%!important}.rgn-pdf-table th:nth-child(6){width:9%!important}.rgn-pdf-table th:nth-child(7){width:15%!important}.rgn-pdf-table th:nth-child(8){width:18%!important}
    .rgn-pdf-summary{width:360px!important;margin-right:auto!important;border:1px solid #dbe3ef!important;border-radius:14px!important;overflow:hidden!important;margin-bottom:20px!important}.rgn-pdf-summary>div{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:16px!important;padding:11px 13px!important;border-bottom:1px solid #e2e8f0!important;font-size:11.5px!important;background:#fff!important}.rgn-pdf-summary>div:last-child{border-bottom:0!important}.rgn-pdf-summary b{font-size:14px!important}.rgn-pdf-summary .due{background:#eff6ff!important;color:#1d4ed8!important}.rgn-pdf-summary .due b{font-size:17px!important}
    .rgn-pdf-bank{border:1px solid #dbe3ef!important;border-radius:14px!important;padding:14px 16px!important;background:#f8fafc!important;margin-top:6px!important;width:100%!important}.rgn-pdf-bank h3{margin:0 0 10px!important;font-size:14px!important}.rgn-pdf-bank-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px 16px!important}.rgn-pdf-bank-grid p{margin:0!important;font-size:10.5px!important}.rgn-pdf-bank-grid p.wide{grid-column:1/-1!important}.rgn-pdf-bank-grid span{display:block!important;color:#64748b!important;font-size:9.5px!important;margin-bottom:2px!important}.rgn-pdf-bank-grid b{font-size:11.5px!important}.rgn-pdf-bank-empty{margin:0!important;color:#64748b!important;font-size:11px!important}
    .rgn-pdf-note{margin-top:16px!important;padding-top:12px!important;border-top:1px solid #e2e8f0!important;color:#64748b!important;font-size:9.5px!important;line-height:1.8!important;text-align:center!important;width:100%!important}
  `}

  function loadScript(win,src){return new Promise((resolve,reject)=>{const s=win.document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;win.document.head.appendChild(s)})}

  async function makeBlob(n){
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-2147483647;';
    document.body.appendChild(frame);
    try{
      const w=frame.contentWindow,d=frame.contentDocument;
      d.open();d.write(`<!doctype html><html dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1"><style>${css()}</style></head><body>${noticeHtml(n)}</body></html>`);d.close();
      await loadScript(w,'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js');
      await new Promise(r=>setTimeout(r,80));
      const doc=d.querySelector('.rgn-pdf-doc');
      if(!doc||typeof w.html2pdf!=='function')throw new Error('PDF engine unavailable');
      const blob=await w.html2pdf().set({margin:0,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,width:794,height:1123,windowWidth:794,windowHeight:1123,x:0,y:0,logging:false},jsPDF:{unit:'px',format:[794,1123],orientation:'portrait',hotfixes:['px_scaling'],compress:true}}).from(doc).outputPdf('blob');
      return blob;
    } finally {frame.remove()}
  }

  async function exportPdf(id){const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');try{const blob=await makeBlob(n),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${n.number}-${n.customer_name||'ready-goods'}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){console.error('Ready goods PDF export failed',e);alert('تعذر إنشاء ملف PDF. حاول مرة أخرى.')}}
  async function shareNotice(id){const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');const text=`عميلنا العزيز ${n.customer_name||''}\nنفيدكم بأن البضاعة الخاصة بكم جاهزة.\nإجمالي القيمة: ${fmt(n.total)} ريال\nالمدفوع: ${fmt(n.paid)} ريال\nالمتبقي: ${fmt(n.remaining)} ريال\nرقم الإشعار: ${n.number}`;try{const blob=await makeBlob(n),file=new File([blob],`${n.number}.pdf`,{type:'application/pdf'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({title:'إشعار بضاعة جاهزة',text,files:[file]});return}}catch(e){console.warn('Ready goods PDF share fallback',e)}const phone=String(n.customer_phone||'').replace(/\D/g,'').replace(/^0/,'966');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank')}

  function install(){if(!window.JMSReadyGoods){setTimeout(install,250);return}window.JMSReadyGoods.exportPdf=exportPdf;window.JMSReadyGoods.share=shareNotice;window.JMSReadyGoods.__pdfFix='20260816-production-5'}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();