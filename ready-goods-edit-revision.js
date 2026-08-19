/* JMS Ready Goods Notice — edit + revision history workflow */
(function(){
  'use strict';
  const STYLE_ID='jms-rgn-edit-style';
  let editingId='';
  let editItems=[];

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Number(v)||0);
  const r2=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
  const fmt=v=>r2(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const notices=()=>{try{db.readyGoodsNotices=db.readyGoodsNotices||[];return db.readyGoodsNotices}catch(_){return []}};
  const isRep=()=>window.currentUser?.role==='rep';
  const mine=()=>notices().filter(n=>!isRep()||String(n.rep_id)===String(window.currentUser?.id)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const get=id=>notices().find(n=>String(n.id)===String(id));
  const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());
  const clone=o=>JSON.parse(JSON.stringify(o));

  function persist(){
    try{
      if(typeof save==='function') return save();
      if(typeof window.save==='function') return window.save();
      localStorage.setItem('jms_factory_crm_pro_v4',JSON.stringify(db));
    }catch(e){console.error('RGN revision save failed',e);throw e}
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .rgn-edit-btn{background:#fff7ed!important;color:#9a3412!important;border:1px solid #fed7aa!important}.rgn-history-btn{background:#f8fafc!important;color:#475569!important;border:1px solid #cbd5e1!important}.rgn-rev-badge{display:inline-block;margin-inline-start:6px;padding:2px 7px;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:10px;font-weight:900}
      .rgn-edit-overlay{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.58);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto}.rgn-edit-modal{width:min(980px,100%);background:#fff;border-radius:22px;box-shadow:0 28px 80px rgba(15,23,42,.28);overflow:hidden;margin:auto}.rgn-edit-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:18px 20px;background:#0f172a;color:#fff}.rgn-edit-head h3{margin:0;font-size:20px}.rgn-edit-head p{margin:4px 0 0;color:#cbd5e1;font-size:12px}.rgn-edit-close{border:0;background:rgba(255,255,255,.12);color:#fff;width:42px;height:42px;border-radius:12px;font-size:24px;cursor:pointer}.rgn-edit-body{padding:18px}.rgn-edit-note{padding:10px 12px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12px;font-weight:800;margin-bottom:14px}.rgn-edit-customer{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.rgn-edit-readonly{padding:11px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.rgn-edit-readonly small{display:block;color:#64748b;margin-bottom:4px}.rgn-edit-item{border:1px solid #e2e8f0;border-radius:16px;padding:12px;margin-bottom:10px;background:#f8fafc}.rgn-edit-grid{display:grid;grid-template-columns:1.15fr 1fr 1fr .75fr .75fr 1fr 1fr auto;gap:8px;align-items:end}.rgn-edit-field{display:flex;flex-direction:column;gap:5px}.rgn-edit-field span{font-size:11px;font-weight:900;color:#475569}.rgn-edit-field input,.rgn-edit-field select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font:inherit}.rgn-edit-remove{height:42px;border:0;border-radius:10px;background:#fee2e2;color:#b91c1c;font-weight:900;padding:0 11px}.rgn-edit-add{border:1px dashed #94a3b8;background:#fff;color:#334155;border-radius:12px;padding:10px 14px;font-weight:900}.rgn-edit-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px}.rgn-edit-kpi{padding:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px}.rgn-edit-kpi span{display:block;font-size:10px;color:#64748b;font-weight:800}.rgn-edit-kpi b{display:block;margin-top:5px;font-size:15px}.rgn-edit-kpi input{width:100%;box-sizing:border-box;margin-top:5px;padding:8px;border:1px solid #cbd5e1;border-radius:9px}.rgn-edit-foot{display:flex;justify-content:flex-end;gap:9px;padding:14px 18px;border-top:1px solid #e2e8f0;background:#f8fafc}.rgn-edit-foot button{border:0;border-radius:11px;padding:11px 16px;font-weight:900;font:inherit}.rgn-edit-save{background:#2563eb;color:#fff}.rgn-edit-cancel{background:#e2e8f0;color:#0f172a}.rgn-history-list{display:grid;gap:9px}.rgn-history-card{padding:12px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}.rgn-history-card b{color:#0f172a}.rgn-history-card small{display:block;color:#64748b;margin-top:4px}.rgn-history-delta{margin-top:7px;color:#334155;font-size:12px}
      @media(max-width:900px){.rgn-edit-grid{grid-template-columns:1fr 1fr}.rgn-edit-summary{grid-template-columns:1fr 1fr}.rgn-edit-customer{grid-template-columns:1fr}.rgn-edit-overlay{padding:8px}.rgn-edit-modal{border-radius:18px}.rgn-edit-foot{position:sticky;bottom:0}.rgn-edit-foot button{flex:1}}
      @media(max-width:520px){.rgn-edit-grid{grid-template-columns:1fr}.rgn-edit-summary{grid-template-columns:1fr 1fr}.rgn-edit-remove{width:100%}}
    `;document.head.appendChild(s);
  }

  function financial(items,paid){
    const subtotal=r2((items||[]).reduce((s,it)=>s+num(it.qty)*num(it.unit_price),0));
    const vat=r2(subtotal*.15),total=r2(subtotal+vat),p=num(paid),remaining=r2(Math.max(0,total-p));
    return {subtotal,vat,total,paid:p,remaining};
  }

  function itemHtml(it,i){return `<div class="rgn-edit-item" data-edit-item="${i}"><div class="rgn-edit-grid">
    <label class="rgn-edit-field"><span>الصنف</span><select data-k="type" data-i="${i}">${['أكياس بلاستيك','رول بلاستيك','كليشة','أخرى'].map(v=>`<option ${it.type===v?'selected':''}>${v}</option>`).join('')}</select></label>
    <label class="rgn-edit-field"><span>الوصف</span><input data-k="description" data-i="${i}" value="${esc(it.description||'')}"></label>
    <label class="rgn-edit-field"><span>المقاس</span><input data-k="size" data-i="${i}" value="${esc(it.size||'')}"></label>
    <label class="rgn-edit-field"><span>الكمية</span><input data-k="qty" data-i="${i}" type="number" min="0" step="0.01" value="${num(it.qty)}"></label>
    <label class="rgn-edit-field"><span>الوحدة</span><select data-k="unit" data-i="${i}">${['كجم','حبة','رول','قطعة'].map(v=>`<option ${it.unit===v?'selected':''}>${v}</option>`).join('')}</select></label>
    <label class="rgn-edit-field"><span>التعبئة / عدد العبوات</span><input data-k="packaging_label" data-i="${i}" value="${esc(it.packaging_label||it.packaging||'')}" placeholder="24 كرتون"></label>
    <label class="rgn-edit-field"><span>سعر الوحدة قبل الضريبة</span><input data-k="unit_price" data-i="${i}" type="number" min="0" step="0.01" value="${num(it.unit_price)}"></label>
    <button class="rgn-edit-remove" type="button" data-remove-i="${i}">حذف</button>
  </div></div>`}

  function renderEditItems(){const root=document.getElementById('rgnEditItems');if(root)root.innerHTML=editItems.map(itemHtml).join('');recalcModal()}
  function recalcModal(){
    const paid=num(document.getElementById('rgnEditPaid')?.value);const f=financial(editItems,paid);
    [['rgnEditSubtotal',f.subtotal],['rgnEditVat',f.vat],['rgnEditTotal',f.total],['rgnEditRemaining',f.remaining]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=fmt(v)+' ريال'});
    return f;
  }

  function openEdit(id){
    const n=get(id);if(!n)return alert('تعذر العثور على الإشعار');
    if(isRep()&&String(n.rep_id)!==String(window.currentUser?.id))return alert('لا يمكنك تعديل إشعار مندوب آخر');
    editingId=String(id);editItems=clone(n.items||[]).map(x=>({...x,id:x.id||uid(),packaging_label:x.packaging_label||x.packaging||''}));if(!editItems.length)editItems=[{id:uid(),type:'أكياس بلاستيك',description:'',size:'',qty:1,unit:'كجم',packaging_label:'',unit_price:0}];
    document.getElementById('jmsRgnEditOverlay')?.remove();
    const ov=document.createElement('div');ov.id='jmsRgnEditOverlay';ov.className='rgn-edit-overlay';ov.innerHTML=`<div class="rgn-edit-modal" role="dialog" aria-modal="true">
      <div class="rgn-edit-head"><div><h3>تعديل ${esc(n.number||'إشعار البضاعة')}</h3><p>Rev.${Number(n.revision||0)+1} — يتم حفظ النسخة السابقة تلقائيًا في سجل التعديلات</p></div><button class="rgn-edit-close" type="button" data-close-edit>×</button></div>
      <div class="rgn-edit-body"><div class="rgn-edit-note">أي تعديل على السعر أو الكمية أو التعبئة يُسجل كتعديل جديد مع الاحتفاظ بالقيم السابقة للمراجعة.</div>
        <div class="rgn-edit-customer"><div class="rgn-edit-readonly"><small>العميل</small><b>${esc(n.customer_name||'-')}</b></div><div class="rgn-edit-readonly"><small>رقم الإشعار</small><b>${esc(n.number||'-')}</b></div></div>
        <div id="rgnEditItems"></div><button class="rgn-edit-add" type="button" id="rgnEditAdd">+ إضافة صنف</button>
        <div class="rgn-edit-summary"><div class="rgn-edit-kpi"><span>قبل الضريبة</span><b id="rgnEditSubtotal"></b></div><div class="rgn-edit-kpi"><span>الضريبة 15%</span><b id="rgnEditVat"></b></div><div class="rgn-edit-kpi"><span>شامل الضريبة</span><b id="rgnEditTotal"></b></div><div class="rgn-edit-kpi"><span>المدفوع سابقًا</span><input id="rgnEditPaid" type="number" min="0" step="0.01" value="${num(n.paid)}"></div><div class="rgn-edit-kpi"><span>المتبقي</span><b id="rgnEditRemaining"></b></div></div>
      </div><div class="rgn-edit-foot"><button class="rgn-edit-cancel" type="button" data-close-edit>إلغاء</button><button class="rgn-edit-save" type="button" id="rgnEditSave">حفظ النسخة المعدلة</button></div></div>`;
    document.body.appendChild(ov);renderEditItems();
  }

  function snapshot(n){return {revision:Number(n.revision||0),saved_at:new Date().toISOString(),saved_by:window.currentUser?.name||'',items:clone(n.items||[]),subtotal:num(n.subtotal),vat_amount:num(n.vat_amount),total:num(n.total),paid:num(n.paid),remaining:num(n.remaining)}}

  function saveEdit(){
    const n=get(editingId);if(!n)return;
    const f=recalcModal();
    if(!editItems.length||editItems.some(it=>!it.type||num(it.qty)<=0))return alert('راجع الأصناف والكميات');
    if(f.paid>f.total)return alert('المبلغ المدفوع لا يمكن أن يكون أكبر من الإجمالي');
    n.revision_history=Array.isArray(n.revision_history)?n.revision_history:[];n.revision_history.push(snapshot(n));
    n.revision=Number(n.revision||0)+1;n.updated_at=new Date().toISOString();n.updated_by=window.currentUser?.name||'';n.status='draft';
    n.items=editItems.map(it=>({...it,qty:num(it.qty),unit_price:num(it.unit_price),packaging_label:String(it.packaging_label||'').trim(),line_subtotal:r2(num(it.qty)*num(it.unit_price)),line_total:r2(num(it.qty)*num(it.unit_price))}));
    n.subtotal=f.subtotal;n.vat_rate=.15;n.vat_amount=f.vat;n.total=f.total;n.paid=f.paid;n.remaining=f.remaining;n.pricing_mode='net_plus_vat';
    try{persist()}catch(_){return alert('تعذر حفظ التعديل. حاول مرة أخرى')}
    document.getElementById('jmsRgnEditOverlay')?.remove();editingId='';editItems=[];
    try{window.JMSReadyGoods?.renderList?.()}catch(_){}setTimeout(enhanceList,120);
    alert(`تم حفظ التعديل Rev.${n.revision} مع الاحتفاظ بالنسخة السابقة`);
  }

  function showHistory(id){
    const n=get(id);if(!n)return;const h=Array.isArray(n.revision_history)?n.revision_history:[];
    document.getElementById('jmsRgnEditOverlay')?.remove();const ov=document.createElement('div');ov.id='jmsRgnEditOverlay';ov.className='rgn-edit-overlay';
    ov.innerHTML=`<div class="rgn-edit-modal" style="max-width:720px"><div class="rgn-edit-head"><div><h3>سجل تعديلات ${esc(n.number||'')}</h3><p>الإصدار الحالي Rev.${Number(n.revision||0)}</p></div><button class="rgn-edit-close" data-close-edit>×</button></div><div class="rgn-edit-body"><div class="rgn-history-list">${h.length?h.slice().reverse().map((x,idx)=>`<div class="rgn-history-card"><b>النسخة السابقة Rev.${Number(x.revision||0)}</b><small>${esc(x.saved_by||'')} · ${esc(new Date(x.saved_at).toLocaleString('ar-SA'))}</small><div class="rgn-history-delta">الإجمالي: ${fmt(x.total)} ريال · المدفوع: ${fmt(x.paid)} ريال · المتبقي: ${fmt(x.remaining)} ريال · الأصناف: ${(x.items||[]).length}</div></div>`).join(''):'<div class="rgn-edit-note">لا توجد تعديلات سابقة على هذا الإشعار.</div>'}</div></div><div class="rgn-edit-foot"><button class="rgn-edit-cancel" data-close-edit>إغلاق</button></div></div>`;document.body.appendChild(ov);
  }

  function enhanceList(){
    const root=document.getElementById('rgnList');if(!root)return;const rows=[...root.querySelectorAll('.rgn-row')],list=mine().slice(0,30);
    rows.forEach((row,i)=>{
      const n=list[i];if(!n)return;row.dataset.noticeId=n.id;
      const numberSmall=row.querySelector('small');if(numberSmall&&Number(n.revision||0)>0&&!numberSmall.querySelector?.('.rgn-rev-badge'))numberSmall.insertAdjacentHTML('beforeend',` <span class="rgn-rev-badge">Rev.${Number(n.revision)}</span>`);
      const actions=row.querySelector('.rgn-actions');if(!actions)return;
      if(!actions.querySelector('.rgn-edit-btn')){const b=document.createElement('button');b.className='rgn-edit-btn';b.type='button';b.textContent='تعديل';b.addEventListener('click',()=>openEdit(n.id));actions.prepend(b)}
      if(Number(n.revision||0)>0&&!actions.querySelector('.rgn-history-btn')){const b=document.createElement('button');b.className='rgn-history-btn';b.type='button';b.textContent='السجل';b.addEventListener('click',()=>showHistory(n.id));actions.appendChild(b)}
    });
  }

  function install(){
    addStyle();
    document.addEventListener('input',e=>{const t=e.target;if(t?.matches?.('#jmsRgnEditOverlay [data-k]')){const i=Number(t.dataset.i),k=t.dataset.k;if(editItems[i])editItems[i][k]=['qty','unit_price'].includes(k)?num(t.value):t.value;recalcModal()}if(t?.id==='rgnEditPaid')recalcModal()});
    document.addEventListener('change',e=>{const t=e.target;if(t?.matches?.('#jmsRgnEditOverlay [data-k]')){const i=Number(t.dataset.i),k=t.dataset.k;if(editItems[i])editItems[i][k]=t.value;recalcModal()}});
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-close-edit]'))document.getElementById('jmsRgnEditOverlay')?.remove();
      const rem=e.target.closest?.('[data-remove-i]');if(rem){if(editItems.length===1)return alert('يجب وجود صنف واحد على الأقل');editItems.splice(Number(rem.dataset.removeI),1);renderEditItems()}
      if(e.target.closest?.('#rgnEditAdd')){editItems.push({id:uid(),type:'أكياس بلاستيك',description:'',size:'',qty:1,unit:'كجم',packaging_label:'',unit_price:0});renderEditItems()}
      if(e.target.closest?.('#rgnEditSave'))saveEdit();
    });
    const obs=new MutationObserver(()=>setTimeout(enhanceList,20));const watch=()=>{const r=document.getElementById('rgnList');if(r){obs.observe(r,{childList:true,subtree:true});enhanceList()}else setTimeout(watch,300)};watch();setInterval(enhanceList,1500);
    window.JMSReadyGoodsRevision={edit:openEdit,history:showHistory,enhanceList};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700));else setTimeout(install,700);
})();
