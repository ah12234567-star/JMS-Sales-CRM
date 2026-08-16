/* JMS visit reason extension for the daily visit planner. */
(function(){
  'use strict';
  const VERSION='20260816-visit-reason-1';
  const STYLE_ID='jmsVisitReasonPlannerStyle';
  const reasons=[
    ['scheduled','زيارة دورية / مجدولة'],
    ['new_order','طلب جديد'],
    ['quotation','عرض سعر'],
    ['collection','تحصيل'],
    ['payment_followup','متابعة سداد'],
    ['follow_up','متابعة عميل'],
    ['sample','تسليم / استلام عينة'],
    ['complaint','شكوى أو ملاحظة'],
    ['other','أخرى']
  ];
  const reasonLabel=value=>reasons.find(x=>x[0]===value)?.[1]||value||'-';
  const dbRef=()=>{try{return db}catch(_){return window.db||{}}};
  const user=()=>window.currentUser||null;
  const localDate=()=>{const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
  const todayRoute=repId=>(dbRef().routes||[]).find(r=>r.rep_id===repId&&String(r.date||'').slice(0,10)===localDate())||null;
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state={};
  let installed=false;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .jms-selected-item{grid-template-columns:32px 1fr auto!important}.jms-visit-reason-wrap{grid-column:2/-1;display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:center;margin-top:4px}.jms-visit-reason-wrap label{font-size:10px;font-weight:800;color:#475569}.jms-visit-reason-select,.jms-visit-reason-note{width:100%;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:9px 10px;font:inherit;color:#111827}.jms-visit-reason-note{grid-column:2;margin-top:4px}.jms-purpose-badge{display:inline-flex;align-items:center;margin-top:5px;padding:4px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:9px;font-weight:900}.jms-report-purpose{display:inline-flex;margin-top:6px;margin-inline-end:6px;padding:4px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:9px;font-weight:900}
      @media(max-width:700px){.jms-visit-reason-wrap{grid-template-columns:1fr}.jms-visit-reason-note{grid-column:1}.jms-visit-reason-wrap label{margin-bottom:-3px}}
    `;document.head.appendChild(s);
  }

  function routeItem(cid,repId=user()?.id){return (todayRoute(repId)?.items||[]).find(i=>i.customer_id===cid)||null}
  function readReason(item){return item?.visit_reason||item?.purpose||item?.reason||''}
  function readNote(item){return item?.visit_reason_note||item?.reason_note||''}
  function optionsHtml(value){return `<option value="">اختر سبب الزيارة</option>`+reasons.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}
  function extractCid(row){const btn=[...row.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').includes('JMSVisitPlanner.remove'));const m=String(btn?.getAttribute('onclick')||'').match(/remove\(['"]([^'"]+)['"]\)/);return m?.[1]||''}

  function capture(){
    document.querySelectorAll('#jmsSelectedVisits .jms-selected-item').forEach(row=>{
      const cid=extractCid(row);if(!cid)return;
      const sel=row.querySelector('.jms-visit-reason-select');const note=row.querySelector('.jms-visit-reason-note');
      state[cid]={reason:sel?.value||state[cid]?.reason||'',note:note?.value||state[cid]?.note||''};
    });
  }
  function loadState(){
    Object.keys(state).forEach(k=>delete state[k]);
    const route=todayRoute(user()?.id);(route?.items||[]).forEach(i=>state[i.customer_id]={reason:readReason(i),note:readNote(i)});
  }
  function setReason(cid,value){state[cid]||={reason:'',note:''};state[cid].reason=value;const row=[...document.querySelectorAll('#jmsSelectedVisits .jms-selected-item')].find(r=>extractCid(r)===cid);const note=row?.querySelector('.jms-visit-reason-note');if(note)note.style.display=value==='other'?'block':'none'}
  function setNote(cid,value){state[cid]||={reason:'',note:''};state[cid].note=value}

  function enhancePlannerRows(){
    injectStyle();
    document.querySelectorAll('#jmsSelectedVisits .jms-selected-item').forEach(row=>{
      const cid=extractCid(row);if(!cid||row.querySelector('.jms-visit-reason-wrap'))return;
      const item=routeItem(cid);state[cid]||={reason:readReason(item),note:readNote(item)};
      const value=state[cid].reason||'';
      const wrap=document.createElement('div');wrap.className='jms-visit-reason-wrap';
      wrap.innerHTML=`<label>سبب الزيارة</label><select class="jms-visit-reason-select" onchange="JMSVisitReasonPlanner.setReason('${escapeHtml(cid)}',this.value)">${optionsHtml(value)}</select><input class="jms-visit-reason-note" placeholder="اكتب سبب الزيارة" value="${escapeHtml(state[cid].note||'')}" oninput="JMSVisitReasonPlanner.setNote('${escapeHtml(cid)}',this.value)" style="display:${value==='other'?'block':'none'}">`;
      row.appendChild(wrap);
    });
  }

  function saveReasons(){
    capture();
    const rows=[...document.querySelectorAll('#jmsSelectedVisits .jms-selected-item')];
    for(const row of rows){
      const cid=extractCid(row),r=state[cid]?.reason||'';
      if(!r){row.querySelector('.jms-visit-reason-select')?.focus();alert('حدد سبب الزيارة لكل عميل قبل الحفظ');return false}
      if(r==='other'&&!String(state[cid]?.note||'').trim()){row.querySelector('.jms-visit-reason-note')?.focus();alert('اكتب سبب الزيارة في خيار أخرى');return false}
    }
    return true;
  }
  function persistReasons(){
    const route=todayRoute(user()?.id);if(!route)return;
    (route.items||[]).forEach(i=>{const s=state[i.customer_id];if(s){i.visit_reason=s.reason;i.visit_reason_label=reasonLabel(s.reason);i.visit_reason_note=s.note||''}});
    try{if(typeof save==='function')save()}catch(e){console.error('JMS visit reason save failed',e)}
  }

  function purposeFor(repId,cid){const item=routeItem(cid,repId);return item?{reason:readReason(item),note:readNote(item)}:null}
  function enhancePlanBadges(){
    if(user()?.role!=='rep')return;
    const repId=user()?.id,route=todayRoute(repId);if(!route)return;
    document.querySelectorAll('#jmsTodayPlanStrip .jms-plan-row,#routesList .jms-plan-row').forEach(row=>{
      if(row.querySelector('.jms-purpose-badge'))return;
      const name=row.querySelector('h4')?.textContent?.trim();const c=(dbRef().customers||[]).find(x=>x.rep_id===repId&&x.name===name);if(!c)return;
      const p=purposeFor(repId,c.id);if(!p?.reason)return;
      const badge=document.createElement('span');badge.className='jms-purpose-badge';badge.textContent=`سبب الزيارة: ${reasonLabel(p.reason)}${p.note?` — ${p.note}`:''}`;row.querySelector('p')?.insertAdjacentElement('afterend',badge);
    });
  }
  function enhanceManagerReport(){
    if(!['admin','sales'].includes(user()?.role))return;
    document.querySelectorAll('#jmsTodayVisitReport .jms-rep-report').forEach(repBox=>{
      const repName=repBox.querySelector('.jms-rep-report-title b')?.textContent?.trim();const rep=(dbRef().reps||[]).find(r=>r.name===repName);if(!rep)return;
      repBox.querySelectorAll('.jms-report-event').forEach(event=>{
        if(event.querySelector('.jms-report-purpose'))return;
        const h=event.querySelector('h4');if(!h||h.textContent.includes('لم تبدأ بعد'))return;
        const customerName=h.childNodes[0]?.textContent?.trim()||h.textContent.trim();const c=(dbRef().customers||[]).find(x=>x.name===customerName);if(!c)return;
        const visit=(dbRef().visits||[]).filter(v=>v.rep_id===rep.id&&v.customer_id===c.id&&String(v.date||v.checkin_at||'').slice(0,10)===localDate()).sort((a,b)=>String(b.checkin_at||'').localeCompare(String(a.checkin_at||'')))[0];
        const planned=purposeFor(rep.id,c.id);const reason=visit?.type||planned?.reason;const note=planned?.note||'';if(!reason)return;
        const badge=document.createElement('span');badge.className='jms-report-purpose';badge.textContent=`سبب الزيارة: ${reasonLabel(reason)}${note?` — ${note}`:''}`;event.appendChild(badge);
      });
      const missed=[...repBox.querySelectorAll('.jms-report-event')].find(e=>e.querySelector('h4')?.textContent.includes('لم تبدأ بعد'));
      missed?.querySelectorAll('.jms-report-meta span').forEach(span=>{if(span.dataset.reasonDone)return;const text=span.textContent.replace(/^\s*\d+\.\s*/,'').trim();const c=(dbRef().customers||[]).find(x=>x.name===text);const p=c&&purposeFor(rep.id,c.id);if(p?.reason){span.textContent+=` — ${reasonLabel(p.reason)}${p.note?` (${p.note})`:''}`;span.dataset.reasonDone='1'}})
    });
  }
  function enhanceAll(){enhancePlannerRows();enhancePlanBadges();enhanceManagerReport()}

  function patchPlanner(){
    if(installed||!window.JMSVisitPlanner)return false;installed=true;injectStyle();
    const p=window.JMSVisitPlanner,origOpen=p.open,origAdd=p.add,origRemove=p.remove,origMove=p.move,origSave=p.save;
    p.open=function(){loadState();const r=origOpen.apply(this,arguments);setTimeout(enhancePlannerRows,0);return r};
    window.openTodayVisitPlanner=p.open;
    p.add=function(cid){capture();state[cid]||={reason:'',note:''};const r=origAdd.apply(this,arguments);setTimeout(enhancePlannerRows,0);return r};
    p.remove=function(cid){capture();delete state[cid];const r=origRemove.apply(this,arguments);setTimeout(enhancePlannerRows,0);return r};
    p.move=function(){capture();const r=origMove.apply(this,arguments);setTimeout(enhancePlannerRows,0);return r};
    p.save=function(){if(!saveReasons())return;const r=origSave.apply(this,arguments);persistReasons();setTimeout(()=>{try{window.renderRoutes?.();window.JMSDailyVisitReport?.refresh?.()}catch(_){}enhanceAll()},60);return r};
    p.version=VERSION;

    const origStart=window.startPlannedVisit;
    window.startPlannedVisit=function(cid){const pinfo=purposeFor(user()?.id,cid);const r=origStart?.apply(this,arguments);setTimeout(()=>{const sel=document.getElementById('svType');if(sel&&pinfo?.reason){if(![...sel.options].some(o=>o.value===pinfo.reason)){const o=document.createElement('option');o.value=pinfo.reason;o.textContent=reasonLabel(pinfo.reason);sel.appendChild(o)}sel.value=pinfo.reason}const notes=document.getElementById('svStartNotes');if(notes&&pinfo?.reason){const prefix=`سبب الزيارة: ${reasonLabel(pinfo.reason)}${pinfo.note?` — ${pinfo.note}`:''}`;if(!notes.value.includes(prefix))notes.value=[prefix,notes.value].filter(Boolean).join(' | ') }},30);return r};

    window.JMSVisitReasonPlanner={setReason,setNote,enhance:enhanceAll,version:VERSION};
    const observer=new MutationObserver(()=>setTimeout(enhanceAll,0));observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',()=>setTimeout(enhanceAll,80),true);
    setInterval(()=>{enhancePlanBadges();enhanceManagerReport()},5000);
    enhanceAll();return true;
  }
  const timer=setInterval(()=>{if(patchPlanner())clearInterval(timer)},100);
  setTimeout(()=>clearInterval(timer),15000);
})();
