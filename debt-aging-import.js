(function(){
'use strict';
const VERSION='2026-08-15-debt-aging-import-1';

function getStore(){ try{return (typeof db!=='undefined'?db:window.db)||{};}catch(_){return window.db||{};} }
function getUser(){ return window.currentUser || (typeof currentUser!=='undefined'?currentUser:null); }
function canUse(){ const u=getUser(); return !!u && ['admin','sales'].includes(u.role); }
function norm(v){
  return String(v??'').trim().toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim();
}
function num(v){ const n=Number(String(v??0).replace(/,/g,'')); return Number.isFinite(n)?n:0; }
function money(v){ return Number(v||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function injectButton(){
  if(!canUse() || document.getElementById('jmsDebtAgingImportBtn')) return;
  const page=document.getElementById('customers');
  if(!page) return;
  const head=page.querySelector('.page-head');
  if(!head) return;
  let actions=head.querySelector('.head-actions');
  if(!actions){ actions=document.createElement('div'); actions.className='head-actions'; head.appendChild(actions); }
  const btn=document.createElement('button');
  btn.id='jmsDebtAgingImportBtn'; btn.type='button'; btn.className='primary secondary';
  btn.textContent='استيراد أعمار الديون';
  btn.onclick=()=>document.getElementById('jmsDebtAgingFileInput')?.click();
  actions.appendChild(btn);

  const input=document.createElement('input');
  input.id='jmsDebtAgingFileInput'; input.type='file'; input.accept='.xls,.xlsx'; input.style.display='none';
  input.onchange=async()=>{ const file=input.files?.[0]; input.value=''; if(file) await processFile(file); };
  document.body.appendChild(input);
}

function findHeader(rows){
  for(let i=0;i<Math.min(rows.length,20);i++){
    const r=(rows[i]||[]).map(x=>norm(x));
    if(r.includes('الرمز') && r.includes('الاسم') && r.includes('مندوب الحساب') && r.includes('الرصيد')) return i;
  }
  return -1;
}
function idx(headers,label){ return headers.findIndex(x=>norm(x)===norm(label)); }

function buildPreview(rows){
  const headerRow=findHeader(rows);
  if(headerRow<0) throw new Error('لم أجد عناوين أعمار الديون المطلوبة: الرمز، الاسم، مندوب الحساب، الرصيد');
  const headers=rows[headerRow]||[];
  const ix={code:idx(headers,'الرمز'),name:idx(headers,'الاسم'),rep:idx(headers,'مندوب الحساب'),d30:idx(headers,'30 يوم'),d60:idx(headers,'60 يوم'),d90:idx(headers,'90 يوم'),d120:idx(headers,'120 يوم'),d150:idx(headers,'150 يوم'),over150:idx(headers,'فوق 150 يوم'),balance:idx(headers,'الرصيد')};
  const store=getStore(); const reps=store.reps||[]; const customers=store.customers||[];
  const yaser=reps.find(r=>norm(r.name).includes('ياسر الحسني')) || reps.find(r=>norm(r.name).includes('ياسر'));
  const yaserId=yaser?.id || '';
  const pool=yaserId?customers.filter(c=>String(c.rep_id||'')===String(yaserId)):customers;
  const codeMap=new Map(); const nameMap=new Map();
  for(const c of pool){
    for(const key of ['account_code','customer_code','code','erp_code']){ if(c?.[key]) codeMap.set(String(c[key]).trim(),c); }
    const n=norm(c.name); if(n){ if(!nameMap.has(n)) nameMap.set(n,[]); nameMap.get(n).push(c); }
  }
  const matched=[],unmatched=[];
  for(let r=headerRow+1;r<rows.length;r++){
    const row=rows[r]||[]; const repName=String(row[ix.rep]??'').trim(); const name=String(row[ix.name]??'').trim(); const code=String(row[ix.code]??'').trim();
    if(!name || !norm(repName).includes('ياسر')) continue;
    const sourceBalance=num(row[ix.balance]);
    let customer=code?codeMap.get(code):null; let matchType=customer?'code':'';
    if(!customer){ const arr=nameMap.get(norm(name))||[]; if(arr.length===1){customer=arr[0];matchType='name';} }
    const item={row:r+1,code,name,repName,sourceBalance,matchType,customer,
      aging:{d30:num(row[ix.d30]),d60:num(row[ix.d60]),d90:num(row[ix.d90]),d120:num(row[ix.d120]),d150:num(row[ix.d150]),over150:num(row[ix.over150])}};
    if(customer) matched.push(item); else unmatched.push(item);
  }
  return {matched,unmatched,yaserId};
}

function calculate(item){
  const b=item.sourceBalance;
  if(b<0) return {debt_balance:b,advance_balance:Math.abs(b),account_balance_type:'advance',aging:{d30:0,d60:0,d90:0,d120:0,d150:0,over150:0}};
  if(b>0 && b<500) return {debt_balance:0,advance_balance:0,account_balance_type:'zeroed_small',aging:{d30:0,d60:0,d90:0,d120:0,d150:0,over150:0}};
  return {debt_balance:b,advance_balance:0,account_balance_type:b>0?'debt':'clear',aging:item.aging};
}

async function applyPreview(preview){
  const store=getStore(); let zeroed=0,advances=0,debts=0;
  for(const item of preview.matched){
    const c=item.customer; const calc=calculate(item);
    c.account_code=item.code || c.account_code || '';
    c.debt_balance=calc.debt_balance;
    c.advance_balance=calc.advance_balance;
    c.account_balance_type=calc.account_balance_type;
    c.aging_30=calc.aging.d30; c.aging_60=calc.aging.d60; c.aging_90=calc.aging.d90;
    c.aging_120=calc.aging.d120; c.aging_150=calc.aging.d150; c.aging_over_150=calc.aging.over150;
    c.debt_aging_updated_at=new Date().toISOString(); c.debt_aging_source='excel';
    if(calc.account_balance_type==='zeroed_small')zeroed++; else if(calc.account_balance_type==='advance')advances++; else if(calc.account_balance_type==='debt')debts++;
  }
  if(typeof save==='function') save();
  if(typeof window.pushCloudData==='function') await window.pushCloudData();
  if(typeof renderAll==='function') renderAll();
  return {zeroed,advances,debts};
}

function showPreview(preview){
  const matched=preview.matched; const unmatched=preview.unmatched;
  const zeroed=matched.filter(x=>x.sourceBalance>0&&x.sourceBalance<500);
  const advances=matched.filter(x=>x.sourceBalance<0);
  const debts=matched.filter(x=>x.sourceBalance>=500);
  const totalAdv=advances.reduce((s,x)=>s+Math.abs(x.sourceBalance),0);
  const totalDebt=debts.reduce((s,x)=>s+x.sourceBalance,0);
  const unmatchedHtml=unmatched.slice(0,12).map(x=>`<li>${escapeHtml(x.code)} — ${escapeHtml(x.name)}</li>`).join('');
  const html=`<h2>مراجعة استيراد أعمار الديون</h2>
  <div class="panel" style="margin:12px 0"><b>المندوب: ياسر</b><br>
  مطابق: <b>${matched.length}</b> عميل · غير مطابق: <b>${unmatched.length}</b><br>
  سيتم تصفير: <b>${zeroed.length}</b> عميل أقل من 500 ريال<br>
  دفعات مقدمة: <b>${advances.length}</b> عميل بإجمالي ${money(totalAdv)} ريال<br>
  ديون 500 فأكثر: <b>${debts.length}</b> عميل بإجمالي ${money(totalDebt)} ريال</div>
  ${unmatched.length?`<div class="panel"><b>لن يتم تعديل العملاء غير المطابقين:</b><ul style="max-height:180px;overflow:auto">${unmatchedHtml}</ul>${unmatched.length>12?`<small>و ${unmatched.length-12} عميل إضافي</small>`:''}</div>`:''}
  <p class="muted">لن يتم إنشاء عملاء جدد. الرصيد السالب سيُحفظ كدفعة مقدمة، والرصيد الموجب الأقل من 500 سيصبح صفراً.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button id="jmsApplyDebtAging" class="primary">اعتماد التحديث</button><button onclick="closeModal()">إلغاء</button></div>`;
  if(window.modalBody && window.modal){ modalBody.innerHTML=html; modal.classList.remove('hidden'); }
  else { if(!confirm(`مطابق ${matched.length}، غير مطابق ${unmatched.length}. اعتماد التحديث؟`)) return; applyAndNotify(preview); return; }
  setTimeout(()=>{ const b=document.getElementById('jmsApplyDebtAging'); if(b)b.onclick=()=>applyAndNotify(preview); },0);
}
function escapeHtml(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
async function applyAndNotify(preview){
  const btn=document.getElementById('jmsApplyDebtAging'); if(btn){btn.disabled=true;btn.textContent='جاري الحفظ...';}
  try{
    const out=await applyPreview(preview);
    if(typeof closeModal==='function') closeModal();
    alert(`تم تحديث أعمار الديون بنجاح\nتم تصفير: ${out.zeroed}\nدفعات مقدمة: ${out.advances}\nديون 500 فأكثر: ${out.debts}`);
  }catch(error){ console.error('Debt aging import failed',error); alert('تعذر حفظ تحديث أعمار الديون. لم يكتمل التحديث السحابي.'); if(btn){btn.disabled=false;btn.textContent='اعتماد التحديث';} }
}

async function processFile(file){
  if(!canUse()) return alert('هذه الميزة متاحة للمدير فقط');
  if(!window.XLSX) return alert('مكتبة Excel غير محملة في النظام');
  try{
    const buf=await file.arrayBuffer(); const book=XLSX.read(buf,{type:'array'}); const sheet=book.Sheets[book.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
    const preview=buildPreview(rows);
    if(!preview.matched.length) return alert('لم أجد عملاء مطابقين لياسر. لم يتم تعديل أي بيانات.');
    showPreview(preview);
  }catch(error){ console.error(error); alert(error?.message||'تعذر قراءة ملف أعمار الديون'); }
}

const observer=new MutationObserver(()=>injectButton());
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectButton);else injectButton();
window.jmsDebtAgingImport={version:VERSION,processFile};
})();
