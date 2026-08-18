/* Ready Goods Notice PDF renderer — branded production-ready layout. */
(function(){
  'use strict';
  const VAT_RATE=0.15;
  const BRAND='#73152b',BRAND_DARK='#54101f',INK='#172033',MUTED='#667085';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Number(v)||0);
  const round2=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
  const fmt=v=>round2(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const readJson=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(_){return {}}};
  const LOGO_CACHE='jms_official_quote_logo_v1';
  function dbRef(){try{return db}catch(_){return window.db||{}}}
  const getNotice=id=>(dbRef().readyGoodsNotices||[]).find(x=>String(x.id)===String(id));
  function profile(){
    const d=dbRef(),local=readJson('jms_company_profile_v1');
    const cloud={...(d.company||{}),...(d.settings?.company||{}),...(d.companyProfile||{})};
    return {...local,...cloud,name:cloud.name||local.name||'شركة جدة النموذجية للصناعة'};
  }
  function bank(){
    const d=dbRef(),local=readJson('jms_company_bank_v1');
    return {...local,...(d.settings?.bank||{}),...(d.companyBank||{})};
  }
  function rememberLogo(src){if(!src||!/^data:image\/(jpeg|png);base64,/i.test(src))return '';window.JMS_COMPANY_DOCUMENT_LOGO=src;try{localStorage.setItem(LOGO_CACHE,src)}catch(_){}return src}
  async function officialLogo(){
    const live=document.querySelector('.quote-a4-logo')?.src;
    if(live&&/^data:image\/(jpeg|png);base64,/i.test(live))return rememberLogo(live);
    if(window.JMS_COMPANY_DOCUMENT_LOGO)return window.JMS_COMPANY_DOCUMENT_LOGO;
    try{const cached=localStorage.getItem(LOGO_CACHE);if(cached)return cached}catch(_){}
    try{
      const text=await fetch('/app.js?logo-source=20260818',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('app source unavailable');return r.text()});
      const match=text.match(/const\s+JMS_LOGO_DATA\s*=\s*"([^"]+)"/);if(match?.[1])return rememberLogo(match[1]);
    }catch(error){console.warn('Could not resolve quotation logo',error)}
    return '';
  }
  function financials(n){
    if(n.pricing_mode==='net_plus_vat'||n.subtotal!==undefined){
      const subtotal=num(n.subtotal),vat=n.vat_amount!==undefined?num(n.vat_amount):round2(subtotal*VAT_RATE),total=n.total!==undefined?num(n.total):round2(subtotal+vat);
      return {subtotal,vat,total,rate:Number(n.vat_rate??VAT_RATE)};
    }
    return {subtotal:num(n.total),vat:0,total:num(n.total),rate:0};
  }
  function packagingLabel(it,n){
    const direct=it?.packaging_label||it?.packaging||it?.package_label||it?.packing||'';
    if(direct)return String(direct);
    const count=it?.package_count??it?.packages_count??it?.packages??it?.cartons??it?.bundles??it?.packs;
    const unit=it?.package_unit||it?.packaging_unit||(it?.cartons!=null?'كرتون':it?.bundles!=null?'شدة':'عبوة');
    if(count!==undefined&&count!==null&&String(count)!=='')return `${count} ${unit}`;
    const cut=(n?.cutting||n?.cutting_summary||n?.production_cutting||{});
    const cutCount=cut.package_count??cut.packages_count??cut.cartons??cut.bundles;
    const cutUnit=cut.package_unit||(cut.cartons!=null?'كرتون':cut.bundles!=null?'شدة':'عبوة');
    return cutCount!==undefined&&cutCount!==null&&String(cutCount)!==''?`${cutCount} ${cutUnit}`:'—';
  }
  function noticeHtml(n,logo){
    const c=profile(),b=bank(),f=financials(n);
    const rows=(n.items||[]).map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.type)}</td><td>${esc(it.description||'-')}</td><td>${esc(it.size||'-')}</td><td>${fmt(it.qty)}</td><td>${esc(it.unit||'')}</td><td class="pack">${esc(packagingLabel(it,n))}</td><td>${fmt(it.unit_price)}</td><td>${fmt(it.line_subtotal??it.line_total)}</td></tr>`).join('');
    const companyMeta=[c.commercial_registration||c.cr?`السجل التجاري: ${esc(c.commercial_registration||c.cr)}`:'',c.vat_number||c.vat?`الرقم الضريبي: ${esc(c.vat_number||c.vat)}`:'',c.address?esc(c.address):'',c.phone?`هاتف: ${esc(c.phone)}`:'',c.email?esc(c.email):''].filter(Boolean).join(' · ');
    const bankReady=b.bank_name||b.account_name||b.iban||b.account_number;
    const logoHtml=logo?`<img class="logo" src="${esc(logo)}" alt="شعار الشركة">`:'<div class="logoFallback">JM</div>';
    return `<main class="doc" dir="rtl">
      <header class="head">${logoHtml}<div class="company"><h1>${esc(c.name)}</h1><p>Jeddah Model Industrial Co. Ltd</p><p>${companyMeta||'الصناعات البلاستيكية والتغليف'}</p></div><div class="title"><h2>إشعار بضاعة جاهزة</h2><b>${esc(n.number)}</b><span>${esc(n.date||'')}</span><span>المندوب: ${esc(n.rep_name||'-')}</span></div></header>
      <section class="grid"><div class="card"><span>العميل</span><b>${esc(n.customer_name||'-')}</b></div><div class="card"><span>الجوال</span><b dir="ltr">${esc(n.customer_phone||'-')}</b></div></section>
      <table><thead><tr><th>#</th><th>الصنف</th><th>الوصف</th><th>المقاس</th><th>الكمية</th><th>الوحدة</th><th>التعبئة / عدد العبوات</th><th>سعر الوحدة قبل الضريبة</th><th>الإجمالي قبل الضريبة</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="finance"><div class="summary"><div><span>الإجمالي قبل الضريبة</span><b>${fmt(f.subtotal)} ريال</b></div><div><span>ضريبة القيمة المضافة ${Math.round(f.rate*100)}%</span><b>${fmt(f.vat)} ريال</b></div><div><span>الإجمالي شامل الضريبة</span><b>${fmt(f.total)} ريال</b></div><div><span>المدفوع سابقًا</span><b>${fmt(n.paid)} ريال</b></div></div><div class="dueCard"><span>المبلغ المتبقي للدفعة</span><b>${fmt(n.remaining)} <small>ريال</small></b><em>المبلغ المطلوب لاستكمال الاستلام</em></div></section>
      <section class="bank"><div class="bankHead"><i>↙</i><div><b>بيانات التحويل البنكي</b><span>Bank Transfer Details</span></div></div><div class="bankFields">${bankReady?`${b.bank_name?`<div><span>البنك</span><b>${esc(b.bank_name)}</b></div>`:''}${b.account_name?`<div><span>اسم الحساب</span><b>${esc(b.account_name)}</b></div>`:''}${b.account_number?`<div><span>رقم الحساب</span><b dir="ltr">${esc(b.account_number)}</b></div>`:''}${b.iban?`<div class="wide"><span>IBAN</span><b dir="ltr">${esc(b.iban)}</b></div>`:''}`:'<div class="wide empty">بيانات الحساب البنكي غير مضافة في قاعدة البيانات المركزية.</div>'}</div></section>
      <footer><span>يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة.</span><b>هذا المستند إشعار بضاعة جاهزة وليس فاتورة ضريبية.</b></footer>
    </main>`;
  }
  function css(){return `
    html,body{margin:0!important;padding:0!important;width:794px!important;height:1123px!important;background:#fff!important;overflow:hidden!important;direction:ltr!important}*{box-sizing:border-box}
    .doc{width:794px!important;height:1123px!important;padding:34px 38px 30px!important;background:#fff;color:${INK};font-family:Arial,Tahoma,sans-serif;direction:rtl}
    .head{display:grid;grid-template-columns:112px 1fr 190px;gap:18px;align-items:center;border-bottom:4px solid ${BRAND};padding-bottom:15px}.logo{display:block;width:108px;height:86px;object-fit:contain}.logoFallback{display:grid;place-items:center;width:108px;height:86px;color:${BRAND};font:700 44px Georgia,serif}.company h1{margin:0 0 5px;font-size:22px;color:${INK}}.company p{margin:2px 0;color:${MUTED};font-size:9.5px;line-height:1.5}.title{text-align:left;display:flex;flex-direction:column;gap:3px}.title h2{margin:0 0 6px;color:${BRAND};font-size:24px}.title b{font-size:13px}.title span{font-size:9.5px;color:#596579}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.card{border:1px solid #e1e5eb;background:#fbfcfd;border-radius:10px;padding:10px 13px}.card span{display:block;color:${MUTED};font-size:9px;margin-bottom:3px}.card b{font-size:13px}
    table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;margin-top:15px;border:1px solid #d8dde5;border-radius:9px;overflow:hidden}th{background:${BRAND};color:#fff;border-left:1px solid rgba(255,255,255,.18);padding:8px 3px;font-size:7.8px;line-height:1.45;font-weight:800}td{border-left:1px solid #e0e4ea;border-top:1px solid #e0e4ea;padding:7px 3px;text-align:center;font-size:8.8px;word-break:break-word}tbody tr:nth-child(odd) td{background:#fff}tbody tr:nth-child(even) td{background:#f6f7f9}.pack{font-weight:800;color:${BRAND_DARK}}th:nth-child(1){width:4%}th:nth-child(2){width:11%}th:nth-child(3){width:14%}th:nth-child(4){width:10%}th:nth-child(5){width:8%}th:nth-child(6){width:7%}th:nth-child(7){width:14%}th:nth-child(8){width:15%}th:nth-child(9){width:17%}
    .finance{display:grid;grid-template-columns:1.35fr .9fr;gap:12px;margin-top:16px;align-items:stretch}.summary{border:1px solid #e0e4ea;border-radius:11px;overflow:hidden}.summary>div{display:flex;justify-content:space-between;gap:12px;padding:8px 12px;border-bottom:1px solid #e8ebef;background:#fbfcfd;font-size:10px}.summary>div:last-child{border-bottom:0}.summary b{font-size:11.5px}.dueCard{display:flex;flex-direction:column;justify-content:center;min-height:132px;padding:16px 18px;border-radius:13px;background:linear-gradient(145deg,${BRAND_DARK},${BRAND});color:#fff;box-shadow:0 8px 20px rgba(84,16,31,.18)}.dueCard span{font-size:10px;font-weight:800;opacity:.94}.dueCard b{font-size:27px;line-height:1.2;margin:7px 0 4px}.dueCard small{font-size:11px}.dueCard em{font-size:8.5px;font-style:normal;color:#f9dfe5}
    .bank{margin-top:16px;border:1px solid #d9dde4;border-radius:12px;overflow:hidden;background:#fff}.bankHead{display:flex;align-items:center;gap:10px;background:${BRAND};color:#fff;padding:10px 13px}.bankHead i{display:grid;place-items:center;width:29px;height:29px;border-radius:9px;background:rgba(255,255,255,.14);font-style:normal;font-size:17px}.bankHead b,.bankHead span{display:block}.bankHead b{font-size:11.5px}.bankHead span{font-size:8px;color:#f4dce1;margin-top:2px}.bankFields{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:0}.bankFields>div{padding:10px 12px;border-left:1px solid #e7e9ed;border-top:1px solid #e7e9ed}.bankFields span{display:block;color:${MUTED};font-size:7.5px}.bankFields b{display:block;margin-top:3px;font-size:9.5px;color:${INK}}.bankFields .wide{grid-column:1/-1}.bankFields .wide b{font-size:10.5px;letter-spacing:.3px}.empty{color:${MUTED};font-size:9px;text-align:center}
    footer{display:flex;justify-content:space-between;gap:14px;margin-top:14px;padding-top:10px;border-top:1px solid #e2e6eb;color:${MUTED};font-size:8.5px;line-height:1.65}footer b{color:#475467}
  `}
  function loadScript(win,src){return new Promise((resolve,reject)=>{const s=win.document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;win.document.head.appendChild(s)})}
  async function makeBlob(n){
    const logo=await officialLogo();const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-2147483647;';document.body.appendChild(frame);
    try{
      const w=frame.contentWindow,d=frame.contentDocument;d.open();d.write(`<!doctype html><html dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1"><style>${css()}</style></head><body>${noticeHtml(n,logo)}</body></html>`);d.close();
      await loadScript(w,'/vendor/html2pdf.bundle.min.js');await new Promise(r=>setTimeout(r,160));
      const doc=d.querySelector('.doc');if(!doc||typeof w.html2pdf!=='function')throw new Error('PDF engine unavailable');
      return await w.html2pdf().set({margin:0,image:{type:'jpeg',quality:.99},html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,width:794,height:1123,windowWidth:794,windowHeight:1123,x:0,y:0,logging:false},jsPDF:{unit:'px',format:[794,1123],orientation:'portrait',hotfixes:['px_scaling'],compress:true}}).from(doc).outputPdf('blob');
    }finally{frame.remove()}
  }
  async function exportPdf(id){const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');try{const blob=await makeBlob(n),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${n.number}-${n.customer_name||'ready-goods'}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){console.error('Ready goods PDF export failed',e);alert('تعذر إنشاء ملف PDF. حاول مرة أخرى.')}}
  async function shareNotice(id){const n=getNotice(id);if(!n)return alert('تعذر العثور على الإشعار');const f=financials(n),text=`عميلنا العزيز ${n.customer_name||''}\nنفيدكم بأن البضاعة الخاصة بكم جاهزة.\nالقيمة قبل الضريبة: ${fmt(f.subtotal)} ريال\nضريبة القيمة المضافة: ${fmt(f.vat)} ريال\nالإجمالي شامل الضريبة: ${fmt(f.total)} ريال\nالمدفوع: ${fmt(n.paid)} ريال\nالمتبقي: ${fmt(n.remaining)} ريال\nرقم الإشعار: ${n.number}`;try{const blob=await makeBlob(n),file=new File([blob],`${n.number}.pdf`,{type:'application/pdf'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({title:'إشعار بضاعة جاهزة',text,files:[file]});return}}catch(e){console.warn('Ready goods PDF share fallback',e)}const phone=String(n.customer_phone||'').replace(/\D/g,'').replace(/^0/,'966');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank')}
  function install(){if(!window.JMSReadyGoods){setTimeout(install,250);return}window.JMSReadyGoods.exportPdf=exportPdf;window.JMSReadyGoods.share=shareNotice;window.JMSReadyGoods.__pdfFix='20260818-branded-packaging-cloud-bank-v2'}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();
