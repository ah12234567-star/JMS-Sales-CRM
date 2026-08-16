/* Ready Goods Notice PDF layout fix - production */
(function(){
  'use strict';

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Number(v)||0);
  const fmt=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const bank=()=>{ try{return JSON.parse(localStorage.getItem('jms_company_bank_v1')||'{}')}catch(_){return {}} };
  const getNotice=id=>(window.db?.readyGoodsNotices||[]).find(x=>x.id===id);

  function noticeHtml(n){
    const b=bank();
    const bankReady=b.bank_name||b.iban||b.account_name||b.account_number;
    const rows=(n.items||[]).map((it,i)=>`<tr>
      <td>${i+1}</td><td>${esc(it.type)}</td><td>${esc(it.description||'-')}</td><td>${esc(it.size||'-')}</td>
      <td>${fmt(it.qty)}</td><td>${esc(it.unit||'')}</td><td>${fmt(it.unit_price)}</td><td>${fmt(it.line_total)}</td>
    </tr>`).join('');
    return `<div class="rgn-pdf-doc" dir="rtl">
      <header class="rgn-pdf-head">
        <div class="rgn-pdf-brand"><div class="rgn-pdf-logo">JMS</div><div><h1>إشعار قيمة البضاعة الجاهزة</h1><p>شركة جدة النموذجية للصناعة</p></div></div>
        <div class="rgn-pdf-meta"><b>${esc(n.number)}</b><span>${esc(n.date||'')}</span><span>المندوب: ${esc(n.rep_name||'-')}</span></div>
      </header>
      <section class="rgn-pdf-customer"><div><span>العميل</span><b>${esc(n.customer_name||'-')}</b></div>${n.customer_phone?`<div><span>الجوال</span><b>${esc(n.customer_phone)}</b></div>`:''}</section>
      <table class="rgn-pdf-table"><thead><tr><th>#</th><th>الصنف</th><th>الوصف</th><th>المقاس</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="rgn-pdf-summary">
        <div><span>إجمالي قيمة الأصناف شامل الضريبة</span><b>${fmt(n.total)} ريال</b></div>
        <div><span>المدفوع سابقًا</span><b>${fmt(n.paid)} ريال</b></div>
        <div class="due"><span>المبلغ المتبقي</span><b>${fmt(n.remaining)} ريال</b></div>
      </section>
      <section class="rgn-pdf-bank"><h3>بيانات التحويل البنكي</h3>${bankReady?`<div class="rgn-pdf-bank-grid">${b.bank_name?`<p><span>البنك</span><b>${esc(b.bank_name)}</b></p>`:''}${b.account_name?`<p><span>اسم الحساب</span><b>${esc(b.account_name)}</b></p>`:''}${b.iban?`<p class="wide"><span>IBAN</span><b dir="ltr">${esc(b.iban)}</b></p>`:''}${b.account_number?`<p><span>رقم الحساب</span><b dir="ltr">${esc(b.account_number)}</b></p>`:''}</div>`:'<p class="rgn-pdf-bank-empty">بيانات الحساب البنكي غير مضافة بعد في إعدادات الشركة.</p>'}</section>
      <footer class="rgn-pdf-note">يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة. هذا المستند إشعار بضاعة جاهزة وليس فاتورة ضريبية.</footer>
    </div>`;
  }

  function ensureCss(){
    if(document.getElementById('rgnPdfFixStyle'))return;
    const s=document.createElement('style');s.id='rgnPdfFixStyle';s.textContent=`
      .rgn-pdf-stage{position:fixed!important;top:0!important;left:0!important;right:auto!important;width:794px!important;height:auto!important;margin:0!important;padding:0!important;transform:none!important;direction:ltr!important;z-index:-2147483000!important;pointer-events:none!important;background:#fff!important;overflow:visible!important}
      .rgn-pdf-doc{width:794px!important;min-height:1123px!important;max-width:794px!important;box-sizing:border-box!important;background:#fff!important;color:#0f172a!important;padding:46px 48px 40px!important;margin:0!important;font-family:Cairo,Arial,sans-serif!important;direction:rtl!important;position:relative!important;transform:none!important}
      .rgn-pdf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:4px solid #1d4ed8;padding-bottom:20px;margin-bottom:22px}
      .rgn-pdf-brand{display:flex;align-items:center;gap:14px}.rgn-pdf-logo{width:58px;height:58px;border-radius:16px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:900;font-size:21px;letter-spacing:.5px}
      .rgn-pdf-head h1{margin:0 0 5px;font-size:25px;line-height:1.35}.rgn-pdf-head p{margin:0;color:#64748b;font-size:13px}.rgn-pdf-meta{display:flex;flex-direction:column;gap:4px;text-align:left;font-size:12px;color:#475569;min-width:150px}.rgn-pdf-meta b{font-size:15px;color:#0f172a}
      .rgn-pdf-customer{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}.rgn-pdf-customer>div{border:1px solid #dbe3ef;border-radius:12px;padding:12px 14px;background:#f8fafc}.rgn-pdf-customer span{display:block;font-size:11px;color:#64748b;font-weight:700;margin-bottom:3px}.rgn-pdf-customer b{font-size:14px}
      .rgn-pdf-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 22px}.rgn-pdf-table th,.rgn-pdf-table td{border:1px solid #cbd5e1;padding:9px 6px;text-align:center;font-size:10.5px;vertical-align:middle;word-break:break-word}.rgn-pdf-table th{background:#eff6ff;color:#1e3a8a;font-weight:900}.rgn-pdf-table th:nth-child(1){width:4%}.rgn-pdf-table th:nth-child(2){width:14%}.rgn-pdf-table th:nth-child(3){width:17%}.rgn-pdf-table th:nth-child(4){width:13%}.rgn-pdf-table th:nth-child(5){width:10%}.rgn-pdf-table th:nth-child(6){width:9%}.rgn-pdf-table th:nth-child(7){width:15%}.rgn-pdf-table th:nth-child(8){width:18%}
      .rgn-pdf-summary{width:360px;margin-right:auto;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;margin-bottom:22px}.rgn-pdf-summary>div{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:11px 13px;border-bottom:1px solid #e2e8f0;font-size:11.5px;background:#fff}.rgn-pdf-summary>div:last-child{border-bottom:0}.rgn-pdf-summary b{font-size:14px}.rgn-pdf-summary .due{background:#eff6ff;color:#1d4ed8}.rgn-pdf-summary .due b{font-size:17px}
      .rgn-pdf-bank{border:1px solid #dbe3ef;border-radius:14px;padding:14px 16px;background:#f8fafc;margin-top:6px}.rgn-pdf-bank h3{margin:0 0 10px;font-size:14px}.rgn-pdf-bank-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.rgn-pdf-bank-grid p{margin:0;font-size:10.5px}.rgn-pdf-bank-grid p.wide{grid-column:1/-1}.rgn-pdf-bank-grid span{display:block;color:#64748b;font-size:9.5px;margin-bottom:2px}.rgn-pdf-bank-grid b{font-size:11.5px}.rgn-pdf-bank-empty{margin:0;color:#64748b;font-size:11px}
      .rgn-pdf-note{margin-top:18px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-size:9.5px;line-height:1.8;text-align:center}
    `;document.head.appendChild(s);
  }

  async function makeBlob(n){
    if(typeof window.html2pdf!=='function')throw new Error('PDF engine unavailable');
    ensureCss();
    const stage=document.createElement('div');stage.className='rgn-pdf-stage';stage.innerHTML=noticeHtml(n);document.body.appendChild(stage);
    try{
      if(document.fonts?.ready)await document.fonts.ready;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const doc=stage.firstElementChild;
      const worker=window.html2pdf().set({
        margin:0,
        image:{type:'jpeg',quality:.98},
        html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,width:794,height:1123,windowWidth:794,windowHeight:1123,logging:false},
        jsPDF:{unit:'px',format:[794,1123],orientation:'portrait',hotfixes:['px_scaling'],compress:true}
      }).from(doc).toCanvas();
      await worker;
      const canvas=await worker.get('canvas');
      const img=canvas.toDataURL('image/jpeg',0.98);
      await worker.toPdf();
      const pdf=await worker.get('pdf');
      const originalPages=pdf.getNumberOfPages();
      pdf.addPage([794,1123],'portrait');
      pdf.setPage(originalPages+1);
      pdf.addImage(img,'JPEG',0,0,794,1123,undefined,'FAST');
      for(let p=originalPages;p>=1;p--)pdf.deletePage(p);
      return pdf.output('blob');
    } finally { stage.remove(); }
  }

  async function exportPdf(id){
    const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');
    try{const blob=await makeBlob(n);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${n.number}-${n.customer_name||'ready-goods'}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){console.error('Ready goods PDF export failed',e);alert('تعذر إنشاء ملف PDF. حاول مرة أخرى.');}
  }

  async function shareNotice(id){
    const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');
    const text=`عميلنا العزيز ${n.customer_name||''}\nنفيدكم بأن البضاعة الخاصة بكم جاهزة.\nإجمالي القيمة: ${fmt(n.total)} ريال\nالمدفوع: ${fmt(n.paid)} ريال\nالمتبقي: ${fmt(n.remaining)} ريال\nرقم الإشعار: ${n.number}`;
    try{
      const blob=await makeBlob(n);const file=new File([blob],`${n.number}.pdf`,{type:'application/pdf'});
      if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({title:'إشعار بضاعة جاهزة',text,files:[file]});return;}
    }catch(e){console.warn('Ready goods PDF share fallback',e)}
    const phone=String(n.customer_phone||'').replace(/\D/g,'').replace(/^0/,'966');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');
  }

  function install(){
    if(!window.JMSReadyGoods){setTimeout(install,250);return;}
    window.JMSReadyGoods.exportPdf=exportPdf;
    window.JMSReadyGoods.share=shareNotice;
    window.JMSReadyGoods.__pdfFix='20260816-production-3';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();
