/* JMS UPDATE 15C: Smart customer re-import for phone update by representative */
(function(){
  'use strict';
  const VERSION='2026-08-22-customer-phone-update-v2';
  const REPORT_KEY='jms_last_customer_phone_update_report';

  function store(){ try{return (typeof db!=='undefined'?db:window.db)||{};}catch(_){return window.db||{};} }
  function user(){ try{return window.currentUser || (typeof currentUser!=='undefined'?currentUser:null);}catch(_){return window.currentUser||null;} }
  function canUse(){ const u=user(); return !!u && u.role==='admin'; }
  function saveNow(){ try{ if(typeof save==='function') save(); else window.save?.(); }catch(e){ console.error('JMS phone update save failed', e); } }
  function uid(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()+Math.random()); }
  function clean(v){ return String(v ?? '').trim(); }
  function norm(v){
    return clean(v).toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'')
      .replace(/\b(شركة|شركه|مؤسسة|موسسه|مؤسسه|مطاعم|مطعم|محلات|محل|فرع|للتجارة|للتجاره|التجارة|التجاره|مركز|مصنع|مخابز|مطابخ)\b/g,'')
      .replace(/[^\p{L}\p{N}]+/gu,'')
      .trim();
  }
  function displayPhone(p){ return p ? p : 'بدون رقم'; }
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
  function money(v){ return Number(v||0).toLocaleString('ar-SA',{maximumFractionDigits:2}); }
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
  function valueOf(row,names){
    for(const n of names){ if(row[n]!==undefined && row[n]!==null && String(row[n]).trim()!=='') return row[n]; }
    const keys=Object.keys(row||{});
    for(const n of names){ const wanted=norm(n); const k=keys.find(x=>norm(x)===wanted || norm(x).includes(wanted)); if(k && String(row[k]??'').trim()!=='') return row[k]; }
    return '';
  }
  function selectedRep(row){
    const selector=document.getElementById('phoneUpdateTargetRep'); const chosen=selector?selector.value:'';
    if(chosen && chosen!=='file') return chosen;
    return findRepFromValue(valueOf(row,['rep_id','كود المندوب','rep_email','ايميل المندوب','إيميل المندوب','rep_name','اسم المندوب','المندوب','مندوب الحساب'])) || 'rep-osman';
  }
  function similarName(a,b){ const x=norm(a), y=norm(b); if(!x||!y) return false; if(x===y) return true; return Math.min(x.length,y.length)>=5 && (x.includes(y)||y.includes(x)); }
  function parseCsvLine(line){ const cells=[]; let cur='', q=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"' && line[i+1]==='"'){cur+='"';i++;continue;} if(ch==='"'){q=!q;continue;} if(ch===','&&!q){cells.push(cur);cur='';continue;} cur+=ch; } cells.push(cur); return cells.map(x=>x.trim()); }
  function simpleCsv(text){ const lines=String(text||'').replace(/^\ufeff/,'').replace(/\r/g,'').split('\n').filter(x=>x.trim()); if(!lines.length) return []; const h=parseCsvLine(lines[0]); return lines.slice(1).map(line=>{ const v=parseCsvLine(line), o={}; h.forEach((k,i)=>o[k]=v[i]||''); return o; }); }
  function sheetRowsToObjects(rows){
    if(!Array.isArray(rows)||!rows.length) return [];
    let headerIndex=0;
    for(let i=0;i<Math.min(15,rows.length);i++){
      const n=(rows[i]||[]).map(x=>norm(x));
      if(n.some(x=>['name','اسم العميل','العميل','الاسم','customername'].map(norm).includes(x)) || n.some(x=>x.includes('جوال')||x.includes('phone')||x.includes('mobile'))){ headerIndex=i; break; }
    }
    const headers=(rows[headerIndex]||[]).map((h,i)=>clean(h)||('col_'+i));
    return rows.slice(headerIndex+1).map(row=>{ const o={}; headers.forEach((h,i)=>o[h]=row[i]??''); return o; });
  }
  function readFile(file,cb){
    const ext=file.name.toLowerCase().split('.').pop(); const reader=new FileReader();
    reader.onload=e=>{
      try{
        if(ext==='xlsx'||ext==='xls'){
          if(!window.XLSX) throw new Error('مكتبة قراءة Excel غير محملة. حدث الصفحة وجرب مرة ثانية.');
          const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'}); const sh=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:''}); cb(sheetRowsToObjects(rows),null);
        }else cb(simpleCsv(String(e.target.result||'')),null);
      }catch(err){ cb(null, err.message || String(err)); }
    };
    if(ext==='xlsx'||ext==='xls') reader.readAsArrayBuffer(file); else reader.readAsText(file,'UTF-8');
  }
  function normalizeCustomerRow(row){
    const name=clean(valueOf(row,['name','اسم العميل','العميل','الاسم','Customer Name','customer','client']));
    const phone=normalizePhone(valueOf(row,['phone','رقم الجوال','الجوال','جوال','Mobile','Phone','mobile','tel','هاتف']));
    const city=clean(valueOf(row,['city','المدينة','City'])) || 'جدة';
    const district=clean(valueOf(row,['district','الحي','District']));
    const location=clean(valueOf(row,['location','العنوان','الموقع','Address']));
    const category=clean(valueOf(row,['category','التصنيف'])) || 'عميل';
    const code=clean(valueOf(row,['code','account_code','customer_code','erp_code','الرمز','كود العميل','رقم الحساب']));
    const notes=clean(valueOf(row,['notes','ملاحظات','note']));
    const rep_id=selectedRep(row);
    if(!name && !phone && !code) return null;
    return {name,phone,city,district,location,category,code,notes,rep_id};
  }
  function customerCode(c){ return clean(c.account_code||c.customer_code||c.code||c.erp_code); }
  function findInTarget(row){
    const customers=store().customers||[]; const repId=row.rep_id||'';
    const target=customers.filter(c=>String(c.rep_id||'')===String(repId));
    if(row.code){ const hit=target.find(c=>customerCode(c)===row.code); if(hit) return {customer:hit,reason:'نفس رمز العميل'}; }
    if(row.name){
      const byName=target.filter(c=>similarName(c.name,row.name) && (!c.city || !row.city || clean(c.city)===clean(row.city)));
      if(byName.length===1) return {customer:byName[0],reason:'نفس الاسم عند نفس المندوب'};
      if(byName.length>1) return {multi:byName,reason:'أكثر من عميل بنفس الاسم عند نفس المندوب'};
    }
    if(row.phone){ const hit=target.find(c=>normalizePhone(c.phone)===row.phone); if(hit) return {customer:hit,reason:'نفس رقم الجوال عند نفس المندوب'}; }
    return null;
  }
  function findConflictOtherRep(row){
    const customers=store().customers||[];
    if(row.phone){ const hit=customers.find(c=>String(c.rep_id||'')!==String(row.rep_id||'') && normalizePhone(c.phone)===row.phone); if(hit) return {customer:hit,reason:'نفس رقم الجوال عند مندوب آخر'}; }
    if(row.code){ const hit=customers.find(c=>String(c.rep_id||'')!==String(row.rep_id||'') && customerCode(c)===row.code); if(hit) return {customer:hit,reason:'نفس رمز العميل عند مندوب آخر'}; }
    if(row.name){ const hit=customers.find(c=>String(c.rep_id||'')!==String(row.rep_id||'') && similarName(c.name,row.name) && (!c.city || !row.city || clean(c.city)===clean(row.city))); if(hit) return {customer:hit,reason:'اسم مشابه عند مندوب آخر'}; }
    return null;
  }
  function updateExisting(c,row){
    const oldPhone=normalizePhone(c.phone); const newPhone=row.phone;
    if(newPhone) c.phone=newPhone;
    if(row.city) c.city=row.city;
    if(row.district) c.district=row.district;
    if(row.location) c.location=row.location;
    if(row.category) c.category=row.category;
    if(row.code){ c.account_code=c.account_code||row.code; c.customer_code=c.customer_code||row.code; }
    if(row.notes){ c.notes=[c.notes,row.notes].filter(Boolean).join(' | '); }
    c.updated_at=new Date().toISOString();
    return oldPhone!==normalizePhone(c.phone);
  }
  function addCustomer(row){
    const s=store(); s.customers ||= [];
    const c={id:uid(),name:row.name||row.code||row.phone||'عميل بدون اسم',phone:row.phone||'',city:row.city||'جدة',district:row.district||'',location:row.location||'',category:row.category||'عميل',status:'active',rep_id:row.rep_id||'',credit_limit:0,debt_balance:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    if(row.code){ c.account_code=row.code; c.customer_code=row.code; }
    if(row.notes) c.notes=row.notes;
    s.customers.push(c); return c;
  }
  function processRows(rows){
    const missingPolicy=document.getElementById('phoneUpdateMissingPolicy')?.value || 'skip';
    let updated=0, phoneChanged=0, noChange=0, created=0, skipped=0; const conflicts=[], multiple=[], unmatched=[];
    (rows||[]).forEach((raw,idx)=>{
      const row=normalizeCustomerRow(raw); if(!row){ skipped++; return; }
      if(!row.rep_id){ conflicts.push({row:idx+2,name:row.name,phone:row.phone,oldRep:'-',newRep:'-',reason:'لم يتم تحديد المندوب'}); skipped++; return; }
      const same=findInTarget(row);
      if(same?.multi){ multiple.push({row:idx+2,name:row.name,phone:row.phone,rep_id:row.rep_id,count:same.multi.length,reason:same.reason}); skipped++; return; }
      if(same?.customer){
        const changed=updateExisting(same.customer,row); updated++; if(changed) phoneChanged++; else noChange++; return;
      }
      const conflict=findConflictOtherRep(row);
      if(conflict?.customer){ conflicts.push({row:idx+2,name:row.name,phone:row.phone,existingName:conflict.customer.name,oldRep:conflict.customer.rep_id||'',newRep:row.rep_id,reason:conflict.reason}); skipped++; return; }
      if(missingPolicy==='create'){ addCustomer(row); created++; }
      else { unmatched.push({row:idx+2,name:row.name,phone:row.phone,rep_id:row.rep_id,reason:'غير موجود عند المندوب المختار'}); skipped++; }
    });
    localStorage.setItem(REPORT_KEY,JSON.stringify({updated,phoneChanged,noChange,created,skipped,conflicts,multiple,unmatched,at:new Date().toISOString()}));
    saveNow(); if(typeof renderAll==='function') renderAll(); if(typeof renderCustomers==='function') renderCustomers();
    return {updated,phoneChanged,noChange,created,skipped,conflicts,multiple,unmatched};
  }
  function resultHtml(out){
    let html=`<div class="jms-phone-result">تمت معالجة ملف العملاء\nالمحدث: ${out.updated}\nأرقام تغيرت: ${out.phoneChanged}\nبدون تغيير: ${out.noChange}\nالمضاف: ${out.created}\nالمتجاهل: ${out.skipped}\nتعارضات مندوب: ${out.conflicts.length}\nأسماء متكررة عند نفس المندوب: ${out.multiple.length}\nغير موجود: ${out.unmatched.length}</div>`;
    const rows=(title,items,mapper)=>items.length?`<div class="panel import-conflict-panel"><h3>${title}</h3><div class="table-wrap"><table><thead><tr><th>السطر</th><th>الاسم</th><th>الجوال</th><th>تفصيل</th><th>المندوب الحالي</th><th>المندوب المطلوب</th></tr></thead><tbody>${items.slice(0,100).map(mapper).join('')}</tbody></table></div></div>`:'';
    html+=rows('تعارضات لا يتم تعديلها حتى لا تختلط العملاء',out.conflicts,x=>`<tr><td>${x.row}</td><td>${x.name||x.existingName||'-'}</td><td>${displayPhone(x.phone)}</td><td>${x.reason||'-'}</td><td>${repNameById(x.oldRep)}</td><td>${repNameById(x.newRep)}</td></tr>`);
    html+=rows('أسماء متكررة عند نفس المندوب تحتاج مراجعة',out.multiple,x=>`<tr><td>${x.row}</td><td>${x.name||'-'}</td><td>${displayPhone(x.phone)}</td><td>${x.count} عملاء بنفس الاسم</td><td>${repNameById(x.rep_id)}</td><td>${repNameById(x.rep_id)}</td></tr>`);
    if(out.unmatched.length) html+=`<div class="panel import-conflict-panel"><h3>عملاء غير موجودين عند المندوب المختار</h3><p>لم أضفهم لأن اختيارك كان تحديث الموجود فقط. لتضيفهم، افتح النافذة مرة ثانية واختر: إضافة غير الموجود.</p></div>`;
    return html;
  }
  window.openCustomerPhoneUpdateImportV2=function(){
    if(!canUse()) return alert('تحديث أرقام العملاء متاح لمدير النظام فقط');
    const s=store(); s.reps ||= []; s.customers ||= [];
    const repOptions=(s.reps||[]).map(r=>`<option value="${r.id}" ${String(r.id)==='rep-osman'?'selected':''}>${r.name}</option>`).join('');
    const body=window.modalBody||document.getElementById('modalBody'), m=window.modal||document.getElementById('modal'); if(!body||!m) return alert('تعذر فتح نافذة الاستيراد');
    body.innerHTML=`<h2>تحديث أرقام العملاء من Excel / CSV</h2>
      <div class="import-help">استخدم هذا الخيار لإعادة استيراد عملاء عثمان أو أي مندوب لتحديث الجوالات فقط بدون تكرار. النظام يطابق بالاسم/الكود داخل المندوب المختار، وإذا وجد العميل عند مندوب آخر يعرض تعارض ولا يعدله.</div>
      <div class="form-grid two">
        <label>ربط وتحديث العملاء على المندوب
          <select id="phoneUpdateTargetRep"><option value="file">حسب الملف / rep_id</option>${repOptions}</select>
        </label>
        <label>إذا العميل غير موجود عند المندوب المختار
          <select id="phoneUpdateMissingPolicy">
            <option value="skip">حدث الموجود فقط ولا تضف جديد</option>
            <option value="create">أضف عميل جديد على المندوب المختار</option>
          </select>
        </label>
      </div>
      <div class="import-help">الأعمدة المقبولة: <b>name / اسم العميل</b> + <b>phone / الجوال</b>، ويفضل city والرمز إن موجود.</div>
      <div class="import-drop"><b>اختر ملف العملاء</b><input id="phoneUpdateFile" type="file" accept=".xlsx,.xls,.csv"><small>لعملاء عثمان: اختر عثمان بالأعلى، ثم ارفع ملفه الجديد.</small></div>
      <div class="import-actions"><button class="import" onclick="runCustomerPhoneUpdateImportV2()">تحديث أرقام العملاء الآن</button></div>
      <div id="phoneUpdateResult" class="import-result">لم يتم التحديث بعد.</div>
      <div id="phoneUpdateDetails"></div>`;
    m.classList.remove('hidden');
  };
  window.runCustomerPhoneUpdateImportV2=function(){
    const file=document.getElementById('phoneUpdateFile')?.files?.[0];
    const res=document.getElementById('phoneUpdateResult'), details=document.getElementById('phoneUpdateDetails');
    if(!file) return alert('اختر ملف Excel أو CSV أولاً');
    if(res) res.textContent='جاري قراءة الملف...'; if(details) details.innerHTML='';
    readFile(file,(rows,err)=>{
      if(err){ if(res) res.textContent='خطأ: '+err; return; }
      const out=processRows(rows); if(res) res.outerHTML=resultHtml(out); else if(details) details.innerHTML=resultHtml(out);
    });
  };
  function injectButton(){
    if(!canUse()) return;
    const page=document.getElementById('customers'); if(!page) return;
    const head=page.querySelector('.page-head'); if(!head) return;
    let actions=head.querySelector('.head-actions'); if(!actions){ actions=document.createElement('div'); actions.className='head-actions'; head.appendChild(actions); }
    if(!document.getElementById('jmsPhoneUpdateV2Btn')){
      const b=document.createElement('button'); b.id='jmsPhoneUpdateV2Btn'; b.type='button'; b.className='primary secondary'; b.textContent='تحديث أرقام العملاء V2'; b.onclick=window.openCustomerPhoneUpdateImportV2; actions.appendChild(b);
    }
    document.querySelectorAll('button').forEach(btn=>{
      const t=(btn.textContent||'').trim();
      if(t==='استيراد العملاء' || t.includes('استيراد العملاء من')) btn.onclick=window.openCustomerPhoneUpdateImportV2;
    });
  }
  function injectStyle(){ if(document.getElementById('jmsPhoneUpdateV2Style')) return; const st=document.createElement('style'); st.id='jmsPhoneUpdateV2Style'; st.textContent='.jms-phone-result,.import-result{background:#0f172a;color:#fff;border-radius:14px;padding:12px;white-space:pre-wrap}.import-help{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:14px;margin:10px 0;line-height:1.8}.import-conflict-panel{margin-top:12px}.table-wrap{overflow:auto}.table-wrap table{width:100%;border-collapse:collapse}.table-wrap th,.table-wrap td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;white-space:nowrap}'; document.head.appendChild(st); }
  function tick(){ injectStyle(); injectButton(); }
  window.addEventListener('load',()=>setTimeout(tick,700)); setInterval(tick,2000);
})();
