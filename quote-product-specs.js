(function () {
  'use strict';
  const VERSION = '2026-08-13-quote-specs-2';
  let draftItems = [];
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
    draftItems = Array.isArray(q?.items) ? q.items.slice(1) : [];
    panel.insertAdjacentHTML('beforeend', `<div class="jms-multi-item-actions"><button type="button" onclick="jmsAddQuoteItem()">＋ حفظ الصنف وإضافة صنف آخر</button><span>يمكن إضافة حتى 10 أصناف في عرض واحد</span></div><div id="jmsQuoteDraftItems" class="jms-draft-items"></div>`);
    const print = document.getElementById('mqPrint');
    if (print) {
      print.innerHTML = '<option>بدون طباعة</option><option>طباعة وجه واحد</option><option>طباعة وجهين</option>';
      const old = q?.print || print.value; const wanted = old === 'وجه واحد' ? 'طباعة وجه واحد' : old === 'وجهين' ? 'طباعة وجهين' : old;
      const match=[...print.options].find(o=>o.value===wanted); if(match) match.selected=true; else print.options[0].selected=true;
      const toggle = () => { const wrap=document.getElementById('mqPrintColorsWrap'); if(wrap) wrap.hidden=print.value==='بدون طباعة'; if(wrap?.hidden) document.getElementById('mqPrintColors').value=''; };
      print.addEventListener('change', toggle); toggle();
    }
    renderDraftItems();
  }

  function readSpecs() {
    return {fold_bottom:val('mqFoldBottom'),fold_top:val('mqFoldTop'),fold_side:val('mqFoldSide'),handle_type:val('mqHandleType'),handle_color:val('mqHandleColor'),print_colors:val('mqPrintColors'),print:val('mqPrint')};
  }
  function currentItem() {
    const item={product:val('mqProduct'),material:val('mqMaterial'),color:val('mqColor'),width:val('mqWidth'),length:val('mqLength'),size_unit:val('mqSizeUnit'),thickness:val('mqThickness'),thickness_unit:val('mqThicknessUnit'),total_kg:val('mqKg'),price_kg:val('mqPriceKg'),piece_weight:val('mqPiece'),pieces:val('mqPieces'),...readSpecs()};
    item.total_amount=(Number(item.total_kg||0)*Number(item.price_kg||0)).toFixed(2); return item;
  }
  function validItem(item){return item.product&&Number(item.width)>0&&Number(item.length)>0&&Number(item.thickness)>0&&Number(item.total_kg)>0&&Number(item.price_kg)>0;}
  function renderDraftItems(){const box=document.getElementById('jmsQuoteDraftItems');if(!box)return;box.innerHTML=draftItems.map((item,index)=>`<div><b>الصنف ${index+1}: ${esc(item.product)}</b><span>${esc(item.width)} × ${esc(item.length)} ${esc(item.size_unit||'سم')} · ${esc(item.thickness)} ${esc(item.thickness_unit||'ميكرون')} · ${esc(item.total_kg)} كجم</span><button type="button" onclick="jmsRemoveQuoteItem(${index})">حذف</button></div>`).join('');}
  window.jmsRemoveQuoteItem=function(index){draftItems.splice(index,1);renderDraftItems();};
  window.jmsAddQuoteItem=function(){const item=currentItem();if(!validItem(item))return alert('أكمل نوع الكيس والطول والعرض والسماكة والكمية والسعر قبل إضافة الصنف.');if(draftItems.length>=9)return alert('الحد الأعلى 10 أصناف في العرض الواحد.');draftItems.push(item);renderDraftItems();['mqColor','mqWidth','mqLength','mqThickness','mqKg','mqPriceKg','mqTotal','mqPiece','mqPieces','mqFoldBottom','mqFoldTop','mqFoldSide','mqHandleType','mqHandleColor','mqPrintColors'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});const print=document.getElementById('mqPrint');if(print)print.selectedIndex=0;document.getElementById('mqPrintColorsWrap')?.setAttribute('hidden','');document.getElementById('mqProduct')?.focus();};
  function applyItems(q,current){if(!q)return;const items=[...draftItems,current].filter(validItem).slice(0,10);if(!items.length)return;q.items=items;Object.assign(q,items[0]);q.total_kg=items.reduce((sum,item)=>sum+Number(item.total_kg||0),0);q.total_amount=items.reduce((sum,item)=>sum+Number(item.total_amount||0),0).toFixed(2);q.items_count=items.length;saveDb();draftItems=[];}
  function applySpecs(q, specs) { if (!q) return; Object.assign(q, specs); saveDb(); }

  const oldForceForm = window.forceQuoteForm;
  if (typeof oldForceForm === 'function') window.forceQuoteForm = function(q){ const result=oldForceForm.apply(this,arguments); enhanceForm(q); return result; };
  const oldOpen = window.openQuoteForm;
  if (typeof oldOpen === 'function') window.openQuoteForm = function(){ const result=oldOpen.apply(this,arguments); enhanceForm(null); return result; };
  const oldEdit = window.editQuote;
  if (typeof oldEdit === 'function') window.editQuote = function(qid){ const result=oldEdit.apply(this,arguments); enhanceForm((database().quotes||[]).find(q=>q.id===qid)); return result; };
  const oldSave = window.forceSaveQuote;
  if (typeof oldSave === 'function') window.forceSaveQuote = function(){ const specs=readSpecs(),item=currentItem(); const before=new Set((database().quotes||[]).map(q=>q.id)); const result=oldSave.apply(this,arguments); const created=(database().quotes||[]).find(q=>!before.has(q.id)); applySpecs(created,specs); applyItems(created,item); return result; };
  const oldUpdate = window.forceUpdateQuote;
  if (typeof oldUpdate === 'function') window.forceUpdateQuote = function(qid){ const specs=readSpecs(),item=currentItem(); const result=oldUpdate.apply(this,arguments); const q=(database().quotes||[]).find(q=>q.id===qid); applySpecs(q,specs); applyItems(q,item); return result; };

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
    const items=Array.isArray(q.items)&&q.items.length?q.items:[q];
    const definitions=[
      ['product',lang==='ar'?'الصنف':'Item',item=>translateProduct(item.product||'',lang),true],
      ['material',lang==='ar'?'المادة':'Material',item=>item.material,true],
      ['color',lang==='ar'?'اللون':'Color',item=>item.color,false],
      ['length',lang==='ar'?'الطول':'Length',item=>item.length?`${item.length} ${item.size_unit||'cm'}`:'',true],
      ['width',lang==='ar'?'العرض':'Width',item=>item.width?`${item.width} ${item.size_unit||'cm'}`:'',true],
      ['fold_side',lang==='ar'?'الطوية الجانبية':'Side gusset',item=>item.fold_side?`${item.fold_side} ${lang==='ar'?'سم':'cm'}`:'',false],
      ['folds',lang==='ar'?'الطوية س/ع':'Bottom/Top fold',item=>[item.fold_bottom,item.fold_top].filter(Boolean).join(' / '),false],
      ['thickness',lang==='ar'?'السماكة':'Thickness',item=>item.thickness?`${item.thickness} ${item.thickness_unit||'micron'}`:'',true],
      ['handle',lang==='ar'?'اليد':'Handle',item=>[item.handle_type,item.handle_color].filter(Boolean).join(' - '),false],
      ['print',lang==='ar'?'الطباعة':'Printing',item=>{const p=translatePrint(item.print||'',lang);return [p,item.print_colors?`${item.print_colors} ${lang==='ar'?'ألوان':'colors'}`:''].filter(Boolean).join(' - ')},false],
      ['total_kg',lang==='ar'?'الكمية':'Qty',item=>item.total_kg?`${item.total_kg} ${lang==='ar'?'كجم':'kg'}`:'',true],
      ['price_kg',lang==='ar'?'سعر الكيلو':'Price/kg',item=>item.price_kg?`${item.price_kg} ${lang==='ar'?'ريال':'SAR'}`:'',true],
      ['total_amount',lang==='ar'?'الإجمالي':'Total',item=>item.total_amount?`${Number(item.total_amount).toLocaleString('en-US')} ${lang==='ar'?'ريال':'SAR'}`:'',true]
    ];
    const columns=definitions.filter(([, ,getter,required])=>required||items.some(item=>String(getter(item)||'').trim()));
    const section=document.createElement('section'); section.className='jms-smart-specs';
    section.innerHTML=`<div class="jms-smart-spec-title"><div><b>${lang==='ar'?'أصناف عرض السعر':'Quotation Items'}</b><span>${lang==='ar'?'كل صنف في سطر واحد':'One line per item'}</span></div><i>${items.length}</i></div><div class="jms-spec-table-wrap"><table class="jms-smart-spec-table"><thead><tr>${columns.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>`<tr>${columns.map(([, ,getter])=>`<td>${esc(getter(item)||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
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
    .jms-quote-spec-panel{grid-column:1/-1;margin:13px 0;padding:15px;border:1px solid #dbe4ef;border-radius:16px;background:linear-gradient(135deg,#f8fafc,#fff)}.jms-spec-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.jms-spec-head b{display:block;color:#0f172a}.jms-spec-head span{display:block;color:#64748b;font-size:11px}.jms-spec-head i{font-style:normal;color:#b91c1c}.jms-spec-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.jms-spec-grid label{font-size:11px;font-weight:800;color:#475569}.jms-spec-grid input,.jms-spec-grid select{width:100%;margin-top:5px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#fff}.jms-multi-item-actions{display:flex;align-items:center;gap:10px;margin-top:13px;padding-top:12px;border-top:1px solid #e2e8f0}.jms-multi-item-actions button{border:0;border-radius:10px;background:#111827;color:#fff;padding:10px 13px;font-weight:800}.jms-multi-item-actions span{font-size:10px;color:#64748b}.jms-draft-items{display:grid;gap:6px;margin-top:9px}.jms-draft-items>div{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:8px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:10px}.jms-draft-items b{font-size:11px}.jms-draft-items span{font-size:9px;color:#64748b}.jms-draft-items button{grid-row:1/3;grid-column:2;border:0;background:#fee2e2;color:#b91c1c;border-radius:8px}.jms-smart-specs{margin-top:5mm;border:1px solid #dbe4ef;border-radius:4mm;overflow:hidden;break-inside:avoid}.jms-smart-spec-title{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(120deg,#111827,#7f1d1d);color:#fff;padding:3mm 4mm}.jms-smart-spec-title b{display:block;font-size:11pt}.jms-smart-spec-title span{font-size:7pt;color:#e2e8f0}.jms-smart-spec-title i{display:grid;place-items:center;width:8mm;height:8mm;border-radius:50%;background:rgba(255,255,255,.15);font-style:normal;font-size:7pt}.jms-spec-table-wrap{overflow:auto}.jms-smart-spec-table{width:100%;border-collapse:collapse;table-layout:auto}.jms-smart-spec-table th{background:#111827;color:#fff;padding:7px 4px;font-size:8px;white-space:nowrap}.jms-smart-spec-table td{border:1px solid #e2e8f0;padding:7px 4px;font-size:8px;text-align:center;white-space:nowrap}.jms-lang-choice{display:flex;gap:5px;margin-inline-end:auto}.jms-send-language{text-align:center;padding:12px}.jms-send-language>i{display:grid;place-items:center;width:64px;height:64px;margin:auto;border-radius:20px;background:linear-gradient(135deg,#b91c1c,#111827);color:#fff;font-style:normal;font-weight:900}.jms-send-language h2{margin:15px 0 5px}.jms-send-language p{color:#64748b}.jms-send-language>div{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.jms-send-language button{padding:18px;border:1px solid #dbe4ef;border-radius:16px;background:#fff;cursor:pointer}.jms-send-language button b,.jms-send-language button span{display:block}.jms-send-language button b{font-size:18px;color:#0f172a}.jms-send-language button span{font-size:11px;color:#64748b;margin-top:5px}@media(max-width:620px){.jms-spec-grid{grid-template-columns:1fr 1fr}.jms-send-language>div{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
  window.JMS_QUOTE_PRODUCT_SPECS_VERSION=VERSION;
})();
