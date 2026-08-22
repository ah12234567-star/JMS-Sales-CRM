/* JMS UPDATE 15B: Smart debt import by representative + conflict protection */
(function(){
  'use strict';
  const VERSION='2026-08-22-smart-debt-import-rep-conflicts';
  const CONFLICT_KEY='jms_last_debt_import_conflicts';

  function store(){ try{return (typeof db!=='undefined'?db:window.db)||{};}catch(_){return window.db||{};} }
  function user(){ try{return window.currentUser || (typeof currentUser!=='undefined'?currentUser:null);}catch(_){return window.currentUser||null;} }
  function canUse(){ const u=user(); return !!u && u.role==='admin'; }
  function saveNow(){ try{ if(typeof save==='function') save(); else window.save?.(); }catch(e){ console.error('JMS debt import save failed', e); } }
  function uid(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()+Math.random()); }
  function clean(v){ return String(v ?? '').trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'').replace(/\b(شركة|شركه|مؤسسة|موسسه|مؤسسه|مطاعم|مطعم|محلات|محل|فرع|للتجارة|للتجاره|التجارة|التجاره|مركز)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,'').trim(); }
  function number(v){
    let s=String(v ?? '').trim();
    if(!s) return 0;
    s=s.replace(/,/g,'').replace(/[ ريالSAR\s]/gi,'').replace(/[()]/g,'-');
    const n=Number(s.replace(/[^\d.-]/g,''));
    return Number.isFinite(n)?n:0;
  }
  function money(v){ return Number(v||0).toLocaleString('ar-SA',{maximumFractionDigits:2}); }
  function normalizePhone(v){
    let p=String(v ?? '').trim();
    if(/e\+?/i.test(p)){ const n=Number(p); if(!isNaN(n)) p=String(Math.trunc(n)); }
    p=p.replace(/\D/g,'');
    if(!p) return '';
    if(p.startsWith('00966')) p=p.slice(2);
    if(p.startsWith('966')) return p;
    if(p.startsWith('05') && p.length===10) return '966'+p.slice(1);
    if(p.startsWith('5') && p.length===9) return '966'+p;
    return p;
  }
  function repNameById(id){ const s=store(); return (s.reps||[]).find(r=>String(r.id)===String(id))?.name || (s.users||[]).find(u=>String(u.id)===String(id))?.name || id || 'بدون مندوب'; }
  function findRepFromValue(v){
    const s=store(); const raw=clean(v); if(!raw) return '';
    const low=raw.toLowerCase();
    if(low.includes('yaser') || raw.includes('ياسر')) return 'rep-yaser';
    if(low.includes('osman') || low.includes('othman') || raw.includes('عثمان')) return 'rep-osman';
    let r=(s.reps||[]).find(x=>clean(x.id)===raw); if(r) return r.id;
    r=(s.reps||[]).find(x=>String(x.email||'').toLowerCase()===low); if(r) return r.id;
    r=(s.reps||[]).find(x=>norm(x.name).includes(norm(raw)) || norm(raw).includes(norm(x.name))); if(r) return r.id;
    return '';
  }
  function valueOf(row, names){
    for(const n of names){ if(row[n]!==undefined && row[n]!==null && String(row[n]).trim()!=='') return row[n]; }
    const keys=Object.keys(row||{});
    for(const n of names){ const wanted=norm(n); const k=keys.find(x=>norm(x)===wanted || norm(x).includes(wanted)); if(k && String(row[k]??'').trim()!=='') return row[k]; }
    return '';
  }
  function repFromRow(row){ return findRepFromValue(valueOf(row,['rep_id','كود المندوب','rep_email','ايميل المندوب','إيميل المندوب','rep_name','اسم المندوب','المندوب','مندوب الحساب'])); }
  function selectedRep(row){ const selector=document.getElementById('debtImportTargetRep'); const v=selector?selector.value:'file'; if(v && v!=='file') return v; return repFromRow(row); }
  function similarName(a,b){ const x=norm(a), y=norm(b); if(!x||!y) return false; if(x===y) return true; return Math.min(x.length,y.length)>=5 && (x.includes(y)||y.includes(x)); }
  function parseCsvLine(line){ const cells=[]; let cur='', q=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"' && line[i+1]==='"'){cur+='"';i++;continue;} if(ch==='"'){q=!q;continue;} if(ch===','&&!q){cells.push(cur);cur='';continue;} cur+=ch; } cells.push(cur); return cells.map(x=>x.trim()); }
  function simpleCsv(text){ const lines=String(text||'').replace(/^\ufeff/,'').replace(/\r/g,'').split('\n').filter(x=>x.trim()); if(!lines.length) return []; const h=parseCsvLine(lines[0]); return lines.slice(1).map(line=>{ const v=parseCsvLine(line), o={}; h.forEach((k,i)=>o[k]=v[i]||''); return o; }); }
  function readFile(file, cb){
    const ext=file.name.toLowerCase().split('.').pop();
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        if(ext==='xlsx'||ext==='xls'){
          if(!window.XLSX) throw new Error('مكتبة قراءة Excel غير محملة. حدث الصفحة وجرب مرة ثانية.');
          const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
          const sh=wb.Sheets[wb.SheetNames[0]];
          cb(XLSX.utils.sheet_to_json(sh,{defval:''}), null);
        }else cb(simpleCsv(String(e.target.result||'')), null);
      }catch(err){ cb(null, err.message || String(err)); }
    };
    if(ext==='xlsx'||ext==='xls') reader.readAsArrayBuffer(file); else reader.readAsText(file,'UTF-8');
  }
  function normalizeDebtRow(row){
    const name=clean(valueOf(row,['name','اسم العميل','العميل','الاسم','Customer Name','customer']));
    const phone=normalizePhone(valueOf(row,['phone','رقم الجوال','الجوال','Mobile','Phone']));
    const code=clean(valueOf(row,['code','account_code','customer_code','erp_code','الرمز','كود العميل','رقم الحساب']));
    const city=clean(valueOf(row,['city','المدينة','City'])) || 'جدة';
    const rawBalance=valueOf(row,['debt_balance','balance','الرصيد','المديونية','رصيد المديونية','Balance','Amount']);
    const balance=number(rawBalance);
    const rep_id=selectedRep(row);
    if(!name && !phone && !code) return null;
    const aging={
      d30:number(valueOf(row,['30 يوم','0-30','0_30','aging_30','30'])),
      d60:number(valueOf(row,['60 يوم','31-60','31_60','aging_60','60'])),
      d90:number(valueOf(row,['90 يوم','61-90','61_90','aging_90','90'])),
      d120:number(valueOf(row,['120 يوم','91-120','91_120','aging_120','120'])),
      d150:number(valueOf(row,['150 يوم','121-150','121_150','aging_150','150'])),
      over150:number(valueOf(row,['فوق 150 يوم','اكثر من 150','أكثر من 150','over150','aging_over_150']))
    };
    return {name,phone,code,city,balance,rep_id,aging,source:row};
  }
  function findCustomer(row){
    const s=store(); const customers=s.customers||[];
    if(row.phone){ const hit=customers.find(c=>normalizePhone(c.phone)===row.phone); if(hit) return {customer:hit, reason:'نفس رقم الجوال'}; }
    if(row.code){ const hit=customers.find(c=>['account_code','customer_code','code','erp_code'].some(k=>clean(c[k])===row.code)); if(hit) return {customer:hit, reason:'نفس رمز الحساب'}; }
    if(row.name){ const exact=customers.find(c=>similarName(c.name,row.name) && (!c.city || !row.city || clean(c.city)===clean(row.city))); if(exact) return {customer:exact, reason:'اسم مشابه/مطابق في نفس المدينة'}; }
    return null;
  }
  function ageMeta(aging,balance){
    if(balance<0) return {code:'advance', label:'رصيد دائن / دفعة مقدمة', overdue:false};
    if(balance>0 && balance<500) return {code:'zeroed_small', label:'أقل من 500 ريال', overdue:false};
    if(number(aging.over150)>0) return {code:'over150',label:'أكثر من 150 يوم',overdue:true};
    if(number(aging.d150)>0) return {code:'121_150',label:'121–150 يوم',overdue:true};
    if(number(aging.d120)>0) return {code:'91_120',label:'91–120 يوم',overdue:true};
    if(number(aging.d90)>0) return {code:'61_90',label:'61–90 يوم',overdue:true};
    if(number(aging.d60)>0) return {code:'31_60',label:'31–60 يوم',overdue:true};
    if(number(aging.d30)>0) return {code:'0_30',label:'حتى 30 يوم',overdue:false};
    return {code:balance>0?'debt':'clear',label:balance>0?'مديونية بدون عمر':'لا توجد مديونية',overdue:false};
  }
  function applyDebt(customer,row,moveRep){
    const age=ageMeta(row.aging,row.balance);
    customer.account_code=row.code || customer.account_code || customer.customer_code || '';
    customer.phone=customer.phone || row.phone || '';
    customer.city=customer.city || row.city || 'جدة';
    if(moveRep && row.rep_id) customer.rep_id=row.rep_id;
    customer.debt_balance=row.balance;
    customer.advance_balance=row.balance<0?Math.abs(row.balance):0;
    customer.account_balance_type=row.balance<0?'advance':row.balance>0?'debt':'clear';
    customer.aging_30=row.aging.d30;
    customer.aging_60=row.aging.d60;
    customer.aging_90=row.aging.d90;
    customer.aging_120=row.aging.d120;
    customer.aging_150=row.aging.d150;
    customer.aging_over_150=row.aging.over150;
    customer.debt_age_bucket=age.code;
    customer.debt_age_label=age.label;
    customer.debt_overdue=!!age.overdue;
    customer.debt_aging_updated_at=new Date().toISOString();
    customer.debt_aging_source='smart_debt_import';
    customer.updated_at=new Date().toISOString();
  }
  function addMissing(row){
    const s=store(); s.customers ||= [];
    const c={id:uid(),name:row.name||row.code||'عميل بدون اسم',phone:row.phone||'',city:row.city||'جدة',district:'',location:'',category:'عميل',status:'active',rep_id:row.rep_id||'',credit_limit:0,created_at:new Date().toISOString()};
    applyDebt(c,row,false); s.customers.push(c); return c;
  }
  function runImportRows(rows){
    const policy=document.getElementById('debtDuplicatePolicy')?.value || 'conflict';
    const missingPolicy=document.getElementById('debtMissingPolicy')?.value || 'skip';
    let updated=0,moved=0,created=0,skipped=0; const conflicts=[], unmatched=[];
    (rows||[]).forEach((raw,idx)=>{
      const row=normalizeDebtRow(raw); if(!row){skipped++; return;}
      if(!row.rep_id){ conflicts.push({row:idx+2,name:row.name,phone:row.phone,oldRep:'-',newRep:'-',reason:'لا يوجد مندوب في الملف ولم يتم اختيار مندوب'}); skipped++; return; }
      const dup=findCustomer(row);
      if(!dup){
        if(missingPolicy==='create'){ addMissing(row); created++; }
        else { unmatched.push({row:idx+2,name:row.name,phone:row.phone,rep_id:row.rep_id,balance:row.balance,reason:'لم يتم العثور على عميل مطابق'}); skipped++; }
        return;
      }
      const c=dup.customer; const oldRep=c.rep_id||''; const newRep=row.rep_id||oldRep;
      if(oldRep && newRep && oldRep!==newRep && policy!=='move'){
        conflicts.push({row:idx+2,name:row.name||c.name,phone:row.phone||c.phone,existingName:c.name,oldRep,newRep,reason:dup.reason}); skipped++; return;
      }
      applyDebt(c,row,policy==='move' && oldRep!==newRep);
      if(oldRep!==c.rep_id) moved++; else updated++;
    });
    localStorage.setItem(CONFLICT_KEY,JSON.stringify({conflicts,unmatched,at:new Date().toISOString()}));
    saveNow();
    if(typeof renderAll==='function') renderAll();
    if(typeof renderCustomers==='function') renderCustomers();
    return {updated,moved,created,skipped,conflicts,unmatched};
  }
  function renderResult(out){
    const box=document.getElementById('debtImportResult');
    const conflictBox=document.getElementById('debtImportConflicts');
    if(box) box.textContent=`تمت معالجة ملف الديون\nالمحدّث: ${out.updated}\nالمنقول: ${out.moved}\nالمضاف: ${out.created}\nالمتجاهل: ${out.skipped}\nتعارضات المندوب: ${out.conflicts.length}\nغير مطابق: ${out.unmatched.length}`;
    let html='';
    if(out.conflicts.length){
      html += `<div class="panel import-conflict-panel"><h3>تعارضات المندوب</h3><p>لم يتم تعديل هؤلاء حتى لا تختلط ديون ياسر مع عثمان أو العكس.</p><div class="table-wrap"><table><thead><tr><th>السطر</th><th>الاسم في الملف</th><th>الجوال</th><th>موجود باسم</th><th>المندوب الحالي</th><th>المندوب المطلوب</th><th>السبب</th></tr></thead><tbody>${out.conflicts.slice(0,100).map(x=>`<tr><td>${x.row}</td><td>${x.name||'-'}</td><td>${x.phone||'-'}</td><td>${x.existingName||'-'}</td><td>${repNameById(x.oldRep)}</td><td>${repNameById(x.newRep)}</td><td>${x.reason}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if(out.unmatched.length){
      html += `<div class="panel import-conflict-panel"><h3>عملاء غير موجودين</h3><p>هؤلاء موجودون في ملف الديون لكن لم أجد لهم عميل مطابق في النظام.</p><div class="table-wrap"><table><thead><tr><th>السطر</th><th>الاسم</th><th>الجوال</th><th>المندوب</th><th>الرصيد</th><th>السبب</th></tr></thead><tbody>${out.unmatched.slice(0,100).map(x=>`<tr><td>${x.row}</td><td>${x.name||'-'}</td><td>${x.phone||'-'}</td><td>${repNameById(x.rep_id)}</td><td>${money(x.balance)}</td><td>${x.reason}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if(conflictBox) conflictBox.innerHTML=html || '<div class="hint">لا توجد تعارضات.</div>';
  }
  window.openSmartDebtImport=function(){
    if(!canUse()) return alert('استيراد الديون متاح فقط لمدير النظام');
    const s=store(); s.reps ||= [];
    const reps=s.reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    modalBody.innerHTML=`<h2>استيراد الديون الذكي</h2>
      <div class="import-help">اختر المندوب قبل رفع ملف الديون. إذا ظهر العميل عند مندوب آخر، النظام لا يغيره ولا يكرر البيانات، بل يعرض تعارض واضح للمراجعة.</div>
      <div class="form-grid two">
        <label>ربط الديون على المندوب
          <select id="debtImportTargetRep"><option value="file">حسب الملف / مندوب الحساب</option>${reps}</select>
        </label>
        <label>سياسة تعارض المندوب
          <select id="debtDuplicatePolicy"><option value="conflict">اعرض تعارض ولا تنقل</option><option value="move">انقل العميل للمندوب المختار ثم حدّث الدين</option></select>
        </label>
        <label>إذا العميل غير موجود
          <select id="debtMissingPolicy"><option value="skip">لا تضف، اعرضه كمشكلة</option><option value="create">أضف عميل جديد على المندوب المختار</option></select>
        </label>
        <label>ملف الديون Excel / CSV<input id="smartDebtImportFile" type="file" accept=".xlsx,.xls,.csv"></label>
      </div>
      <div class="import-actions"><button class="import" onclick="runSmartDebtImport()">استيراد الديون الآن</button></div>
      <pre id="debtImportResult" class="import-result">لم يتم الاستيراد بعد.</pre>
      <div id="debtImportConflicts"></div>`;
    modal.classList.remove('hidden');
  };
  window.runSmartDebtImport=function(){
    const file=document.getElementById('smartDebtImportFile')?.files?.[0];
    if(!file) return alert('اختر ملف الديون أولاً');
    const result=document.getElementById('debtImportResult'); if(result) result.textContent='جاري قراءة الملف...';
    readFile(file,(rows,err)=>{ if(err){ if(result) result.textContent='خطأ: '+err; return; } renderResult(runImportRows(rows)); });
  };
  function injectButton(){
    if(!canUse()) return;
    const page=document.getElementById('customers'); if(!page) return;
    const head=page.querySelector('.page-head'); if(!head) return;
    let actions=head.querySelector('.head-actions'); if(!actions){ actions=document.createElement('div'); actions.className='head-actions'; head.appendChild(actions); }
    const old=document.getElementById('jmsDebtAgingImportBtn'); if(old){ old.onclick=window.openSmartDebtImport; old.textContent='استيراد الديون الذكي'; return; }
    if(document.getElementById('jmsSmartDebtImportBtn')) return;
    const btn=document.createElement('button'); btn.id='jmsSmartDebtImportBtn'; btn.type='button'; btn.className='primary secondary'; btn.textContent='استيراد الديون الذكي'; btn.onclick=window.openSmartDebtImport; actions.appendChild(btn);
  }
  function injectStyle(){ if(document.getElementById('jmsSmartDebtImportStyle')) return; const st=document.createElement('style'); st.id='jmsSmartDebtImportStyle'; st.textContent='.import-help{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:14px;margin:10px 0;line-height:1.8}.import-result{background:#0f172a;color:#fff;border-radius:14px;padding:12px;white-space:pre-wrap}.import-conflict-panel{margin-top:12px}.table-wrap{overflow:auto}.table-wrap table{width:100%;border-collapse:collapse}.table-wrap th,.table-wrap td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;white-space:nowrap}'; document.head.appendChild(st); }
  function tick(){ injectStyle(); injectButton(); }
  window.addEventListener('load',()=>setTimeout(tick,900));
  setInterval(tick,2500);
})();
