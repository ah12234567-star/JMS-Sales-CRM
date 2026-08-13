(function () {
  'use strict';
  const VERSION = '2026-08-13-quote-specs-1';
  const val = id => document.getElementById(id)?.value?.trim() || '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const database = () => { try { return db; } catch (_) { return window.db || {}; } };
  const saveDb = () => { try { if (typeof save === 'function') save(); } catch (_) { localStorage.setItem('jms_factory_crm_pro_v4', JSON.stringify(database())); } };

  const productOptions = [
    ['أكياس رول','رول'],['أكياس تي شيرت','تيشرت'],['أكياس بنانا','بنانا'],['أكياس شريط','شريط']
  ];
  const specFields = [
    ['product','نوع الكيس','Bag type'],['material','نوع المادة','Material'],['color','اللون','Color'],
    ['length','الطول','Length'],['width','العرض','Width'],['thickness','السماكة','Thickness'],
    ['fold_bottom','الطوية السفلية','Bottom gusset'],['fold_top','الطوية العلوية','Top fold'],['fold_side','الطوية الجانبية','Side gusset'],
    ['handle_type','نوع اليد','Handle type'],['handle_color','لون اليد','Handle color'],
    ['print','الطباعة','Printing'],['print_colors','عدد ألوان الطباعة','Printing colors'],
    ['piece_weight','وزن الحبة','Piece weight'],['pieces','عدد الحبات','Pieces count']
  ];

  function optionList(selected) {
    const list = [...productOptions];
    if (selected && !list.some(([value]) => value === selected)) list.push([selected, selected]);
    return list.map(([value,label]) => `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join('');
  }

  function enhanceForm(q) {
    const product = document.getElementById('mqProduct');
    if (!product || document.getElementById('jmsQuoteSpecs')) return;
    const selected = q?.product || product.value;
    product.innerHTML = optionList(selected);
    const anchor = document.getElementById('mqThicknessUnit')?.closest('.form-grid') || product.closest('.form-grid');
    const panel = document.createElement('div');
    panel.id = 'jmsQuoteSpecs'; panel.className = 'jms-quote-spec-panel';
    panel.innerHTML = `<div class="jms-spec-head"><div><b>مواصفات المنتج</b><span>الخانات الفارغة لن تظهر في عرض السعر</span></div><i>✦</i></div>
      <div class="jms-spec-grid">
        <label>الطوية السفلية سم<input id="mqFoldBottom" type="number" min="0" step="0.01" value="${esc(q?.fold_bottom||'')}"></label>
        <label>الطوية العلوية سم<input id="mqFoldTop" type="number" min="0" step="0.01" value="${esc(q?.fold_top||'')}"></label>
        <label>الطوية الجانبية سم<input id="mqFoldSide" type="number" min="0" step="0.01" value="${esc(q?.fold_side||'')}"></label>
        <label>نوع اليد<input id="mqHandleType" placeholder="تيشرت / بنانا / شريط" value="${esc(q?.handle_type||'')}"></label>
        <label>لون اليد<input id="mqHandleColor" placeholder="مثال: كريمي" value="${esc(q?.handle_color||'')}"></label>
        <label id="mqPrintColorsWrap">عدد ألوان الطباعة<select id="mqPrintColors"><option value="">اختر</option>${[1,2,3,4,5,6,7,8].map(n=>`<option ${String(q?.print_colors||'')===String(n)?'selected':''}>${n}</option>`).join('')}</select></label>
      </div>`;
    anchor?.insertAdjacentElement('afterend', panel);
    const print = document.getElementById('mqPrint');
    if (print) {
      print.innerHTML = '<option>بدون طباعة</option><option>طباعة وجه واحد</option><option>طباعة وجهين</option>';
      const old = q?.print || print.value; const wanted = old === 'وجه واحد' ? 'طباعة وجه واحد' : old === 'وجهين' ? 'طباعة وجهين' : old;
      const match=[...print.options].find(o=>o.value===wanted); if(match) match.selected=true; else print.options[0].selected=true;
      const toggle = () => { const wrap=document.getElementById('mqPrintColorsWrap'); if(wrap) wrap.hidden=print.value==='بدون طباعة'; if(wrap?.hidden) document.getElementById('mqPrintColors').value=''; };
      print.addEventListener('change', toggle); toggle();
    }
  }

  function readSpecs() {
    return {fold_bottom:val('mqFoldBottom'),fold_top:val('mqFoldTop'),fold_side:val('mqFoldSide'),handle_type:val('mqHandleType'),handle_color:val('mqHandleColor'),print_colors:val('mqPrintColors'),print:val('mqPrint')};
  }
  function applySpecs(q, specs) { if (!q) return; Object.assign(q, specs); saveDb(); }

  const oldForceForm = window.forceQuoteForm;
  if (typeof oldForceForm === 'function') window.forceQuoteForm = function(q){ const result=oldForceForm.apply(this,arguments); enhanceForm(q); return result; };
  const oldOpen = window.openQuoteForm;
  if (typeof oldOpen === 'function') window.openQuoteForm = function(){ const result=oldOpen.apply(this,arguments); enhanceForm(null); return result; };
  const oldEdit = window.editQuote;
  if (typeof oldEdit === 'function') window.editQuote = function(qid){ const result=oldEdit.apply(this,arguments); enhanceForm((database().quotes||[]).find(q=>q.id===qid)); return result; };
  const oldSave = window.forceSaveQuote;
  if (typeof oldSave === 'function') window.forceSaveQuote = function(){ const specs=readSpecs(); const before=new Set((database().quotes||[]).map(q=>q.id)); const result=oldSave.apply(this,arguments); const created=(database().quotes||[]).find(q=>!before.has(q.id)); applySpecs(created,specs); return result; };
  const oldUpdate = window.forceUpdateQuote;
  if (typeof oldUpdate === 'function') window.forceUpdateQuote = function(qid){ const specs=readSpecs(); const result=oldUpdate.apply(this,arguments); applySpecs((database().quotes||[]).find(q=>q.id===qid),specs); return result; };

  function valueWithUnit(q,key) {
    const raw=q[key]; if(raw===undefined||raw===null||String(raw).trim()==='') return '';
    if(['width','length'].includes(key)) return `${raw} ${q.size_unit||'سم'}`;
    if(key==='thickness') return `${raw} ${q.thickness_unit||'ميكرون'}`;
    if(['fold_bottom','fold_top','fold_side'].includes(key)) return `${raw} سم`;
    if(key==='print_colors') return `${raw}`;
    return String(raw);
  }

  function translatePrint(value,lang){ if(lang==='ar') return value; return value==='بدون طباعة'?'No printing':value.includes('وجهين')?'Two-side printing':value.includes('وجه')?'One-side printing':value; }
  function translateProduct(value,lang){ if(lang==='ar') return value; const map={'أكياس رول':'Roll bags','أكياس تي شيرت':'T-shirt bags','أكياس بنانا':'Banana-handle bags','أكياس شريط':'Strip-handle bags'}; return map[value]||value; }

  function enhanceQuoteDocument(q,lang='ar') {
    const doc=document.querySelector('#modalBody .quote-a4'); if(!doc||!q) return;
    doc.dataset.lang=lang; doc.dir=lang==='ar'?'rtl':'ltr';
    doc.querySelector('.jms-smart-specs')?.remove();
    const fields=specFields.map(([key,ar,en])=>{
      let value=valueWithUnit(q,key); if(!value) return null;
      if(key==='product') value=translateProduct(value,lang); if(key==='print') value=translatePrint(value,lang);
      return {label:lang==='ar'?ar:en,value};
    }).filter(Boolean);
    const section=document.createElement('section'); section.className='jms-smart-specs';
    section.innerHTML=`<div class="jms-smart-spec-title"><div><b>${lang==='ar'?'مواصفات المنتج':'Product Specifications'}</b><span>${translateProduct(q.product||'',lang)}</span></div><i>${fields.length}</i></div><div class="jms-smart-spec-grid">${fields.map(item=>`<div><span>${esc(item.label)}</span><b>${esc(item.value)}</b></div>`).join('')}</div>`;
    const table=doc.querySelector('.quote-a4-table'); if(table){table.hidden=true;table.insertAdjacentElement('afterend',section);} else doc.querySelector('.quote-a4-grid')?.insertAdjacentElement('afterend',section);
    const title=doc.querySelector('.quote-a4-title h2'); if(title) title.textContent=lang==='ar'?'عرض سعر':'QUOTATION';
    if(lang==='en') {
      const replacements={'بيانات العميل':'Customer Details','بيانات العرض':'Quotation Details','الشروط والملاحظات':'Terms & Notes','الإجمالي قبل الضريبة':'Subtotal','ضريبة القيمة المضافة 15%':'VAT 15%','الإجمالي النهائي':'Grand Total','اعتماد العميل':'Customer Approval','اعتماد الشركة':'Company Approval','اسم العميل:':'Customer:','الجوال:':'Phone:','المدينة:':'City:','العنوان:':'Address:','المندوب:':'Sales representative:','الحالة:':'Status:','شروط الدفع:':'Payment terms:','مدة التسليم:':'Delivery:','رقم العرض:':'Quotation No:','تاريخ الإصدار:':'Issue date:','صالح حتى:':'Valid until:'};
      doc.querySelectorAll('h3,b,span').forEach(el=>{const t=el.textContent.trim();if(replacements[t])el.textContent=replacements[t];});
      const terms=doc.querySelector('.quote-a4-terms ul'); if(terms) terms.innerHTML='<li>Prices apply to the specifications stated in this quotation.</li><li>This quotation is valid until the date shown above.</li><li>Delivery is subject to the production schedule after order confirmation.</li><li>Changes to size, material or printing may affect the price.</li>'+(q.notes?`<li>${esc(q.notes)}</li>`:'');
    }
    const toolbar=document.querySelector('#modalBody .quote-toolbar');
    if(toolbar&&!toolbar.querySelector('.jms-lang-choice')) toolbar.insertAdjacentHTML('afterbegin',`<div class="jms-lang-choice"><button onclick="jmsQuoteLanguage('${q.id}','ar')">عربي</button><button onclick="jmsQuoteLanguage('${q.id}','en')">English</button></div>`);
  }

  const oldView=window.viewQuote;
  if(typeof oldView==='function') window.viewQuote=function(qid){const result=oldView.apply(this,arguments);const q=(database().quotes||[]).find(x=>x.id===qid);enhanceQuoteDocument(q,q?.output_language||'ar');return result;};
  window.jmsQuoteLanguage=function(qid,lang){const q=(database().quotes||[]).find(x=>x.id===qid);if(!q)return;q.output_language=lang;saveDb();oldView(qid);enhanceQuoteDocument(q,lang);};

  const pdfShare=window.jmsShareQuotePdf||window.sendQuote;
  window.sendQuote=function(qid){
    const q=(database().quotes||[]).find(x=>x.id===qid); if(!q)return;
    const modal=document.getElementById('modal'),body=document.getElementById('modalBody');
    body.innerHTML=`<div class="jms-send-language"><i>PDF</i><h2>اختر لغة عرض السعر</h2><p>سيتم تجهيز الملف ومشاركته عبر واتساب باللغة التي تختارها.</p><div><button onclick="jmsSendQuoteLanguage('${qid}','ar')"><b>عربي</b><span>عرض سعر باللغة العربية</span></button><button onclick="jmsSendQuoteLanguage('${qid}','en')"><b>English</b><span>Quotation in English</span></button></div></div>`; modal.classList.remove('hidden');
  };
  window.jmsSendQuoteLanguage=async function(qid,lang){const q=(database().quotes||[]).find(x=>x.id===qid);if(!q)return;q.output_language=lang;saveDb();oldView(qid);enhanceQuoteDocument(q,lang);setTimeout(()=>pdfShare(qid),80);};

  const style=document.createElement('style'); style.textContent=`
    .jms-quote-spec-panel{grid-column:1/-1;margin:13px 0;padding:15px;border:1px solid #dbe4ef;border-radius:16px;background:linear-gradient(135deg,#f8fafc,#fff)}.jms-spec-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.jms-spec-head b{display:block;color:#0f172a}.jms-spec-head span{display:block;color:#64748b;font-size:11px}.jms-spec-head i{font-style:normal;color:#b91c1c}.jms-spec-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.jms-spec-grid label{font-size:11px;font-weight:800;color:#475569}.jms-spec-grid input,.jms-spec-grid select{width:100%;margin-top:5px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#fff}.jms-smart-specs{margin-top:5mm;border:1px solid #dbe4ef;border-radius:4mm;overflow:hidden;break-inside:avoid}.jms-smart-spec-title{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(120deg,#111827,#7f1d1d);color:#fff;padding:3mm 4mm}.jms-smart-spec-title b{display:block;font-size:11pt}.jms-smart-spec-title span{font-size:7pt;color:#e2e8f0}.jms-smart-spec-title i{display:grid;place-items:center;width:8mm;height:8mm;border-radius:50%;background:rgba(255,255,255,.15);font-style:normal;font-size:7pt}.jms-smart-spec-grid{display:grid;grid-template-columns:repeat(4,1fr);background:#fff}.jms-smart-spec-grid>div{padding:2.5mm 3mm;border-inline-end:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;min-height:14mm}.jms-smart-spec-grid span{display:block;color:#64748b;font-size:6.5pt}.jms-smart-spec-grid b{display:block;color:#0f172a;font-size:8pt;margin-top:1mm}.jms-lang-choice{display:flex;gap:5px;margin-inline-end:auto}.jms-send-language{text-align:center;padding:12px}.jms-send-language>i{display:grid;place-items:center;width:64px;height:64px;margin:auto;border-radius:20px;background:linear-gradient(135deg,#b91c1c,#111827);color:#fff;font-style:normal;font-weight:900}.jms-send-language h2{margin:15px 0 5px}.jms-send-language p{color:#64748b}.jms-send-language>div{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.jms-send-language button{padding:18px;border:1px solid #dbe4ef;border-radius:16px;background:#fff;cursor:pointer}.jms-send-language button b,.jms-send-language button span{display:block}.jms-send-language button b{font-size:18px;color:#0f172a}.jms-send-language button span{font-size:11px;color:#64748b;margin-top:5px}@media(max-width:620px){.jms-spec-grid{grid-template-columns:1fr 1fr}.jms-smart-spec-grid{grid-template-columns:1fr 1fr}.jms-send-language>div{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
  window.JMS_QUOTE_PRODUCT_SPECS_VERSION=VERSION;
})();
