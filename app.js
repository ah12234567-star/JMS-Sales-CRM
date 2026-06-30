const DENSITY={HDPE:.95,LDPE:.92,LLDPE:.92,PP:.90,MIX:.93};
const STORE='jms_factory_crm_pro_v4';
let db=load();
let currentUser=JSON.parse(sessionStorage.getItem('jms_current_user')||'null');

function load(){
  const saved=localStorage.getItem(STORE);
  if(saved) return JSON.parse(saved);
  const yaserNames=(window.JMS_IMPORTED_CUSTOMERS||[]).slice(0,160);
  const reps=[
    {id:'rep-yaser',name:'ياسر الحسني',email:'yaser@jms.local',password:'123456',role:'rep',status:'active'},
    {id:'rep-demo',name:'مندوب جدة',email:'rep@jms.local',password:'123456',role:'rep',status:'active'}
  ];
  return {
    users:[
      {id:'u-admin',name:'مدير النظام',email:'admin@jms.local',password:'123456',role:'admin',status:'active'},
      {id:'u-sales',name:'مدير المبيعات',email:'sales@jms.local',password:'123456',role:'sales',status:'active'},
      ...reps.map(r=>({...r}))
    ],
    reps,
    customers:yaserNames.map((name,i)=>({id:'c'+i,name,phone:'',city:'جدة',district:'',location:'',category:'عميل',status:'active',rep_id:'rep-yaser',debt_balance:0,credit_limit:0,notes:''})),
    visits:[],orders:[],collections:[],routes:[]
  };
}
function save(){localStorage.setItem(STORE,JSON.stringify(db))}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function $(id){return document.getElementById(id)}
function today(){return new Date().toISOString().slice(0,10)}
function month(){return today().slice(0,7)}
function money(n){return Number(n||0).toLocaleString('ar-SA')}
function roleText(r){return r==='admin'?'مدير النظام':r==='sales'?'مدير مبيعات':'مندوب'}
function allowedCustomers(){return currentUser.role==='rep'?db.customers.filter(c=>c.rep_id===currentUser.id):db.customers}
function allowedOrders(){return currentUser.role==='rep'?db.orders.filter(o=>o.rep_id===currentUser.id):db.orders}

document.querySelectorAll('input[name=loginRole]').forEach(x=>x.onchange=()=>{
  const r=document.querySelector('input[name=loginRole]:checked').value;
  if(r==='admin'){loginEmail.value='admin@jms.local';loginHint.textContent='مدير النظام: admin@jms.local / 123456'}
  if(r==='sales'){loginEmail.value='sales@jms.local';loginHint.textContent='مدير المبيعات: sales@jms.local / 123456'}
  if(r==='rep'){loginEmail.value='yaser@jms.local';loginHint.textContent='المندوب: yaser@jms.local / 123456'}
  loginPassword.value='123456';
});
loginForm.onsubmit=e=>{
  e.preventDefault();
  const u=db.users.find(u=>u.email===loginEmail.value.trim()&&u.password===loginPassword.value);
  if(!u) return alert('بيانات الدخول غير صحيحة');
  if(u.status!=='active') return alert('هذا الحساب موقوف');
  currentUser={id:u.id,name:u.name,email:u.email,role:u.role};
  sessionStorage.setItem('jms_current_user',JSON.stringify(currentUser));
  showApp();
};
logoutBtn.onclick=()=>{sessionStorage.removeItem('jms_current_user');location.reload()};

function showApp(){
  loginView.classList.add('hidden');appView.classList.remove('hidden');
  currentUserName.textContent=currentUser.name;currentUserRole.textContent=roleText(currentUser.role);
  document.querySelectorAll('.admin-only').forEach(x=>x.style.display=currentUser.role==='admin'?'block':'none');
  orderDate.value=today();
  renderAll();
}
if(currentUser) showApp();

document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');$(btn.dataset.page).classList.add('active');
  renderAll();
});

function renderAll(){renderStats();renderCustomers();renderSelects();renderVisitFilters();renderVisits();renderQuotes();renderOrders();renderRoutes();renderAlerts();renderUsers();calc()}
function repName(id){return db.reps.find(r=>r.id===id)?.name||'-'}
function customerName(id){return db.customers.find(c=>c.id===id)?.name||'-'}
function lastVisit(cid){return db.visits.filter(v=>v.customer_id===cid).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||''}
function daysFrom(d){return d?Math.floor((new Date(today())-new Date(d))/86400000):999}
function customerState(c){let d=daysFrom(lastVisit(c.id));if(d>=30)return ['متأخر '+d+' يوم','late'];if(d>=20)return ['قريب '+d+' يوم','warn'];return ['منتظم','ok']}
function monthOrders(){return allowedOrders().filter(o=>String(o.date).startsWith(month()))}
function monthCollections(){return db.collections.filter(c=>String(c.date).startsWith(month())&&(currentUser.role!=='rep'||c.rep_id===currentUser.id))}

function renderStats(){
  const sales=monthOrders().reduce((s,o)=>s+Number(o.amount_value||0),0);
  const coll=monthCollections().reduce((s,c)=>s+Number(c.amount||0),0);
  mSales.textContent=money(sales);mCollected.textContent=money(coll);collectionRate.textContent=sales?Math.round(coll/sales*100)+'%':'0%';
  const late=allowedCustomers().filter(c=>daysFrom(lastVisit(c.id))>=30).length;
  lateCount.textContent=late;customersCount.textContent=allowedCustomers().length;ordersCount.textContent=monthOrders().length;
  topReps.innerHTML=db.reps.map(r=>({r,visits:db.visits.filter(v=>v.rep_id===r.id).length,orders:db.orders.filter(o=>o.rep_id===r.id).length})).sort((a,b)=>(b.visits+b.orders)-(a.visits+a.orders)).map(x=>`<div class="route-item"><b>${x.r.name}</b><br>زيارات: ${x.visits} · طلبات: ${x.orders}</div>`).join('')||'لا يوجد بيانات';
  dashAlerts.innerHTML=allowedCustomers().filter(c=>daysFrom(lastVisit(c.id))>=30).slice(0,5).map(c=>`<div class="alert-card">${c.name} لم تتم زيارته منذ ${daysFrom(lastVisit(c.id))} يوم</div>`).join('')||'لا توجد تنبيهات';
}

customerSearch.oninput=renderCustomers;
function renderCustomers(){
  const q=(customerSearch.value||'').trim();
  const list=allowedCustomers().filter(c=>!q||c.name.includes(q)||String(c.phone).includes(q)||String(c.city).includes(q));
  customersGrid.innerHTML=list.map(c=>{
    const st=customerState(c);
    return `<div class="customer-card">
      <div class="customer-head"><div><h3>${c.name}</h3><p>${c.phone||'-'} · ${c.city||'-'} · ${repName(c.rep_id)}</p></div><span class="badge ${st[1]}">${st[0]}</span></div>
      <div class="metrics"><div><b>${money(c.debt_balance)}</b><span>مديونية</span></div><div><b>${lastVisit(c.id)||'-'}</b><span>آخر زيارة</span></div><div><b>${c.next_date||'-'}</b><span>موعد</span></div></div>
      <div class="customer-actions">
        <button onclick="visit('${c.id}')">تمت الزيارة</button><button onclick="newOrder('${c.id}')">طلب جديد</button><button onclick="appointment('${c.id}')">موعد</button><button onclick="collect('${c.id}')">تحصيل</button><button onclick="note('${c.id}')">ملاحظة</button>
      </div>
    </div>`;
  }).join('')||'<div class="panel">لا يوجد عملاء</div>';
}
function visit(cid){const c=db.customers.find(x=>x.id===cid);db.visits.unshift({id:id(),customer_id:cid,rep_id:c.rep_id,date:today(),notes:'تمت الزيارة'});save();renderAll()}
function newOrder(cid){document.querySelector('[data-page=orders]').click();setTimeout(()=>orderCustomer.value=cid,100)}
function appointment(cid){let d=prompt('تاريخ الموعد YYYY-MM-DD',today());if(!d)return;let c=db.customers.find(x=>x.id===cid);c.next_date=d;save();renderAll()}
function collect(cid){let a=Number(prompt('مبلغ التحصيل','0')||0);if(!a)return;let c=db.customers.find(x=>x.id===cid);c.debt_balance=Math.max(0,Number(c.debt_balance||0)-a);db.collections.unshift({id:id(),customer_id:cid,rep_id:c.rep_id,date:today(),amount:a});save();renderAll()}
function note(cid){let n=prompt('ملاحظة العميل');if(!n)return;let c=db.customers.find(x=>x.id===cid);c.notes=[c.notes,n].filter(Boolean).join(' | ');save();renderAll()}
function openCustomerForm(){
  modalBody.innerHTML=`<h2>إضافة عميل</h2><div class="form-grid two"><label>اسم العميل<input id="mcName"></label><label>الجوال<input id="mcPhone"></label><label>المدينة<input id="mcCity" value="جدة"></label><label>المندوب<select id="mcRep">${db.reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label><label>الموقع<input id="mcLocation"></label><label>تصنيف العميل<input id="mcCategory" value="عميل"></label></div><br><button class="primary" onclick="saveCustomer()">حفظ</button>`;
  modal.classList.remove('hidden');
}
function saveCustomer(){db.customers.unshift({id:id(),name:mcName.value,phone:mcPhone.value,city:mcCity.value,location:mcLocation.value,category:mcCategory.value,status:'active',rep_id:mcRep.value,debt_balance:0,notes:''});save();closeModal();renderAll()}

function renderSelects(){
  const cs=allowedCustomers();orderCustomer.innerHTML='<option value="">اختر العميل</option>'+cs.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;orderRep.innerHTML=reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}
['width','length','thickness','sizeUnit','thicknessUnit','material','totalKg','priceKg'].forEach(x=>$(x).addEventListener('input',calc));
['sizeUnit','thicknessUnit','material'].forEach(x=>$(x).addEventListener('change',calc));
function calc(){
  let w=Number(width.value||0),l=Number(length.value||0),t=Number(thickness.value||0);
  if(sizeUnit.value==='cm'){w/=100;l/=100}else if(sizeUnit.value==='mm'){w/=1000;l/=1000}
  if(thicknessUnit.value==='mm')t*=1000;
  const den=DENSITY[material.value]||.93;density.value=den;
  const gram=w*l*t*den;pieceWeight.value=gram?gram.toFixed(2)+' جرام':'';
  const kg=Number(totalKg.value||0);const pcs=gram?Math.floor(kg/(gram/1000)):0;piecesCount.value=pcs?pcs.toLocaleString('ar-SA')+' حبة':'';
  const amount=kg*Number(priceKg.value||0);orderAmount.value=amount?amount.toFixed(2)+' ريال':'';
}
orderForm.onsubmit=e=>{
  e.preventDefault();if(!orderCustomer.value)return alert('اختر العميل');
  const amountValue=Number(totalKg.value||0)*Number(priceKg.value||0);
  db.orders.unshift({id:id(),date:orderDate.value||today(),customer_id:orderCustomer.value,rep_id:orderRep.value,product:productType.value,material:material.value,color:color.value,width:width.value,length:length.value,thickness:thickness.value,total_kg:totalKg.value,piece_weight:pieceWeight.value,pieces:piecesCount.value,amount:orderAmount.value,amount_value:amountValue,status:orderStatus.value,notes:orderNotes.value});
  save();renderAll();alert('تم حفظ الطلب');
}
function resetOrder(){orderForm.reset();orderDate.value=today();calc()}
function renderOrders(){
  const rows=allowedOrders().map(o=>`<tr><td>${o.date}</td><td>${customerName(o.customer_id)}</td><td>${repName(o.rep_id)}</td><td>${o.product}</td><td>${o.width}×${o.length}</td><td>${o.thickness}</td><td>${o.total_kg} كجم</td><td>${o.piece_weight}</td><td>${o.pieces}</td><td>${o.amount}</td><td>${o.status}</td></tr>`).join('');
  ordersList.innerHTML=rows?`<table><tr><th>التاريخ</th><th>العميل</th><th>المندوب</th><th>المنتج</th><th>المقاس</th><th>السماكة</th><th>الكمية</th><th>وزن الحبة</th><th>عدد الحبات</th><th>القيمة</th><th>الحالة</th></tr>${rows}</table>`:'لا توجد طلبات';
}
function renderAlerts(){
  const list=allowedCustomers().filter(c=>daysFrom(lastVisit(c.id))>=30);
  alertsList.innerHTML=list.map(c=>`<div class="alert-card"><b>${c.name}</b><br>المندوب: ${repName(c.rep_id)} — لم تتم زيارته منذ ${daysFrom(lastVisit(c.id))} يوم <div class="row-actions"><button onclick="appointment('${c.id}')">تحديد موعد</button><button onclick="newOrder('${c.id}')">طلب جديد</button></div></div>`).join('')||'<div class="panel">لا توجد تنبيهات</div>';
}
function createRoute(){
  const repId=currentUser.role==='rep'?currentUser.id:prompt('اكتب ID المندوب: rep-yaser أو rep-demo','rep-yaser');
  const customers=allowedCustomers().filter(c=>c.rep_id===repId).slice(0,10);
  db.routes.unshift({id:id(),date:today(),rep_id:repId,items:customers.map((c,i)=>({customer_id:c.id,order:i+1,status:'pending'}))});save();renderRoutes();
}
function renderRoutes(){
  routesList.innerHTML=db.routes.filter(r=>currentUser.role!=='rep'||r.rep_id===currentUser.id).map(r=>`<div class="route-card"><b>مسار ${r.date} - ${repName(r.rep_id)}</b><div class="route-items">${r.items.map(i=>`<div class="route-item">${i.order}. ${customerName(i.customer_id)} <button onclick="visit('${i.customer_id}')">تمت الزيارة</button></div>`).join('')}</div></div>`).join('')||'<div class="panel">لا توجد مسارات</div>';
}
function openUserForm(){
  modalBody.innerHTML=`<h2>إضافة مستخدم / مندوب</h2><div class="form-grid two"><label>الاسم<input id="muName"></label><label>البريد<input id="muEmail"></label><label>كلمة المرور<input id="muPass" value="123456"></label><label>الدور<select id="muRole"><option value="rep">مندوب</option><option value="sales">مدير مبيعات</option><option value="admin">مدير نظام</option></select></label></div><br><button class="primary" onclick="saveUser()">حفظ</button>`;modal.classList.remove('hidden');
}
function saveUser(){const u={id:id(),name:muName.value,email:muEmail.value,password:muPass.value,role:muRole.value,status:'active'};db.users.push(u);if(u.role==='rep')db.reps.push({...u});save();closeModal();renderAll()}
function renderUsers(){
  usersList.innerHTML=`<table><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>إجراءات</th></tr>${db.users.map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td>${roleText(u.role)}</td><td>${u.status==='active'?'نشط':'موقوف'}</td><td><div class="row-actions"><button onclick="toggleUser('${u.id}')">${u.status==='active'?'إيقاف':'تفعيل'}</button><button onclick="resetPass('${u.id}')">إعادة كلمة المرور</button></div></td></tr>`).join('')}</table>`;
}
function roleText(r){return r==='admin'?'مدير النظام':r==='sales'?'مدير مبيعات':'مندوب'}
function toggleUser(uid){let u=db.users.find(x=>x.id===uid);u.status=u.status==='active'?'disabled':'active';let r=db.reps.find(x=>x.id===uid);if(r)r.status=u.status;save();renderUsers()}
function resetPass(uid){let u=db.users.find(x=>x.id===uid);let p=prompt('كلمة المرور الجديدة','123456');if(!p)return;u.password=p;save();alert('تم تغيير كلمة المرور')}
function changeMyPassword(){let u=db.users.find(x=>x.email===currentUser.email);if(!u)return;if(oldPassword.value!==u.password)return alert('كلمة المرور الحالية غير صحيحة');if(!newPassword.value)return alert('اكتب كلمة مرور جديدة');u.password=newPassword.value;save();alert('تم تغيير كلمة المرور')}
function closeModal(){modal.classList.add('hidden');modalBody.innerHTML=''}



/* JMS visits module */
function inRange(date, from, to){
  if(!date) return false;
  if(from && date < from) return false;
  if(to && date > to) return false;
  return true;
}
function startOfWeekISO(){
  const d=new Date();
  const day=(d.getDay()+6)%7;
  d.setDate(d.getDate()-day);
  return d.toISOString().slice(0,10);
}
function renderVisitFilters(){
  if(!window.visitFrom) return;
  if(!visitFrom.value) visitFrom.value=today();
  if(!visitTo.value) visitTo.value=today();
  const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;
  const current=visitRepFilter.value;
  visitRepFilter.innerHTML='<option value="all">كل المناديب</option>'+reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  if(current) visitRepFilter.value=current;
}
function setVisitQuickRange(type){
  if(type==='today'){visitFrom.value=today();visitTo.value=today();}
  if(type==='week'){visitFrom.value=startOfWeekISO();visitTo.value=today();}
  if(type==='month'){visitFrom.value=month()+'-01';visitTo.value=today();}
  renderVisits();
}
function visitScopeCustomers(repId){
  let cs=allowedCustomers();
  if(repId && repId!=='all') cs=cs.filter(c=>c.rep_id===repId);
  return cs;
}
function visitsInPeriod(){
  if(!window.visitFrom) return [];
  const repId=visitRepFilter.value||'all';
  let vs=db.visits.filter(v=>inRange(v.date,visitFrom.value,visitTo.value));
  if(currentUser.role==='rep') vs=vs.filter(v=>v.rep_id===currentUser.id);
  if(repId!=='all') vs=vs.filter(v=>v.rep_id===repId);
  return vs;
}
function renderVisits(){
  if(!window.visitsList) return;
  renderVisitFilters();
  const repId=visitRepFilter.value||'all';
  const cs=visitScopeCustomers(repId);
  const vs=visitsInPeriod();
  const visitedIds=new Set(vs.map(v=>v.customer_id));
  const notVisited=cs.filter(c=>!visitedIds.has(c.id));
  const late30=cs.filter(c=>daysFrom(lastVisit(c.id))>=30);

  visitsPeriodCount.textContent=vs.length;
  visitedCustomersCount.textContent=visitedIds.size;
  notVisitedCustomersCount.textContent=notVisited.length;
  late30CustomersCount.textContent=late30.length;

  visitsList.innerHTML=vs.map(v=>{
    const c=db.customers.find(x=>x.id===v.customer_id)||{};
    return `<div class="visit-card">
      <h4>${c.name||'-'}</h4>
      <p>المندوب: ${repName(v.rep_id)}<br>التاريخ: ${v.date}<br>النتيجة: ${v.result||v.notes||'تمت الزيارة'}</p>
      <div class="mini"><span>وقت الوصول: ${v.arrive_time||'-'}</span><span>وقت المغادرة: ${v.leave_time||'-'}</span><span>مدة الزيارة: ${v.duration||'-'}</span></div>
    </div>`;
  }).join('') || '<div class="ok-line">لا توجد زيارات في هذه الفترة</div>';

  const reportType=visitReportType.value;
  let notList = reportType==='late30' ? late30 : notVisited;
  notVisitedList.innerHTML=notList.map(c=>`<div class="late-line">
    <b>${c.name}</b><br>
    المندوب: ${repName(c.rep_id)} — آخر زيارة: ${lastVisit(c.id)||'لم يزر'} — التأخير: ${daysFrom(lastVisit(c.id))} يوم
    <div class="row-actions"><button onclick="visit('${c.id}')">تسجيل زيارة</button><button onclick="appointment('${c.id}')">موعد</button><button onclick="newOrder('${c.id}')">طلب جديد</button></div>
  </div>`).join('') || '<div class="ok-line">لا يوجد عملاء في هذا التقرير</div>';

  renderRepVisitSummary();
}
function renderRepVisitSummary(){
  if(!window.repVisitSummary) return;
  const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;
  repVisitSummary.innerHTML='<div class="summary-grid">'+reps.map(r=>{
    const cs=allowedCustomers().filter(c=>c.rep_id===r.id);
    const vs=db.visits.filter(v=>v.rep_id===r.id && (!window.visitFrom || inRange(v.date,visitFrom.value,visitTo.value)));
    const orders=db.orders.filter(o=>o.rep_id===r.id && (!window.visitFrom || inRange(o.date,visitFrom.value,visitTo.value)));
    const visited=new Set(vs.map(v=>v.customer_id));
    const notv=cs.filter(c=>!visited.has(c.id)).length;
    return `<div class="summary-card"><h4>${r.name}</h4><div class="nums">
      <div><b>${vs.length}</b><span>زيارات</span></div>
      <div><b>${orders.length}</b><span>طلبات</span></div>
      <div><b>${notv}</b><span>بدون زيارة</span></div>
    </div></div>`;
  }).join('')+'</div>';
}
function openVisitForm(){
  const cs=allowedCustomers();
  modalBody.innerHTML=`<h2>تسجيل زيارة يدوية</h2>
    <div class="form-grid two">
      <label>العميل<select id="mvCustomer">${cs.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
      <label>المندوب<select id="mvRep">${(currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
      <label>التاريخ<input id="mvDate" type="date" value="${today()}"></label>
      <label>نتيجة الزيارة<select id="mvResult"><option>متابعة</option><option>طلب جديد</option><option>تحصيل</option><option>بدون طلب</option></select></label>
      <label>وقت الوصول<input id="mvArrive" type="time"></label>
      <label>وقت المغادرة<input id="mvLeave" type="time"></label>
    </div>
    <br><label>ملاحظات<input id="mvNotes" placeholder="ملاحظات الزيارة"></label>
    <br><button class="primary" onclick="saveManualVisit()">حفظ الزيارة</button>`;
  modal.classList.remove('hidden');
}
function saveManualVisit(){
  const arrive=mvArrive.value||'', leave=mvLeave.value||'';
  let duration='-';
  if(arrive && leave){
    const [ah,am]=arrive.split(':').map(Number), [lh,lm]=leave.split(':').map(Number);
    const mins=(lh*60+lm)-(ah*60+am);
    if(mins>=0) duration=mins+' دقيقة';
  }
  db.visits.unshift({id:id(),customer_id:mvCustomer.value,rep_id:mvRep.value,date:mvDate.value||today(),result:mvResult.value,arrive_time:arrive,leave_time:leave,duration,notes:mvNotes.value});
  save();closeModal();renderAll();
}



/* JMS quotations approval module */
function ensureQuotes(){
  db.quotes ||= [];
  save();
}
function quoteStatusText(s){
  return s==='pending'?'بانتظار اعتماد المدير':s==='approved'?'معتمد':s==='rejected'?'مرفوض':s==='sent'?'مرسل للعميل':'-';
}
function allowedQuotes(){
  ensureQuotes();
  return currentUser.role==='rep' ? db.quotes.filter(q=>q.rep_id===currentUser.id) : db.quotes;
}
function renderQuoteFilters(){
  if(!window.quoteRepFilter) return;
  const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;
  const cur=quoteRepFilter.value;
  quoteRepFilter.innerHTML='<option value="all">كل المناديب</option>'+reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  if(cur) quoteRepFilter.value=cur;
}
function renderQuotes(){
  if(!window.quotesList) return;
  ensureQuotes();
  renderQuoteFilters();

  const all=allowedQuotes();
  quotesTotal.textContent=all.length;
  quotesPending.textContent=all.filter(q=>q.status==='pending').length;
  quotesApproved.textContent=all.filter(q=>q.status==='approved').length;
  quotesRejected.textContent=all.filter(q=>q.status==='rejected').length;

  const st=quoteStatusFilter.value||'all';
  const rep=quoteRepFilter.value||'all';
  const qtxt=(quoteSearch.value||'').trim();

  let list=all.filter(q=>{
    if(st!=='all' && q.status!==st) return false;
    if(rep!=='all' && q.rep_id!==rep) return false;
    const cname=customerName(q.customer_id);
    if(qtxt && !String(q.quote_no).includes(qtxt) && !cname.includes(qtxt)) return false;
    return true;
  });

  quotesList.innerHTML=list.map(q=>quoteCard(q)).join('') || '<div class="panel">لا توجد عروض أسعار</div>';
}
function quoteCard(q){
  const canApprove=currentUser.role==='admin'||currentUser.role==='sales';
  const canSend=q.status==='approved'||q.status==='sent';
  const canConvert=q.status==='approved'||q.status==='sent';
  return `<div class="quote-card">
    <div class="quote-head">
      <div>
        <h3>عرض رقم ${q.quote_no}</h3>
        <p>${customerName(q.customer_id)} · ${repName(q.rep_id)} · ${q.date}</p>
      </div>
      <span class="quote-status ${q.status}">${quoteStatusText(q.status)}</span>
    </div>

    <div class="quote-lines">
      <div><span>المنتج</span><b>${q.product}</b></div>
      <div><span>المقاس</span><b>${q.width} × ${q.length} ${q.size_unit}</b></div>
      <div><span>السماكة</span><b>${q.thickness} ${q.thickness_unit}</b></div>
      <div><span>الخامة</span><b>${q.material}</b></div>
      <div><span>الكمية</span><b>${q.total_kg} كجم</b></div>
      <div><span>سعر الكيلو</span><b>${q.price_kg} ريال</b></div>
      <div><span>وزن الحبة</span><b>${q.piece_weight||'-'}</b></div>
      <div><span>عدد الحبات</span><b>${q.pieces||'-'}</b></div>
    </div>

    <div class="quote-total"><span>إجمالي العرض</span><b>${q.total_amount} ريال</b></div>
    ${q.reject_reason?`<div class="alert-card">سبب الرفض: ${q.reject_reason}</div>`:''}
    ${q.approved_by?`<div class="ok-line">اعتمد بواسطة: ${q.approved_by} بتاريخ ${q.approved_at||'-'}</div>`:''}

    <div class="quote-actions">
      <button onclick="viewQuote('${q.id}')">عرض</button>
      ${canApprove && q.status==='pending'?`<button class="approve" onclick="approveQuote('${q.id}')">اعتماد</button><button class="reject" onclick="rejectQuote('${q.id}')">رفض</button>`:''}
      ${canSend?`<button class="send" onclick="sendQuote('${q.id}')">إرسال للعميل</button>`:''}
      ${canConvert?`<button class="convert" onclick="convertQuoteToOrder('${q.id}')">تحويل لطلب</button>`:''}
    </div>
  </div>`;
}
function openQuoteForm(){
  ensureQuotes();
  const cs=allowedCustomers();
  const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;
  modalBody.innerHTML=`<h2>إنشاء عرض سعر</h2>
    <div class="form-grid two">
      <label>العميل<select id="mqCustomer">${cs.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
      <label>المندوب<select id="mqRep">${reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
      <label>تاريخ العرض<input id="mqDate" type="date" value="${today()}"></label>
      <label>صلاحية العرض<input id="mqValid" type="date"></label>
    </div>
    <div class="form-grid four">
      <label>المنتج<select id="mqProduct"><option>أكياس رول</option><option>أكياس شيت</option><option>أكياس تي شيرت</option><option>شرنك</option><option>فيلم</option><option>أكياس نفايات</option></select></label>
      <label>الخامة<select id="mqMaterial"><option value="HDPE">HDPE</option><option value="LDPE">LDPE</option><option value="LLDPE">LLDPE</option><option value="PP">PP</option><option value="MIX">خلطة</option></select></label>
      <label>اللون<input id="mqColor" placeholder="شفاف / أبيض / حسب الطلب"></label>
      <label>الطباعة<select id="mqPrint"><option>بدون طباعة</option><option>وجه واحد</option><option>وجهين</option></select></label>
    </div>
    <div class="form-grid four">
      <label>العرض<input id="mqWidth" type="number" step="0.01" placeholder="65"></label>
      <label>الطول<input id="mqLength" type="number" step="0.01" placeholder="95"></label>
      <label>وحدة المقاس<select id="mqSizeUnit"><option value="cm">سم</option><option value="mm">مم</option></select></label>
      <label>السماكة<input id="mqThickness" type="number" step="0.01" placeholder="75"></label>
    </div>
    <div class="form-grid four">
      <label>وحدة السماكة<select id="mqThicknessUnit"><option value="micron">ميكرون</option><option value="mm">مم</option></select></label>
      <label>كمية الطلب بالكيلو<input id="mqKg" type="number" step="0.01" placeholder="1000"></label>
      <label>سعر الكيلو<input id="mqPriceKg" type="number" step="0.01"></label>
      <label>الإجمالي<input id="mqTotal" readonly></label>
    </div>
    <div class="form-grid two">
      <label>شروط الدفع<input id="mqPayment" value="حسب الاتفاق"></label>
      <label>مدة التسليم<input id="mqDelivery" value="حسب جدول الإنتاج"></label>
      <label>وزن الحبة<input id="mqPiece" readonly></label>
      <label>عدد الحبات<input id="mqPieces" readonly></label>
    </div>
    <label>ملاحظات<input id="mqNotes" placeholder="ملاحظات للمدير أو العميل"></label>
    <br><button class="primary" onclick="saveQuote()">حفظ وإرساله للمدير للاعتماد</button>`;

  modal.classList.remove('hidden');
  ['mqWidth','mqLength','mqThickness','mqSizeUnit','mqThicknessUnit','mqMaterial','mqKg','mqPriceKg'].forEach(id=>{
    const el=document.getElementById(id); if(el){el.addEventListener('input',calcQuoteForm);el.addEventListener('change',calcQuoteForm);}
  });
  calcQuoteForm();
}
function calcQuoteForm(){
  if(!window.mqTotal) return;
  let w=Number(mqWidth.value||0),l=Number(mqLength.value||0),t=Number(mqThickness.value||0);
  if(mqSizeUnit.value==='cm'){w/=100;l/=100}else if(mqSizeUnit.value==='mm'){w/=1000;l/=1000}
  if(mqThicknessUnit.value==='mm') t*=1000;
  const den=DENSITY[mqMaterial.value]||.93;
  const gram=w*l*t*den;
  mqPiece.value=gram?gram.toFixed(2)+' جرام':'';
  const kg=Number(mqKg.value||0);
  const pcs=gram?Math.floor(kg/(gram/1000)):0;
  mqPieces.value=pcs?pcs.toLocaleString('ar-SA')+' حبة':'';
  const total=kg*Number(mqPriceKg.value||0);
  mqTotal.value=total?total.toFixed(2):'';
}
function saveQuote(){
  ensureQuotes();
  if(!mqCustomer.value) return alert('اختر العميل');
  const no='Q-'+String(db.quotes.length+1).padStart(5,'0');
  db.quotes.unshift({
    id:id(),quote_no:no,status:'pending',
    customer_id:mqCustomer.value,rep_id:mqRep.value,date:mqDate.value||today(),valid_until:mqValid.value,
    product:mqProduct.value,material:mqMaterial.value,color:mqColor.value,print:mqPrint.value,
    width:mqWidth.value,length:mqLength.value,size_unit:mqSizeUnit.value,thickness:mqThickness.value,thickness_unit:mqThicknessUnit.value,
    total_kg:mqKg.value,price_kg:mqPriceKg.value,total_amount:mqTotal.value,piece_weight:mqPiece.value,pieces:mqPieces.value,
    payment_terms:mqPayment.value,delivery_terms:mqDelivery.value,notes:mqNotes.value,
    created_by:currentUser.name,created_at:new Date().toISOString()
  });
  save();closeModal();renderAll();alert('تم حفظ العرض وإرساله للمدير للاعتماد');
}
function approveQuote(qid){
  const q=db.quotes.find(x=>x.id===qid); if(!q) return;
  q.status='approved'; q.approved_by=currentUser.name; q.approved_at=today();
  save();renderQuotes();alert('تم اعتماد عرض السعر');
}
function rejectQuote(qid){
  const q=db.quotes.find(x=>x.id===qid); if(!q) return;
  const reason=prompt('سبب الرفض');
  if(!reason) return;
  q.status='rejected'; q.reject_reason=reason; q.rejected_by=currentUser.name; q.rejected_at=today();
  save();renderQuotes();alert('تم رفض العرض وإرجاعه للمندوب');
}
function sendQuote(qid){
  const q=db.quotes.find(x=>x.id===qid); if(!q) return;
  if(q.status!=='approved' && q.status!=='sent') return alert('لا يمكن الإرسال قبل اعتماد المدير');
  q.status='sent'; q.sent_at=today(); save(); renderQuotes();
  const msg=`عرض سعر من شركة جدة النموذجية للصناعة%0Aرقم العرض: ${q.quote_no}%0Aالعميل: ${customerName(q.customer_id)}%0Aالمنتج: ${q.product}%0Aالمقاس: ${q.width} × ${q.length} ${q.size_unit}%0Aالسماكة: ${q.thickness} ${q.thickness_unit}%0Aالخامة: ${q.material}%0Aالكمية: ${q.total_kg} كجم%0Aالإجمالي: ${q.total_amount} ريال`;
  window.open(`https://wa.me/?text=${msg}`,'_blank');
}
function viewQuote(qid){
  const q=db.quotes.find(x=>x.id===qid); if(!q) return;
  modalBody.innerHTML=`<div class="quote-print">
    <div class="print-head"><div><h1>عرض سعر</h1><p>شركة جدة النموذجية للصناعة</p></div><div><b>${q.quote_no}</b><br>${q.date}</div></div>
    <p><b>العميل:</b> ${customerName(q.customer_id)}<br><b>المندوب:</b> ${repName(q.rep_id)}<br><b>الحالة:</b> ${quoteStatusText(q.status)}</p>
    <table><tr><th>المنتج</th><th>المقاس</th><th>السماكة</th><th>الخامة</th><th>الكمية</th><th>سعر الكيلو</th><th>الإجمالي</th></tr>
    <tr><td>${q.product}</td><td>${q.width}×${q.length} ${q.size_unit}</td><td>${q.thickness} ${q.thickness_unit}</td><td>${q.material}</td><td>${q.total_kg} كجم</td><td>${q.price_kg}</td><td>${q.total_amount}</td></tr></table>
    <p><b>شروط الدفع:</b> ${q.payment_terms||'-'}<br><b>التسليم:</b> ${q.delivery_terms||'-'}<br><b>ملاحظات:</b> ${q.notes||'-'}</p>
    <button class="primary" onclick="window.print()">طباعة / PDF</button>
  </div>`;
  modal.classList.remove('hidden');
}
function convertQuoteToOrder(qid){
  const q=db.quotes.find(x=>x.id===qid); if(!q) return;
  if(q.status!=='approved' && q.status!=='sent') return alert('لا يمكن تحويل عرض غير معتمد إلى طلب');
  db.orders.unshift({
    id:id(),date:today(),customer_id:q.customer_id,rep_id:q.rep_id,product:q.product,material:q.material,color:q.color,
    width:q.width,length:q.length,thickness:q.thickness,total_kg:q.total_kg,piece_weight:q.piece_weight,pieces:q.pieces,
    amount:q.total_amount+' ريال',amount_value:Number(q.total_amount||0),status:'جديد',notes:'تم التحويل من عرض السعر '+q.quote_no
  });
  q.converted_to_order=true; q.converted_at=today();
  save();renderAll();alert('تم تحويل عرض السعر إلى طلب تصنيع');
}
