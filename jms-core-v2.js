/* JMS Core 2.0 - Phase 2: canonical representatives, ownership integrity, unified import center */
(function(){
  'use strict';
  const VERSION='2026-08-29-core-v2-phase2';
  const CHILD_COLLECTIONS=['quotes','visits','orders','collections'];
  const STORE_KEY='jms_factory_crm_pro_v4';
  let normalizing=false;

  function getDb(){try{return (typeof db!=='undefined'?db:window.db)||null}catch(_){return window.db||null}}
  function getUser(){try{return window.currentUser||(typeof currentUser!=='undefined'?currentUser:null)}catch(_){return window.currentUser||null}}
  function clean(v){return String(v??'').trim()}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function normalizePhone(v){let p=clean(v);if(/e\+?/i.test(p)){const n=Number(p);if(Number.isFinite(n))p=String(Math.trunc(n));}p=p.replace(/\D/g,'');if(!p)return'';if(p.startsWith('00966'))p=p.slice(2);if(p.startsWith('966'))return p;if(p.startsWith('05')&&p.length===10)return'966'+p.slice(1);if(p.startsWith('5')&&p.length===9)return'966'+p;return p}
  function normName(v){return clean(v).toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'').replace(/\b(شركة|شركه|مؤسسة|موسسه|مؤسسه|مطاعم|مطعم|محلات|محل|فرع|للتجارة|للتجاره|التجارة|التجاره|مركز)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,'')}
  function saveLocal(){const s=getDb();if(!s)return;try{localStorage.setItem(STORE_KEY,JSON.stringify(s))}catch(_){}try{if(typeof save==='function')save();else window.save?.()}catch(_){}}
  function emit(source='core-v2'){try{document.dispatchEvent(new CustomEvent('jms:data-changed',{detail:{source}}))}catch(_){}}

  function repRegistry(){
    const s=getDb()||{}, map=new Map();
    const add=r=>{
      if(!r?.id)return;const id=String(r.id);const prev=map.get(id)||{};
      map.set(id,{...prev,...r,id,name:clean(r.name||prev.name||id),email:clean(r.email||prev.email||''),role:'rep',status:r.status||prev.status||'active'});
    };
    (s.reps||[]).forEach(add);
    (s.users||[]).filter(x=>x.role==='rep').forEach(add);
    return map;
  }

  function syncRepRegistry(){
    const s=getDb();if(!s)return {changed:0,reps:0};
    s.reps ||= [];s.users ||= [];
    const map=repRegistry();let changed=0;
    const canonical=[...map.values()];
    const before=JSON.stringify((s.reps||[]).map(r=>({id:r.id,name:r.name,email:r.email,role:r.role,status:r.status,area:r.area})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
    s.reps=canonical.map(r=>({...r,role:'rep'}));
    const after=JSON.stringify(s.reps.map(r=>({id:r.id,name:r.name,email:r.email,role:r.role,status:r.status,area:r.area})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
    if(before!==after)changed++;
    return {changed,reps:s.reps.length};
  }

  function customerMap(){return new Map(((getDb()?.customers)||[]).filter(x=>x?.id).map(x=>[String(x.id),x]))}

  function normalizeOwnership(){
    if(normalizing)return {changed:0,issues:[]};normalizing=true;
    try{
      const s=getDb();if(!s)return {changed:0,issues:[]};
      const customers=customerMap(), reps=repRegistry(), issues=[];let changed=0;
      const repSync=syncRepRegistry();changed+=repSync.changed;

      for(const c of s.customers||[]){
        if(c.phone){const p=normalizePhone(c.phone);if(p&&p!==c.phone){c.phone=p;changed++}}
        if(!clean(c.rep_id)) issues.push({type:'customer_without_rep',collection:'customers',id:c.id,name:c.name||''});
        else if(!reps.has(String(c.rep_id))) issues.push({type:'customer_unknown_rep',collection:'customers',id:c.id,name:c.name||'',rep_id:c.rep_id});
      }

      for(const key of CHILD_COLLECTIONS){
        for(const row of s[key]||[]){
          const customer=customers.get(String(row.customer_id||''));
          if(!clean(row.rep_id)&&customer?.rep_id){row.rep_id=customer.rep_id;changed++}
          if(row.phone){const p=normalizePhone(row.phone);if(p&&p!==row.phone){row.phone=p;changed++}}
          if(customer?.rep_id&&row.rep_id&&String(customer.rep_id)!==String(row.rep_id)){
            issues.push({type:'owner_mismatch',collection:key,id:row.id,customer_id:row.customer_id,record_rep_id:row.rep_id,customer_rep_id:customer.rep_id});
          }
          if(!clean(row.rep_id))issues.push({type:'record_without_rep',collection:key,id:row.id,customer_id:row.customer_id||''});
        }
      }
      if(changed){saveLocal();emit('core-v2-normalized')}
      return {changed,issues};
    }finally{normalizing=false}
  }

  function audit(){
    const s=getDb()||{}, reps=repRegistry(), customers=s.customers||[], issues=[];
    const seenPhone=new Map(), seenName=new Map();
    for(const c of customers){
      const p=normalizePhone(c.phone);if(p){if(seenPhone.has(p))issues.push({type:'duplicate_phone',customer_a:seenPhone.get(p),customer_b:c.id,phone:p});else seenPhone.set(p,c.id)}
      const n=normName(c.name);if(n){const k=n+'|'+clean(c.city).toLowerCase();if(seenName.has(k))issues.push({type:'duplicate_name_city',customer_a:seenName.get(k),customer_b:c.id,name:c.name,city:c.city||''});else seenName.set(k,c.id)}
      if(!clean(c.rep_id))issues.push({type:'customer_without_rep',id:c.id,name:c.name||''});
      else if(!reps.has(String(c.rep_id)))issues.push({type:'customer_unknown_rep',id:c.id,name:c.name||'',rep_id:c.rep_id});
    }
    const ownership=normalizeOwnership();issues.push(...ownership.issues);
    const grouped=issues.reduce((a,x)=>{a[x.type]=(a[x.type]||0)+1;return a},{});
    return {version:VERSION,counts:{reps:reps.size,customers:customers.length,quotes:(s.quotes||[]).length,visits:(s.visits||[]).length,orders:(s.orders||[]).length,collections:(s.collections||[]).length,routes:(s.routes||[]).length},auto_fixed:ownership.changed,issues,grouped};
  }

  function enforceRepScope(){
    const u=getUser();if(u?.role!=='rep')return;
    const s=getDb();if(!s)return;
    window.JMS_ALLOWED_REP_ID=String(u.id||'');
    window.jmsOwnedRows=function(key){return (s[key]||[]).filter(x=>String(x.rep_id||'')===String(u.id||''));};
  }

  function repOptions(selected='',includeFile=false){
    const opts=[...repRegistry().values()].filter(r=>r.status!=='inactive').sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
    return (includeFile?'<option value="file">حسب الملف / rep_id</option>':'')+opts.map(r=>`<option value="${esc(r.id)}" ${String(r.id)===String(selected)?'selected':''}>${esc(r.name)}</option>`).join('');
  }

  function closeModalSafe(){try{if(typeof closeModal==='function')closeModal();else document.getElementById('modal')?.classList.add('hidden')}catch(_){}}
  function openImportTool(fn){closeModalSafe();setTimeout(()=>{if(typeof window[fn]==='function')window[fn]();else alert('أداة الاستيراد لم تكتمل تحميلها. حدث الصفحة وحاول مرة ثانية.')},80)}

  window.openJmsImportCenter=function(){
    const u=getUser();if(u?.role!=='admin')return alert('مركز الاستيراد متاح لمدير النظام فقط');
    const body=document.getElementById('modalBody'),m=document.getElementById('modal');if(!body||!m)return alert('تعذر فتح مركز الاستيراد');
    const a=audit();
    body.innerHTML=`<div class="jms-core-center"><div class="jms-core-title"><div><h2>مركز الاستيراد الموحد</h2><p>نقطة واحدة لكل استيراد العملاء والديون والتحديثات، مع حماية ملكية المندوب.</p></div><span>Core 2.0</span></div>
      <div class="jms-core-kpis"><div><b>${a.counts.reps}</b><small>مناديب</small></div><div><b>${a.counts.customers}</b><small>عملاء</small></div><div><b>${a.issues.length}</b><small>ملاحظات سلامة</small></div></div>
      <div class="jms-core-tools">
        <button onclick="jmsCoreOpenImport('openCustomerImport')"><b>استيراد عملاء</b><small>إضافة أو تحديث مع منع التكرار وتعارض المندوب</small></button>
        <button onclick="jmsCoreOpenImport('openCustomerPhoneUpdateImportV2')"><b>تحديث بيانات/جوالات</b><small>تحديث العملاء الموجودين بدون إنشاء نسخ مكررة</small></button>
        <button onclick="jmsCoreOpenImport('openSmartDebtImport')"><b>استيراد الديون</b><small>الرصيد وأعمار الديون مع ربط صحيح بالمندوب</small></button>
        <button onclick="openJmsDataIntegrity()"><b>فحص سلامة البيانات</b><small>تكرار العملاء، سجلات بلا مندوب، وتعارضات الملكية</small></button>
      </div></div>`;
    m.classList.remove('hidden');
  };
  window.jmsCoreOpenImport=openImportTool;

  function customerLabel(id){const c=customerMap().get(String(id||''));return c?.name||id||'-'}
  function issueText(x){
    const labels={customer_without_rep:'عميل بدون مندوب',customer_unknown_rep:'عميل مرتبط بمندوب غير معروف',record_without_rep:'سجل بدون مندوب',owner_mismatch:'تعارض ملكية بين العميل والسجل',duplicate_phone:'رقم جوال مكرر',duplicate_name_city:'اسم عميل مكرر في نفس المدينة'};
    let detail='';
    if(x.type==='customer_without_rep'||x.type==='customer_unknown_rep')detail=x.name||x.id||'';
    else if(x.type==='owner_mismatch')detail=`${x.collection} · ${customerLabel(x.customer_id)} · السجل ${x.record_rep_id} / العميل ${x.customer_rep_id}`;
    else if(x.type==='record_without_rep')detail=`${x.collection} · ${customerLabel(x.customer_id)}`;
    else if(x.type==='duplicate_phone')detail=`${x.phone} · ${customerLabel(x.customer_a)} / ${customerLabel(x.customer_b)}`;
    else if(x.type==='duplicate_name_city')detail=`${x.name||''} · ${x.city||''}`;
    return {label:labels[x.type]||x.type,detail};
  }

  window.openJmsDataIntegrity=function(){
    const body=document.getElementById('modalBody'),m=document.getElementById('modal');if(!body||!m)return;
    const a=audit(), groups=Object.entries(a.grouped||{}).sort((x,y)=>y[1]-x[1]);
    body.innerHTML=`<div class="jms-core-center"><div class="jms-core-title"><div><h2>فحص سلامة البيانات</h2><p>الفحص لا ينقل ملكية عميل بين المناديب تلقائياً؛ يعرض التعارض للمراجعة.</p></div><span>${esc(a.version)}</span></div>
      <div class="jms-core-kpis"><div><b>${a.counts.customers}</b><small>عملاء</small></div><div><b>${a.auto_fixed}</b><small>تصحيحات آمنة تلقائية</small></div><div><b>${a.issues.length}</b><small>تحتاج مراجعة</small></div></div>
      ${groups.length?`<div class="jms-core-groups">${groups.map(([k,v])=>`<span>${esc(issueText({type:k}).label)} <b>${v}</b></span>`).join('')}</div>`:'<div class="jms-core-ok">✓ لا توجد ملاحظات سلامة حالياً</div>'}
      <div class="jms-core-issues">${a.issues.slice(0,150).map(x=>{const t=issueText(x);return `<div><b>${esc(t.label)}</b><small>${esc(t.detail)}</small></div>`}).join('')}</div>
      ${a.issues.length>150?`<p class="muted">تم عرض أول 150 ملاحظة من ${a.issues.length}.</p>`:''}
    </div>`;
    m.classList.remove('hidden');
  };

  function hideLegacyImportButtons(){
    const ids=['jmsDebtAgingImportBtn','jmsSmartDebtImportBtn','jmsSmartDebtImportV2Btn','jmsPhoneUpdateV2Btn'];
    ids.forEach(id=>{const x=document.getElementById(id);if(x)x.style.display='none'});
    document.querySelectorAll('#customers .page-head button').forEach(b=>{
      const t=clean(b.textContent);if(t&&/(استيراد الديون|تحديث أرقام العملاء V2)/.test(t)&&b.id!=='jmsUnifiedImportBtn')b.style.display='none';
    });
  }
  function injectUnifiedImportButton(){
    const u=getUser();if(u?.role!=='admin')return;
    const page=document.getElementById('customers'),head=page?.querySelector('.page-head');if(!head)return;
    let actions=head.querySelector('.head-actions');if(!actions){actions=document.createElement('div');actions.className='head-actions';head.appendChild(actions)}
    let b=document.getElementById('jmsUnifiedImportBtn');if(!b){b=document.createElement('button');b.id='jmsUnifiedImportBtn';b.type='button';b.className='primary secondary';b.textContent='مركز الاستيراد';b.onclick=window.openJmsImportCenter;actions.appendChild(b)}
    hideLegacyImportButtons();
  }

  function patchRepSelects(){
    const selectors=['orderRep','quoteRepFilter','visitNoteRepFilter','smartVisitRepFilter','repFilter'];
    selectors.forEach(id=>{
      const el=document.getElementById(id);if(!el||el.dataset.jmsCoreManaged==='1')return;
      const value=el.value, first=[...el.options].find(o=>!o.value||o.value==='all');
      const prefix=first?`<option value="${esc(first.value)}">${esc(first.textContent)}</option>`:'';
      el.innerHTML=prefix+repOptions(value,false);if(value&&[...el.options].some(o=>o.value===value))el.value=value;el.dataset.jmsCoreManaged='1';
    });
  }

  function installStyle(){
    if(document.getElementById('jmsCoreV2Style'))return;const s=document.createElement('style');s.id='jmsCoreV2Style';s.textContent=`
      .jms-core-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.jms-core-title h2{margin:0}.jms-core-title p{color:#64748b;margin:5px 0 0}.jms-core-title>span{background:#0f172a;color:#fff;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900;white-space:nowrap}
      .jms-core-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.jms-core-kpis>div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:13px;padding:11px;text-align:center}.jms-core-kpis b{display:block;font-size:21px}.jms-core-kpis small{color:#64748b}
      .jms-core-tools{display:grid;grid-template-columns:1fr 1fr;gap:9px}.jms-core-tools button{border:1px solid #dbe3ee;background:#fff;border-radius:14px;padding:13px;text-align:right;cursor:pointer}.jms-core-tools button:hover{background:#f8fafc}.jms-core-tools b,.jms-core-tools small{display:block}.jms-core-tools small{color:#64748b;margin-top:4px;line-height:1.6}
      .jms-core-groups{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.jms-core-groups span{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:999px;padding:6px 9px;font-size:11px}.jms-core-issues{max-height:48vh;overflow:auto}.jms-core-issues>div{display:grid;gap:3px;border-bottom:1px solid #e5e7eb;padding:9px 2px}.jms-core-issues small{color:#64748b}.jms-core-ok{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;padding:12px;border-radius:13px;font-weight:900}
      @media(max-width:620px){.jms-core-tools{grid-template-columns:1fr}.jms-core-kpis{grid-template-columns:1fr 1fr 1fr}.jms-core-title{flex-direction:column}}
    `;document.head.appendChild(s)
  }

  function tick(){if(!getDb())return;normalizeOwnership();enforceRepScope();injectUnifiedImportButton();patchRepSelects()}
  function boot(){
    let tries=0;const t=setInterval(()=>{tries++;if(!getDb()){if(tries>40)clearInterval(t);return}clearInterval(t);installStyle();tick();window.JMS_CORE_V2={version:VERSION,audit,normalizeOwnership,normalizePhone,repRegistry,repOptions,syncRepRegistry,openImportCenter:window.openJmsImportCenter};console.info('JMS Core 2.0 Phase 2 active',audit());setInterval(tick,2500)},250);
  }
  document.addEventListener('jms:data-changed',e=>{if(e?.detail?.source!=='core-v2-normalized')setTimeout(()=>{try{normalizeOwnership()}catch(_){}},120)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
