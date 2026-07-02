const STORE='jms_factory_crm_pro_v4';
let db = loadDB();

function loadDB(){
  try{
    const raw=localStorage.getItem(STORE);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {
    reps:[
      {id:'rep-yaser',name:'ياسر الحسني',email:'yaser@jms.local',status:'active'},
      {id:'rep-demo',name:'مندوب جدة',email:'rep@jms.local',status:'active'}
    ],
    customers:[],
    visits:[],
    quotes:[],
    orders:[],
    collections:[]
  };
}
function saveDB(){localStorage.setItem(STORE,JSON.stringify(db))}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function today(){return new Date().toISOString().slice(0,10)}
function money(n){return Number(n||0).toLocaleString('ar-SA')}
function repName(repId){return (db.reps||[]).find(r=>r.id===repId)?.name||'-'}
function lastVisit(cid){
  const v=(db.visits||[]).filter(x=>x.customer_id===cid).sort((a,b)=>String(b.checkin_at||b.date||'').localeCompare(String(a.checkin_at||a.date||'')))[0];
  return (v?.checkin_at||v?.date||'-').slice ? (v?.checkin_at||v?.date||'-').slice(0,10) : '-';
}
function quoteCount(cid){return (db.quotes||[]).filter(q=>q.customer_id===cid).length}
function orderCount(cid){return (db.orders||[]).filter(o=>o.customer_id===cid).length}
function phoneOk(c){return String(c.phone||'').replace(/\D/g,'').length>=8}

function setupFilters(){
  const rep=document.getElementById('repFilter'), city=document.getElementById('cityFilter'), cat=document.getElementById('categoryFilter');
  const oldRep=rep.value||'all', oldCity=city.value||'all', oldCat=cat.value||'all';
  rep.innerHTML='<option value="all">كل المناديب</option>'+(db.reps||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  const cities=[...new Set((db.customers||[]).map(c=>c.city).filter(Boolean))];
  const cats=[...new Set((db.customers||[]).map(c=>c.category).filter(Boolean))];
  city.innerHTML='<option value="all">كل المدن</option>'+cities.map(x=>`<option value="${x}">${x}</option>`).join('');
  cat.innerHTML='<option value="all">كل التصنيفات</option>'+cats.map(x=>`<option value="${x}">${x}</option>`).join('');
  rep.value=[...rep.options].some(o=>o.value===oldRep)?oldRep:'all';
  city.value=[...city.options].some(o=>o.value===oldCity)?oldCity:'all';
  cat.value=[...cat.options].some(o=>o.value===oldCat)?oldCat:'all';
}
function filtered(){
  const q=(search.value||'').trim(), rep=repFilter.value, city=cityFilter.value, cat=categoryFilter.value;
  return (db.customers||[]).filter(c=>{
    if(rep!=='all'&&c.rep_id!==rep)return false;
    if(city!=='all'&&c.city!==city)return false;
    if(cat!=='all'&&c.category!==cat)return false;
    if(q&&!`${c.name||''} ${c.phone||''} ${c.city||''} ${c.district||''} ${repName(c.rep_id)}`.includes(q))return false;
    return true;
  });
}
function updateKpis(list){
  kpiCustomers.textContent=(db.customers||[]).length;
  heroCustomers.textContent=(db.customers||[]).length;
  kpiFiltered.textContent=list.length;
  kpiVisits.textContent=(db.visits||[]).filter(v=>String(v.date||v.checkin_at||'').startsWith(today())).length;
  kpiQuotes.textContent=(db.quotes||[]).length;
  kpiOrders.textContent=(db.orders||[]).length;
  resultCount.textContent=list.length+' عميل';
}
function card(c){
  return `<div class="customer-card">
    <div class="card-head">
      <div><h3>${c.name||'-'}</h3><p>📍 ${c.city||'-'} ${c.district?'- '+c.district:''}<br>👤 ${repName(c.rep_id)}</p></div>
      <span class="badge">${c.category||'عميل'}</span>
    </div>
    <div class="info">
      <div><span>الجوال</span><b>${c.phone||'-'}</b></div>
      <div><span>آخر زيارة</span><b>${lastVisit(c.id)}</b></div>
      <div><span>العروض</span><b>${quoteCount(c.id)}</b></div>
      <div><span>الطلبات</span><b>${orderCount(c.id)}</b></div>
      <div><span>الرصيد</span><b>${money(c.debt_balance||0)} ريال</b></div>
      <div><span>العنوان</span><b>${c.location||c.district||'-'}</b></div>
    </div>
    <div class="actions">
      <button class="visit" onclick="quickVisit('${c.id}')">زيارة</button>
      <button class="quote" onclick="alert('سيتم ربط عرض السعر في المرحلة التالية')">عرض سعر</button>
      <button class="collect" onclick="alert('سيتم ربط التحصيل في المرحلة التالية')">تحصيل</button>
      <button class="more" onclick="toggleMore('${c.id}')">⋮</button>
    </div>
    <div id="more_${c.id}" class="more-panel">
      <button onclick="editCustomer('${c.id}')">تعديل العميل</button>
      <button onclick="openMap('${c.id}')">موقع العميل</button>
      ${phoneOk(c)?`<button onclick="sendSurvey('${c.id}')">رسالة تقييم واتساب</button>`:`<button disabled>لا يوجد رقم جوال</button>`}
      <button onclick="quickVisit('${c.id}')">تسجيل زيارة</button>
    </div>
  </div>`
}
function render(){
  setupFilters();
  const list=filtered();
  updateKpis(list);
  customers.innerHTML=list.map(card).join('')||'<div class="empty">لا يوجد عملاء حسب الفلتر المحدد</div>';
}
function toggleMore(cid){document.getElementById('more_'+cid)?.classList.toggle('open')}
function closeModal(){modal.classList.add('hidden');modalBody.innerHTML=''}
function openCustomerModal(){editCustomer(null)}
function editCustomer(cid){
  const c=cid?(db.customers||[]).find(x=>x.id===cid):{};
  modalBody.innerHTML=`<h2>${cid?'تعديل العميل':'إضافة عميل'}</h2>
  <div class="form-grid">
    <label>اسم العميل<input id="mName" value="${c.name||''}"></label>
    <label>الجوال<input id="mPhone" value="${c.phone||''}"></label>
    <label>المدينة<input id="mCity" value="${c.city||'جدة'}"></label>
    <label>الحي<input id="mDistrict" value="${c.district||''}"></label>
    <label>العنوان<input id="mLocation" value="${c.location||''}"></label>
    <label>التصنيف<input id="mCategory" value="${c.category||'عميل'}"></label>
    <label>المندوب<select id="mRep">${(db.reps||[]).map(r=>`<option value="${r.id}" ${c.rep_id===r.id?'selected':''}>${r.name}</option>`).join('')}</select></label>
    <label>الرصيد<input id="mDebt" type="number" value="${c.debt_balance||0}"></label>
  </div>
  <br><button class="primary" onclick="saveCustomer('${cid||''}')">حفظ</button>`;
  modal.classList.remove('hidden');
}
function saveCustomer(cid){
  if(!mName.value.trim())return alert('اكتب اسم العميل');
  const payload={name:mName.value,phone:mPhone.value,city:mCity.value,district:mDistrict.value,location:mLocation.value,category:mCategory.value,rep_id:mRep.value,debt_balance:Number(mDebt.value||0),status:'active'};
  if(cid){Object.assign(db.customers.find(x=>x.id===cid),payload)}
  else{db.customers.unshift({id:id(),...payload,created_at:new Date().toISOString()})}
  saveDB();closeModal();render();
}
function quickVisit(cid){
  const c=db.customers.find(x=>x.id===cid);
  db.visits.unshift({id:id(),customer_id:cid,rep_id:c.rep_id,date:today(),checkin_at:new Date().toISOString(),result:'none',notes:'زيارة من V2'});
  saveDB();render();alert('تم تسجيل زيارة للعميل');
}
function openMap(cid){
  const c=db.customers.find(x=>x.id===cid); if(!c)return;
  const q=encodeURIComponent(`${c.name||''} ${c.city||'جدة'} ${c.location||''}`);
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank');
}
function sendSurvey(cid){
  const c=db.customers.find(x=>x.id===cid); const p=String(c.phone||'').replace(/\D/g,'');
  if(!p)return alert('لا يوجد رقم جوال');
  const sa=p.startsWith('966')?p:'966'+p.replace(/^0/,'');
  const msg='السلام عليكم%0Aنشكر لكم التعامل مع شركة جدة النموذجية للصناعة.%0Aنأمل تقييم خدمتنا من 1 إلى 5 نجوم:%0A⭐⭐⭐⭐⭐';
  window.open(`https://wa.me/${sa}?text=${msg}`,'_blank');
}
function downloadTemplate(){
  const csv='\ufeffname,phone,city,district,location,category,rep_id,debt_balance\nشركة تجريبية,0500000000,جدة,الصناعية,العنوان,عميل,rep-yaser,0\n';
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='customers_template.csv';a.click();
}
render();
