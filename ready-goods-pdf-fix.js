/* Ready Goods Notice PDF renderer - production 7, reuses the exact quotation logo. */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Number(v)||0);
  const fmt=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const readJson=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(_){return {}}};
  const LOGO_CACHE='jms_official_quote_logo_v1';
  function dbRef(){try{return db}catch(_){return window.db||{}}}
  const getNotice=id=>(dbRef().readyGoodsNotices||[]).find(x=>x.id===id);
  function profile(){
    const d=dbRef(),local=readJson('jms_company_profile_v1');
    return {...(d.company||{}),...(d.companyProfile||{}),...(d.settings?.company||{}),...local,name:local.name||d.companyProfile?.name||d.company?.name||'شركة جدة النموذجية للصناعة'};
  }
  function bank(){const d=dbRef();return {...(d.companyBank||{}),...(d.settings?.bank||{}),...readJson('jms_company_bank_v1')}}
  function rememberLogo(src){
    if(!src||!/^data:image\/(jpeg|png);base64,/i.test(src))return '';
    window.JMS_COMPANY_DOCUMENT_LOGO=src;
    try{localStorage.setItem(LOGO_CACHE,src)}catch(_){}
    return src;
  }
  async function officialLogo(){
    const live=document.querySelector('.quote-a4-logo')?.src;
    if(live&&/^data:image\/(jpeg|png);base64,/i.test(live))return rememberLogo(live);
    if(window.JMS_COMPANY_DOCUMENT_LOGO)return window.JMS_COMPANY_DOCUMENT_LOGO;
    try{const cached=localStorage.getItem(LOGO_CACHE);if(cached)return cached}catch(_){}
    try{
      const text=await fetch('/app.js?logo-source=20260816',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('app source unavailable');return r.text()});
      const match=text.match(/const\s+JMS_LOGO_DATA\s*=\s*"([^"]+)"/);
      if(match?.[1])return rememberLogo(match[1]);
    }catch(error){console.warn('Could not resolve quotation logo',error)}
    return '';
  }
  function noticeHtml(n,logo){
    const c=profile(),b=bank();
    const rows=(n.items||[]).map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.type)}</td><td>${esc(it.description||'-')}</td><td>${esc(it.size||'-')}</td><td>${fmt(it.qty)}</td><td>${esc(it.unit||'')}</td><td>${fmt(it.unit_price)}</td><td>${fmt(it.line_total)}</td></tr>`).join('');
    const companyMeta=[c.commercial_registration||c.cr?`السجل التجاري: ${esc(c.commercial_registration||c.cr)}`:'',c.vat_number||c.vat?`الرقم الضريبي: ${esc(c.vat_number||c.vat)}`:'',c.address?esc(c.address):'',c.phone?`هاتف: ${esc(c.phone)}`:'',c.email?esc(c.email):''].filter(Boolean).join(' · ');
    const bankReady=b.bank_name||b.account_name||b.iban||b.account_number;
    const logoHtml=logo?`<img class="logo" src="${esc(logo)}" alt="شعار شركة جدة النموذجية للصناعة">`:'<div class="logoFallback">JM</div>';
    return `<main class="doc" dir="rtl">
      <header class="head">${logoHtml}<div class="company"><h1>${esc(c.name)}</h1><p>Jeddah Model Industrial Co. Ltd</p><p>${companyMeta||'عروض المنتجات البلاستيكية والتغليف'}</p></div><div class="title"><h2>إشعار بضاعة جاهزة</h2><b>${esc(n.number)}</b><span>${esc(n.date||'')}</span><span>المندوب: ${esc(n.rep_name||'-')}</span></div></header>
      <section class="grid"><div class="card"><span>العميل</span><b>${esc(n.customer_name||'-')}</b></div>${n.customer_phone?`<div class="card"><span>الجوال</span><b dir="ltr">${esc(n.customer_phone)}</b></div>`:'<div class="card"><span>الجوال</span><b>-</b></div>'}</section>
      <table><thead><tr><th>#</th><th>الصنف</th><th>الوصف</th><th>المقاس</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="summary"><div><span>إجمالي قيمة الأصناف شامل الضريبة</span><b>${fmt(n.total)} ريال</b></div><div><span>المدفوع سابقًا</span><b>${fmt(n.paid)} ريال</b></div><div class="final"><span>المبلغ المتبقي</span><b>${fmt(n.remaining)} ريال</b></div></section>
      <section class="bank"><div class="bankHead"><b>بيانات التحويل البنكي</b><span>Bank Transfer Details</span></div><div class="bankFields">${bankReady?`${b.bank_name?`<div><span>البنك</span><b>${esc(b.bank_name)}</b></div>`:''}${b.account_name?`<div><span>اسم الحساب</span><b>${esc(b.account_name)}</b></div>`:''}${b.iban?`<div class="wide"><span>IBAN</span><b dir="ltr">${esc(b.iban)}</b></div>`:''}${b.account_number?`<div><span>رقم الحساب</span><b dir="ltr">${esc(b.account_number)}</b></div>`:''}`:'<div class="wide empty">بيانات الحساب البنكي غير مضافة. يقوم مدير النظام بإضافتها من إعدادات إشعار البضاعة الجاهزة.</div>'}</div></section>
      <footer><span>يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة.</span><b>هذا المستند إشعار بضاعة جاهزة وليس فاتورة ضريبية.</b></footer>
    </main>`;
  }
  function css(){return `html,body{margin:0!important;padding:0!important;width:794px!important;height:1123px!important;background:#fff!important;overflow:hidden!important;direction:ltr!important}*{box-sizing:border-box}.doc{width:794px!important;height:1123px!important;padding:38px 44px 34px!important;background:#fff;color:#111827;font-family:Arial,Tahoma,sans-serif;direction:rtl}.head{display:grid;grid-template-columns:118px 1fr 180px;gap:18px;align-items:center;border-bottom:3px solid #111827;padding-bottom:18px}.logo{display:block;width:116px;height:94px;object-fit:contain;object-position:center;background:#fff}.logoFallback{display:grid;place-items:center;width:116px;height:94px;color:#c8102e;font:700 48px Georgia,serif;background:#fff}.company h1{margin:0 0 5px;font-size:24px}.company p{margin:2px 0;color:#64748b;font-size:10px;line-height:1.55}.title{text-align:left;display:flex;flex-direction:column;gap:3px}.title h2{margin:0 0 5px;color:#b91c1c;font-size:26px}.title b{font-size:14px}.title span{font-size:10px;color:#475569}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.card{border:1px solid #dbe2ea;background:#f8fafc;border-radius:12px;padding:12px 14px}.card span{display:block;color:#64748b;font-size:10px;margin-bottom:4px}.card b{font-size:14px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:18px}th{background:#111827;color:#fff;border:1px solid #111827;padding:8px 4px;font-size:9px}td{border:1px solid #cbd5e1;padding:8px 4px;text-align:center;font-size:9.5px;word-break:break-word}th:nth-child(1){width:4%}th:nth-child(2){width:14%}th:nth-child(3){width:17%}th:nth-child(4){width:13%}th:nth-child(5){width:10%}th:nth-child(6){width:9%}th:nth-child(7){width:15%}th:nth-child(8){width:18%}.summary{width:360px;margin-right:auto;margin-top:18px;border:1px solid #dbe2ea;border-radius:12px;overflow:hidden}.summary>div{display:flex;justify-content:space-between;gap:14px;padding:11px 13px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-size:11px}.summary>div:last-child{border-bottom:0}.summary b{font-size:13px}.summary .final{background:#111827;color:#fff;font-weight:900}.summary .final b{font-size:16px}.bank{display:grid;grid-template-columns:150px 1fr;margin-top:18px;border:1px solid #dbe2ea;border-radius:12px;overflow:hidden;background:#f8fafc}.bankHead{display:flex;flex-direction:column;justify-content:center;background:#111827;color:#fff;padding:12px}.bankHead b{font-size:12px}.bankHead span{font-size:9px;color:#cbd5e1;margin-top:3px}.bankFields{display:grid;grid-template-columns:1.2fr 1fr 1.2fr;gap:10px;padding:12px}.bankFields span{display:block;color:#64748b;font-size:8px}.bankFields b{display:block;margin-top:3px;font-size:10px}.bankFields .wide{grid-column:1/-1}.empty{color:#64748b;font-size:10px;align-self:center}footer{display:flex;justify-content:space-between;gap:14px;margin-top:18px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-size:9px;line-height:1.7}footer b{color:#475569}`}
  function loadScript(win,src){return new Promise((resolve,reject)=>{const s=win.document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;win.document.head.appendChild(s)})}
  async function makeBlob(n){
    const logo=await officialLogo();
    const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-2147483647;';document.body.appendChild(frame);
    try{const w=frame.contentWindow,d=frame.contentDocument;d.open();d.write(`<!doctype html><html dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1"><style>${css()}</style></head><body>${noticeHtml(n,logo)}</body></html>`);d.close();await loadScript(w,'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js');await new Promise(r=>setTimeout(r,180));const doc=d.querySelector('.doc');if(!doc||typeof w.html2pdf!=='function')throw new Error('PDF engine unavailable');return await w.html2pdf().set({margin:0,image:{type:'jpeg',quality:.99},html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,width:794,height:1123,windowWidth:794,windowHeight:1123,x:0,y:0,logging:false},jsPDF:{unit:'px',format:[794,1123],orientation:'portrait',hotfixes:['px_scaling'],compress:true}}).from(doc).outputPdf('blob')}finally{frame.remove()}}
  async function exportPdf(id){const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');try{const blob=await makeBlob(n),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${n.number}-${n.customer_name||'ready-goods'}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){console.error('Ready goods PDF export failed',e);alert('تعذر إنشاء ملف PDF. حاول مرة أخرى.')}}
  async function shareNotice(id){const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');const text=`عميلنا العزيز ${n.customer_name||''}\nنفيدكم بأن البضاعة الخاصة بكم جاهزة.\nإجمالي القيمة: ${fmt(n.total)} ريال\nالمدفوع: ${fmt(n.paid)} ريال\nالمتبقي: ${fmt(n.remaining)} ريال\nرقم الإشعار: ${n.number}`;try{const blob=await makeBlob(n),file=new File([blob],`${n.number}.pdf`,{type:'application/pdf'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({title:'إشعار بضاعة جاهزة',text,files:[file]});return}}catch(e){console.warn('Ready goods PDF share fallback',e)}const phone=String(n.customer_phone||'').replace(/\D/g,'').replace(/^0/,'966');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank')}
  function install(){if(!window.JMSReadyGoods){setTimeout(install,250);return}window.JMSReadyGoods.exportPdf=exportPdf;window.JMSReadyGoods.share=shareNotice;window.JMSReadyGoods.__pdfFix='20260816-production-7'}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();