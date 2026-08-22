/* JMS UPDATE 15: Smart customer import by representative + duplicate/conflict protection */
(function(){
  const IMPORT_KEY='jms_last_customer_import_conflicts';
  function ensure(){ db.customers ||= []; db.reps ||= []; db.users ||= []; }
  function safeId(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()+Math.random()); }
  function clean(v){ return String(v ?? '').trim(); }
  function moneyText(v){ const n=Number(v||0); return isNaN(n)?'0':n.toLocaleString('ar-SA',{maximumFractionDigits:2}); }
  function num(v){
    const raw=String(v ?? '').replace(/,/g,'').replace(/[ ريالSAR\s]/gi,'');
    const n=Number(raw.replace(/[^\d.-]/g,''));
    return isNaN(n)?0:n;
  }
  function normalizePhone(v){
    let p=String(v ?? '').trim();
    if(/e\+?/i.test(p)){
      const n=Number(p);
      if(!isNaN(n)) p=String(Math.trunc(n));
    }
    p=p.replace(/\D/g,'');
    if(!p) return '';
    if(p.startsWith('00966')) p=p.slice(2);
    if(p.startsWith('966')) return p;
    if(p.startsWith('05') && p.length===10) return '966'+p.slice(1);
    if(p.startsWith('5') && p.length===9) return '966'+p;
    return p;
  }
  function normalizeName(v){
    return clean(v)
      .replace(/[إأآا]/g,'ا')
      .replace(/[ة]/g,'ه')
      .replace(/[ى]/g,'ي')
      .replace(/[ـ]/g,'')
      .replace(/[ًٌٍَُِّْ]/g,'')
      .replace(/\b(شركة|شركه|مؤسسة|موسسه|مؤسسه|مطاعم|مطعم|محلات|محل|فرع|للتجارة|للتجاره|التجارة|التجاره|مركز)\b/g,'')
      .replace(/[\s\-_.،,\/\\()]+/g,'')
      .toLowerCase();
  }
  function sameOrSimilarName(a,b){
    const x=normalizeName(a), y=normalizeName(b);
    if(!x || !y) return false;
    if(x===y) return true;
    if(Math.min(x.length,y.length)>=5 && (x.includes(y)||y.includes(x))) return true;
    return false;
  }
  function repNameById(id){
    return (db.reps||[]).find(r=>r.id===id)?.name || (db.users||[]).find(u=>u.id===id)?.name || id || 'بدون مندوب';
  }
  function findRepFromValue(v){
    const raw=clean(v);
    if(!raw) return '';
    const low=raw.toLowerCase();
    if(low.includes('yaser') || raw.includes('ياسر')) return 'rep-yaser';
    if(low.includes('osman') || raw.includes('عثمان')) return 'rep-osman';
    let r=(db.reps||[]).find(x=>clean(x.id)===raw);
    if(r) return r.id;
    r=(db.reps||[]).find(x=>String(x.email||'').toLowerCase()===low);
    if(r) return r.id;
    r=(db.reps||[]).find(x=>clean(x.name).includes(raw) || raw.includes(clean(x.name)));
    if(r) return r.id;
    return '';
  }
  function repFromRow(row){
    return findRepFromValue(row.rep_id || row['rep_id'] || row['كود المندوب']) ||
           findRepFromValue(row.rep_email || row['rep_email'] || row['ايميل المندوب'] || row['إيميل المندوب']) ||
           findRepFromValue(row.rep_name || row['rep_name'] || row['اسم المندوب'] || row['المندوب']) || '';
  }
  function selectedImportRep(row){
    const selector=document.getElementById('importTargetRep');
    const value=selector ? selector.value : 'file';
    if(value && value!=='file') return value;
    return repFromRow(row) || 'rep-yaser';
  }
  function normalizeRow(row){
    const name = clean(row.name || row['name'] || row['اسم العميل'] || row['العميل'] || row['Customer Name'] || row['customer']);
    if(!name) return null;
    const phone = normalizePhone(row.phone || row['phone'] || row['الجوال'] || row['رقم الجوال'] || row['Mobile'] || row['Phone']);
    const city = clean(row.city || row['city'] || row['المدينة'] || row['City']) || 'جدة';
    const district = clean(row.district || row['district'] || row['الحي'] || row['District']);
    const location = clean(row.location || row['location'] || row['العنوان'] || row['الموقع'] || row['Address']);
    const category = clean(row.category || row['category'] || row['التصنيف']) || 'عميل';
    const notes = clean(row.notes || row['notes'] || row['ملاحظات']);
    const debt = num(row.debt_balance || row['debt_balance'] || row.balance || row['balance'] || row['الرصيد'] || row['المديونية'] || row['رصيد المديونية']);
    const lat = num(row.lat || row['lat'] || row['latitude'] || row['خط العرض']);
    const lng = num(row.lng || row['lng'] || row['longitude'] || row['خط الطول']);
    return {name,phone,city,district,location,category,notes,debt_balance:debt,lat:lat||'',lng:lng||'',rep_id:selectedImportRep(row),status:'active'};
  }
  function findDuplicate(c){
    const p=normalizePhone(c.phone);
    let byPhone=null;
    if(p) byPhone=db.customers.find(x=>normalizePhone(x.phone)===p);
    if(byPhone) return {customer:byPhone, reason:'نفس رقم الجوال'};
    const byName=db.customers.find(x=>sameOrSimilarName(x.name,c.name) && (!x.city || !c.city || clean(x.city)===clean(c.city)));
    if(byName) return {customer:byName, reason:'اسم مشابه/مطابق في نفس المدينة'};
    return null;
  }
  function parseCsvLine(line){
    const cells=[]; let cur=''; let q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"' && line[i+1]==='"'){ cur+='"'; i++; continue; }
      if(ch==='"'){ q=!q; continue; }
      if(ch===',' && !q){ cells.push(cur); cur=''; continue; }
      cur+=ch;
    }
    cells.push(cur);
    return cells.map(x=>x.trim());
  }
  function simpleCsv(text){
    const lines=String(text||'').replace(/^\ufeff/,'').replace(/\r/g,'').split('\n').filter(x=>x.trim());
    if(!lines.length) return [];
    const headers=parseCsvLine(lines[0]);
    return lines.slice(1).map(line=>{
      const vals=parseCsvLine(line); const obj={};
      headers.forEach((h,i)=>obj[h]=vals[i]||'');
      return obj;
    });
  }
  function readFile(file, cb){
    const reader=new FileReader();
    const ext=file.name.toLowerCase().split('.').pop();
    reader.onload=function(e){
      try{
        if(ext==='xlsx' || ext==='xls'){
          if(!window.XLSX) throw new Error('مكتبة قراءة Excel لم يتم تحميلها. جرب CSV أو حدّث الصفحة.');
          const data=new Uint8Array(e.target.result);
          const wb=XLSX.read(data,{type:'array'});
          const sh=wb.Sheets[wb.SheetNames[0]];
          cb(XLSX.utils.sheet_to_json(sh,{defval:''}), null);
        }else{
          cb(simpleCsv(String(e.target.result||'')), null);
        }
      }catch(err){ cb(null, err.message || String(err)); }
    };
    if(ext==='xlsx' || ext==='xls') reader.readAsArrayBuffer(file); else reader.readAsText(file,'UTF-8');
  }
  function updateCustomer(existing,c,moveRep){
    Object.assign(existing,{
      phone:c.phone || existing.phone,
      city:c.city || existing.city,
      district:c.district || existing.district,
      location:c.location || existing.location,
      category:c.category || existing.category,
      rep_id: moveRep ? c.rep_id : (existing.rep_id || c.rep_id),
      debt_balance: c.debt_balance !== 0 ? c.debt_balance : (existing.debt_balance || 0),
      notes:[existing.notes,c.notes].filter(Boolean).join(' | '),
      lat:c.lat || existing.lat || '',
      lng:c.lng || existing.lng || '',
      updated_at:new Date().toISOString()
    });
  }
  window.downloadCustomerTemplate = function(){
    const csv = [
      ['name','phone','city','district','location','category','rep_id','debt_balance','notes','lat','lng'].join(','),
      ['شركة تجريبية','966500000000','جدة','الصناعية','جدة الصناعية','عميل','rep-yaser','0','ملاحظة','21.4858','39.1925'].join(',')
    ].join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='customers_import_template.csv'; document.body.appendChild(a); a.click(); a.remove();
  };
  window.openCustomerImport = function(){
    if(!currentUser || currentUser.role!=='admin') return alert('استيراد العملاء متاح فقط لمدير النظام');
    ensure();
    const repOptions=(db.reps||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    modalBody.innerHTML = `<h2>استيراد العملاء الذكي</h2>
      <div class="import-help">
        اختر المندوب قبل الاستيراد. إذا ظهر نفس العميل عند مندوب آخر، النظام <b>لن يكرر العميل</b> وسيعرضه كتعارض حتى تقرر هل هو ياسر أو عثمان.<br>
        الأعمدة المقبولة: <b>name, phone, city, district, rep_id, debt_balance, notes</b>
      </div>
      <div class="form-grid two">
        <label>ربط العملاء على المندوب
          <select id="importTargetRep">
            <option value="file">حسب الملف / rep_id</option>
            ${repOptions}
          </select>
        </label>
        <label>سياسة العميل المكرر
          <select id="importDuplicatePolicy">
            <option value="conflict">لا تنقل العميل إذا كان عند مندوب آخر، اعرض تعارض</option>
            <option value="move">انقل العميل المكرر للمندوب المختار</option>
          </select>
        </label>
      </div>
      <div class="import-drop">
        <b>اختر ملف العملاء</b>
        <input id="customerImportFile" type="file" accept=".xlsx,.xls,.csv">
        <small>مثال: اختر rep-yaser لعملاء ياسر، أو rep-osman لعملاء عثمان.</small>
      </div>
      <div class="import-actions">
        <button class="template" onclick="downloadCustomerTemplate()">تحميل قالب العملاء</button>
        <button class="import" onclick="runCustomerImport()">استيراد الآن</button>
      </div>
      <div id="customerImportResult" class="import-result">لم يتم الاستيراد بعد.</div>
      <div id="customerImportConflicts"></div>`;
    modal.classList.remove('hidden');
  };
  window.runCustomerImport = function(){
    ensure();
    const file=document.getElementById('customerImportFile')?.files?.[0];
    if(!file) return alert('اختر ملف Excel أو CSV أولاً');
    const policy=document.getElementById('importDuplicatePolicy')?.value || 'conflict';
    const result=document.getElementById('customerImportResult');
    const conflictBox=document.getElementById('customerImportConflicts');
    result.textContent='جاري قراءة الملف...'; conflictBox.innerHTML='';
    readFile(file,(rows,err)=>{
      if(err){ result.textContent='خطأ: '+err; return; }
      let added=0, updated=0, skipped=0, moved=0; const conflicts=[];
      (rows||[]).forEach((row,idx)=>{
        const c=normalizeRow(row);
        if(!c){ skipped++; return; }
        const dup=findDuplicate(c);
        if(dup && dup.customer){
          const existing=dup.customer;
          const oldRep=existing.rep_id || '';
          const newRep=c.rep_id || oldRep;
          if(oldRep && newRep && oldRep!==newRep && policy!=='move'){
            conflicts.push({row:idx+2,name:c.name,phone:c.phone,reason:dup.reason,existingName:existing.name,oldRep,newRep});
            skipped++;
            return;
          }
          updateCustomer(existing,c,policy==='move' && oldRep!==newRep);
          if(oldRep!==existing.rep_id) moved++; else updated++;
        }else{
          db.customers.push({id:safeId(),...c,credit_limit:0,created_at:new Date().toISOString()});
          added++;
        }
      });
      localStorage.setItem(IMPORT_KEY,JSON.stringify(conflicts));
      if(typeof save==='function') save();
      if(typeof renderAll==='function') renderAll();
      result.textContent=`تم الاستيراد\nالمضاف: ${added}\nالمحدّث: ${updated}\nالمنقول: ${moved}\nالمتجاهل: ${skipped}\nالتعارضات: ${conflicts.length}`;
      if(conflicts.length){
        conflictBox.innerHTML = `<div class="panel import-conflict-panel"><h3>تعارضات تحتاج مراجعة</h3><p>لم يتم إنشاء عميل مكرر. راجع هؤلاء وحدد هل يبقون على المندوب الحالي أو تنقلهم يدويًا.</p>
          <div class="table-wrap"><table><thead><tr><th>السطر</th><th>الاسم في الملف</th><th>الجوال</th><th>موجود باسم</th><th>مندوبه الحالي</th><th>المندوب المطلوب</th><th>السبب</th></tr></thead><tbody>
          ${conflicts.slice(0,80).map(x=>`<tr><td>${x.row}</td><td>${x.name}</td><td>${x.phone||'-'}</td><td>${x.existingName}</td><td>${repNameById(x.oldRep)}</td><td>${repNameById(x.newRep)}</td><td>${x.reason}</td></tr>`).join('')}
          </tbody></table></div>
          ${conflicts.length>80?`<small>تم عرض أول 80 تعارض فقط من ${conflicts.length}</small>`:''}
        </div>`;
      }
    });
  };

  const baseAllowed = window.allowedCustomers;
  if(typeof baseAllowed === 'function' && !window.__repCustomerSeparationPatched){
    window.__repCustomerSeparationPatched=true;
    window.__customerRepFilter=window.__customerRepFilter||'all';
    window.allowedCustomers=function(){
      let list=baseAllowed();
      if(currentUser && currentUser.role!=='rep' && window.__customerRepFilter && window.__customerRepFilter!=='all'){
        list=list.filter(c=>String(c.rep_id||'')===String(window.__customerRepFilter));
      }
      return list;
    };
  }
  function addRepCustomerFilter(){
    if(!currentUser || currentUser.role==='rep') return;
    const head=document.querySelector('#customers .page-head.with-action') || document.querySelector('#customers .page-head');
    if(!head || document.getElementById('customerRepFilter')) return;
    const wrap=document.createElement('div');
    wrap.className='customer-rep-filter';
    wrap.innerHTML=`<select id="customerRepFilter"><option value="all">كل المناديب</option>${(db.reps||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}<option value="">بدون مندوب</option></select>`;
    const sel=wrap.querySelector('select');
    sel.value=window.__customerRepFilter||'all';
    sel.onchange=function(){ window.__customerRepFilter=this.value; if(typeof renderCustomers==='function') renderCustomers(); if(typeof renderStats==='function') renderStats(); };
    const actionBox=head.querySelector('.head-actions') || head;
    actionBox.appendChild(wrap);
  }
  const oldRenderAll=window.renderAll;
  window.renderAll=function(){
    if(typeof oldRenderAll==='function') oldRenderAll();
    setTimeout(addRepCustomerFilter,120);
  };
  setTimeout(addRepCustomerFilter,700);
})();
