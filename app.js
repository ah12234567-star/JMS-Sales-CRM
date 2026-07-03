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
function save(){
  localStorage.setItem(STORE, JSON.stringify(db));
  // Supabase sync: after any local change, push the latest DB to cloud.
  if(typeof window.pushCloudData === 'function'){
    setTimeout(() => window.pushCloudData(), 80);
  }
}
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
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  currentUserName.textContent=currentUser.name;
  currentUserRole.textContent=roleText(currentUser.role);

  const repAllowed = ['customers','visits','orders','quotes','routes','profile'];
  document.querySelectorAll('.nav').forEach(btn=>{
    const page = btn.dataset.page;
    const repAllowed = ['customers','visits','orders','quotes','routes','profile'];
    if(currentUser.role === 'rep' && !repAllowed.includes(page)){
      btn.style.display='none';
    } else if(btn.classList.contains('admin-only') && currentUser.role !== 'admin'){
      btn.style.display='none';
    } else if(btn.classList.contains('manager-only') && !['admin','sales'].includes(currentUser.role)){
      btn.style.display='none';
    } else {
      btn.style.display='block';
    }
  });

  if(currentUser.role === 'rep'){
    document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
    const first = document.querySelector('.nav[data-page="customers"]');
    const page = document.getElementById('customers');
    if(first) first.classList.add('active');
    if(page) page.classList.add('active');
  }

  if(window.orderDate) orderDate.value=today();
  renderAll();
}
if(currentUser) showApp();

document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');$(btn.dataset.page).classList.add('active');
  renderAll();
});

function renderAll(){renderStats();renderCustomers();renderSelects();if(typeof renderVisitFilters==='function')renderVisitFilters();if(typeof renderVisits==='function')renderVisits();if(typeof renderQuotes==='function')renderQuotes();if(typeof renderVisitNotes==='function')renderVisitNotes();renderOrders();renderRoutes();renderAlerts();renderUsers();calc()}
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



/* JMS final fixes applied */
(function(){
  function safeToday(){ return (typeof today==='function') ? today() : new Date().toISOString().slice(0,10); }
  function safeMonth(){ return safeToday().slice(0,7); }
  function newLocalId(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function saveDB(){ if(typeof save==='function') save(); }
  function $id(x){ return document.getElementById(x); }

  window.daysFrom = function(date){
    if(!date) return null;
    const d = new Date(date + 'T00:00:00');
    if(isNaN(d.getTime())) return null;
    return Math.floor((new Date(safeToday()+'T00:00:00') - d) / 86400000);
  };

  window.customerState = function(c){
    const lv = (typeof lastVisit==='function') ? lastVisit(c.id) : '';
    const d = daysFrom(lv);
    if(d === null) return ['لم تتم زيارته','never-visited'];
    if(d === 0) return ['تمت زيارته اليوم','ok'];
    if(d >= 30) return ['متأخر '+d+' يوم','late'];
    if(d >= 15) return ['قريب '+d+' يوم','warn'];
    return ['منتظم منذ '+d+' يوم','ok'];
  };

  window.renderStats = function(){
    const ord=(typeof allowedOrders==='function'?allowedOrders():db.orders||[]).filter(o=>String(o.date||'').startsWith(safeMonth()));
    const sales=ord.reduce((s,o)=>s+Number(o.amount_value||0),0);
    const coll=(db.collections||[]).filter(c=>String(c.date||'').startsWith(safeMonth())&&(currentUser.role!=='rep'||c.rep_id===currentUser.id)).reduce((s,c)=>s+Number(c.amount||0),0);
    if(window.mSales) mSales.textContent=Number(sales||0).toLocaleString('ar-SA');
    if(window.mCollected) mCollected.textContent=Number(coll||0).toLocaleString('ar-SA');
    if(window.collectionRate) collectionRate.textContent=sales?Math.round(coll/sales*100)+'%':'0%';
    const cs=typeof allowedCustomers==='function'?allowedCustomers():db.customers||[];
    const late=cs.filter(c=>{const d=daysFrom(typeof lastVisit==='function'?lastVisit(c.id):'');return d!==null && d>=30}).length;
    if(window.lateCount) lateCount.textContent=late;
    if(window.customersCount) customersCount.textContent=cs.length;
    if(window.ordersCount) ordersCount.textContent=ord.length;
    if(window.topReps){
      topReps.innerHTML=(db.reps||[]).map(r=>({r,visits:(db.visits||[]).filter(v=>v.rep_id===r.id).length,orders:(db.orders||[]).filter(o=>o.rep_id===r.id).length})).sort((a,b)=>(b.visits+b.orders)-(a.visits+a.orders)).map(x=>`<div class="route-item"><b>${x.r.name}</b><br>زيارات: ${x.visits} · طلبات: ${x.orders}</div>`).join('')||'لا يوجد بيانات';
    }
    if(window.dashAlerts){
      dashAlerts.innerHTML=cs.filter(c=>{const d=daysFrom(typeof lastVisit==='function'?lastVisit(c.id):'');return d===null || d>=30}).slice(0,5).map(c=>{
        const d=daysFrom(typeof lastVisit==='function'?lastVisit(c.id):'');
        return `<div class="alert-card">${c.name} — ${d===null?'لم تتم زيارته':('لم تتم زيارته منذ '+d+' يوم')}</div>`;
      }).join('')||'لا توجد تنبيهات';
    }
  };

  window.renderAlerts = function(){
    if(!window.alertsList) return;
    const cs=typeof allowedCustomers==='function'?allowedCustomers():db.customers||[];
    const list=cs.filter(c=>{const d=daysFrom(typeof lastVisit==='function'?lastVisit(c.id):'');return d===null || d>=30});
    alertsList.innerHTML=list.map(c=>{
      const d=daysFrom(typeof lastVisit==='function'?lastVisit(c.id):'');
      const txt=d===null?'لم تتم زيارته من قبل':'لم تتم زيارته منذ '+d+' يوم';
      return `<div class="alert-card"><b>${c.name}</b><br>المندوب: ${repName(c.rep_id)} — ${txt}<div class="row-actions"><button onclick="appointment('${c.id}')">تحديد موعد</button><button onclick="newOrder('${c.id}')">طلب جديد</button></div></div>`;
    }).join('')||'<div class="panel">لا توجد تنبيهات</div>';
  };

  window.ensureQuotes = function(){ db.quotes ||= []; saveDB(); };
  window.quoteStatusText = function(s){ return s==='pending'?'بانتظار اعتماد المدير':s==='approved'?'معتمد':s==='rejected'?'مرفوض':s==='sent'?'مرسل للعميل':'-'; };
  window.allowedQuotes = function(){ ensureQuotes(); return currentUser.role==='rep' ? db.quotes.filter(q=>q.rep_id===currentUser.id) : db.quotes; };

  window.renderQuoteFilters = function(){
    if(!window.quoteRepFilter) return;
    const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;
    const cur=quoteRepFilter.value;
    quoteRepFilter.innerHTML='<option value="all">كل المناديب</option>'+reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    if(cur) quoteRepFilter.value=cur;
  };

  window.renderQuotes = function(){
    if(!window.quotesList) return;
    ensureQuotes(); renderQuoteFilters();
    const all=allowedQuotes();
    quotesTotal.textContent=all.length;
    quotesPending.textContent=all.filter(q=>q.status==='pending').length;
    quotesApproved.textContent=all.filter(q=>q.status==='approved').length;
    quotesRejected.textContent=all.filter(q=>q.status==='rejected').length;
    const st=quoteStatusFilter.value||'all', rep=quoteRepFilter.value||'all', txt=(quoteSearch.value||'').trim();
    const list=all.filter(q=>{
      if(st!=='all' && q.status!==st) return false;
      if(rep!=='all' && q.rep_id!==rep) return false;
      const cname=customerName(q.customer_id);
      if(txt && !String(q.quote_no).includes(txt) && !cname.includes(txt)) return false;
      return true;
    });
    quotesList.innerHTML=list.map(q=>quoteCard(q)).join('') || '<div class="panel">لا توجد عروض أسعار</div>';
  };

  window.quoteCard=function(q){
    const canApprove=currentUser.role==='admin'||currentUser.role==='sales';
    const canSend=q.status==='approved'||q.status==='sent';
    const canConvert=q.status==='approved'||q.status==='sent';
    return `<div class="quote-card">
      <div class="quote-head"><div><h3>عرض رقم ${q.quote_no}</h3><p>${customerName(q.customer_id)} · ${repName(q.rep_id)} · ${q.date}</p></div><span class="quote-status ${q.status}">${quoteStatusText(q.status)}</span></div>
      <div class="quote-lines"><div><span>المنتج</span><b>${q.product}</b></div><div><span>المقاس</span><b>${q.width} × ${q.length} ${q.size_unit}</b></div><div><span>السماكة</span><b>${q.thickness} ${q.thickness_unit}</b></div><div><span>الخامة</span><b>${q.material}</b></div><div><span>الكمية</span><b>${q.total_kg} كجم</b></div><div><span>سعر الكيلو</span><b>${q.price_kg} ريال</b></div><div><span>وزن الحبة</span><b>${q.piece_weight||'-'}</b></div><div><span>عدد الحبات</span><b>${q.pieces||'-'}</b></div></div>
      <div class="quote-total"><span>إجمالي العرض</span><b>${q.total_amount} ريال</b></div>
      ${q.reject_reason?`<div class="alert-card">سبب الرفض: ${q.reject_reason}</div>`:''}
      ${q.approved_by?`<div class="ok-line">اعتمد بواسطة: ${q.approved_by} بتاريخ ${q.approved_at||'-'}</div>`:''}
      <div class="quote-actions"><button onclick="viewQuote('${q.id}')">عرض</button>${canApprove&&q.status==='pending'?`<button class="approve" onclick="approveQuote('${q.id}')">اعتماد</button><button class="reject" onclick="rejectQuote('${q.id}')">رفض</button>`:''}${canSend?`<button class="send" onclick="sendQuote('${q.id}')">إرسال للعميل</button>`:''}${canConvert?`<button class="convert" onclick="convertQuoteToOrder('${q.id}')">تحويل لطلب</button>`:''}</div>
    </div>`;
  };

  window.openQuoteForm=function(){
    ensureQuotes();
    const cs=typeof allowedCustomers==='function'?allowedCustomers():db.customers||[];
    const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;
    const defaultRep=currentUser.role==='rep'?currentUser.id:(reps[0]?.id||'');
    modalBody.innerHTML=`<h2>إنشاء عرض سعر</h2>
      <div class="quote-customer-mode">
        <label><input type="radio" name="quoteCustomerMode" value="existing" checked onchange="toggleQuoteCustomerMode()"><span>اختيار عميل موجود</span></label>
        <label><input type="radio" name="quoteCustomerMode" value="new" onchange="toggleQuoteCustomerMode()"><span>إضافة عميل جديد</span></label>
      </div>
      <div id="existingCustomerBox" class="form-grid two">
        <label>العميل<select id="mqCustomer">${cs.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
        <label>المندوب<select id="mqRep">${reps.map(r=>`<option value="${r.id}" ${r.id===defaultRep?'selected':''}>${r.name}</option>`).join('')}</select></label>
      </div>
      <div id="newCustomerBox" class="form-grid two hidden">
        <label>اسم العميل الجديد<input id="mqNewCustomerName" placeholder="اسم العميل"></label>
        <label>جوال العميل<input id="mqNewCustomerPhone" placeholder="05xxxxxxxx"></label>
        <label>المدينة<input id="mqNewCustomerCity" value="جدة"></label>
        <label>الحي / الموقع<input id="mqNewCustomerLocation" placeholder="الحي أو رابط الموقع"></label>
      </div>
      <div class="form-grid two"><label>تاريخ العرض<input id="mqDate" type="date" value="${safeToday()}"></label><label>صلاحية العرض<input id="mqValid" type="date"></label></div>
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
      <div class="form-grid two"><label>شروط الدفع<input id="mqPayment" value="حسب الاتفاق"></label><label>مدة التسليم<input id="mqDelivery" value="حسب جدول الإنتاج"></label><label>وزن الحبة<input id="mqPiece" readonly></label><label>عدد الحبات<input id="mqPieces" readonly></label></div>
      <label>ملاحظات<input id="mqNotes" placeholder="ملاحظات للمدير أو العميل"></label>
      <br><button class="primary" type="button" onclick="saveQuote()">حفظ وإرساله للمدير للاعتماد</button>`;
    modal.classList.remove('hidden');
    ['mqWidth','mqLength','mqThickness','mqSizeUnit','mqThicknessUnit','mqMaterial','mqKg','mqPriceKg'].forEach(x=>{const el=$id(x);if(el){el.addEventListener('input',calcQuoteForm);el.addEventListener('change',calcQuoteForm);}});
    calcQuoteForm();
  };

  window.toggleQuoteCustomerMode=function(){
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    existingCustomerBox.classList.toggle('hidden',mode!=='existing');
    newCustomerBox.classList.toggle('hidden',mode!=='new');
  };

  window.calcQuoteForm=function(){
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
    mqTotal.value=(kg*Number(mqPriceKg.value||0)) ? (kg*Number(mqPriceKg.value||0)).toFixed(2) : '';
  };

  window.saveQuote=function(){
    ensureQuotes();
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    let customerId='';
    let repId=(window.mqRep && mqRep.value) ? mqRep.value : currentUser.id;
    if(mode==='new'){
      const name=(mqNewCustomerName.value||'').trim();
      if(!name) return alert('اكتب اسم العميل الجديد');
      const newCustomer={id:newLocalId(),name,phone:mqNewCustomerPhone.value||'',city:mqNewCustomerCity.value||'جدة',district:'',location:mqNewCustomerLocation.value||'',category:'عميل',status:'active',rep_id:repId,debt_balance:0,credit_limit:0,notes:'تمت إضافته من عرض سعر'};
      db.customers.unshift(newCustomer);
      customerId=newCustomer.id;
    }else{
      customerId=mqCustomer.value;
      if(!customerId) return alert('اختر العميل');
    }
    const no='Q-'+String((db.quotes||[]).length+1).padStart(5,'0');
    db.quotes.unshift({id:newLocalId(),quote_no:no,status:'pending',customer_id:customerId,rep_id:repId,date:mqDate.value||safeToday(),valid_until:mqValid.value,product:mqProduct.value,material:mqMaterial.value,color:mqColor.value,print:mqPrint.value,width:mqWidth.value,length:mqLength.value,size_unit:mqSizeUnit.value,thickness:mqThickness.value,thickness_unit:mqThicknessUnit.value,total_kg:mqKg.value,price_kg:mqPriceKg.value,total_amount:mqTotal.value,piece_weight:mqPiece.value,pieces:mqPieces.value,payment_terms:mqPayment.value,delivery_terms:mqDelivery.value,notes:mqNotes.value,created_by:currentUser.name,created_at:new Date().toISOString()});
    saveDB(); closeModal(); renderAll(); alert('تم حفظ العرض وإرساله للمدير للاعتماد');
  };

  window.approveQuote=function(x){const q=db.quotes.find(q=>q.id===x);if(!q)return;q.status='approved';q.approved_by=currentUser.name;q.approved_at=safeToday();saveDB();renderQuotes();alert('تم اعتماد عرض السعر');};
  window.rejectQuote=function(x){const q=db.quotes.find(q=>q.id===x);if(!q)return;const reason=prompt('سبب الرفض');if(!reason)return;q.status='rejected';q.reject_reason=reason;q.rejected_by=currentUser.name;q.rejected_at=safeToday();saveDB();renderQuotes();alert('تم رفض العرض');};
  window.sendQuote=function(x){const q=db.quotes.find(q=>q.id===x);if(!q)return;if(q.status!=='approved'&&q.status!=='sent')return alert('لا يمكن الإرسال قبل اعتماد المدير');q.status='sent';q.sent_at=safeToday();saveDB();renderQuotes();const msg=`عرض سعر من شركة جدة النموذجية للصناعة%0Aرقم العرض: ${q.quote_no}%0Aالعميل: ${customerName(q.customer_id)}%0Aالمنتج: ${q.product}%0Aالمقاس: ${q.width} × ${q.length} ${q.size_unit}%0Aالسماكة: ${q.thickness} ${q.thickness_unit}%0Aالخامة: ${q.material}%0Aالكمية: ${q.total_kg} كجم%0Aالإجمالي: ${q.total_amount} ريال`;window.open(`https://wa.me/?text=${msg}`,'_blank');};
  window.viewQuote=function(x){const q=db.quotes.find(q=>q.id===x);if(!q)return;modalBody.innerHTML=`<div class="quote-print"><div class="print-head"><div><h1>عرض سعر</h1><p>شركة جدة النموذجية للصناعة</p></div><div><b>${q.quote_no}</b><br>${q.date}</div></div><p><b>العميل:</b> ${customerName(q.customer_id)}<br><b>المندوب:</b> ${repName(q.rep_id)}<br><b>الحالة:</b> ${quoteStatusText(q.status)}</p><table><tr><th>المنتج</th><th>المقاس</th><th>السماكة</th><th>الخامة</th><th>الكمية</th><th>سعر الكيلو</th><th>الإجمالي</th></tr><tr><td>${q.product}</td><td>${q.width}×${q.length} ${q.size_unit}</td><td>${q.thickness} ${q.thickness_unit}</td><td>${q.material}</td><td>${q.total_kg} كجم</td><td>${q.price_kg}</td><td>${q.total_amount}</td></tr></table><p><b>شروط الدفع:</b> ${q.payment_terms||'-'}<br><b>التسليم:</b> ${q.delivery_terms||'-'}<br><b>ملاحظات:</b> ${q.notes||'-'}</p><button class="primary" onclick="window.print()">طباعة / PDF</button></div>`;modal.classList.remove('hidden');};
  window.convertQuoteToOrder=function(x){const q=db.quotes.find(q=>q.id===x);if(!q)return;if(q.status!=='approved'&&q.status!=='sent')return alert('لا يمكن تحويل عرض غير معتمد إلى طلب');db.orders.unshift({id:newLocalId(),date:safeToday(),customer_id:q.customer_id,rep_id:q.rep_id,product:q.product,material:q.material,color:q.color,width:q.width,length:q.length,thickness:q.thickness,total_kg:q.total_kg,piece_weight:q.piece_weight,pieces:q.pieces,amount:q.total_amount+' ريال',amount_value:Number(q.total_amount||0),status:'جديد',notes:'تم التحويل من عرض السعر '+q.quote_no});q.converted_to_order=true;q.converted_at=safeToday();saveDB();renderAll();alert('تم تحويل عرض السعر إلى طلب تصنيع');};
})();



/* JMS visit report notes module */
(function(){
  function localId(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function saveDb(){ if(typeof save === 'function') save(); }
  function byId(id){ return document.getElementById(id); }

  window.ensureVisitReports = function(){
    db.visitReports ||= [];
    saveDb();
  };

  window.noteTypeText = function(type){
    return type==='quote'?'طلب عرض سعر':
      type==='complaint'?'شكوى عميل':
      type==='price'?'طلب سعر خاص':
      type==='manager'?'طلب مقابلة المدير':
      type==='followup'?'موعد متابعة':
      'ملاحظة عامة';
  };

  window.noteNeedsAction = function(type){
    return ['quote','complaint','price','manager','followup'].includes(type);
  };

  window.renderVisitNoteFilters = function(){
    if(!window.visitNoteRepFilter) return;
    const reps = currentUser.role === 'rep' ? db.reps.filter(r=>r.id===currentUser.id) : db.reps;
    const cur = visitNoteRepFilter.value;
    visitNoteRepFilter.innerHTML = '<option value="all">كل المناديب</option>' + reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    if(cur) visitNoteRepFilter.value = cur;
  };

  window.renderVisitNotes = function(){
    if(!window.visitNotesList) return;
    ensureVisitReports();
    renderVisitNoteFilters();

    let reports = currentUser.role === 'rep' ? db.visitReports.filter(r=>r.rep_id===currentUser.id) : db.visitReports;
    const type = visitNoteTypeFilter.value || 'all';
    const rep = visitNoteRepFilter.value || 'all';
    const search = (visitNoteSearch.value || '').trim();

    if(type !== 'all') reports = reports.filter(r=>r.type === type);
    if(rep !== 'all') reports = reports.filter(r=>r.rep_id === rep);
    if(search) reports = reports.filter(r => customerName(r.customer_id).includes(search) || String(r.note||'').includes(search));

    visitReportsCount.textContent = reports.length;
    visitActionCount.textContent = reports.filter(r=>r.needs_action && r.status!=='closed').length;
    visitQuoteReqCount.textContent = reports.filter(r=>r.type==='quote').length;
    visitComplaintCount.textContent = reports.filter(r=>r.type==='complaint').length;

    visitNotesList.innerHTML = reports.map(r=>visitNoteCard(r)).join('') || '<div class="panel">لا توجد ملاحظات زيارات</div>';
  };

  window.visitNoteCard = function(r){
    return `<div class="visit-note-card">
      <div class="visit-note-head">
        <div>
          <h3>${customerName(r.customer_id)}</h3>
          <p>المندوب: ${repName(r.rep_id)}<br>التاريخ: ${r.date} · وقت الزيارة: ${r.arrive_time||'-'} - ${r.leave_time||'-'}</p>
        </div>
        <span class="note-type ${r.type}">${noteTypeText(r.type)}</span>
      </div>
      <div class="visit-note-body">${r.note || '-'}</div>
      <div class="visit-note-meta">
        <div><b>الاهتمام بالمنتج:</b><br>${r.product_interest||'-'}</div>
        <div><b>السعر المطلوب:</b><br>${r.requested_price||'-'}</div>
        <div><b>موعد المتابعة:</b><br>${r.followup_date||'-'}</div>
        <div><b>الحالة:</b><br>${r.status==='closed'?'تمت المعالجة':'مفتوحة'}</div>
      </div>
      <div class="visit-note-actions">
        ${r.type==='quote'?`<button class="quote" onclick="createQuoteFromVisit('${r.id}')">إنشاء عرض سعر</button>`:''}
        ${r.followup_date?`<button class="follow" onclick="appointment('${r.customer_id}')">تحديث الموعد</button>`:''}
        <button class="done" onclick="closeVisitReport('${r.id}')">تمت المعالجة</button>
      </div>
    </div>`;
  };

  window.openVisitReportForm = function(customerId){
    const c = db.customers.find(x=>x.id===customerId);
    if(!c) return;
    modalBody.innerHTML = `<h2>تقرير زيارة: ${c.name}</h2>
      <div class="form-grid two">
        <label>نوع الملاحظة
          <select id="vrType">
            <option value="general">ملاحظة عامة</option>
            <option value="quote">طلب عرض سعر</option>
            <option value="complaint">شكوى عميل</option>
            <option value="price">طلب سعر خاص</option>
            <option value="manager">طلب مقابلة المدير</option>
            <option value="followup">موعد متابعة</option>
          </select>
        </label>
        <label>تاريخ الزيارة<input id="vrDate" type="date" value="${tdy()}"></label>
        <label>وقت الوصول<input id="vrArrive" type="time"></label>
        <label>وقت المغادرة<input id="vrLeave" type="time"></label>
        <label>المنتج الذي يهتم به العميل<input id="vrProduct" placeholder="مثال: أكياس رول / شرنك"></label>
        <label>السعر الذي طلبه العميل<input id="vrPrice" placeholder="مثال: 8.5 ريال للكيلو"></label>
        <label>موعد المتابعة القادم<input id="vrFollowup" type="date"></label>
      </div>
      <br>
      <label>ملاحظات الزيارة<textarea id="vrNote" style="width:100%;min-height:110px;border:1px solid #d8dee9;border-radius:14px;padding:12px" placeholder="اكتب تفاصيل الزيارة كاملة..."></textarea></label>
      <br><button class="primary" type="button" onclick="saveVisitReport('${customerId}')">حفظ تقرير الزيارة</button>`;
    modal.classList.remove('hidden');
  };

  window.saveVisitReport = function(customerId){
    ensureVisitReports();
    const c = db.customers.find(x=>x.id===customerId);
    if(!c) return;
    const repId = c.rep_id || currentUser.id;
    const report = {
      id: localId(),
      customer_id: customerId,
      rep_id: repId,
      date: vrDate.value || tdy(),
      arrive_time: vrArrive.value || '',
      leave_time: vrLeave.value || '',
      type: vrType.value,
      note: vrNote.value || '',
      product_interest: vrProduct.value || '',
      requested_price: vrPrice.value || '',
      followup_date: vrFollowup.value || '',
      needs_action: noteNeedsAction(vrType.value),
      status: noteNeedsAction(vrType.value) ? 'open' : 'info',
      created_by: currentUser.name,
      created_at: new Date().toISOString()
    };
    db.visitReports.unshift(report);

    // also register a visit record
    db.visits ||= [];
    db.visits.unshift({
      id: localId(),
      customer_id: customerId,
      rep_id: repId,
      date: report.date,
      result: noteTypeText(report.type),
      arrive_time: report.arrive_time,
      leave_time: report.leave_time,
      duration: '',
      notes: report.note
    });

    if(report.followup_date) c.next_date = report.followup_date;
    c.notes = [c.notes, report.note].filter(Boolean).join(' | ');
    saveDb(); closeModal(); renderAll(); alert('تم حفظ تقرير الزيارة وإرساله لمدير المبيعات');
  };

  window.closeVisitReport = function(id){
    const r = db.visitReports.find(x=>x.id===id);
    if(!r) return;
    r.status = 'closed';
    r.closed_by = currentUser.name;
    r.closed_at = tdy();
    saveDb(); renderVisitNotes();
  };

  window.createQuoteFromVisit = function(id){
    const r = db.visitReports.find(x=>x.id===id);
    if(!r) return;
    if(typeof openQuoteForm === 'function'){
      openQuoteForm();
      setTimeout(()=>{
        if(window.mqCustomer) mqCustomer.value = r.customer_id;
        if(window.mqRep) mqRep.value = r.rep_id;
        if(window.mqProduct && r.product_interest) mqProduct.value = r.product_interest;
        if(window.mqPriceKg && r.requested_price) mqPriceKg.value = String(r.requested_price).replace(/[^\d.]/g,'');
        if(window.mqNotes) mqNotes.value = 'تم إنشاء العرض من تقرير زيارة: ' + (r.note || '');
      }, 300);
    }
  };

  // Override visit action to open report form instead of simple visit
  window.visit = function(customerId){
    openVisitReportForm(customerId);
  };

  // Enhance customer cards by replacing the first button behavior through existing visit()
  // Add a separate visible "تقرير زيارة" button if possible by overriding renderCustomers
  const oldRenderCustomers = window.renderCustomers;
  window.renderCustomers = function(){
    if(typeof oldRenderCustomers === 'function') oldRenderCustomers();
    // Existing "تمت الزيارة" button now opens report form because visit() is overridden
  };
})();



/* Professional quotation document override */
(function(){
  function num(n){ return Number(n||0); }
  function fmt(n){ return num(n).toLocaleString('ar-SA', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function customerObj(id){ return (db.customers||[]).find(c=>c.id===id) || {}; }
  function vatAmount(total){ return total * 0.15; }

  window.viewQuote = function(qid){
    const q = (db.quotes||[]).find(x=>x.id===qid);
    if(!q) return;

    const c = customerObj(q.customer_id);
    const subtotal = num(q.total_amount);
    const vat = vatAmount(subtotal);
    const grand = subtotal + vat;
    const verifyText = `JMS-${q.quote_no}`;

    modalBody.innerHTML = `
      <div class="quote-print-pro">
        <div class="quote-doc">
          <div class="quote-doc-header">
            <div class="quote-company">
              <img src="assets/jms-logo.svg" alt="JMS">
              <div>
                <h1>شركة جدة النموذجية للصناعة</h1>
                <p>Jeddah Model Industrial Company</p>
                <p>عروض أسعار المنتجات البلاستيكية والتغليف</p>
              </div>
            </div>
            <div class="quote-title-box">
              <h2>عرض سعر</h2>
              <div>رقم العرض: ${q.quote_no}</div>
              <div>تاريخ الإصدار: ${q.date || '-'}</div>
              <div>صالح حتى: ${q.valid_until || '-'}</div>
            </div>
          </div>

          <div class="quote-info-grid">
            <div class="quote-info-card">
              <h3>بيانات العميل</h3>
              <p>
                <b>اسم العميل:</b> ${customerName(q.customer_id)}<br>
                <b>الجوال:</b> ${c.phone || '-'}<br>
                <b>المدينة:</b> ${c.city || '-'}<br>
                <b>العنوان:</b> ${c.location || c.district || '-'}
              </p>
            </div>
            <div class="quote-info-card">
              <h3>بيانات العرض</h3>
              <p>
                <b>المندوب:</b> ${repName(q.rep_id)}<br>
                <b>الحالة:</b> ${quoteStatusText(q.status)}<br>
                <b>شروط الدفع:</b> ${q.payment_terms || '-'}<br>
                <b>مدة التسليم:</b> ${q.delivery_terms || '-'}
              </p>
            </div>
          </div>

          <table class="quote-products-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>المقاس</th>
                <th>السماكة</th>
                <th>اللون</th>
                <th>الخامة</th>
                <th>وزن الحبة</th>
                <th>عدد الحبات</th>
                <th>الكمية كجم</th>
                <th>سعر الكيلو</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${q.product || '-'}</td>
                <td>${q.width || '-'} × ${q.length || '-'} ${q.size_unit || ''}</td>
                <td>${q.thickness || '-'} ${q.thickness_unit || ''}</td>
                <td>${q.color || '-'}</td>
                <td>${q.material || '-'}</td>
                <td>${q.piece_weight || '-'}</td>
                <td>${q.pieces || '-'}</td>
                <td>${q.total_kg || '-'}</td>
                <td>${q.price_kg || '-'} ريال</td>
                <td>${fmt(subtotal)} ريال</td>
              </tr>
            </tbody>
          </table>

          <div class="quote-summary">
            <div class="quote-terms">
              <h3>الشروط والملاحظات</h3>
              <ul>
                <li>الأسعار أعلاه حسب المواصفات الموضحة في هذا العرض.</li>
                <li>مدة صلاحية العرض حتى التاريخ الموضح أعلاه.</li>
                <li>مدة التسليم حسب جدول الإنتاج بعد اعتماد الطلب.</li>
                <li>أي تعديل في المقاس أو الخامة أو الطباعة قد يغير السعر.</li>
                <li>${q.notes || 'لا توجد ملاحظات إضافية.'}</li>
              </ul>
            </div>
            <div class="quote-totals">
              <div class="quote-total-row"><span>الإجمالي قبل الضريبة</span><b>${fmt(subtotal)} ريال</b></div>
              <div class="quote-total-row"><span>ضريبة القيمة المضافة 15%</span><b>${fmt(vat)} ريال</b></div>
              <div class="quote-total-row final"><span>الإجمالي النهائي</span><b>${fmt(grand)} ريال</b></div>
            </div>
          </div>

          <div class="quote-footer">
            <div class="quote-sign">اعتماد مدير المبيعات</div>
            <div class="quote-sign">ختم الشركة</div>
            <div class="quote-qr">
              رمز التحقق<br>
              ${verifyText}<br>
              QR
            </div>
          </div>
        </div>

        <div class="quote-actions-print">
          <button onclick="window.print()">طباعة / حفظ PDF</button>
          <button class="whatsapp" onclick="sendQuote('${q.id}')">إرسال واتساب</button>
          <button onclick="convertQuoteToOrder('${q.id}')">تحويل إلى طلب</button>
          <button class="close" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
  };

  window.sendQuote = function(qid){
    const q = (db.quotes||[]).find(x=>x.id===qid);
    if(!q) return;
    if(q.status !== 'approved' && q.status !== 'sent'){
      alert('لا يمكن إرسال العرض قبل اعتماد المدير');
      return;
    }
    q.status = 'sent';
    q.sent_at = (typeof today==='function') ? today() : new Date().toISOString().slice(0,10);
    if(typeof save === 'function') save();
    if(typeof renderQuotes === 'function') renderQuotes();

    const subtotal = num(q.total_amount);
    const grand = subtotal + vatAmount(subtotal);
    const msg =
      `عرض سعر من شركة جدة النموذجية للصناعة%0A`+
      `رقم العرض: ${q.quote_no}%0A`+
      `العميل: ${customerName(q.customer_id)}%0A`+
      `المنتج: ${q.product}%0A`+
      `المقاس: ${q.width} × ${q.length} ${q.size_unit}%0A`+
      `السماكة: ${q.thickness} ${q.thickness_unit}%0A`+
      `الخامة: ${q.material}%0A`+
      `الكمية: ${q.total_kg} كجم%0A`+
      `الإجمالي شامل الضريبة: ${fmt(grand)} ريال`;
    window.open(`https://wa.me/?text=${msg}`,'_blank');
  };
})();



/* Searchable customer picker override */
(function(){
  function localId(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function saveDb(){ if(typeof save === 'function') save(); }
  function allowedCs(){ return (typeof allowedCustomers === 'function') ? allowedCustomers() : (db.customers||[]); }
  function safeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  window.renderQuoteCustomerSearch = function(){
    if(!window.mqCustomerSearchResults || !window.mqCustomerSearch) return;
    const q = (mqCustomerSearch.value || '').trim();
    const list = allowedCs().filter(c=>{
      const txt = `${c.name||''} ${c.phone||''} ${c.city||''} ${c.district||''}`;
      return !q || txt.includes(q);
    }).slice(0,80);

    mqCustomerSearchResults.innerHTML = list.map(c=>`
      <button type="button" onclick="selectQuoteCustomer('${c.id}')">
        ${safeHtml(c.name)}
        <small>${safeHtml(c.phone || '-')} · ${safeHtml(c.city || '-')} · ${safeHtml(repName(c.rep_id))}</small>
      </button>
    `).join('') || `<button type="button" disabled>لا يوجد عميل بهذا الاسم</button>`;

    mqCustomerSearchResults.classList.add('active');
  };

  window.selectQuoteCustomer = function(customerId){
    const c = (db.customers||[]).find(x=>x.id===customerId);
    if(!c) return;
    mqCustomer.value = customerId;
    mqCustomerSearch.value = c.name;
    selectedQuoteCustomer.textContent = 'تم اختيار العميل: ' + c.name;
    selectedQuoteCustomer.classList.add('active');
    mqCustomerSearchResults.classList.remove('active');
    if(window.mqRep && c.rep_id) mqRep.value = c.rep_id;
  };

  const previousOpenQuoteForm = window.openQuoteForm;
  window.openQuoteForm = function(){
    if(typeof ensureQuotes === 'function') ensureQuotes();
    const cs = allowedCs();
    const reps = currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;
    const defaultRep=currentUser.role==='rep'?currentUser.id:(reps[0]?.id||'');

    modalBody.innerHTML=`<h2>إنشاء عرض سعر</h2>
      <div class="quote-customer-mode">
        <label><input type="radio" name="quoteCustomerMode" value="existing" checked onchange="toggleQuoteCustomerMode()"><span>اختيار عميل موجود</span></label>
        <label><input type="radio" name="quoteCustomerMode" value="new" onchange="toggleQuoteCustomerMode()"><span>إضافة عميل جديد</span></label>
      </div>

      <div id="existingCustomerBox" class="form-grid two">
        <label>بحث باسم العميل
          <div class="customer-search-picker">
            <input id="mqCustomerSearch" placeholder="اكتب اسم العميل أو جزء منه..." autocomplete="off" oninput="renderQuoteCustomerSearch()" onfocus="renderQuoteCustomerSearch()">
            <div id="mqCustomerSearchResults" class="customer-search-results"></div>
            <div id="selectedQuoteCustomer" class="selected-customer-pill"></div>
          </div>
          <input id="mqCustomer" type="hidden" value="">
        </label>
        <label>المندوب<select id="mqRep">${reps.map(r=>`<option value="${r.id}" ${r.id===defaultRep?'selected':''}>${r.name}</option>`).join('')}</select></label>
      </div>

      <div id="newCustomerBox" class="form-grid two hidden">
        <label>اسم العميل الجديد<input id="mqNewCustomerName" placeholder="اسم العميل"></label>
        <label>جوال العميل<input id="mqNewCustomerPhone" placeholder="05xxxxxxxx"></label>
        <label>المدينة<input id="mqNewCustomerCity" value="جدة"></label>
        <label>الحي / الموقع<input id="mqNewCustomerLocation" placeholder="الحي أو رابط الموقع"></label>
      </div>

      <div class="form-grid two"><label>تاريخ العرض<input id="mqDate" type="date" value="${tdy()}"></label><label>صلاحية العرض<input id="mqValid" type="date"></label></div>
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
      <div class="form-grid two"><label>شروط الدفع<input id="mqPayment" value="حسب الاتفاق"></label><label>مدة التسليم<input id="mqDelivery" value="حسب جدول الإنتاج"></label><label>وزن الحبة<input id="mqPiece" readonly></label><label>عدد الحبات<input id="mqPieces" readonly></label></div>
      <label>ملاحظات<input id="mqNotes" placeholder="ملاحظات للمدير أو العميل"></label>
      <br><button class="primary" type="button" onclick="saveQuote()">حفظ وإرساله للمدير للاعتماد</button>`;

    modal.classList.remove('hidden');

    ['mqWidth','mqLength','mqThickness','mqSizeUnit','mqThicknessUnit','mqMaterial','mqKg','mqPriceKg'].forEach(x=>{
      const el=document.getElementById(x);
      if(el){ el.addEventListener('input',calcQuoteForm); el.addEventListener('change',calcQuoteForm); }
    });

    // select first customer only if user doesn't search
    if(cs[0]) {
      mqCustomer.value = cs[0].id;
      selectedQuoteCustomer.textContent = 'العميل الافتراضي: ' + cs[0].name;
      selectedQuoteCustomer.classList.add('active');
    }

    if(typeof calcQuoteForm === 'function') calcQuoteForm();

    document.addEventListener('click', function closePicker(e){
      if(!document.getElementById('existingCustomerBox')) {
        document.removeEventListener('click', closePicker);
        return;
      }
      const box = document.querySelector('.customer-search-picker');
      if(box && !box.contains(e.target) && window.mqCustomerSearchResults){
        mqCustomerSearchResults.classList.remove('active');
      }
    });
  };

  window.saveQuote = function(){
    if(typeof ensureQuotes === 'function') ensureQuotes();
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    let customerId='';
    let repId=(window.mqRep && mqRep.value) ? mqRep.value : currentUser.id;

    if(mode==='new'){
      const name=(mqNewCustomerName.value||'').trim();
      if(!name) return alert('اكتب اسم العميل الجديد');
      const newCustomer={id:localId(),name,phone:mqNewCustomerPhone.value||'',city:mqNewCustomerCity.value||'جدة',district:'',location:mqNewCustomerLocation.value||'',category:'عميل',status:'active',rep_id:repId,debt_balance:0,credit_limit:0,notes:'تمت إضافته من عرض سعر'};
      db.customers.unshift(newCustomer);
      customerId=newCustomer.id;
    }else{
      customerId=mqCustomer.value;
      if(!customerId) return alert('اكتب اسم العميل واختره من نتائج البحث');
    }

    const no='Q-'+String((db.quotes||[]).length+1).padStart(5,'0');
    db.quotes ||= [];
    db.quotes.unshift({
      id:localId(),quote_no:no,status:'pending',customer_id:customerId,rep_id:repId,date:mqDate.value||tdy(),valid_until:mqValid.value,
      product:mqProduct.value,material:mqMaterial.value,color:mqColor.value,print:mqPrint.value,
      width:mqWidth.value,length:mqLength.value,size_unit:mqSizeUnit.value,thickness:mqThickness.value,thickness_unit:mqThicknessUnit.value,
      total_kg:mqKg.value,price_kg:mqPriceKg.value,total_amount:mqTotal.value,piece_weight:mqPiece.value,pieces:mqPieces.value,
      payment_terms:mqPayment.value,delivery_terms:mqDelivery.value,notes:mqNotes.value,created_by:currentUser.name,created_at:new Date().toISOString()
    });
    saveDb();
    closeModal();
    renderAll();
    alert('تم حفظ العرض وإرساله للمدير للاعتماد');
  };
})();



/* Final quotation logo and PDF action override */
(function(){
  function num(n){ return Number(n||0); }
  function fmt(n){ return num(n).toLocaleString('ar-SA', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function customerObj(id){ return (db.customers||[]).find(c=>c.id===id) || {}; }
  function vatAmount(total){ return total * 0.15; }

  window.downloadQuotePDF = function(){
    window.print();
  };

  window.viewQuote = function(qid){
    const q = (db.quotes||[]).find(x=>x.id===qid);
    if(!q) return;

    const c = customerObj(q.customer_id);
    const subtotal = num(q.total_amount);
    const vat = vatAmount(subtotal);
    const grand = subtotal + vat;
    const verifyText = `JMS-${q.quote_no}`;

    modalBody.innerHTML = `
      <div class="quote-print-pro">
        <div class="quote-doc">
          <div class="quote-doc-header">
            <div class="quote-company">
              <img class="jms-real-logo" src="assets/jeddah-model-logo.jpeg" alt="Jeddah Model Industrial Co. Ltd">
              <div>
                <h1>شركة جدة النموذجية للصناعة</h1>
                <p>Jeddah Model Industrial Co. Ltd</p>
                <p>عروض أسعار المنتجات البلاستيكية والتغليف</p>
              </div>
            </div>
            <div class="quote-title-box">
              <h2>عرض سعر</h2>
              <div>رقم العرض: ${q.quote_no}</div>
              <div>تاريخ الإصدار: ${q.date || '-'}</div>
              <div>صالح حتى: ${q.valid_until || '-'}</div>
            </div>
          </div>

          <div class="quote-info-grid">
            <div class="quote-info-card">
              <h3>بيانات العميل</h3>
              <p>
                <b>اسم العميل:</b> ${customerName(q.customer_id)}<br>
                <b>الجوال:</b> ${c.phone || '-'}<br>
                <b>المدينة:</b> ${c.city || '-'}<br>
                <b>العنوان:</b> ${c.location || c.district || '-'}
              </p>
            </div>
            <div class="quote-info-card">
              <h3>بيانات العرض</h3>
              <p>
                <b>المندوب:</b> ${repName(q.rep_id)}<br>
                <b>الحالة:</b> ${quoteStatusText(q.status)}<br>
                <b>شروط الدفع:</b> ${q.payment_terms || '-'}<br>
                <b>مدة التسليم:</b> ${q.delivery_terms || '-'}
              </p>
            </div>
          </div>

          <table class="quote-products-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>المقاس</th>
                <th>السماكة</th>
                <th>اللون</th>
                <th>الخامة</th>
                <th>وزن الحبة</th>
                <th>عدد الحبات</th>
                <th>الكمية كجم</th>
                <th>سعر الكيلو</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${q.product || '-'}</td>
                <td>${q.width || '-'} × ${q.length || '-'} ${q.size_unit || ''}</td>
                <td>${q.thickness || '-'} ${q.thickness_unit || ''}</td>
                <td>${q.color || '-'}</td>
                <td>${q.material || '-'}</td>
                <td>${q.piece_weight || '-'}</td>
                <td>${q.pieces || '-'}</td>
                <td>${q.total_kg || '-'}</td>
                <td>${q.price_kg || '-'} ريال</td>
                <td>${fmt(subtotal)} ريال</td>
              </tr>
            </tbody>
          </table>

          <div class="quote-summary">
            <div class="quote-terms">
              <h3>الشروط والملاحظات</h3>
              <ul>
                <li>الأسعار أعلاه حسب المواصفات الموضحة في هذا العرض.</li>
                <li>مدة صلاحية العرض حتى التاريخ الموضح أعلاه.</li>
                <li>مدة التسليم حسب جدول الإنتاج بعد اعتماد الطلب.</li>
                <li>أي تعديل في المقاس أو الخامة أو الطباعة قد يغير السعر.</li>
                <li>${q.notes || 'لا توجد ملاحظات إضافية.'}</li>
              </ul>
            </div>
            <div class="quote-totals">
              <div class="quote-total-row"><span>الإجمالي قبل الضريبة</span><b>${fmt(subtotal)} ريال</b></div>
              <div class="quote-total-row"><span>ضريبة القيمة المضافة 15%</span><b>${fmt(vat)} ريال</b></div>
              <div class="quote-total-row final"><span>الإجمالي النهائي</span><b>${fmt(grand)} ريال</b></div>
            </div>
          </div>

          <div class="quote-footer">
            <div class="quote-sign">اعتماد مدير المبيعات</div>
            <div class="quote-sign">ختم الشركة</div>
            <div class="quote-qr">
              رمز التحقق<br>
              ${verifyText}<br>
              QR
            </div>
          </div>
        </div>

        <div class="quote-actions-print">
          <button class="pdf" onclick="downloadQuotePDF()">تحميل PDF</button>
          <button onclick="window.print()">طباعة</button>
          <button class="whatsapp" onclick="sendQuote('${q.id}')">إرسال واتساب</button>
          <button onclick="convertQuoteToOrder('${q.id}')">تحويل إلى طلب</button>
          <button class="close" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
  };
})();


/* === JMS WORLD CLASS STABLE JS PATCH === */
(function(){
  const JMS_LOGO_DATA = "data:image/jpeg;base64,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2pdvtTlGBTbGJsWlCgUtFIBCoNMK46VJTWppgMHSlHHSiii4BTSMc9adRjNIBmR6U3Aqbb7UbfancViHApal2+1G32qbBYipMc5qbb7UbfaquMZ+FH4U/b7UbfakBFSYFTbfajb7U0wIlwoxQMDtUu32o2+1O4FYcDFKMKc4qTBowakdxu80m40/Bowaq4hwOQKWiipAXJFJRRQAw9aMmn7c9qXb7UFXGg5p2TSYxRQK47GeTS7RQvSloEJtFG0UtFO47jdtG2nUUXEN20badRRcBAMUtFFIAooooAKKKKACiiigAooooAKKKKACiiigAooooA//0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBCM0m2nUUmwG7aNtOopXAbto206iqAQDFLRRQAdabtp1FADdtG2nUUAN206iigAooooAKKKKACiiigAooooAKKKKACkIzS0UAN20oGKWigAooooAKKKKACkIzS0UAN20badRQA3bSgYpaKACiiigAooooAKKKKACiiigAooooAKKKKAG7aNtOooAbto206igBu2jbTqKAG7aNtOooAOlFFFACEZpNtOooAQDFLRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/9H9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//T/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBCcUm6gnFM3D0p2Cz6D91G6m7hRTsCTHbqNxptJkUOwD9xo3GmZFJupXQnJdiTdS5FRbqNxpXQJpkuRRuFRbjTqrQY7cKN1Noo0Aduo3UmTRzRoFvMXdSg5pv40hPc1OgW8ySiosijIqtCtCWiosijIo0DQloqLIoyKNA0JaQnFR5FIST7VOgaEu4Um6ohn1pRk0XQaEm6jdTMH1oAxTuhOw/caNxpmRQDmi6C67D9xo3GmE4puec0XRLkuxLuNG40zJ9KMn0qrC5kP3GjcaZk+lJuNLQOZEm40bjUe40bjUXDmRJuNG6o9xoBJNFxcw/eKXdUZZR2pwYGr1L5ZD88Zpu+jOeKbkUJdwuluSA5paQdKWpAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//U/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBrYxzUJZAcVM3TNVjNEnMjBfqapEtyvZEhwB9abkiqDX8O7BcYHuKX+0Lb/noPzFQ52NnSqNaF7cTxTNrZqst9ak/6xfzFTG7tv8Anqp/EU1NdSFGpDRokAenYaqjXVtn/Wj8xUn221/56j8xV88Svff2SYtt600SI3QfpVdr6z7yr+YpovbUdJF/MVPPAFSlL4olzIFBYjmqn263J4dfzFTfabVh/rF/MVDnAPZ26DxLTxKuOah861/vr+YpPtdoODIv5in7SmNQ8ix5q+lL5g9Kr/bLP/nov5ik+12n99fzFHtKZTh5FnzB6UoZTVb7Zaf31/MUhvbQfxj8xR7SBPI30LeVoytU/t1p/fH50f2hZDguv50e1gHsn2Le4Um5ari/sj/y0X86Df2Q/wCWi/nR7SAeyfYsblo3JVb+0LL++v5003lm/wDy0UfiKPaQD2fkXdyUwsueKq/abP8A56j86glvrWPG2RTn3FUpw7g6WmzNLHGaZuFUBqFswx5g/MU03sCnIcH8RWM6kE9RxoPsaG/tTuo7VTW8tXHMij8ab9otgf8AWA/jWqnGxLpNO6Rd2n1FJ93nNU/tVr/fX86Ptdp/fX86XPEfv/yloyZ70gbmq32m0/56L+dH2q0HRlJ+tV7SA0p/ylzefWjefWqn2u3/ANn86Ptdv/s/nR7SBfI/5S3vPrRvPrVX7XB6r+dH2uD1X86PaRDkf8pa3n1o3n1qr9rg9V/Oj7XB6r+dPngHI/5S15lODE1U+1W3qv50v223H8S/nS54C5H2LHU0oB6iqP2+3H8S/nSHUoB0K/nSVVERp1epoE460o56VTivUc4BBq8DuHFO9yJU7bkoGBilpB0paQgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/1f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAgnbahNfDv7RfxM8a+E22+Hbd5P92vuOdQ0ZBrj9W8L6HrgxqFss2PUVlNvZHdhqkIO8j8jJv2ivjKiKDp8o3HHU/wCFVj+0V8YhwbGX8/8A61fq5J8NPCU2FXTkG3pwP8Kgb4WeFz/y4R/98j/CsHBs+qp5jQSs4n5T/wDDR3xgHWyl/Wnr+0d8Xyf+POX9f8K/U/8A4VR4XY4+wR/98j/Cj/hUvhkH/jxj/wC+R/hXPOlK+jO2OZ4RfFE/L2P9of4vuQPsUvP1/wAK0x8d/jC4+Wxl6Z6n/Cv03i+FnhhP+XKP/vkf4VYf4deG4+Vs48EH+Ef4VDoztuNZzhFK3Ij8itc/an+I+hq0uoxSxKnUnNc8f21PF+3cHbH1r72/aD+Bvh7UvBt7eWluiSKpbhfSvwv1iySxvJ7PPMbsuPoa8HG1qtFo/XOHcPl+YU5S5NUfdmlfti+N9VuUtLLdJLIcAA16FD+0F8W2wfscvPvX54eAtf8A+EZ1u3vZ4vMRWB5r9ZPhF8X/AIc+L4YbO9jhjlChcHGcjj0rDD4p1HZsM3ydYeDqU6Sa9DzE/tA/FscCyl/M/wCFNPx9+K45NnL+v+FfpBo/gzwdqNqLi1topFYZ4A/wrc/4Vl4akUE2cYz/ALI/wr6WNBSWjPyt5thacmqlNfcfmL/wvr4s4yLOXH+farCfHv4rbAfskv5//Wr9ND8M/DW3AtI/++R/hUP/AArDw8elon/fI/woeGfc0WeYB/YR+af/AAvv4rf8+kv6/wCFPX47/FUjP2ST86/SkfC/w/8A8+af98j/AAp3/CrfCx5ks0z9BU/V5dGUs7wKf8Nfcfmt/wAL1+K3/PpJSj44/FV/m+xyfma/Sn/hVfhP/n0T8qkX4X+F1GFtkA+g/wAKf1afc0/t7A/8+/wPzZT44/FLvaSfrU6/HD4nsMm0k/M1+kP/AArDwx/z7p+Q/wAKevwy8MqMfZk/75H+FNYafcl5/gf+ff4H5u/8Lv8Aid/z6SfrSr8bPie/S1k/M1+kn/CtPDP/AD6p/wB80n/CtvDq/ctU/wC+RVfVpdyf7fwP/Ps/OD/hdHxRP/LrL+ZpD8ZPikwJ+xynHua/SEfDnQP+fVP++RQ/gDQo12iyRs+wo9hJa3Inn2EatGmrn5f6l+0B8SNLQy3NvIijuTXJL+154mEhiLNuHbNfo38QfhZ4e1DR7jbaKrBT0Ar8UfiRoMfh/wAYXVrEu1Vbp+Jr5zMKlSiuZM/U+FqWAzR8soK/ofUOn/tX+Kr67W1jZt7HAGa9ctfit8Tr6BZIIXG7kEHNfm/Z3smmXUeoQrkoQfyr7u+Dnx50SUQ6drMSR4AGWx1rgwWYTqNQkz6HiDhqnhYc+GppneD4hfFonAikND/ED4tqdrQyg19n+EpvCmv20d1aCOQsAcDFehHw5osmD9lTd9B/hX1MaUpbM/AMRm1PDz5KlO3yPzpPxC+LA/5Zy/5/Cnp8Qvi2p3CKU4r9Dj4T0vORapj/AHRUv/CMaUF/49Uz/uiun6tPuYTzmk/hgj87/wDhZHxd/wCeEn+fwoHxI+LveCT/AD+FfoZ/wjGmf8+qf98igeGNMz/x6p/3yKr6tLuZ/wBq0v5Efnp/wsr4tf8APCT/AD+FH/Cyvi1/zwk/z+Ffob/wi+l/8+qf98ikPhfS8f8AHqn/AHyKPq8+4f2rS/kR+ef/AAsr4t/88Jab/wALK+Lf/PCWv0L/AOEW0z/n1T8h/hR/wi2mf8+qfkP8Kr6tLuP+1aX8iPzxPxM+LnaCX/P4Uw/Ev4v9fIk/z+Ffoh/wimm/8+qfkP8ACj/hFNN/59U/75H+FS8NLuH9q0v5EfnafiR8XiP+PeWoz8SPjB/z7yV+jo8LaV/z6p/3yP8ACnr4W0n/AJ9U/If4U402upzzzOm1ZRR8ffDb4h+Pr+8SLWLV0GcZJr7W0ueSaySSX5WIFZcfhzTreQPBaqpHcAVvi3HlBPu13wVj5rEVI1GXEOVFOpka7UCnnFPqzgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAawyOagK7Purmp2pgz3ppCcb6kZjyR2Hel8pPU1Lg0lOyGo+ZGIlHIzTWwexqQMTmkyO9Q3Zi0W4mxSPSq4Co/llSRjrVknNRdXH0NNy0Mvc5jyn4qiA+D9QRoyR5bd/Y1/Nh47UN4uvlRdoErcfjX9KnxVQDwdqB/6Zt/I1/Nh45P8AxV18f+mrfzr4vOXdRP6R8PUnGbXkVYFDRIcZxU1nqF9o1+l3YSvCyHPDHn8qpWspEYqxvYSDzF4+lfCxqyhK5/R9SlTr0uSSP0E/Z/8A2t7zSruHRfEDFYVwN7kY/rX6y+EfHmi+KbGK8064WdZFDfKema/mVNuyzedbvsP1xX098Dv2iNe8C6xBp+pTFrTIXJ9Onc19ll+YpO0j8B4m4Ki17WktT+gRJ1l+4pIqwoVu9eKfDj4l6R4x0yG7sZ1dnUEgHPWvaoX3KJAOor7inUhNXR/NuNwMsNNxmrWFZVHGTS/Pj5eacyhunBpV3BQD1rdtLU5VKKWgz956U0qxOSDU+Woy1HP5D5/Ig2H0NKIz6GpstQCaXN5Cc/Ij8s+hoCsOgqbj/Io4/wAiquHN5EBVvSkBZWAI61Y4/wAiq0zYdKL30GnfSxha7bB7C4L9Npr8E/j4wj+I17Gq/Lkc/ia/ffXP+QZcf7hr8Cvj6CfiLe49f6mvh86jamfv/hi5PFSPI9oMe3d1qk4ngIeJyhByCCRTy5FPcsyfKMmvzSE5Qd0f2BVUKsXGSPoD4T/HrXvA99BFdSPJbggEk5GPxr9bPhh8ZtB8c2cDx3CmZkztB5r8DEkJ+WQYrvvBPxE8QeCdWgvLO4IhQ4I5xgn619plmbuD5ah+KcU8E4XGUpVaStI/ouiljkj8xeVPeljw7ZAyvrXyv8Cvjpo/jjR4LaedRcAAEE8k19SQTC4KvD9wV+hUsXGorxP49xuCq4Ko6U42Lm0en60YX0/Wlors5jyde4Y9jRj2NO3UbqTmOzDYtGxal4pcil7QqzIdoo2ipsik4NLmFZkPlr6UeWvpUhx2pKLIVmMAf1oKluCafRVpj5B6jAApaQdKWoGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/9f9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAEPSm5NPopoTRHlqXk0/AoouK3mMIxUJOKsnpUXrRfUta7ke49xUZJDA47VOopj/eH0qx2V9jyj4qOT4O1DPA8tv5Gv5sPHJz4tvx/01b+df0mfFf8A5E7UP+ubfyNfzZeN/wDkbL//AK6t/M18VnbXun9GeHq9yp8jLthhAatAueWPSq0P+qFPr8/mtT+jIytEnVt5xnFXZbaNwjIfnHcVRXpV1TtxsPXrUttWsbxtJOM1e59DfA3436z4A8QQWVzOzWmcHJOBX7f/AA0+JmmeM9Ltri0mWQyrk4OcV/OGVWI+eB8wr64/Zl+Olz4V1yPS9Qk2W+4KuT26V9Xl+YSi1Fn4txhwrRq0ZV6fxH7uSMd4Kng1aX7vrXDeGPE9l4l0uG8s3DhlB45ruIyCgr9HpS5oKR/J1Si6MnGSsx+RRSYFLWpi21sFFFKgxSYJ6XEoqSipuFyOq8iZkU1cqKTqKHJoalYxNb/5Bd1n+4a/BD48lT8RL3nuP5mv3r1w/wDEruf901+Bvx1/5KFe/wC9/U18XxCuWmn3P6F8LFy4qaPG3QluKsJHvUANginoOM1ADiQ1+YS0R/YMYqMk+5VuH2yBSPxqQIJ/3fQYzmop+tLG2xc1Cb3RxS/iNPY7TwL411bwPq8d3Y3DKisMrmv2I+AvxysvG1hBbzzqsuACCea/EC4jBBZeprvfhh8RtS8Ba1BOr7YtwzzX3GVZi6bUJLQ/I+L+GqGMpSqRVpI/ozSYSKGTkGpAxzXgHwg+Jtp400W2khmDSFRkZr3+J1kyO4FfpkKql8J/F+NwlTDVeSaH76cpORVcod1WADkVpKVjimrK6J8GjBp46UVArjMGgL60+igLibRSbadRQIbz26UmSKfRU2AKKKKoAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Q/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAA9Ki7VKelRdqOo0ItNf7w+hpw6GmN94fSrZXVHkvxX/wCRO1D/AK5t/I1/Nl43/wCRsv8A/rq38zX9J/xY/wCRO1H/AK5t/I1/Nj42/wCRovv+urfzr4rO/sn9GeHvwz+Rlw/6oU+q8fVPrU46mvhJbn9ELYnXpV+1TaCzVSj5GKuINozWMzqprW5M+WQ5qoizxzw3VqxjZOc9OhqyDvOK04YY3jIk7VSq8mqN5YeOI92Wx+l/7InxtllaPQNUnGVwo3NjP51+p9peJcwJLGchhkYr+Z3wV4km8KeJra9iJCIwP61+8PwL+I0PjTwva3CSbpFUZ5r9JyrG+0jys/kzjzh72NZ16a0Z9FGU55pVc45NV0cSw+a/UVOyk4NfWppo/C46PlZKDmpk6VWTgVYSsHe4paSJKKKKoAqKTqKlqKWpYGBrn/ILuf8AdNfgb8df+ShXv+9/U1++Gt/8gq5/3TX4G/HT/kod9/vf1NfIcSfw4n9E+GH+9zPKE6VWJxIasJVVzhz9a/MJH9fSexHIMtQFG3BpTy1K2AuaSRzSWtyFlZodwPIrMurSa5iG04IrTL54oJxzWsZuDujlrU41Vys+kP2cPi3f+CvENvpt3P8AuHYDluBX7c+ENdt9a02G9iYP5yjkHPav5p9zWk6TxfeU5r9d/wBk34xQ65o9votxJiWDgAn3Ar9JyfGc3uzZ/MvHXDlouvRjsfojwDzSggnjmqscgliVyeGqVR5ZAXoa+0kuZaH8xxTUnGRdooHSikUFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//R/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAA9Ki7VKelRdqOo0IOhpjfeH0p601u341bH1PJPix/yJ+o/9c2/ka/mz8bf8jRff9dW/nX9JPxa/wCRO1H/AK5t/I1/Nn42P/FUXv8A11b+Zr4rOvsn9GeHvwzMmPqn1qcdTUEYyU+tTjqa+Dluf0RHYtRVbfhBiqkXWpwecVmzri7KxNbctzV64Zli+SqsYwalYkjnmsJxud1J8sbEqFXiUkfNX3f+x/8AFCbSdZXw9cSYQkAZNfCkfSum8Da8/hzxXZagCVVJBkg4r2ctxDpVT5HiPLY4vBSi9z+k3TpvtdrHIp4YA/nW5H8y4rx34ReIoPEnhWz1GN93yL39AK9hVumOhr9Yw1Xnhc/grGYeVLESi+gu0g1MnSomBJqVBgV0t62OG7b2H0UUUigqKWpaim+7Uy2A57W/+QVc/wC6a/A346f8lDvv97+pr98td/5B1x/uf0r8Bvjd/wAlCvv98/zNfH8Rv93E/onwv/3yXyPLkqpJ94/WraVVf7/41+YSWh/X09kNGM0yX7nFOPUUOvFEGc09UUQTmpWYBKGGDTa2tc41daEO9c5fvXrHwY8Z3PgvxjY3EUhWJ5RuGe3JryNkJapN7WjLcrwYzmu3DV3TqKx42Z4NYnDyhJdD+kfwNrieIPD9neI27eoPHPYV3ikCTafSvhf9kf4hx6/4bhsHky0Ixyc9MCvuZWG4P61+x4KfPTuz+Bs4wTw2MnTtpcu0UDpRXWfPhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//0v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAPSou1S1C3SjqNAtI/QfjRH0ND9B+NWyup5B8Wv8AkTtR/wCubfyNfzYeNTnxRe/9dW/ma/pP+LX/ACJ2o/8AXNv5Gv5sPGf/ACNl9/11b+Zr4rOvsn9FeHy92oZ8I4Q1J/Eajt/uipj1r4KR/RUfhLMfWph96o4etSD71Q0dKRbj+8KkPSo4/vCpyPlFYNndHYnTpRcKBGrrwyEGli6VK+GXbUxlyyTRvKCnCUX1R+uP7GXjiXVfD6aPI2TEMfrX6JwDMYY1+H37G/ig6T4yFo7kK7KMZ46+lfttp9x59nHL/eGf0r9eyqrzU0fwrxtgnhMbJpaM0HOBxToiTUfUVJEMCvoWtD81i043JqKKKzEFQz/dNTVDP901EtgOf13/AJB1x/uf0r8Bvjd/yUK+/wB8/wAzX7967/yDbj/cr8AfjZ/yUK//AN/+pr5HiP8AhRP6J8MP97l8jzGPqaqv9/8AGrUfU1Vf7/41+ZS2P6+nshh6ilfoKQ9RSy/drNHNLYrN1qNjgVLVeTpW6ZxzfUliAY5p10imAr6ioIyRzT3lC+9Uo68xspr2bTPrj9j7xpLpHihdJLnbKwHX1Nftxpzm4toX9QDX84fwd1k6J4/s7osVUyL3x3r+hX4e6kNT8O2l0p3BkXn8K/VMmr80LH8beIGB9jX9qluegUUUV9KfiAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/9P9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKif7tS1C3SjqUhI+hofoPxoTpSSf41bH1PIfi1/yJ2o/wDXNv5Gv5sPGf8AyNl9/wBdW/ma/pR+L3HgnUCP+ebfyNfzYeMsf8JZff8AXVv5mvic6fwn9FeHvwzMyD7oqc9ait+FFSN1/GvgpM/oqPwlyHrUo61BFUw+9SZ1R2LKVa/hH0qqnUVaP3RXNJHdT2LEX3c0+PO7moojxVgnaucVmzpiup6v8D9VOj+PbORTgNItfv8AeD75b3QrSYHO5F/kK/m/8IX7WviK0lB2kSDkV/Ql8Gb0Xvg+zkJ3Hyl/kK/Ssiq80eU/lzxOwsbQrI9dU5qyowKqRj5SatJ0r7V6Ox/NMLOCaH0UUUhhUM33TU1RSc8VMtgMDXf+Qbcf7lfgD8a/+Sh3/wDv/wBTX7/a6P8AiVXR/wBk1+Anxy4+Il7j+9/U18hxH/CR/RPhf/vkvkeXJVV/v/jVuKqcn3j9a/MJM/r+eyGnqKWX7tIeopZfu1KOWWxXqIjNS1EelbdDkluO2hVqm/LYq0zHbUYUEZNbRlaNiKq5tEGn3P2LV7S4jOCrg1+/37Oetf2p4FsSzZIRf5V/PhNG0dwsgPQ5r9uP2NtYF74IhhZtzIcfpX22RT5JNM/n/wARcOp4X2ltmfc1FIOlLX6AfyeFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//U/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACoW6VMelRHkUdRoRelNk/xpy02TpVMv7SPI/jB/wAiRqH/AFzb+Rr+bDxf/wAjZff9dW/nX9JXxgYjwRqH/XNv5Gv5svGJI8U3pHeVv5mviM7+yf0R4ffDP5FKIYRacelRx8hB71Mw5r4OW5/Ra2LMVTD71QwVMPvUM6VsWU6irR+6Kqp1FWj90Vzs76ZPF0FXAFKAHrVOLoKtAcCsmdcfhYywKwanbuOz1++37ON8bnwRZnOfkA/QV/P6hYXUTejV+7f7KFy0/gS2LtuIH+Ffb5DL32j+fPEqnfBp+Z9a/wAJqxH90VD2UHuakiJwc9jX6RLe5/JEVaCRLRRRSAKjk6ipKjk6ZqWJmBrv/IJuv901+AXxz/5KJe/739TX7+65/wAgm4/3TX4D/HQD/hY17/vf1NfJcSfwon9E+GH+9z+R5ZF938KpSfeP1q7H0NUpPvfjX5dI/sCeyGnqKWX7tIeopZfu1KOWWxXqI9KlqI9K2OOW41vu0DPlnHWh/u5p8X3atrQqPxFC6JztPpX6v/sM6oW0l7Vj0Jr8n5mzuLcmv0l/YcvyJpIA3c/zr6vKJe/Y/IeOaSll8z9cl+6KWoIGJjyTmpVr9OP4r6jqKKKCQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//V/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAA9Ki7VKelRdqOo0ItNk6U71pH6D8aqWxf2keO/GD/kR9Q/65t/I1/Nl4y/5Gi8/wCurfzNf0mfGI/8URqH/XNv5Gv5tPF4z4qvQenmt/M18Tna+E/onw9V4zM+Lon1qdvvGo4ACoz2zSknNfBPVn9Fr4S7D1qQfeqCM46VMvJpNnQmWk6irR+6Kqp1FWj90Vgzvpk8XQVbXtVOP7oq1Gc4rNnVB9CtIuxkb3r9uv2QLgyeBrcehP8ASvxNkVWVc+tfs7+xnIz+DI1Y5Ck4/MV9dkT/AHp+J+JFP/hO5n3PuZzyg96sIMZqsTlVJ7GrSmv1Fn8Z30sOoooqRBUb9DUlRP1qZbAYWt/8gq5/3TX4DfHT/ko17/vf1NfvrrpI0q5x/dNfgV8d+PiHen/a/qa+S4k/hRP6G8MNMXNnlkfQ1Sk+9+NWITnNQyD5s1+XSP7Ak7xTIz1FLL92kPUUr9BUo55bFeoj0qRjio26VujkluI/3aah+SlblaQD5K0buibe8Z0pJlK+tffn7D1y3/CQSwk8An+dfAxUbt3evuL9iiZ4/F8iqeD/AI19HlbtUR+W8Zpyy2Z+19v/AKqp1qpbk+SD7VZB4r9UP4ja1JKKQHNLQQFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAPSou1SnpUXajqNCDoaa3QfQ04dDTW6D6GrZXU8d+MX/Ikah/1zb+Rr+bXxd/yNV9/wBdW/ma/pK+MX/Ikah/1zb+Rr+bXxd/yNV9/wBdW/ma+KzraJ/Rfh58E/kU7f7o/Gk7/iaW3+6PxpO/4mvgI7n9FL4SylTr1qBKnXrUs3iWk6irR+6Kqp1FWj90Viz0KZNH90VPGelQR/dFWIuXIPas2dMNxznhfrX7M/sXf8iav1P8xX4xnsPev2a/Yt/5Exfq38xX1uQ/xT8d8SV/wmP1R91fwD61ZSq38A+tWEr9SlufxXbckoooqSQpjdafUMhwamWwHP69/wAgq5/3TX4FfHb/AJKFe/X+pr99de/5BVz/ALpr8C/jwMfEK8+v9TXyPEf8KJ/Q/hl/vUzyWGo5OtSQ1HJ1r8wqH9ffYIj1FK/QUh6iiXpUIwlsV261G3SpCM1CTmtjkluB+7QPu0H7tKvStOgdTPfgH619rfsVv/xWbj/PWvimTv8AWvtL9iwf8Vk5/wA9a+kyv+Ij8x4w/wCRbM/bu2/1K/SrI6VVtOYFzVngV+rdD+IJbsetOpq06pMQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9f9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAD0qLtUp6VF2o6jQg6Gmt0H0NOHQ01ug+hq2V1PHfjF/yJGof9c2/ka/m18Xf8jVff8AXVv5mv6SvjF/yJGof9c2/ka/m28XDPiu+/66t/M18Tne0T+i/Dxe5P5FK3+6PxpO/wCJp0H3M+9J0Jr4HZn9Fpe6iwlTr1qFBUy9almsUWk6irR+6Kqp1FWj90Viz0aZNH90Vbg/1jVUj+6KtQcSNWbOqnuNPUfWv2a/Yv8A+RMX6t/MV+Mp6j61+zP7F/Pgxfq38xX1mQv96fj3iT/yK36o+6eqD61ZToKr/wAA+tWUr9Tb1P4qb3H0UUVJAVDJ1qaoZOtTLYDn9e/5BVz/ALpr8DPjz/yUK8+v9TX7569/yCrn/dNfgZ8ef+ShXn1/qa+R4j/hRP6H8Mv96meSQ1HJ1qSGo5OtfmFQ/r77BEeopZfu0h6ill+7UIwlsVz0qA9anPSoD1rY45bgfu0q9KU/dqMHC1p0BvUpSd/rX2n+xZ/yOcn+e9fFrjJA9TX2h+xcSPGzr2x/WvpMr/iI/M+L/wDkWzP27s/+PdasnqKrWvEC49Ks9RX6t0P4flux606mrTqkxCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/Q/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAA9Ki7VKelRdqOo0IOhprdB9DTh0NNboPoatldTx34xf8iRqH/XNv5Gv5t/Fv8AyNl7/wBdW/nX9JHxi/5EjUP+ubfyNfzb+Lf+Rsvf+urfzr4nO9on9HeHnwz+RSg/1Y+tB60Qf6sfWg9a+Bluf0T0Raj+8KlH3qij+8KlH3qg2iWU6irR+6Kqp1FWj90Vkzvpk0f3RVqH7zVVj+6KtQ/eas3sdVPcaeo+tfs3+xf/AMiYPq38xX4yHqPrX7N/sX/8iYPq38xX1mRfxT8e8SP+Ra/VH3R/APrVpetVf4B9atL1r9Re5/FHcdRRRQIKhk61NUMnWplsBz+vf8gq5/3TX4GfHn/koV59f6mv3z17/kFXP+6a/Az48/8AJQrz6/1NfI8R/wAKJ/Q/hl/vUzySGo5OtSQ1HJ1r8wqH9ffYIj1FLL92kPUUsv3ahGEtiuelQHrU56VB1NbHHLccfu1F/DUrDC1F/DWnQUtyu33l+tfZn7F//I8v9P618YOfmUe9faH7Fwz45f6f1r6TK/4iPzXi3/kWzP27tf8Aj2X6CrQ6VVtf+PZfoKtDpX6t0P4eluxy06mrTqkxCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP//R/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAA9Ki7VKelRdqOo0IOhprdB9DTh0NNboPoatldTx34xf8iRqH/XNv5Gv5t/Fv8AyNl7/wBdW/nX9JHxi/5EjUP+ubfyNfzb+Lf+Rsvf+urfzr4nO9on9HeHnwz+RSg/1Y+tB60Qf6sfWg9a+Bluf0T0Raj+8KlH3qij+8KlH3qg2iWU6irR+6Kqp1FWj90Vkzvpk0f3RVqH7zVVj+6KtQ/eas3sdVPcaeo+tfs3+xf/AMiYPq38xX4yHqPrX7N/sX/8iYPq38xX1mRfxT8e8SP+Ra/VH3R/APrVpetVf4B9atL1r9Re5/FHcdRRRQIKhk61NUMnWplsBz+vf8gq5/3TX4GfHn/koV59f6mv3z17/kFXP+6a/Az48/8AJQrz6/1NfI8R/wAKJ/Q/hl/vUzySGo5OtSQ1HJ1r8wqH9ffYIj1FLL92kPUUsv3ahGEtiuelQj71THpUHQ1scctx7/dqD+E1IzZWmfw1otiZblN/9Yv1Ffaf7Fv/ACPEn0/rXxa4+ZT719ofsXHb45ce39a+kyv+Ij834u/5Fsz9u7X/AI9l+gq0OlVbX/j2X6CrQ6V+rdD+HZbsctOpq06pMQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//0v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAPSou1SnpUXajqNCDoaa3QfQ04dDTW6D6GrZXU8d+MX/Ikah/1zb+Rr+bfxb/AMjZe/8AXVv51/SR8Yv+RI1D/rm38jX82/i3/kbL3/rq386+JzvaJ/R3h58M/kUoP9WPrQetEH+rH1oPWvgZbn9E9EWo/vCpR96oo/vCpR96oNollOoq0fuiqqdRVo/dFZM76ZNH90Vah+81VY/uirUP3mrN7HVT3GnqPrX7N/sX/wDImD6t/MV+Mh6j61+zf7F//ImD6t/MV9ZkX8U/HvEj/kWv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2t6UmytSJIYlOQBQ8SOMYqXa3pQFOaE7bD5mVFtkU561OUVsZHSp8GjBptt7icm9xnkxZzgCneVD6ClwaMGi5LYeVF6fpSeTF6U7DUmDSuBFhP7ophjjP8Iqxg0YNZqEexSbRCkaL2FScYx0pNrelG1vSrE23uWEGFAp1Iv3RS0CCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP//R/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACkxzmlooAKKKKACiiigBD0plPIyKbg0DVuocUmBnNLg0u2gTSGBeeuc08Io6CjbTqBWEIyKWiigYUUUUAFJgUtFACYFGBS0UAFIRmlooAbtp2MUUUAFFFFABRRRQAUUUUAFIRmlooAbtpQMUtFABRRRQAUdaKKAG7aNtOooAKKKKAEwKMClooAbto206igAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9L9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAQnFJupSR3oyKAE3GnUgx2oJxQAucUmRTSN1IE9aAH59KQluwppz/BQN/egBwLdxS5PpTTu7Unz0APz60m4Ug3dxmlz/ALNAAGBpcimFvQUm8/3aAJMilqIs392kDOP4KAJcn0o3CoizN8pXrQEx2P50ASnpSYHrTCBjpTAD3WgViXHGaTcnrSZ46U0B+5oCw/ctL5i+tIPqKXB9RQMPMX1o8xfWkwfUUmG/vCgB3mL60eYvrTcN/eFGG/vCgB3mL60biegyKbhv7wpN2ON1AD8t6UZb0pN49aN49aAFy3pRlvSk3j1phOf4qAJMt6UbwPvcVHkf3qcvPQ5oAd5i+tHmL60YPqKT8RQAvmL60eYvrR+Io/EUAHmL60oYHpTcH1FNbK9WoAlyKWoAc9GFPUMPvNmgCSkJ445ppA+tNCjqAaAJMn0oJ445NM/A0ADPQ0AG5u4xS7sDJoKr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";
  function safeToday(){ return (typeof today==='function') ? today() : new Date().toISOString().slice(0,10); }
  function safeId(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function saveDB(){ if(typeof save==='function') save(); }
  function num(n){ return Number(n||0); }
  function fmt(n){ return num(n).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function safe(s){ return (s===undefined||s===null||s==='')?'-':String(s); }
  function logoFix(){
    document.querySelectorAll('img[src="assets/jms-logo.svg"]').forEach(img=>{img.src='assets/jeddah-model-logo.jpeg';img.classList.add('jms-real-brand')});
    document.querySelectorAll('.login-logo,.brand img').forEach(img=>img.classList.add('jms-real-brand'));
  }
  document.addEventListener('DOMContentLoaded',logoFix); setTimeout(logoFix,200);
  db.quotes ||= [];
  db.visitReports ||= [];

  window.daysFrom = function(date){
    if(!date) return null;
    const d=new Date(String(date).slice(0,10)+'T00:00:00');
    if(isNaN(d.getTime())) return null;
    return Math.floor((new Date(safeToday()+'T00:00:00')-d)/86400000);
  };
  window.customerState = function(c){
    const d=daysFrom(lastVisit(c.id));
    if(d===null) return ['لم تتم زيارته','never-visited'];
    if(d===0) return ['تمت زيارته اليوم','ok'];
    if(d>=30) return ['متأخر '+d+' يوم','late'];
    if(d>=15) return ['قريب '+d+' يوم','warn'];
    return ['منتظم منذ '+d+' يوم','ok'];
  };
  window.roleText = function(r){return r==='admin'?'مدير النظام':r==='sales'?'مدير المبيعات':'مندوب مبيعات'};
  window.ensureQuotes = function(){db.quotes ||= [];saveDB();};
  window.quoteStatusText = function(s){return s==='pending'?'بانتظار اعتماد المدير':s==='approved'?'معتمد':s==='sent'?'مرسل للعميل':s==='accepted'?'مقبول من العميل':s==='cancelled'?'ملغي - العميل لم يوافق':s==='rejected'?'مرفوض من المدير':'-'};
  window.allowedQuotes = function(){ensureQuotes();return currentUser && currentUser.role==='rep'?db.quotes.filter(q=>q.rep_id===currentUser.id):db.quotes;};
  function customerObj(id){return (db.customers||[]).find(c=>c.id===id)||{};}
  function quoteNo(){return 'Q-'+String((db.quotes||[]).length+1).padStart(5,'0');}

  window.showApp = function(){
    loginView.classList.add('hidden'); appView.classList.remove('hidden'); logoFix();
    currentUserName.textContent=currentUser.name; currentUserRole.textContent=roleText(currentUser.role);
    const repAllowed=['customers','visits','orders','quotes','routes','profile'];
    document.querySelectorAll('.nav').forEach(btn=>{
      const page=btn.dataset.page;
      if(currentUser.role==='rep'&&!repAllowed.includes(page)) btn.style.display='none';
      else if(btn.classList.contains('admin-only')&&currentUser.role!=='admin') btn.style.display='none';
      else if(btn.classList.contains('manager-only')&&!['admin','sales'].includes(currentUser.role)) btn.style.display='none';
      else btn.style.display='block';
    });
    if(currentUser.role==='rep'){
      document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
      const first=document.querySelector('.nav[data-page="customers"]'); const page=document.getElementById('customers');
      if(first) first.classList.add('active'); if(page) page.classList.add('active');
    }
    if(window.orderDate) orderDate.value=safeToday(); renderAll();
  };

  window.renderStats = function(){
    const sales=monthOrders().reduce((s,o)=>s+Number(o.amount_value||0),0);
    const coll=monthCollections().reduce((s,c)=>s+Number(c.amount||0),0);
    if(window.mSales)mSales.textContent=money(sales); if(window.mCollected)mCollected.textContent=money(coll); if(window.collectionRate)collectionRate.textContent=sales?Math.round(coll/sales*100)+'%':'0%';
    const late=allowedCustomers().filter(c=>{const d=daysFrom(lastVisit(c.id));return d!==null&&d>=30}).length;
    if(window.lateCount)lateCount.textContent=late; if(window.customersCount)customersCount.textContent=allowedCustomers().length; if(window.ordersCount)ordersCount.textContent=monthOrders().length;
    if(window.topReps)topReps.innerHTML=db.reps.map(r=>({r,visits:db.visits.filter(v=>v.rep_id===r.id).length,orders:db.orders.filter(o=>o.rep_id===r.id).length})).sort((a,b)=>(b.visits+b.orders)-(a.visits+a.orders)).map(x=>`<div class="route-item"><b>${x.r.name}</b><br>زيارات: ${x.visits} · طلبات: ${x.orders}</div>`).join('')||'لا يوجد بيانات';
    if(window.dashAlerts)dashAlerts.innerHTML=allowedCustomers().filter(c=>{const d=daysFrom(lastVisit(c.id));return d===null||d>=30}).slice(0,6).map(c=>{const d=daysFrom(lastVisit(c.id));return `<div class="alert-card">${c.name} — ${d===null?'لم تتم زيارته':('لم تتم زيارته منذ '+d+' يوم')}</div>`}).join('')||'لا توجد تنبيهات';
  };

  window.renderAlerts = function(){
    if(!window.alertsList)return;
    const list=allowedCustomers().filter(c=>{const d=daysFrom(lastVisit(c.id));return d===null||d>=30});
    alertsList.innerHTML=list.map(c=>{const d=daysFrom(lastVisit(c.id));return `<div class="alert-card"><b>${c.name}</b><br>المندوب: ${repName(c.rep_id)} — ${d===null?'لم تتم زيارته من قبل':('لم تتم زيارته منذ '+d+' يوم')}<div class="row-actions"><button onclick="appointment('${c.id}')">تحديد موعد</button><button onclick="newOrder('${c.id}')">طلب جديد</button></div></div>`}).join('')||'<div class="panel">لا توجد تنبيهات</div>';
  };

  window.renderQuoteCustomerSearch=function(){
    if(!window.mqCustomerSearchResults||!window.mqCustomerSearch)return;
    const q=(mqCustomerSearch.value||'').trim();
    const list=allowedCustomers().filter(c=>!q||`${c.name||''} ${c.phone||''} ${c.city||''} ${c.district||''}`.includes(q)).slice(0,80);
    mqCustomerSearchResults.innerHTML=list.map(c=>`<button type="button" onclick="selectQuoteCustomer('${c.id}')">${c.name}<small>${c.phone||'-'} · ${c.city||'-'} · ${repName(c.rep_id)}</small></button>`).join('')||'<button type="button" disabled>لا يوجد عميل بهذا الاسم</button>';
    mqCustomerSearchResults.classList.add('active');
  };
  window.selectQuoteCustomer=function(cid){
    const c=db.customers.find(x=>x.id===cid); if(!c)return;
    mqCustomer.value=cid; mqCustomerSearch.value=c.name; selectedQuoteCustomer.textContent='تم اختيار العميل: '+c.name; selectedQuoteCustomer.classList.add('active'); mqCustomerSearchResults.classList.remove('active'); if(window.mqRep&&c.rep_id)mqRep.value=c.rep_id;
  };
  window.toggleQuoteCustomerMode=function(){
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    existingCustomerBox.classList.toggle('hidden',mode!=='existing'); newCustomerBox.classList.toggle('hidden',mode!=='new');
  };
  window.calcQuoteForm=function(){
    if(!window.mqTotal)return; let w=num(mqWidth.value),l=num(mqLength.value),t=num(mqThickness.value);
    if(mqSizeUnit.value==='cm'){w/=100;l/=100}else if(mqSizeUnit.value==='mm'){w/=1000;l/=1000} if(mqThicknessUnit.value==='mm')t*=1000;
    const den=(typeof DENSITY!=='undefined'?(DENSITY[mqMaterial.value]||.93):.93); const gram=w*l*t*den;
    mqPiece.value=gram?gram.toFixed(2)+' جرام':''; const kg=num(mqKg.value); mqPieces.value=gram?Math.floor(kg/(gram/1000)).toLocaleString('ar-SA')+' حبة':''; mqTotal.value=(kg*num(mqPriceKg.value))?(kg*num(mqPriceKg.value)).toFixed(2):'';
  };
  window.openQuoteForm=function(){
    ensureQuotes(); const cs=allowedCustomers(); const reps=currentUser.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps; const defaultRep=currentUser.role==='rep'?currentUser.id:(reps[0]?.id||'');
    modalBody.innerHTML=`<h2>إنشاء عرض سعر</h2><div class="quote-customer-mode"><label><input type="radio" name="quoteCustomerMode" value="existing" checked onchange="toggleQuoteCustomerMode()"><span>اختيار عميل موجود</span></label><label><input type="radio" name="quoteCustomerMode" value="new" onchange="toggleQuoteCustomerMode()"><span>إضافة عميل جديد</span></label></div>
    <div id="existingCustomerBox" class="form-grid two"><label>بحث باسم العميل<div class="customer-search-picker"><input id="mqCustomerSearch" placeholder="اكتب اسم العميل أو جزء منه..." autocomplete="off" oninput="renderQuoteCustomerSearch()" onfocus="renderQuoteCustomerSearch()"><div id="mqCustomerSearchResults" class="customer-search-results"></div><div id="selectedQuoteCustomer" class="selected-customer-pill"></div></div><input id="mqCustomer" type="hidden" value=""></label><label>المندوب<select id="mqRep">${reps.map(r=>`<option value="${r.id}" ${r.id===defaultRep?'selected':''}>${r.name}</option>`).join('')}</select></label></div>
    <div id="newCustomerBox" class="form-grid two hidden"><label>اسم العميل الجديد<input id="mqNewCustomerName" placeholder="اسم العميل"></label><label>جوال العميل<input id="mqNewCustomerPhone" placeholder="05xxxxxxxx"></label><label>المدينة<input id="mqNewCustomerCity" value="جدة"></label><label>الحي / الموقع<input id="mqNewCustomerLocation" placeholder="الحي أو رابط الموقع"></label></div>
    <div class="form-grid two"><label>تاريخ العرض<input id="mqDate" type="date" value="${safeToday()}"></label><label>صلاحية العرض<input id="mqValid" type="date"></label></div><div class="form-grid four"><label>المنتج<select id="mqProduct"><option>أكياس رول</option><option>أكياس شيت</option><option>أكياس تي شيرت</option><option>شرنك</option><option>فيلم</option><option>أكياس نفايات</option></select></label><label>الخامة<select id="mqMaterial"><option value="HDPE">HDPE</option><option value="LDPE">LDPE</option><option value="LLDPE">LLDPE</option><option value="PP">PP</option><option value="MIX">خلطة</option></select></label><label>اللون<input id="mqColor" placeholder="شفاف / أبيض / حسب الطلب"></label><label>الطباعة<select id="mqPrint"><option>بدون طباعة</option><option>وجه واحد</option><option>وجهين</option></select></label></div>
    <div class="form-grid four"><label>العرض<input id="mqWidth" type="number" step="0.01" placeholder="65"></label><label>الطول<input id="mqLength" type="number" step="0.01" placeholder="95"></label><label>وحدة المقاس<select id="mqSizeUnit"><option value="cm">سم</option><option value="mm">مم</option></select></label><label>السماكة<input id="mqThickness" type="number" step="0.01" placeholder="75"></label></div><div class="form-grid four"><label>وحدة السماكة<select id="mqThicknessUnit"><option value="micron">ميكرون</option><option value="mm">مم</option></select></label><label>كمية الطلب بالكيلو<input id="mqKg" type="number" step="0.01" placeholder="1000"></label><label>سعر الكيلو<input id="mqPriceKg" type="number" step="0.01"></label><label>الإجمالي<input id="mqTotal" readonly></label></div><div class="form-grid two"><label>شروط الدفع<input id="mqPayment" value="حسب الاتفاق"></label><label>مدة التسليم<input id="mqDelivery" value="حسب جدول الإنتاج"></label><label>وزن الحبة<input id="mqPiece" readonly></label><label>عدد الحبات<input id="mqPieces" readonly></label></div><label>ملاحظات<input id="mqNotes" placeholder="ملاحظات للمدير أو العميل"></label><br><button class="primary" type="button" onclick="saveQuote()">حفظ وإرساله للمدير للاعتماد</button>`;
    modal.classList.remove('hidden'); ['mqWidth','mqLength','mqThickness','mqSizeUnit','mqThicknessUnit','mqMaterial','mqKg','mqPriceKg'].forEach(x=>{const el=document.getElementById(x);if(el){el.addEventListener('input',calcQuoteForm);el.addEventListener('change',calcQuoteForm)}}); if(cs[0]){mqCustomer.value=cs[0].id;selectedQuoteCustomer.textContent='العميل الافتراضي: '+cs[0].name;selectedQuoteCustomer.classList.add('active')} calcQuoteForm();
  };
  window.saveQuote=function(){
    ensureQuotes(); const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing'; let customerId=''; let repId=(window.mqRep&&mqRep.value)?mqRep.value:currentUser.id;
    if(mode==='new'){const name=(mqNewCustomerName.value||'').trim(); if(!name)return alert('اكتب اسم العميل الجديد'); const c={id:safeId(),name,phone:mqNewCustomerPhone.value||'',city:mqNewCustomerCity.value||'جدة',district:'',location:mqNewCustomerLocation.value||'',category:'عميل',status:'active',rep_id:repId,debt_balance:0,credit_limit:0,notes:'تمت إضافته من عرض سعر'}; db.customers.unshift(c); customerId=c.id}else{customerId=mqCustomer.value;if(!customerId)return alert('اكتب اسم العميل واختره من نتائج البحث')}
    db.quotes.unshift({id:safeId(),quote_no:quoteNo(),status:'pending',customer_id:customerId,rep_id:repId,date:mqDate.value||safeToday(),valid_until:mqValid.value,product:mqProduct.value,material:mqMaterial.value,color:mqColor.value,print:mqPrint.value,width:mqWidth.value,length:mqLength.value,size_unit:mqSizeUnit.value,thickness:mqThickness.value,thickness_unit:mqThicknessUnit.value,total_kg:mqKg.value,price_kg:mqPriceKg.value,total_amount:mqTotal.value,piece_weight:mqPiece.value,pieces:mqPieces.value,payment_terms:mqPayment.value,delivery_terms:mqDelivery.value,notes:mqNotes.value,created_by:currentUser.name,created_at:new Date().toISOString()}); saveDB(); closeModal(); renderAll(); alert('تم حفظ العرض وإرساله للمدير للاعتماد');
  };
  window.renderQuotes=function(){
    if(!window.quotesList)return; ensureQuotes(); if(typeof renderQuoteFilters==='function')renderQuoteFilters(); const st=window.quoteStatusFilter?.value||'all',rep=window.quoteRepFilter?.value||'all',txt=(window.quoteSearch?.value||'').trim(); let list=allowedQuotes().filter(q=>{if(st!=='all'&&q.status!==st)return false;if(rep!=='all'&&q.rep_id!==rep)return false;const cname=customerName(q.customer_id);return !txt||String(q.quote_no).includes(txt)||cname.includes(txt)});
    if(window.quotesTotal){quotesTotal.textContent=allowedQuotes().length;quotesPending.textContent=allowedQuotes().filter(q=>q.status==='pending').length;quotesApproved.textContent=allowedQuotes().filter(q=>q.status==='approved'||q.status==='sent'||q.status==='accepted').length;quotesRejected.textContent=allowedQuotes().filter(q=>q.status==='rejected'||q.status==='cancelled').length}
    quotesList.innerHTML=list.map(q=>{const canApprove=['admin','sales'].includes(currentUser.role);const canSend=q.status==='approved'||q.status==='sent'||q.status==='accepted';const canCancel=q.status==='sent'||q.status==='approved';return `<div class="quote-card-pro"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3>عرض رقم ${q.quote_no}</h3><p>${customerName(q.customer_id)} · ${repName(q.rep_id)} · ${q.date||'-'}</p></div><span class="quote-status ${q.status}">${quoteStatusText(q.status)}</span></div><p>المنتج: ${safe(q.product)}<br>المقاس: ${safe(q.width)} × ${safe(q.length)} ${safe(q.size_unit)}<br>السماكة: ${safe(q.thickness)} ${safe(q.thickness_unit)} · الخامة: ${safe(q.material)}<br>الكمية: ${safe(q.total_kg)} كجم · سعر الكيلو: ${safe(q.price_kg)} ريال<br>${q.cancel_reason?'سبب الإلغاء: '+q.cancel_reason:''}</p><div class="quote-total-pro"><span>إجمالي العرض</span><b>${fmt(q.total_amount)} ريال</b></div><div class="quote-actions"><button onclick="viewQuote('${q.id}')">عرض</button>${canApprove&&q.status==='pending'?`<button class="approve" onclick="approveQuote('${q.id}')">اعتماد</button><button class="cancel" onclick="rejectQuote('${q.id}')">رفض</button>`:''}${canSend?`<button class="send" onclick="sendQuote('${q.id}')">إرسال للعميل</button>`:''}${q.status==='sent'?`<button class="approve" onclick="acceptQuote('${q.id}')">العميل وافق</button>`:''}${canCancel?`<button class="cancel" onclick="cancelQuote('${q.id}')">إلغاء - العميل لم يوافق</button>`:''}${q.status==='accepted'?`<button class="convert" onclick="convertQuoteToOrder('${q.id}')">تحويل لطلب</button>`:''}</div></div>`}).join('')||'<div class="panel">لا توجد عروض أسعار</div>';
  };
  window.approveQuote=function(qid){const q=db.quotes.find(x=>x.id===qid);if(!q)return;q.status='approved';q.approved_by=currentUser.name;q.approved_at=safeToday();saveDB();renderAll();alert('تم اعتماد عرض السعر')};
  window.rejectQuote=function(qid){const q=db.quotes.find(x=>x.id===qid);if(!q)return;const reason=prompt('سبب رفض المدير');if(!reason)return;q.status='rejected';q.reject_reason=reason;q.rejected_by=currentUser.name;q.rejected_at=safeToday();saveDB();renderAll()};
  window.acceptQuote=function(qid){const q=db.quotes.find(x=>x.id===qid);if(!q)return;q.status='accepted';q.accepted_at=safeToday();saveDB();renderAll();alert('تم تسجيل موافقة العميل')};
  window.cancelQuote=function(qid){const q=db.quotes.find(x=>x.id===qid);if(!q)return;const reason=prompt('سبب الإلغاء لأن العميل لم يوافق');if(!reason)return;q.status='cancelled';q.cancel_reason=reason;q.cancelled_by=currentUser.name;q.cancelled_at=safeToday();saveDB();renderAll();alert('تم إلغاء العرض وتسجيل السبب')};
  window.sendQuote=function(qid){const q=db.quotes.find(x=>x.id===qid);if(!q)return;if(!['approved','sent','accepted'].includes(q.status))return alert('لا يمكن الإرسال قبل اعتماد المدير');q.status='sent';q.sent_at=safeToday();saveDB();renderAll();const grand=num(q.total_amount)*1.15;const msg=`عرض سعر من شركة جدة النموذجية للصناعة%0Aرقم العرض: ${q.quote_no}%0Aالعميل: ${customerName(q.customer_id)}%0Aالمنتج: ${q.product}%0Aالمقاس: ${q.width} × ${q.length} ${q.size_unit}%0Aالسماكة: ${q.thickness} ${q.thickness_unit}%0Aالخامة: ${q.material}%0Aالكمية: ${q.total_kg} كجم%0Aالإجمالي شامل الضريبة: ${fmt(grand)} ريال`;window.open(`https://wa.me/?text=${encodeURI(msg)}`,'_blank')};
  window.downloadQuotePDF=function(){setTimeout(()=>window.print(),100)};
  window.viewQuote=function(qid){
    const q=db.quotes.find(x=>x.id===qid); if(!q)return; const c=customerObj(q.customer_id); const subtotal=num(q.total_amount); const vat=subtotal*.15; const grand=subtotal+vat;
    modalBody.innerHTML=`<div class="quote-print-shell"><div class="quote-toolbar"><button class="pdf" onclick="downloadQuotePDF()">حفظ PDF / طباعة</button>${['approved','sent','accepted'].includes(q.status)?`<button class="whatsapp" onclick="sendQuote('${q.id}')">إرسال واتساب</button>`:''}${q.status==='sent'?`<button onclick="acceptQuote('${q.id}')">العميل وافق</button><button onclick="cancelQuote('${q.id}')">إلغاء العرض</button>`:''}<button onclick="closeModal()">إغلاق</button></div><div class="quote-a4"><div class="quote-a4-head"><img class="quote-a4-logo" src="${JMS_LOGO_DATA}" alt="JMS"><div class="quote-a4-company"><h1>شركة جدة النموذجية للصناعة</h1><p>Jeddah Model Industrial Co. Ltd</p><p>عروض أسعار المنتجات البلاستيكية والتغليف</p></div><div class="quote-a4-title"><h2>عرض سعر</h2><p>رقم العرض: ${safe(q.quote_no)}</p><p>تاريخ الإصدار: ${safe(q.date)}</p><p>صالح حتى: ${safe(q.valid_until)}</p></div></div><div class="quote-a4-grid"><div class="quote-a4-card"><h3>بيانات العميل</h3><p><b>اسم العميل:</b> ${customerName(q.customer_id)}<br><b>الجوال:</b> ${safe(c.phone)}<br><b>المدينة:</b> ${safe(c.city)}<br><b>العنوان:</b> ${safe(c.location||c.district)}</p></div><div class="quote-a4-card"><h3>بيانات العرض</h3><p><b>المندوب:</b> ${repName(q.rep_id)}<br><b>الحالة:</b> ${quoteStatusText(q.status)}<br><b>شروط الدفع:</b> ${safe(q.payment_terms)}<br><b>مدة التسليم:</b> ${safe(q.delivery_terms)}</p></div></div><table class="quote-a4-table"><thead><tr><th>المنتج</th><th>المقاس</th><th>السماكة</th><th>اللون</th><th>الخامة</th><th>وزن الحبة</th><th>عدد الحبات</th><th>الكمية كجم</th><th>سعر الكيلو</th><th>الإجمالي</th></tr></thead><tbody><tr><td>${safe(q.product)}</td><td>${safe(q.width)} × ${safe(q.length)} ${safe(q.size_unit)}</td><td>${safe(q.thickness)} ${safe(q.thickness_unit)}</td><td>${safe(q.color)}</td><td>${safe(q.material)}</td><td>${safe(q.piece_weight)}</td><td>${safe(q.pieces)}</td><td>${safe(q.total_kg)}</td><td>${safe(q.price_kg)} ريال</td><td>${fmt(subtotal)} ريال</td></tr></tbody></table><div class="quote-a4-summary"><div class="quote-a4-terms"><h3>الشروط والملاحظات</h3><ul><li>الأسعار حسب المواصفات الموضحة في هذا العرض.</li><li>صلاحية العرض حتى التاريخ الموضح أعلاه.</li><li>التسليم حسب جدول الإنتاج بعد اعتماد الطلب.</li><li>أي تعديل في المقاس أو الخامة أو الطباعة قد يغير السعر.</li><li>${q.notes||'لا توجد ملاحظات إضافية.'}</li></ul></div><div class="quote-a4-total"><div class="quote-a4-total-row"><span>الإجمالي قبل الضريبة</span><b>${fmt(subtotal)} ريال</b></div><div class="quote-a4-total-row"><span>ضريبة القيمة المضافة 15%</span><b>${fmt(vat)} ريال</b></div><div class="quote-a4-total-row final"><span>الإجمالي النهائي</span><b>${fmt(grand)} ريال</b></div></div></div><div class="quote-a4-approval"><div class="quote-a4-sign"><b>توقيع العميل</b><div class="quote-a4-line">الاسم والتوقيع</div></div><div class="quote-a4-sign"><b>اعتماد المندوب</b><div class="quote-a4-line">${repName(q.rep_id)}</div></div><div class="quote-a4-sign"><b>اعتماد مدير المبيعات</b><div class="quote-a4-line">التوقيع</div></div><div class="quote-a4-sign"><b>ختم الشركة</b><div class="quote-a4-line">الختم</div></div></div><div class="quote-a4-footer"><span>شركة جدة النموذجية للصناعة</span><span>رقم العرض: ${safe(q.quote_no)}</span><span>العرض لا يعتبر طلبًا نهائيًا إلا بعد الاعتماد.</span></div></div></div>`; modal.classList.remove('hidden');
  };
})();



/* JMS cloud sync patch: makes quotes visible on laptop and mobile */
(function(){
  const tableMap = {
    customers: "jms_customers",
    quotes: "jms_quotes",
    visits: "jms_visits",
    orders: "jms_orders",
    collections: "jms_collections"
  };

  let cloudClient = null;
  let cloudReady = false;
  let syncBusy = false;

  function showCloudStatus(kind, text){
    let el = document.getElementById("cloudSyncStatus");
    if(!el){
      el = document.createElement("div");
      el.id = "cloudSyncStatus";
      document.body.appendChild(el);
    }
    el.className = "cloud-sync-status " + kind;
    el.textContent = text;
  }

  function configReady(){
    return window.JMS_CLOUD &&
      window.JMS_CLOUD.ENABLED === true &&
      window.JMS_CLOUD.SUPABASE_URL &&
      window.JMS_CLOUD.SUPABASE_ANON_KEY &&
      !String(window.JMS_CLOUD.SUPABASE_URL).includes("PUT_");
  }

  window.jmsCloudEnabled = function(){
    return cloudReady && cloudClient;
  };

  window.initJmsCloud = async function(){
    if(!configReady()){
      showCloudStatus("local", "محلي فقط - لا توجد مزامنة");
      return false;
    }
    try{
      cloudClient = supabase.createClient(window.JMS_CLOUD.SUPABASE_URL, window.JMS_CLOUD.SUPABASE_ANON_KEY);
      cloudReady = true;
      showCloudStatus("cloud", "مزامنة سحابية مفعلة");
      await pullCloudData();
      await pushCloudData();
      return true;
    }catch(e){
      console.error(e);
      showCloudStatus("error", "خطأ في المزامنة");
      return false;
    }
  };

  function getDb(){
    // app.js uses a top-level `let db`, not `window.db`.
    // Because this patch is in the same file, we can read it directly.
    return db || {};
  }

  function setDb(next){
    db = Object.assign(db || {}, next || {});
    try{
      localStorage.setItem(STORE, JSON.stringify(db));
    }catch(e){}
  }

  async function pullList(key){
    const table = tableMap[key];
    if(!table || !cloudClient) return [];
    const {data, error} = await cloudClient.from(table).select("id,data,updated_at").order("updated_at", {ascending:false});
    if(error) throw error;
    return (data || []).map(r => ({...r.data, id: r.data.id || r.id, _cloud_updated_at: r.updated_at}));
  }

  window.pullCloudData = async function(){
    if(!cloudReady || syncBusy) return;
    syncBusy = true;
    try{
      const current = getDb();
      const next = {...current};
      for(const key of Object.keys(tableMap)){
        const list = await pullList(key);
        if(list.length){
          const localList = Array.isArray(current[key]) ? current[key] : [];
          const merged = new Map();
          localList.forEach(x => merged.set(String(x.id), x));
          list.forEach(x => merged.set(String(x.id), x));
          next[key] = Array.from(merged.values());
        }
      }
      setDb(next);
      if(typeof save === "function") save();
      if(typeof renderAll === "function") renderAll();
      showCloudStatus("cloud", "تمت المزامنة");
    }catch(e){
      console.error(e);
      showCloudStatus("error", "فشل جلب البيانات");
    }finally{
      syncBusy = false;
    }
  };

  async function upsertList(key){
    const table = tableMap[key];
    if(!table || !cloudClient) return;
    const db = getDb();
    const list = Array.isArray(db[key]) ? db[key] : [];
    if(!list.length) return;
    const rows = list.filter(x => x && x.id).map(x => ({
      id: String(x.id),
      data: x,
      updated_at: new Date().toISOString()
    }));
    if(!rows.length) return;
    const {error} = await cloudClient.from(table).upsert(rows, {onConflict:"id"});
    if(error) throw error;
  }

  window.pushCloudData = async function(){
    if(!cloudReady || syncBusy) return;
    syncBusy = true;
    try{
      for(const key of Object.keys(tableMap)){
        await upsertList(key);
      }
      showCloudStatus("cloud", "تم حفظ البيانات سحابيًا");
    }catch(e){
      console.error(e);
      showCloudStatus("error", "فشل حفظ البيانات");
    }finally{
      syncBusy = false;
    }
  };

  // Expose the real save function for debugging. The actual save() above now pushes to Supabase.
  window.save = save;

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll === "function") oldRenderAll.apply(this, arguments);
  };

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => initJmsCloud(), 500);
    setInterval(() => { if(cloudReady) pullCloudData(); }, 30000);
  });
})();



/* JMS V2 final fixes: customer search, auto calculators, quote/order polish */
(function(){
  const ROOT = window;

  function ensureDbShape(){
    db.customers ||= [];
    db.orders ||= [];
    db.quotes ||= [];
    db.visits ||= [];
    db.collections ||= [];
    db.reps ||= [];
    db.users ||= [];
  }

  function localId(){
    return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
  }

  function den(material){
    const key = String(material || '').toUpperCase();
    if(key.includes('HD')) return 0.95;
    if(key.includes('LD') && !key.includes('LLD')) return 0.92;
    if(key.includes('LLD')) return 0.92;
    if(key.includes('PP')) return 0.90;
    return 0.93;
  }

  function toMeter(value, unit){
    const n = Number(value || 0);
    return unit === 'mm' ? n / 1000 : n / 100;
  }

  function thicknessMicron(value, unit){
    const n = Number(value || 0);
    return unit === 'mm' ? n * 1000 : n;
  }

  function calcPiece(width, length, sizeUnit, thickness, thicknessUnit, material){
    const w = toMeter(width, sizeUnit || 'cm');
    const l = toMeter(length, sizeUnit || 'cm');
    const t = thicknessMicron(thickness, thicknessUnit || 'micron');
    const gram = w * l * t * den(material);
    return gram > 0 ? gram : 0;
  }

  function formatNum(n, decimals=2){
    const x = Number(n || 0);
    return x ? x.toLocaleString('ar-SA', {maximumFractionDigits:decimals, minimumFractionDigits:decimals}) : '';
  }

  function customerDisplay(c){
    return `${c.name || '-'}${c.phone ? ' · '+c.phone : ''}${c.city ? ' · '+c.city : ''}`;
  }

  function safeCustomers(){
    ensureDbShape();
    return (typeof allowedCustomers === 'function') ? allowedCustomers() : db.customers;
  }

  function renderSearchResults(inputId, resultsId, hiddenId, pillId, repSelectId){
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if(!input || !results) return;
    const q = (input.value || '').trim();
    const list = safeCustomers().filter(c=>{
      const text = `${c.name||''} ${c.phone||''} ${c.city||''} ${c.district||''} ${c.location||''}`;
      return !q || text.includes(q);
    }).slice(0,80);

    results.innerHTML = list.map(c=>`
      <button type="button" onclick="jmsPickCustomer('${c.id}','${inputId}','${resultsId}','${hiddenId}','${pillId}','${repSelectId||''}')">
        ${c.name || '-'}
        <small>${c.phone || '-'} · ${c.city || '-'} · ${typeof repName==='function'?repName(c.rep_id):'-'}</small>
      </button>
    `).join('') || `<button type="button" disabled>لا يوجد عميل بهذا البحث</button>`;
    results.classList.add('active');
  }

  window.jmsPickCustomer = function(customerId,inputId,resultsId,hiddenId,pillId,repSelectId){
    const c = db.customers.find(x=>x.id===customerId);
    if(!c) return;
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    const hidden = document.getElementById(hiddenId);
    const pill = document.getElementById(pillId);
    if(input) input.value = c.name;
    if(hidden) hidden.value = c.id;
    if(pill){ pill.textContent = 'تم اختيار العميل: ' + c.name; pill.classList.add('jms-selected-pill'); }
    if(results) results.classList.remove('active');
    if(repSelectId){
      const rep = document.getElementById(repSelectId);
      if(rep && c.rep_id) rep.value = c.rep_id;
    }
  };

  window.jmsSearchCustomers = renderSearchResults;

  function searchCustomerHtml(prefix, defaultCustomerId='', repSelectId=''){
    const c = defaultCustomerId ? db.customers.find(x=>x.id===defaultCustomerId) : null;
    return `
      <div class="jms-search-box">
        <input id="${prefix}CustomerSearch" autocomplete="off" placeholder="اكتب اسم العميل أو الجوال أو المدينة..." value="${c ? c.name : ''}"
          oninput="jmsSearchCustomers('${prefix}CustomerSearch','${prefix}CustomerResults','${prefix}Customer','${prefix}CustomerPill','${repSelectId}')"
          onfocus="jmsSearchCustomers('${prefix}CustomerSearch','${prefix}CustomerResults','${prefix}Customer','${prefix}CustomerPill','${repSelectId}')">
        <div id="${prefix}CustomerResults" class="jms-search-results"></div>
        <input type="hidden" id="${prefix}Customer" value="${c ? c.id : ''}">
        <div id="${prefix}CustomerPill" class="${c ? 'jms-selected-pill' : ''}">${c ? 'تم اختيار العميل: '+c.name : ''}</div>
      </div>
    `;
  }

  function repOptions(selected=''){
    const reps = currentUser && currentUser.role === 'rep' ? db.reps.filter(r=>r.id===currentUser.id) : db.reps;
    return reps.map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${r.name}</option>`).join('');
  }

  function attachAutoCalc(ids, fn){
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el){
        el.addEventListener('input', fn);
        el.addEventListener('change', fn);
      }
    });
    setTimeout(fn, 50);
  }

  window.jmsCalcQuote = function(){
    if(!window.mqPiece && !document.getElementById('mqPiece')) return;
    const width = document.getElementById('mqWidth')?.value;
    const length = document.getElementById('mqLength')?.value;
    const sizeUnit = document.getElementById('mqSizeUnit')?.value || 'cm';
    const thickness = document.getElementById('mqThickness')?.value;
    const thicknessUnit = document.getElementById('mqThicknessUnit')?.value || 'micron';
    const material = document.getElementById('mqMaterial')?.value || 'HDPE';
    const kg = Number(document.getElementById('mqKg')?.value || 0);
    const price = Number(document.getElementById('mqPriceKg')?.value || 0);
    const gram = calcPiece(width,length,sizeUnit,thickness,thicknessUnit,material);
    const piece = document.getElementById('mqPiece');
    const pieces = document.getElementById('mqPieces');
    const total = document.getElementById('mqTotal');
    const density = document.getElementById('mqDensity');
    if(density) density.value = den(material);
    if(piece) piece.value = gram ? gram.toFixed(2) + ' جرام' : '';
    if(pieces) pieces.value = gram && kg ? Math.floor(kg/(gram/1000)).toLocaleString('ar-SA') + ' حبة' : '';
    if(total) total.value = kg && price ? (kg*price).toFixed(2) : '';
  };

  window.jmsCalcOrder = function(){
    const width = document.getElementById('oWidth')?.value || document.getElementById('width')?.value;
    const length = document.getElementById('oLength')?.value || document.getElementById('length')?.value;
    const sizeUnit = document.getElementById('oSizeUnit')?.value || document.getElementById('sizeUnit')?.value || 'cm';
    const thickness = document.getElementById('oThickness')?.value || document.getElementById('thickness')?.value;
    const thicknessUnit = document.getElementById('oThicknessUnit')?.value || document.getElementById('thicknessUnit')?.value || 'micron';
    const material = document.getElementById('oMaterial')?.value || document.getElementById('material')?.value || 'HDPE';
    const kg = Number(document.getElementById('oKg')?.value || document.getElementById('totalKg')?.value || 0);
    const price = Number(document.getElementById('oPriceKg')?.value || document.getElementById('priceKg')?.value || 0);
    const gram = calcPiece(width,length,sizeUnit,thickness,thicknessUnit,material);

    const piece = document.getElementById('oPiece') || document.getElementById('pieceWeight');
    const pieces = document.getElementById('oPieces') || document.getElementById('piecesCount');
    const total = document.getElementById('oTotal') || document.getElementById('orderAmount');
    const density = document.getElementById('oDensity') || document.getElementById('density');
    if(density) density.value = den(material);
    if(piece) piece.value = gram ? gram.toFixed(2) + ' جرام' : '';
    if(pieces) pieces.value = gram && kg ? Math.floor(kg/(gram/1000)).toLocaleString('ar-SA') + ' حبة' : '';
    if(total) total.value = kg && price ? (kg*price).toFixed(2) + ' ريال' : '';
  };

  // Override quotation form with search + auto calculation + customer creation.
  window.openQuoteForm = function(defaultCustomerId=''){
    ensureDbShape();
    db.quotes ||= [];
    const defaultRep = currentUser && currentUser.role === 'rep' ? currentUser.id : (db.reps[0]?.id || '');
    modalBody.innerHTML = `<h2>إنشاء عرض سعر</h2>
      <div class="quote-customer-mode">
        <label><input type="radio" name="quoteCustomerMode" value="existing" checked onchange="toggleQuoteCustomerMode()"><span>اختيار عميل موجود</span></label>
        <label><input type="radio" name="quoteCustomerMode" value="new" onchange="toggleQuoteCustomerMode()"><span>إضافة عميل جديد</span></label>
      </div>

      <div id="existingCustomerBox" class="form-grid two">
        <label>بحث عن العميل ${searchCustomerHtml('mq', defaultCustomerId, 'mqRep')}</label>
        <label>المندوب<select id="mqRep">${repOptions(defaultRep)}</select></label>
      </div>

      <div id="newCustomerBox" class="form-grid two hidden">
        <label>اسم العميل الجديد<input id="mqNewCustomerName" placeholder="اسم العميل"></label>
        <label>جوال العميل<input id="mqNewCustomerPhone" placeholder="05xxxxxxxx"></label>
        <label>المدينة<input id="mqNewCustomerCity" value="جدة"></label>
        <label>الحي / الموقع<input id="mqNewCustomerLocation" placeholder="الحي أو رابط الموقع"></label>
      </div>

      <div class="form-grid two">
        <label>تاريخ العرض<input id="mqDate" type="date" value="${typeof today==='function'?today():new Date().toISOString().slice(0,10)}"></label>
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
        <label>الطول<input id="mqLength" type="number" step="0.01" placeholder="90"></label>
        <label>وحدة المقاس<select id="mqSizeUnit"><option value="cm">سم</option><option value="mm">مم</option></select></label>
        <label>السماكة<input id="mqThickness" type="number" step="0.01" placeholder="75"></label>
      </div>

      <div class="form-grid four">
        <label>وحدة السماكة<select id="mqThicknessUnit"><option value="micron">ميكرون</option><option value="mm">مم</option></select></label>
        <label>كمية الطلب بالكيلو<input id="mqKg" type="number" step="0.01" placeholder="2000"></label>
        <label>سعر الكيلو<input id="mqPriceKg" type="number" step="0.01"></label>
        <label>كثافة الخامة<input id="mqDensity" class="jms-calc-output" readonly></label>
      </div>

      <div class="form-grid three">
        <label>وزن الحبة<input id="mqPiece" class="jms-calc-output" readonly></label>
        <label>عدد الحبات<input id="mqPieces" class="jms-calc-output" readonly></label>
        <label>الإجمالي<input id="mqTotal" class="jms-calc-output" readonly></label>
      </div>

      <div class="form-grid two">
        <label>شروط الدفع<input id="mqPayment" value="حسب الاتفاق"></label>
        <label>مدة التسليم<input id="mqDelivery" value="حسب جدول الإنتاج"></label>
      </div>
      <label>ملاحظات<input id="mqNotes" placeholder="ملاحظات للمدير أو العميل"></label>
      <div class="jms-pro-note">يتم حساب وزن الحبة وعدد الحبات تلقائيًا بمجرد إدخال المقاسات والسماكة والكمية.</div>
      <br><button class="primary" type="button" onclick="saveQuote()">حفظ وإرساله للمدير للاعتماد</button>`;
    modal.classList.remove('hidden');
    attachAutoCalc(['mqWidth','mqLength','mqSizeUnit','mqThickness','mqThicknessUnit','mqMaterial','mqKg','mqPriceKg'], window.jmsCalcQuote);
  };

  window.toggleQuoteCustomerMode = function(){
    const mode = document.querySelector('input[name="quoteCustomerMode"]:checked')?.value || 'existing';
    const existing = document.getElementById('existingCustomerBox');
    const newer = document.getElementById('newCustomerBox');
    if(existing) existing.classList.toggle('hidden', mode !== 'existing');
    if(newer) newer.classList.toggle('hidden', mode !== 'new');
  };

  window.saveQuote = function(){
    ensureDbShape();
    db.quotes ||= [];
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    let customerId='';
    let repId=document.getElementById('mqRep')?.value || (currentUser?.id || '');
    if(mode==='new'){
      const name=(document.getElementById('mqNewCustomerName')?.value||'').trim();
      if(!name) return alert('اكتب اسم العميل الجديد');
      const newCustomer={id:localId(),name,phone:mqNewCustomerPhone.value||'',city:mqNewCustomerCity.value||'جدة',district:'',location:mqNewCustomerLocation.value||'',category:'عميل',status:'active',rep_id:repId,debt_balance:0,credit_limit:0,notes:'تمت إضافته من عرض سعر'};
      db.customers.unshift(newCustomer);
      customerId=newCustomer.id;
    }else{
      customerId=document.getElementById('mqCustomer')?.value;
      if(!customerId) return alert('اكتب اسم العميل واختره من نتائج البحث');
    }
    window.jmsCalcQuote();
    const no='Q-'+String((db.quotes||[]).length+1).padStart(5,'0');
    db.quotes.unshift({
      id:localId(),quote_no:no,status:'pending',customer_id:customerId,rep_id:repId,date:mqDate.value||today(),valid_until:mqValid.value,
      product:mqProduct.value,material:mqMaterial.value,color:mqColor.value,print:mqPrint.value,
      width:mqWidth.value,length:mqLength.value,size_unit:mqSizeUnit.value,thickness:mqThickness.value,thickness_unit:mqThicknessUnit.value,
      total_kg:mqKg.value,price_kg:mqPriceKg.value,total_amount:mqTotal.value,piece_weight:mqPiece.value,pieces:mqPieces.value,
      payment_terms:mqPayment.value,delivery_terms:mqDelivery.value,notes:mqNotes.value,created_by:currentUser?.name||'',created_at:new Date().toISOString()
    });
    if(typeof save==='function') save();
    closeModal(); renderAll(); alert('تم حفظ العرض وإرساله للمدير للاعتماد');
  };

  // Add customer cancellation flow after quote sent.
  window.quoteStatusText = function(s){
    return s==='pending'?'بانتظار اعتماد المدير':s==='approved'?'معتمد':s==='sent'?'مرسل للعميل':s==='accepted'?'مقبول من العميل':s==='cancelled'?'ملغي - العميل لم يوافق':s==='rejected'?'مرفوض':'-';
  };

  const oldQuoteCard = window.quoteCard;
  window.quoteCard = function(q){
    const canApprove=currentUser?.role==='admin'||currentUser?.role==='sales';
    const canSend=q.status==='approved'||q.status==='sent';
    const canConvert=q.status==='accepted'||q.status==='approved'||q.status==='sent';
    return `<div class="quote-card">
      <div class="quote-head"><div><h3>عرض رقم ${q.quote_no}</h3><p>${customerName(q.customer_id)} · ${repName(q.rep_id)} · ${q.date}</p></div><span class="quote-status ${q.status}">${quoteStatusText(q.status)}</span></div>
      <div class="quote-lines"><div><span>المنتج</span><b>${q.product||'-'}</b></div><div><span>المقاس</span><b>${q.width||'-'} × ${q.length||'-'} ${q.size_unit||''}</b></div><div><span>السماكة</span><b>${q.thickness||'-'} ${q.thickness_unit||''}</b></div><div><span>الخامة</span><b>${q.material||'-'}</b></div><div><span>الكمية</span><b>${q.total_kg||'-'} كجم</b></div><div><span>سعر الكيلو</span><b>${q.price_kg||'-'} ريال</b></div><div><span>وزن الحبة</span><b>${q.piece_weight||'-'}</b></div><div><span>عدد الحبات</span><b>${q.pieces||'-'}</b></div></div>
      <div class="quote-total"><span>إجمالي العرض</span><b>${q.total_amount||0} ريال</b></div>
      ${q.cancel_reason?`<div class="alert-card">سبب الإلغاء: ${q.cancel_reason}</div>`:''}
      ${q.reject_reason?`<div class="alert-card">سبب الرفض: ${q.reject_reason}</div>`:''}
      <div class="quote-actions">
        <button onclick="viewQuote('${q.id}')">عرض</button>
        ${canApprove && q.status==='pending'?`<button class="approve" onclick="approveQuote('${q.id}')">اعتماد</button><button class="reject" onclick="rejectQuote('${q.id}')">رفض</button>`:''}
        ${q.status==='approved'?`<button class="send" onclick="sendQuote('${q.id}')">إرسال للعميل</button>`:''}
        ${q.status==='sent'?`<button class="accept" onclick="acceptQuote('${q.id}')">العميل وافق</button><button class="cancel" onclick="cancelQuote('${q.id}')">إلغاء - العميل لم يوافق</button>`:''}
        ${canConvert && q.status!=='cancelled' && q.status!=='rejected'?`<button class="convert" onclick="convertQuoteToOrder('${q.id}')">تحويل لطلب</button>`:''}
      </div>
    </div>`;
  };

  window.acceptQuote = function(qid){
    const q = db.quotes.find(x=>x.id===qid);
    if(!q) return;
    q.status='accepted';
    q.accepted_at = new Date().toISOString();
    if(typeof save==='function') save();
    renderAll();
  };

  window.cancelQuote = function(qid){
    const q = db.quotes.find(x=>x.id===qid);
    if(!q) return;
    const reason = prompt('اكتب سبب إلغاء العرض لأن العميل لم يوافق');
    if(!reason) return;
    q.status='cancelled';
    q.cancel_reason=reason;
    q.cancelled_at = new Date().toISOString();
    if(typeof save==='function') save();
    renderAll();
  };

  // Override production/order form with customer search + same calculator.
  window.openOrderForm = function(defaultCustomerId=''){
    ensureDbShape();
    const defaultRep = currentUser && currentUser.role === 'rep' ? currentUser.id : (db.reps[0]?.id || '');
    modalBody.innerHTML = `<h2>طلب تصنيع جديد</h2>
      <div class="form-grid two">
        <label>بحث عن العميل ${searchCustomerHtml('o', defaultCustomerId, 'oRep')}</label>
        <label>المندوب<select id="oRep">${repOptions(defaultRep)}</select></label>
      </div>
      <div class="form-grid four">
        <label>المنتج<select id="oProduct"><option>أكياس رول</option><option>أكياس شيت</option><option>أكياس تي شيرت</option><option>شرنك</option><option>فيلم</option><option>أكياس نفايات</option></select></label>
        <label>الخامة<select id="oMaterial"><option value="HDPE">HDPE</option><option value="LDPE">LDPE</option><option value="LLDPE">LLDPE</option><option value="PP">PP</option><option value="MIX">خلطة</option></select></label>
        <label>اللون<input id="oColor" placeholder="شفاف / أبيض / أسود"></label>
        <label>حالة الطلب<select id="oStatus"><option>جديد</option><option>بانتظار اعتماد المدير</option><option>قيد الإنتاج</option><option>جاهز للتسليم</option><option>تم التسليم</option></select></label>
      </div>
      <div class="form-grid four">
        <label>العرض<input id="oWidth" type="number" step="0.01" placeholder="65"></label>
        <label>الطول<input id="oLength" type="number" step="0.01" placeholder="90"></label>
        <label>وحدة المقاس<select id="oSizeUnit"><option value="cm">سم</option><option value="mm">مم</option></select></label>
        <label>السماكة<input id="oThickness" type="number" step="0.01" placeholder="75"></label>
      </div>
      <div class="form-grid four">
        <label>وحدة السماكة<select id="oThicknessUnit"><option value="micron">ميكرون</option><option value="mm">مم</option></select></label>
        <label>كمية الطلب بالكيلو<input id="oKg" type="number" step="0.01" placeholder="2000"></label>
        <label>سعر الكيلو<input id="oPriceKg" type="number" step="0.01"></label>
        <label>كثافة الخامة<input id="oDensity" class="jms-calc-output" readonly></label>
      </div>
      <div class="form-grid three">
        <label>وزن الحبة<input id="oPiece" class="jms-calc-output" readonly></label>
        <label>عدد الحبات<input id="oPieces" class="jms-calc-output" readonly></label>
        <label>قيمة الطلب<input id="oTotal" class="jms-calc-output" readonly></label>
      </div>
      <label>ملاحظات الإنتاج<input id="oNotes" placeholder="ملاحظات للمدير أو الإنتاج"></label>
      <div class="jms-pro-note">طلب التصنيع يستخدم نفس حاسبة عرض السعر ويحسب وزن الحبة وعدد الحبات تلقائيًا.</div>
      <br><button class="primary" type="button" onclick="saveOrderFromModal()">حفظ طلب التصنيع</button>`;
    modal.classList.remove('hidden');
    attachAutoCalc(['oWidth','oLength','oSizeUnit','oThickness','oThicknessUnit','oMaterial','oKg','oPriceKg'], window.jmsCalcOrder);
  };

  window.saveOrderFromModal = function(){
    const customerId = document.getElementById('oCustomer')?.value;
    if(!customerId) return alert('اكتب اسم العميل واختره من نتائج البحث');
    window.jmsCalcOrder();
    db.orders ||= [];
    db.orders.unshift({
      id:localId(), date: typeof today==='function'?today():new Date().toISOString().slice(0,10),
      customer_id:customerId, rep_id:document.getElementById('oRep')?.value || currentUser?.id || '',
      product:oProduct.value, material:oMaterial.value, color:oColor.value,
      width:oWidth.value, length:oLength.value, thickness:oThickness.value,
      total_kg:oKg.value, piece_weight:oPiece.value, pieces:oPieces.value,
      amount:oTotal.value, amount_value:Number(String(oTotal.value||'').replace(/[^\d.]/g,'')),
      status:oStatus.value, notes:oNotes.value
    });
    if(typeof save==='function') save();
    closeModal(); renderAll(); alert('تم حفظ طلب التصنيع');
  };

  // If old static order form exists, make its calculator work too.
  setTimeout(()=>{
    attachAutoCalc(['width','length','sizeUnit','thickness','thicknessUnit','material','totalKg','priceKg'], window.jmsCalcOrder);
  }, 500);

  document.addEventListener('click', function(e){
    const pickers = document.querySelectorAll('.jms-search-box');
    pickers.forEach(box=>{
      if(!box.contains(e.target)){
        const res = box.querySelector('.jms-search-results');
        if(res) res.classList.remove('active');
      }
    });
  });
})();



/* JMS quote edit + required validation patch */
(function(){
  function localId(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function ensure(){
    db.customers ||= [];
    db.reps ||= [];
    db.quotes ||= [];
    db.orders ||= [];
  }
  function requiredValue(id){
    const el = document.getElementById(id);
    const val = (el?.value || '').trim();
    if(!val){
      if(el) el.classList.add('jms-field-error');
      return false;
    }
    if(el) el.classList.remove('jms-field-error');
    return true;
  }
  function numValue(id){
    const el = document.getElementById(id);
    const val = Number(String(el?.value || '').replace(/[^\d.]/g,''));
    if(!val || val <= 0){
      if(el) el.classList.add('jms-field-error');
      return false;
    }
    if(el) el.classList.remove('jms-field-error');
    return true;
  }
  function getRepOptions(selected=''){
    const reps = currentUser?.role === 'rep' ? db.reps.filter(r=>r.id===currentUser.id) : db.reps;
    return reps.map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${r.name}</option>`).join('');
  }
  function customerNameById(cid){
    const c = db.customers.find(x=>x.id===cid);
    return c?.name || '';
  }
  function setSelectedCustomer(prefix, cid, repSelectId){
    const c = db.customers.find(x=>x.id===cid);
    if(!c) return;
    const hidden = document.getElementById(prefix+'Customer');
    const search = document.getElementById(prefix+'CustomerSearch');
    const pill = document.getElementById(prefix+'CustomerPill');
    if(hidden) hidden.value = c.id;
    if(search) search.value = c.name;
    if(pill){ pill.textContent='تم اختيار العميل: '+c.name; pill.classList.add('jms-selected-pill'); }
    if(repSelectId && c.rep_id){
      const rep = document.getElementById(repSelectId);
      if(rep) rep.value = c.rep_id;
    }
  }
  function fieldVal(id){ return document.getElementById(id)?.value || ''; }

  function quoteFormHtml(q=null){
    ensure();
    const isEdit = !!q;
    const defaultRep = q?.rep_id || (currentUser?.role === 'rep' ? currentUser.id : (db.reps[0]?.id || ''));
    return `<h2>${isEdit?'تعديل عرض سعر':'إنشاء عرض سعر'}</h2>
      <div class="quote-customer-mode">
        <label><input type="radio" name="quoteCustomerMode" value="existing" checked onchange="toggleQuoteCustomerMode()"><span>اختيار عميل موجود</span></label>
        <label><input type="radio" name="quoteCustomerMode" value="new" onchange="toggleQuoteCustomerMode()"><span>إضافة عميل جديد</span></label>
      </div>

      <div id="existingCustomerBox" class="form-grid two">
        <label>بحث عن العميل
          <div class="jms-search-box">
            <input id="mqCustomerSearch" autocomplete="off" placeholder="اكتب اسم العميل أو الجوال أو المدينة..."
              oninput="jmsSearchCustomers('mqCustomerSearch','mqCustomerResults','mqCustomer','mqCustomerPill','mqRep')"
              onfocus="jmsSearchCustomers('mqCustomerSearch','mqCustomerResults','mqCustomer','mqCustomerPill','mqRep')">
            <div id="mqCustomerResults" class="jms-search-results"></div>
            <input type="hidden" id="mqCustomer">
            <div id="mqCustomerPill"></div>
          </div>
        </label>
        <label>المندوب<select id="mqRep">${getRepOptions(defaultRep)}</select></label>
      </div>

      <div id="newCustomerBox" class="form-grid two hidden">
        <label>اسم العميل الجديد<input id="mqNewCustomerName" placeholder="اسم العميل"></label>
        <label>جوال العميل<input id="mqNewCustomerPhone" placeholder="05xxxxxxxx"></label>
        <label>المدينة<input id="mqNewCustomerCity" value="جدة"></label>
        <label>الحي / الموقع<input id="mqNewCustomerLocation" placeholder="الحي أو رابط الموقع"></label>
      </div>

      <div class="form-grid two">
        <label>تاريخ العرض<input id="mqDate" type="date" value="${q?.date || q?.quote_date || tdy()}"></label>
        <label>صلاحية العرض<input id="mqValid" type="date" value="${q?.valid_until || ''}"></label>
      </div>

      <div class="form-grid four">
        <label>المنتج<select id="mqProduct"><option>أكياس رول</option><option>أكياس شيت</option><option>أكياس تي شيرت</option><option>شرنك</option><option>فيلم</option><option>أكياس نفايات</option></select></label>
        <label>الخامة<select id="mqMaterial"><option value="HDPE">HDPE</option><option value="LDPE">LDPE</option><option value="LLDPE">LLDPE</option><option value="PP">PP</option><option value="MIX">خلطة</option></select></label>
        <label>اللون<input id="mqColor" placeholder="شفاف / أبيض / حسب الطلب" value="${q?.color || ''}"></label>
        <label>الطباعة<select id="mqPrint"><option>بدون طباعة</option><option>وجه واحد</option><option>وجهين</option></select></label>
      </div>

      <div class="form-grid four">
        <label>العرض<input id="mqWidth" type="number" step="0.01" placeholder="65" value="${q?.width || ''}"></label>
        <label>الطول<input id="mqLength" type="number" step="0.01" placeholder="90" value="${q?.length || ''}"></label>
        <label>وحدة المقاس<select id="mqSizeUnit"><option value="cm">سم</option><option value="mm">مم</option></select></label>
        <label>السماكة<input id="mqThickness" type="number" step="0.01" placeholder="75" value="${q?.thickness || ''}"></label>
      </div>

      <div class="form-grid four">
        <label>وحدة السماكة<select id="mqThicknessUnit"><option value="micron">ميكرون</option><option value="mm">مم</option></select></label>
        <label>كمية الطلب بالكيلو<input id="mqKg" type="number" step="0.01" placeholder="2000" value="${q?.total_kg || ''}"></label>
        <label>سعر الكيلو<input id="mqPriceKg" type="number" step="0.01" value="${q?.price_kg || ''}"></label>
        <label>كثافة الخامة<input id="mqDensity" class="jms-calc-output" readonly></label>
      </div>

      <div class="form-grid three">
        <label>وزن الحبة<input id="mqPiece" class="jms-calc-output" readonly value="${q?.piece_weight || ''}"></label>
        <label>عدد الحبات<input id="mqPieces" class="jms-calc-output" readonly value="${q?.pieces || ''}"></label>
        <label>الإجمالي<input id="mqTotal" class="jms-calc-output" readonly value="${q?.total_amount || ''}"></label>
      </div>

      <div class="form-grid two">
        <label>شروط الدفع<input id="mqPayment" value="${q?.payment_terms || 'حسب الاتفاق'}"></label>
        <label>مدة التسليم<input id="mqDelivery" value="${q?.delivery_terms || 'حسب جدول الإنتاج'}"></label>
      </div>
      <label>ملاحظات<input id="mqNotes" placeholder="ملاحظات للمدير أو العميل" value="${q?.notes || ''}"></label>
      <div class="jms-required-hint">لا يمكن حفظ أو إرسال عرض السعر إذا كانت الخانات الأساسية فارغة.</div>
      <br><button class="primary" type="button" onclick="${isEdit?`updateQuote('${q.id}')`:'saveQuote()'}">${isEdit?'حفظ التعديل وإرجاعه للاعتماد':'حفظ وإرساله للمدير للاعتماد'}</button>`;
  }

  function attachCalc(){
    const ids=['mqWidth','mqLength','mqSizeUnit','mqThickness','mqThicknessUnit','mqMaterial','mqKg','mqPriceKg'];
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(el){
        el.addEventListener('input',()=>window.jmsCalcQuote && window.jmsCalcQuote());
        el.addEventListener('change',()=>window.jmsCalcQuote && window.jmsCalcQuote());
      }
    });
    setTimeout(()=>window.jmsCalcQuote && window.jmsCalcQuote(),60);
  }

  function fillQuoteDefaults(q){
    if(!q) return;
    setTimeout(()=>{
      setSelectedCustomer('mq', q.customer_id, 'mqRep');
      if(document.getElementById('mqProduct')) mqProduct.value = q.product || mqProduct.value;
      if(document.getElementById('mqMaterial')) mqMaterial.value = q.material || mqMaterial.value;
      if(document.getElementById('mqPrint')) mqPrint.value = q.print || mqPrint.value;
      if(document.getElementById('mqSizeUnit')) mqSizeUnit.value = q.size_unit || 'cm';
      if(document.getElementById('mqThicknessUnit')) mqThicknessUnit.value = q.thickness_unit || 'micron';
      window.jmsCalcQuote && window.jmsCalcQuote();
    },80);
  }

  window.validateQuoteForm = function(){
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    let ok=true;
    if(mode==='new'){
      ok = requiredValue('mqNewCustomerName') && ok;
    }else{
      ok = requiredValue('mqCustomer') && ok;
    }
    ok = requiredValue('mqProduct') && ok;
    ok = requiredValue('mqMaterial') && ok;
    ok = numValue('mqWidth') && ok;
    ok = numValue('mqLength') && ok;
    ok = numValue('mqThickness') && ok;
    ok = numValue('mqKg') && ok;
    ok = numValue('mqPriceKg') && ok;
    window.jmsCalcQuote && window.jmsCalcQuote();
    ok = requiredValue('mqPiece') && ok;
    ok = requiredValue('mqPieces') && ok;
    ok = numValue('mqTotal') && ok;
    if(!ok){
      alert('لا يمكن حفظ عرض السعر. عبئ الخانات الأساسية أولًا: العميل، المنتج، المقاس، السماكة، الكمية، سعر الكيلو.');
    }
    return ok;
  };

  window.openQuoteForm = function(defaultCustomerId=''){
    modalBody.innerHTML = quoteFormHtml(null);
    modal.classList.remove('hidden');
    if(defaultCustomerId) setTimeout(()=>setSelectedCustomer('mq', defaultCustomerId, 'mqRep'),80);
    attachCalc();
  };

  window.editQuote = function(qid){
    const q=db.quotes.find(x=>x.id===qid);
    if(!q) return alert('لم يتم العثور على عرض السعر');
    if(['approved','sent','accepted','cancelled'].includes(q.status)){
      if(!(currentUser?.role==='admin'||currentUser?.role==='sales')){
        return alert('لا يمكن تعديل عرض معتمد أو مرسل. اطلب من المدير إرجاعه للمراجعة.');
      }
    }
    modalBody.innerHTML = quoteFormHtml(q);
    modal.classList.remove('hidden');
    fillQuoteDefaults(q);
    attachCalc();
  };

  window.updateQuote = function(qid){
    const q=db.quotes.find(x=>x.id===qid);
    if(!q) return;
    if(!validateQuoteForm()) return;
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    let customerId = document.getElementById('mqCustomer')?.value;
    let repId = document.getElementById('mqRep')?.value || q.rep_id;
    if(mode==='new'){
      const name=(mqNewCustomerName.value||'').trim();
      const newCustomer={id:localId(),name,phone:mqNewCustomerPhone.value||'',city:mqNewCustomerCity.value||'جدة',district:'',location:mqNewCustomerLocation.value||'',category:'عميل',status:'active',rep_id:repId,debt_balance:0,credit_limit:0,notes:'تمت إضافته من تعديل عرض سعر'};
      db.customers.unshift(newCustomer);
      customerId=newCustomer.id;
    }
    Object.assign(q,{
      customer_id:customerId,rep_id:repId,
      date:fieldVal('mqDate')||tdy(),valid_until:fieldVal('mqValid'),
      product:fieldVal('mqProduct'),material:fieldVal('mqMaterial'),color:fieldVal('mqColor'),print:fieldVal('mqPrint'),
      width:fieldVal('mqWidth'),length:fieldVal('mqLength'),size_unit:fieldVal('mqSizeUnit'),
      thickness:fieldVal('mqThickness'),thickness_unit:fieldVal('mqThicknessUnit'),
      total_kg:fieldVal('mqKg'),price_kg:fieldVal('mqPriceKg'),total_amount:fieldVal('mqTotal'),
      piece_weight:fieldVal('mqPiece'),pieces:fieldVal('mqPieces'),
      payment_terms:fieldVal('mqPayment'),delivery_terms:fieldVal('mqDelivery'),notes:fieldVal('mqNotes'),
      status:'pending',
      edited_by:currentUser?.name||'',edited_at:new Date().toISOString()
    });
    if(typeof save==='function') save();
    closeModal(); renderAll(); alert('تم تعديل العرض وإرجاعه لاعتماد المدير');
  };

  window.saveQuote = function(){
    ensure();
    if(!validateQuoteForm()) return;
    const mode=document.querySelector('input[name="quoteCustomerMode"]:checked')?.value||'existing';
    let customerId='';
    let repId=document.getElementById('mqRep')?.value || currentUser?.id || '';
    if(mode==='new'){
      const name=(mqNewCustomerName.value||'').trim();
      const newCustomer={id:localId(),name,phone:mqNewCustomerPhone.value||'',city:mqNewCustomerCity.value||'جدة',district:'',location:mqNewCustomerLocation.value||'',category:'عميل',status:'active',rep_id:repId,debt_balance:0,credit_limit:0,notes:'تمت إضافته من عرض سعر'};
      db.customers.unshift(newCustomer);
      customerId=newCustomer.id;
    }else{
      customerId=document.getElementById('mqCustomer')?.value;
    }
    const no='Q-'+String((db.quotes||[]).length+1).padStart(5,'0');
    db.quotes.unshift({
      id:localId(),quote_no:no,status:'pending',customer_id:customerId,rep_id:repId,date:fieldVal('mqDate')||tdy(),valid_until:fieldVal('mqValid'),
      product:fieldVal('mqProduct'),material:fieldVal('mqMaterial'),color:fieldVal('mqColor'),print:fieldVal('mqPrint'),
      width:fieldVal('mqWidth'),length:fieldVal('mqLength'),size_unit:fieldVal('mqSizeUnit'),
      thickness:fieldVal('mqThickness'),thickness_unit:fieldVal('mqThicknessUnit'),
      total_kg:fieldVal('mqKg'),price_kg:fieldVal('mqPriceKg'),total_amount:fieldVal('mqTotal'),
      piece_weight:fieldVal('mqPiece'),pieces:fieldVal('mqPieces'),
      payment_terms:fieldVal('mqPayment'),delivery_terms:fieldVal('mqDelivery'),notes:fieldVal('mqNotes'),
      created_by:currentUser?.name||'',created_at:new Date().toISOString()
    });
    if(typeof save==='function') save();
    closeModal(); renderAll(); alert('تم حفظ العرض وإرساله للمدير للاعتماد');
  };

  window.returnQuoteForEdit = function(qid){
    const q=db.quotes.find(x=>x.id===qid);
    if(!q) return;
    if(!(currentUser?.role==='admin'||currentUser?.role==='sales')) return alert('هذه الصلاحية للمدير فقط');
    q.status='pending';
    q.returned_by=currentUser?.name||'';
    q.returned_at=new Date().toISOString();
    if(typeof save==='function') save();
    renderAll();
    alert('تم إرجاع العرض للمراجعة ويمكن تعديله الآن');
  };

  const oldSendQuote = window.sendQuote;
  window.sendQuote = function(qid){
    const q=db.quotes.find(x=>x.id===qid);
    if(!q) return;
    const required = ['customer_id','product','width','length','thickness','material','total_kg','price_kg','piece_weight','pieces','total_amount'];
    const missing = required.some(k=>!q[k] || Number(q[k])===0);
    if(missing){
      return alert('لا يمكن إرسال عرض السعر لأنه ناقص. عدّل العرض وعبئ الخانات الأساسية أولًا.');
    }
    if(q.status!=='approved' && q.status!=='sent') return alert('لا يمكن الإرسال قبل اعتماد المدير');
    q.status='sent';
    q.sent_at=tdy();
    if(typeof save==='function') save();
    if(typeof renderQuotes==='function') renderQuotes();
    const msg=`عرض سعر من شركة جدة النموذجية للصناعة%0Aرقم العرض: ${q.quote_no}%0Aالعميل: ${customerName(q.customer_id)}%0Aالمنتج: ${q.product}%0Aالمقاس: ${q.width} × ${q.length} ${q.size_unit||''}%0Aالسماكة: ${q.thickness} ${q.thickness_unit||''}%0Aالخامة: ${q.material}%0Aالكمية: ${q.total_kg} كجم%0Aالإجمالي: ${q.total_amount} ريال`;
    window.open(`https://wa.me/?text=${msg}`,'_blank');
  };

  const oldQuoteCard = window.quoteCard;
  window.quoteCard = function(q){
    const canApprove=currentUser?.role==='admin'||currentUser?.role==='sales';
    const canEdit = q.status==='pending' || q.status==='rejected' || canApprove;
    const canSend=q.status==='approved'||q.status==='sent';
    const canConvert=q.status==='accepted'||q.status==='approved'||q.status==='sent';
    return `<div class="quote-card">
      <div class="quote-head"><div><h3>عرض رقم ${q.quote_no}</h3><p>${customerName(q.customer_id)} · ${repName(q.rep_id)} · ${q.date}</p></div><span class="quote-status ${q.status}">${quoteStatusText(q.status)}</span></div>
      <div class="quote-lines">
        <div><span>المنتج</span><b>${q.product||'-'}</b></div>
        <div><span>المقاس</span><b>${q.width||'-'} × ${q.length||'-'} ${q.size_unit||''}</b></div>
        <div><span>السماكة</span><b>${q.thickness||'-'} ${q.thickness_unit||''}</b></div>
        <div><span>الخامة</span><b>${q.material||'-'}</b></div>
        <div><span>الكمية</span><b>${q.total_kg||'-'} كجم</b></div>
        <div><span>سعر الكيلو</span><b>${q.price_kg||'-'} ريال</b></div>
        <div><span>وزن الحبة</span><b>${q.piece_weight||'-'}</b></div>
        <div><span>عدد الحبات</span><b>${q.pieces||'-'}</b></div>
      </div>
      <div class="quote-total"><span>إجمالي العرض</span><b>${q.total_amount||0} ريال</b></div>
      ${q.cancel_reason?`<div class="alert-card">سبب الإلغاء: ${q.cancel_reason}</div>`:''}
      ${q.reject_reason?`<div class="alert-card">سبب الرفض: ${q.reject_reason}</div>`:''}
      <div class="quote-actions">
        <button onclick="viewQuote('${q.id}')">عرض</button>
        ${canEdit?`<button class="edit" onclick="editQuote('${q.id}')">تعديل</button>`:''}
        ${canApprove && ['approved','sent','accepted'].includes(q.status)?`<button class="revision" onclick="returnQuoteForEdit('${q.id}')">إرجاع للمراجعة</button>`:''}
        ${canApprove && q.status==='pending'?`<button class="approve" onclick="approveQuote('${q.id}')">اعتماد</button><button class="reject" onclick="rejectQuote('${q.id}')">رفض</button>`:''}
        ${q.status==='approved'?`<button class="send" onclick="sendQuote('${q.id}')">إرسال للعميل</button>`:''}
        ${q.status==='sent'?`<button class="accept" onclick="acceptQuote('${q.id}')">العميل وافق</button><button class="cancel" onclick="cancelQuote('${q.id}')">إلغاء - العميل لم يوافق</button>`:''}
        ${canConvert && q.status!=='cancelled' && q.status!=='rejected'?`<button class="convert" onclick="convertQuoteToOrder('${q.id}')">تحويل لطلب</button>`:''}
      </div>
    </div>`;
  };
})();



/* FORCE FIX: Quote edit button always visible and validated */
(function(){
  function localId(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function fv(id){ return document.getElementById(id)?.value || ''; }
  function ensure(){ db.quotes ||= []; db.customers ||= []; db.reps ||= []; db.orders ||= []; }
  function canManager(){ return currentUser && (currentUser.role === 'admin' || currentUser.role === 'sales'); }
  function calcIfPossible(){ if(typeof jmsCalcQuote === 'function') jmsCalcQuote(); else if(typeof calcQuoteForm === 'function') calcQuoteForm(); }
  function req(id){ const el=document.getElementById(id); const v=(el?.value||'').trim(); if(!v){ if(el) el.style.borderColor='#b91c1c'; return false; } if(el) el.style.borderColor=''; return true; }
  function reqNum(id){ const el=document.getElementById(id); const n=Number(String(el?.value||'').replace(/[^\d.]/g,'')); if(!n){ if(el) el.style.borderColor='#b91c1c'; return false; } if(el) el.style.borderColor=''; return true; }
  function repsOptions(selected=''){ const reps = currentUser?.role==='rep' ? db.reps.filter(r=>r.id===currentUser.id) : db.reps; return reps.map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${r.name}</option>`).join(''); }
  function customerOptions(selected=''){ return (typeof allowedCustomers==='function'?allowedCustomers():db.customers).map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${c.name}</option>`).join(''); }
  function fillSelect(id,val){ const el=document.getElementById(id); if(el && val) el.value=val; }

  window.forceValidateQuote = function(){
    calcIfPossible();
    let ok=true;
    ok = req('mqCustomer') && ok;
    ok = req('mqProduct') && ok;
    ok = req('mqMaterial') && ok;
    ok = reqNum('mqWidth') && ok;
    ok = reqNum('mqLength') && ok;
    ok = reqNum('mqThickness') && ok;
    ok = reqNum('mqKg') && ok;
    ok = reqNum('mqPriceKg') && ok;
    ok = req('mqPiece') && ok;
    ok = req('mqPieces') && ok;
    ok = reqNum('mqTotal') && ok;
    if(!ok) alert('لا يمكن حفظ أو إرسال عرض السعر قبل تعبئة العميل، المقاس، السماكة، الكمية، سعر الكيلو والحسابات.');
    return ok;
  };

  window.forceQuoteForm = function(q){
    ensure();
    const isEdit=!!q;
    const defaultRep=q?.rep_id || (currentUser?.role==='rep'?currentUser.id:(db.reps[0]?.id||''));
    modalBody.innerHTML = `<h2>${isEdit?'تعديل عرض سعر':'إنشاء عرض سعر'}</h2>
      <div class="form-grid two">
        <label>العميل<select id="mqCustomer"><option value="">اختر العميل</option>${customerOptions(q?.customer_id || '')}</select></label>
        <label>المندوب<select id="mqRep">${repsOptions(defaultRep)}</select></label>
        <label>تاريخ العرض<input id="mqDate" type="date" value="${q?.date || q?.quote_date || tdy()}"></label>
        <label>صلاحية العرض<input id="mqValid" type="date" value="${q?.valid_until || ''}"></label>
      </div>
      <div class="form-grid four">
        <label>المنتج<select id="mqProduct"><option>أكياس رول</option><option>أكياس شيت</option><option>أكياس تي شيرت</option><option>شرنك</option><option>فيلم</option><option>أكياس نفايات</option></select></label>
        <label>الخامة<select id="mqMaterial"><option value="HDPE">HDPE</option><option value="LDPE">LDPE</option><option value="LLDPE">LLDPE</option><option value="PP">PP</option><option value="MIX">خلطة</option></select></label>
        <label>اللون<input id="mqColor" value="${q?.color||''}"></label>
        <label>الطباعة<select id="mqPrint"><option>بدون طباعة</option><option>وجه واحد</option><option>وجهين</option></select></label>
      </div>
      <div class="form-grid four">
        <label>العرض<input id="mqWidth" type="number" step="0.01" value="${q?.width||''}"></label>
        <label>الطول<input id="mqLength" type="number" step="0.01" value="${q?.length||''}"></label>
        <label>وحدة المقاس<select id="mqSizeUnit"><option value="cm">سم</option><option value="mm">مم</option></select></label>
        <label>السماكة<input id="mqThickness" type="number" step="0.01" value="${q?.thickness||''}"></label>
      </div>
      <div class="form-grid four">
        <label>وحدة السماكة<select id="mqThicknessUnit"><option value="micron">ميكرون</option><option value="mm">مم</option></select></label>
        <label>كمية الطلب بالكيلو<input id="mqKg" type="number" step="0.01" value="${q?.total_kg||''}"></label>
        <label>سعر الكيلو<input id="mqPriceKg" type="number" step="0.01" value="${q?.price_kg||''}"></label>
        <label>الإجمالي<input id="mqTotal" readonly value="${q?.total_amount||''}"></label>
      </div>
      <div class="form-grid two">
        <label>وزن الحبة<input id="mqPiece" readonly value="${q?.piece_weight||''}"></label>
        <label>عدد الحبات<input id="mqPieces" readonly value="${q?.pieces||''}"></label>
        <label>شروط الدفع<input id="mqPayment" value="${q?.payment_terms||'حسب الاتفاق'}"></label>
        <label>مدة التسليم<input id="mqDelivery" value="${q?.delivery_terms||'حسب جدول الإنتاج'}"></label>
      </div>
      <label>ملاحظات<input id="mqNotes" value="${q?.notes||''}"></label>
      <br><button class="primary" type="button" onclick="${isEdit?`forceUpdateQuote('${q.id}')`:'forceSaveQuote()'}">${isEdit?'حفظ التعديل وإرجاعه للاعتماد':'حفظ وإرساله للاعتماد'}</button>`;
    modal.classList.remove('hidden');
    fillSelect('mqProduct', q?.product); fillSelect('mqMaterial', q?.material); fillSelect('mqPrint', q?.print); fillSelect('mqSizeUnit', q?.size_unit || 'cm'); fillSelect('mqThicknessUnit', q?.thickness_unit || 'micron');
    ['mqWidth','mqLength','mqSizeUnit','mqThickness','mqThicknessUnit','mqMaterial','mqKg','mqPriceKg'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input',calcIfPossible); el.addEventListener('change',calcIfPossible); } });
    setTimeout(calcIfPossible,80);
  };

  window.openQuoteForm = function(defaultCustomerId=''){ forceQuoteForm(null); if(defaultCustomerId && document.getElementById('mqCustomer')) mqCustomer.value=defaultCustomerId; };
  window.editQuote = function(qid){ const q=db.quotes.find(x=>x.id===qid); if(!q) return alert('لم يتم العثور على عرض السعر'); forceQuoteForm(q); };

  window.forceSaveQuote = function(){
    ensure(); if(!forceValidateQuote()) return;
    const no='Q-'+String(db.quotes.length+1).padStart(5,'0');
    db.quotes.unshift({id:localId(), quote_no:no, status:'pending', customer_id:fv('mqCustomer'), rep_id:fv('mqRep'), date:fv('mqDate')||tdy(), valid_until:fv('mqValid'), product:fv('mqProduct'), material:fv('mqMaterial'), color:fv('mqColor'), print:fv('mqPrint'), width:fv('mqWidth'), length:fv('mqLength'), size_unit:fv('mqSizeUnit'), thickness:fv('mqThickness'), thickness_unit:fv('mqThicknessUnit'), total_kg:fv('mqKg'), price_kg:fv('mqPriceKg'), total_amount:fv('mqTotal'), piece_weight:fv('mqPiece'), pieces:fv('mqPieces'), payment_terms:fv('mqPayment'), delivery_terms:fv('mqDelivery'), notes:fv('mqNotes'), created_by:currentUser?.name||'', created_at:new Date().toISOString()});
    if(typeof save==='function') save(); closeModal(); renderAll(); alert('تم حفظ العرض للاعتماد');
  };

  window.forceUpdateQuote = function(qid){
    const q=db.quotes.find(x=>x.id===qid); if(!q) return; if(!forceValidateQuote()) return;
    Object.assign(q,{status:'pending', customer_id:fv('mqCustomer'), rep_id:fv('mqRep'), date:fv('mqDate')||tdy(), valid_until:fv('mqValid'), product:fv('mqProduct'), material:fv('mqMaterial'), color:fv('mqColor'), print:fv('mqPrint'), width:fv('mqWidth'), length:fv('mqLength'), size_unit:fv('mqSizeUnit'), thickness:fv('mqThickness'), thickness_unit:fv('mqThicknessUnit'), total_kg:fv('mqKg'), price_kg:fv('mqPriceKg'), total_amount:fv('mqTotal'), piece_weight:fv('mqPiece'), pieces:fv('mqPieces'), payment_terms:fv('mqPayment'), delivery_terms:fv('mqDelivery'), notes:fv('mqNotes'), edited_by:currentUser?.name||'', edited_at:new Date().toISOString()});
    if(typeof save==='function') save(); closeModal(); renderAll(); alert('تم تعديل العرض ورجوعه للاعتماد');
  };

  window.returnQuoteForEdit = function(qid){ const q=db.quotes.find(x=>x.id===qid); if(!q) return; if(!canManager()) return alert('إرجاع العرض للمراجعة للمدير فقط'); q.status='pending'; q.returned_at=new Date().toISOString(); q.returned_by=currentUser?.name||''; if(typeof save==='function') save(); renderAll(); };

  window.quoteCard = function(q){
    const canApprove=canManager();
    const canConvert=q.status==='approved'||q.status==='sent'||q.status==='accepted';
    return `<div class="quote-card">
      <div class="quote-head"><div><h3>عرض رقم ${q.quote_no}</h3><p>${customerName(q.customer_id)} · ${repName(q.rep_id)} · ${q.date||'-'}</p></div><span class="quote-status ${q.status}">${quoteStatusText(q.status)}</span></div>
      <div class="quote-lines"><div><span>المنتج</span><b>${q.product||'-'}</b></div><div><span>المقاس</span><b>${q.width||'-'} × ${q.length||'-'} ${q.size_unit||''}</b></div><div><span>السماكة</span><b>${q.thickness||'-'} ${q.thickness_unit||''}</b></div><div><span>الخامة</span><b>${q.material||'-'}</b></div><div><span>الكمية</span><b>${q.total_kg||'-'} كجم</b></div><div><span>سعر الكيلو</span><b>${q.price_kg||'-'} ريال</b></div><div><span>وزن الحبة</span><b>${q.piece_weight||'-'}</b></div><div><span>عدد الحبات</span><b>${q.pieces||'-'}</b></div></div>
      <div class="quote-total"><span>إجمالي العرض</span><b>${q.total_amount||0} ريال</b></div>
      ${q.cancel_reason?`<div class="alert-card">سبب الإلغاء: ${q.cancel_reason}</div>`:''}${q.reject_reason?`<div class="alert-card">سبب الرفض: ${q.reject_reason}</div>`:''}
      <div class="quote-actions"><button onclick="viewQuote('${q.id}')">عرض</button><button class="edit" onclick="editQuote('${q.id}')">تعديل</button>${canApprove && q.status==='pending'?`<button class="approve" onclick="approveQuote('${q.id}')">اعتماد</button><button class="reject" onclick="rejectQuote('${q.id}')">رفض</button>`:''}${canApprove && ['approved','sent','accepted'].includes(q.status)?`<button class="revision" onclick="returnQuoteForEdit('${q.id}')">إرجاع للمراجعة</button>`:''}${q.status==='approved'?`<button class="send" onclick="sendQuote('${q.id}')">إرسال للعميل</button>`:''}${q.status==='sent'?`<button class="accept" onclick="acceptQuote('${q.id}')">العميل وافق</button><button class="cancel" onclick="cancelQuote('${q.id}')">إلغاء - العميل لم يوافق</button>`:''}${canConvert?`<button class="convert" onclick="convertQuoteToOrder('${q.id}')">تحويل لطلب</button>`:''}</div>
    </div>`;
  };

  window.renderQuotes = function(){
    if(!window.quotesList) return; ensure(); if(typeof renderQuoteFilters==='function') renderQuoteFilters();
    const all = currentUser?.role==='rep' ? db.quotes.filter(q=>q.rep_id===currentUser.id) : db.quotes;
    if(window.quotesTotal) quotesTotal.textContent=all.length; if(window.quotesPending) quotesPending.textContent=all.filter(q=>q.status==='pending').length; if(window.quotesApproved) quotesApproved.textContent=all.filter(q=>q.status==='approved').length; if(window.quotesRejected) quotesRejected.textContent=all.filter(q=>q.status==='rejected').length;
    const st=window.quoteStatusFilter?.value||'all'; const rep=window.quoteRepFilter?.value||'all'; const txt=(window.quoteSearch?.value||'').trim();
    const list=all.filter(q=>{ if(st!=='all' && q.status!==st) return false; if(rep!=='all' && q.rep_id!==rep) return false; if(txt && !String(q.quote_no).includes(txt) && !customerName(q.customer_id).includes(txt)) return false; return true; });
    quotesList.innerHTML=list.map(q=>quoteCard(q)).join('') || '<div class="panel">لا توجد عروض أسعار</div>';
  };

  const oldSend = window.sendQuote;
  window.sendQuote = function(qid){ const q=db.quotes.find(x=>x.id===qid); if(!q) return; const missing = ['customer_id','product','width','length','thickness','material','total_kg','price_kg','piece_weight','pieces','total_amount'].some(k=>!q[k] || Number(q[k])===0); if(missing) return alert('لا يمكن إرسال عرض ناقص. اضغط تعديل وعبئ الخانات الأساسية.'); if(q.status!=='approved' && q.status!=='sent') return alert('لا يمكن الإرسال قبل اعتماد المدير'); if(typeof oldSend==='function') oldSend(qid); };
  setTimeout(()=>{ if(window.quotesList) renderQuotes(); }, 300);
})();



/* CRM 3.0 Representatives Phase 1 */
(function(){
  function ensureRepData(){
    db.reps ||= [];
    db.users ||= [];
    db.repAttendance ||= [];
    db.repLocations ||= [];
    db.repTargets ||= [];
    db.repStatus ||= {};
    db.visits ||= [];
    db.quotes ||= [];
    db.orders ||= [];
  }
  function rid(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function nowIso(){ return new Date().toISOString(); }
  function timeOnly(iso){ if(!iso) return '-'; try{return new Date(iso).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(e){return '-'} }
  function roleIsManager(){ return currentUser && (currentUser.role === 'admin' || currentUser.role === 'sales'); }
  function repObj(repId){ return db.reps.find(r=>r.id===repId) || db.users.find(u=>u.id===repId) || {}; }
  function statusText(s){ return s==='on_duty'?'على الدوام':s==='in_visit'?'في زيارة':'خارج الدوام'; }
  function todayVisits(repId){ return db.visits.filter(v=>v.rep_id===repId && String(v.date||v.visit_date||'').startsWith(tdy())).length; }
  function todayQuotes(repId){ return (db.quotes||[]).filter(q=>q.rep_id===repId && String(q.date||q.quote_date||q.created_at||'').startsWith(tdy())).length; }
  function todayOrders(repId){ return (db.orders||[]).filter(o=>o.rep_id===repId && String(o.date||o.order_date||'').startsWith(tdy())).length; }
  function currentAttendance(repId){
    return (db.repAttendance||[]).find(a=>a.rep_id===repId && a.date===tdy() && !a.end_at);
  }
  function lastLocation(repId){
    return (db.repLocations||[]).filter(x=>x.rep_id===repId).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
  }
  function setRepStatus(repId,status){
    db.repStatus ||= {};
    db.repStatus[repId] = {status, updated_at: nowIso()};
  }
  function getRepStatus(repId){
    const s = db.repStatus?.[repId]?.status;
    if(s) return s;
    return currentAttendance(repId) ? 'on_duty' : 'off_duty';
  }
  function saveAndRender(){
    if(typeof save === 'function') save();
    if(typeof renderAll === 'function') renderAll();
  }
  function getGeo(callback){
    if(!navigator.geolocation){
      callback(null, 'المتصفح لا يدعم تحديد الموقع');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => callback({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy}, null),
      err => callback(null, 'لم يتم السماح بتحديد الموقع أو حدث خطأ'),
      {enableHighAccuracy:true, timeout:12000, maximumAge:30000}
    );
  }

  window.openRepForm = function(){
    if(!roleIsManager()) return alert('إضافة المناديب للمدير فقط');
    modalBody.innerHTML = `<h2>إضافة مندوب</h2>
      <div class="form-grid two">
        <label>اسم المندوب<input id="mrName" placeholder="اسم المندوب"></label>
        <label>الجوال<input id="mrPhone" placeholder="05xxxxxxxx"></label>
        <label>الإيميل<input id="mrEmail" placeholder="rep@jms.local"></label>
        <label>كلمة المرور<input id="mrPass" value="123456"></label>
        <label>السيارة<input id="mrCar" placeholder="مثال: تويوتا رايز"></label>
        <label>المنطقة<input id="mrArea" value="جدة"></label>
        <label>الهدف الشهري<input id="mrTarget" type="number" placeholder="مثال: 100000"></label>
        <label>الحالة
          <select id="mrStatus"><option value="active">نشط</option><option value="disabled">موقوف</option></select>
        </label>
      </div>
      <br><button class="primary" onclick="saveRep()">حفظ المندوب</button>`;
    modal.classList.remove('hidden');
  };

  window.saveRep = function(){
    const name=(mrName.value||'').trim();
    if(!name) return alert('اكتب اسم المندوب');
    const repId='rep-'+Date.now();
    const rep={id:repId,name,phone:mrPhone.value||'',email:mrEmail.value||('rep'+Date.now()+'@jms.local'),password:mrPass.value||'123456',role:'rep',status:mrStatus.value||'active',car:mrCar.value||'',area:mrArea.value||'جدة',monthly_target:Number(mrTarget.value||0)};
    db.reps ||= [];
    db.users ||= [];
    db.reps.push(rep);
    db.users.push({...rep});
    setRepStatus(repId,'off_duty');
    if(typeof save==='function') save();
    closeModal();
    renderAll();
    alert('تم إضافة المندوب');
  };

  window.startRepWork = function(repId){
    ensureRepData();
    const active=currentAttendance(repId);
    if(active) return alert('المندوب بدأ الدوام مسبقًا');
    getGeo((geo,err)=>{
      const att={id:rid(),rep_id:repId,date:tdy(),start_at:nowIso(),start_lat:geo?.lat||null,start_lng:geo?.lng||null,start_accuracy:geo?.accuracy||null};
      db.repAttendance.unshift(att);
      if(geo){
        db.repLocations.unshift({id:rid(),rep_id:repId,lat:geo.lat,lng:geo.lng,accuracy:geo.accuracy,source:'start_work',created_at:nowIso()});
      }
      setRepStatus(repId,'on_duty');
      saveAndRender();
      alert(err ? 'تم بدء الدوام بدون موقع: '+err : 'تم بدء الدوام وتسجيل الموقع');
    });
  };

  window.endRepWork = function(repId){
    ensureRepData();
    const att=currentAttendance(repId);
    if(!att) return alert('لا يوجد دوام مفتوح لهذا المندوب');
    getGeo((geo,err)=>{
      att.end_at=nowIso();
      att.end_lat=geo?.lat||null;
      att.end_lng=geo?.lng||null;
      att.end_accuracy=geo?.accuracy||null;
      if(geo){
        db.repLocations.unshift({id:rid(),rep_id:repId,lat:geo.lat,lng:geo.lng,accuracy:geo.accuracy,source:'end_work',created_at:nowIso()});
      }
      setRepStatus(repId,'off_duty');
      saveAndRender();
      alert('تم إنهاء الدوام');
    });
  };

  window.updateRepLocation = function(repId){
    ensureRepData();
    getGeo((geo,err)=>{
      if(!geo) return alert(err || 'تعذر تحديد الموقع');
      db.repLocations.unshift({id:rid(),rep_id:repId,lat:geo.lat,lng:geo.lng,accuracy:geo.accuracy,source:'manual_update',created_at:nowIso()});
      if(currentAttendance(repId)) setRepStatus(repId,'on_duty');
      saveAndRender();
      alert('تم تحديث موقع المندوب');
    });
  };

  window.markRepInVisit = function(repId){
    ensureRepData();
    if(!currentAttendance(repId)) return alert('يجب بدء الدوام أولًا');
    setRepStatus(repId,'in_visit');
    updateRepLocation(repId);
  };

  window.markRepBackOnDuty = function(repId){
    ensureRepData();
    if(!currentAttendance(repId)) return alert('لا يوجد دوام مفتوح');
    setRepStatus(repId,'on_duty');
    if(typeof save==='function') save();
    renderAll();
  };

  window.openRepLocation = function(repId){
    const loc=lastLocation(repId);
    if(!loc) return alert('لا يوجد موقع محفوظ لهذا المندوب');
    window.open(`https://www.google.com/maps?q=${loc.lat},${loc.lng}`,'_blank');
  };

  window.renderRepsControl = function(){
    if(!window.repsControlGrid) return;
    ensureRepData();
    const reps = db.reps || [];
    const q=(window.repSearch?.value||'').trim();
    const sf=window.repStatusFilter?.value||'all';
    const area=(window.repAreaFilter?.value||'').trim();

    let list=reps.filter(r=>{
      const s=getRepStatus(r.id);
      if(sf!=='all' && s!==sf) return false;
      if(q && !(`${r.name||''} ${r.area||''} ${r.phone||''}`).includes(q)) return false;
      if(area && !String(r.area||'').includes(area)) return false;
      return true;
    });

    const total=reps.length;
    const on=reps.filter(r=>getRepStatus(r.id)==='on_duty').length;
    const inv=reps.filter(r=>getRepStatus(r.id)==='in_visit').length;
    const off=reps.filter(r=>getRepStatus(r.id)==='off_duty').length;
    if(window.repsTotal) repsTotal.textContent=total;
    if(window.repsOnDuty) repsOnDuty.textContent=on;
    if(window.repsInVisit) repsInVisit.textContent=inv;
    if(window.repsOffDuty) repsOffDuty.textContent=off;

    repsControlGrid.innerHTML = list.map(r=>{
      const status=getRepStatus(r.id);
      const loc=lastLocation(r.id);
      const att=currentAttendance(r.id);
      const canSelf=currentUser?.id===r.id || currentUser?.email===r.email;
      const canControl=roleIsManager() || canSelf;
      return `<div class="rep-card">
        <div class="rep-card-head">
          <div>
            <h3>${r.name||'-'}</h3>
            <p>${r.phone||'-'} · ${r.area||'جدة'}<br>${r.car?('السيارة: '+r.car):''}</p>
          </div>
          <span class="rep-status ${status}">${statusText(status)}</span>
        </div>
        <div class="rep-metrics">
          <div><b>${todayVisits(r.id)}</b><span>زيارات اليوم</span></div>
          <div><b>${todayQuotes(r.id)}</b><span>عروض اليوم</span></div>
          <div><b>${todayOrders(r.id)}</b><span>طلبات اليوم</span></div>
        </div>
        <div class="rep-location-box">
          <b>الدوام:</b> ${att?('بدأ '+timeOnly(att.start_at)):'خارج الدوام'}<br>
          <b>آخر موقع:</b> ${loc?`${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}`:'لا يوجد'}<br>
          <b>آخر تحديث:</b> ${loc?timeOnly(loc.created_at):'-'}
          ${loc?`<br><a class="rep-map-link" href="https://www.google.com/maps?q=${loc.lat},${loc.lng}" target="_blank">فتح على خرائط Google</a>`:''}
        </div>
        <div class="rep-actions">
          ${canControl?`<button class="start" onclick="startRepWork('${r.id}')">بدء الدوام</button>`:''}
          ${canControl?`<button class="stop" onclick="endRepWork('${r.id}')">إنهاء الدوام</button>`:''}
          ${canControl?`<button class="loc" onclick="updateRepLocation('${r.id}')">تحديث الموقع</button>`:''}
          ${canControl?`<button class="visit" onclick="markRepInVisit('${r.id}')">في زيارة</button>`:''}
          ${canControl?`<button onclick="markRepBackOnDuty('${r.id}')">رجوع للطريق</button>`:''}
          <button onclick="openRepLocation('${r.id}')">عرض الموقع</button>
        </div>
      </div>`;
    }).join('') || '<div class="panel">لا يوجد مناديب</div>';
  };

  // Add quick self panel on customers page for reps
  const oldRenderCustomers = window.renderCustomers;
  window.renderCustomers = function(){
    if(typeof oldRenderCustomers === 'function') oldRenderCustomers();
    if(currentUser?.role==='rep' && window.customersGrid && !document.getElementById('repSelfPanel')){
      const status=getRepStatus(currentUser.id);
      const panel=document.createElement('div');
      panel.id='repSelfPanel';
      panel.className='rep-self-panel';
      panel.innerHTML=`<b>لوحة المندوب السريعة</b><br>
        الحالة الحالية: ${statusText(status)}
        <div class="rep-actions">
          <button class="start" onclick="startRepWork('${currentUser.id}')">بدء الدوام</button>
          <button class="stop" onclick="endRepWork('${currentUser.id}')">إنهاء الدوام</button>
          <button class="loc" onclick="updateRepLocation('${currentUser.id}')">تحديث موقعي</button>
          <button class="visit" onclick="markRepInVisit('${currentUser.id}')">أنا في زيارة</button>
        </div>`;
      customersGrid.parentNode.insertBefore(panel, customersGrid);
    }
  };

  // Make reps page accessible to managers and reps
  const oldShowApp = window.showApp;
  if(typeof oldShowApp === 'function'){
    window.showApp = function(){
      oldShowApp();
      document.querySelectorAll('.nav').forEach(btn=>{
        if(btn.dataset.page==='repsControl'){
          btn.style.display = (currentUser?.role==='admin'||currentUser?.role==='sales'||currentUser?.role==='rep') ? 'block' : 'none';
        }
      });
    };
  }

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll === 'function') oldRenderAll();
    renderRepsControl();
  };
})();



/* CRM 3.0 Smart Visits Phase 2 */
(function(){
  function ensureVisitData(){
    db.visits ||= [];
    db.customers ||= [];
    db.reps ||= [];
    db.repLocations ||= [];
    db.repAttendance ||= [];
    db.repStatus ||= {};
  }
  function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function nowIso(){ return new Date().toISOString(); }
  function isManager(){ return currentUser && (currentUser.role === 'admin' || currentUser.role === 'sales'); }
  function customerObj(id){ return db.customers.find(c=>c.id===id) || {}; }
  function customerNm(id){ return (typeof customerName==='function') ? customerName(id) : (customerObj(id).name || '-'); }
  function repNm(id){ return (typeof repName==='function') ? repName(id) : ((db.reps.find(r=>r.id===id)||{}).name || '-'); }
  function timeStr(iso){ if(!iso) return '-'; try{return new Date(iso).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(e){return '-'} }
  function minDiff(a,b){ if(!a||!b) return 0; return Math.max(0, Math.round((new Date(b)-new Date(a))/60000)); }
  function resultText(r){
    return ({quote:'عرض سعر',sale:'تم البيع',collection:'تحصيل',no_manager:'لا يوجد مسؤول',closed:'العميل مغلق',postponed:'مؤجل',none:'بدون نتيجة'})[r||'none'] || 'بدون نتيجة';
  }
  function allowedReps(){
    return currentUser?.role==='rep' ? db.reps.filter(r=>r.id===currentUser.id) : db.reps;
  }
  function allowedVisitList(){
    ensureVisitData();
    return currentUser?.role==='rep' ? db.visits.filter(v=>v.rep_id===currentUser.id) : db.visits;
  }
  function setRepStatus(repId,status){
    db.repStatus ||= {};
    db.repStatus[repId] = {status,updated_at:nowIso()};
  }
  function getGeo(cb){
    if(!navigator.geolocation) return cb(null,'المتصفح لا يدعم GPS');
    navigator.geolocation.getCurrentPosition(
      pos=>cb({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy},null),
      err=>cb(null,'لم يتم السماح بتحديد الموقع أو حدث خطأ'),
      {enableHighAccuracy:true,timeout:12000,maximumAge:30000}
    );
  }
  function saveRender(){
    if(typeof save==='function') save();
    if(typeof renderAll==='function') renderAll();
  }

  window.openSmartVisitForm = function(customerId=''){
    ensureVisitData();
    const reps=allowedReps();
    const customers=(typeof allowedCustomers==='function'?allowedCustomers():db.customers);
    modalBody.innerHTML = `<h2>بدء زيارة ذكية</h2>
      <div class="form-grid two">
        <label>العميل
          <select id="svCustomer">
            <option value="">اختر العميل</option>
            ${customers.map(c=>`<option value="${c.id}" ${c.id===customerId?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </label>
        <label>المندوب
          <select id="svRep">
            ${reps.map(r=>`<option value="${r.id}" ${r.id===currentUser?.id?'selected':''}>${r.name}</option>`).join('')}
          </select>
        </label>
        <label>نوع الزيارة
          <select id="svType">
            <option value="scheduled">زيارة مجدولة</option>
            <option value="new_order">طلب جديد</option>
            <option value="collection">تحصيل</option>
            <option value="follow_up">متابعة</option>
          </select>
        </label>
        <label>موعد الزيارة القادمة
          <input id="svNextDate" type="date">
        </label>
      </div>
      <label>ملاحظات الوصول
        <input id="svStartNotes" placeholder="ملاحظة مختصرة عند بداية الزيارة">
      </label>
      <div class="smart-note">سيتم تسجيل وقت الوصول وموقع GPS إن سمح المتصفح بذلك.</div>
      <br><button class="primary" onclick="startSmartVisit()">تسجيل الوصول وبدء الزيارة</button>`;
    modal.classList.remove('hidden');
  };

  window.startSmartVisit = function(){
    ensureVisitData();
    const customerId=svCustomer.value;
    const repId=svRep.value;
    if(!customerId) return alert('اختر العميل');
    if(!repId) return alert('اختر المندوب');
    const open=db.visits.find(v=>v.rep_id===repId && !v.checkout_at && (v.smart||v.checkin_at));
    if(open) return alert('يوجد زيارة مفتوحة لهذا المندوب. أنهها أولًا.');
    getGeo((geo,err)=>{
      const v={
        id:uid(), smart:true, date:tdy(), customer_id:customerId, rep_id:repId,
        type:svType.value, checkin_at:nowIso(), checkout_at:null,
        checkin_lat:geo?.lat||null, checkin_lng:geo?.lng||null, checkin_accuracy:geo?.accuracy||null,
        result:'none', notes:svStartNotes.value||'', next_visit_date:svNextDate.value||''
      };
      db.visits.unshift(v);
      if(geo){
        db.repLocations ||= [];
        db.repLocations.unshift({id:uid(),rep_id:repId,lat:geo.lat,lng:geo.lng,accuracy:geo.accuracy,source:'visit_checkin',visit_id:v.id,created_at:nowIso()});
      }
      setRepStatus(repId,'in_visit');
      saveRender();
      closeModal();
      alert(err ? 'تم بدء الزيارة بدون GPS: '+err : 'تم تسجيل الوصول وبدء الزيارة');
    });
  };

  window.endSmartVisit = function(visitId){
    const v=db.visits.find(x=>x.id===visitId);
    if(!v) return;
    modalBody.innerHTML = `<h2>إنهاء الزيارة</h2>
      <p><b>العميل:</b> ${customerNm(v.customer_id)}</p>
      <div class="form-grid two">
        <label>نتيجة الزيارة
          <select id="evResult">
            <option value="quote">عرض سعر</option>
            <option value="sale">تم البيع</option>
            <option value="collection">تحصيل</option>
            <option value="no_manager">لا يوجد مسؤول</option>
            <option value="closed">العميل مغلق</option>
            <option value="postponed">مؤجل</option>
            <option value="none">بدون نتيجة</option>
          </select>
        </label>
        <label>الزيارة القادمة
          <input id="evNextDate" type="date" value="${v.next_visit_date||''}">
        </label>
      </div>
      <label>ملاحظات الزيارة
        <input id="evNotes" value="${v.notes||''}" placeholder="ماذا حدث في الزيارة؟">
      </label>
      <div class="smart-note">سيتم تسجيل وقت المغادرة وموقع GPS إن سمح المتصفح بذلك.</div>
      <br><button class="primary" onclick="saveEndSmartVisit('${visitId}')">حفظ وإنهاء الزيارة</button>`;
    modal.classList.remove('hidden');
  };

  window.saveEndSmartVisit = function(visitId){
    const v=db.visits.find(x=>x.id===visitId);
    if(!v) return;
    getGeo((geo,err)=>{
      v.checkout_at=nowIso();
      v.checkout_lat=geo?.lat||null;
      v.checkout_lng=geo?.lng||null;
      v.checkout_accuracy=geo?.accuracy||null;
      v.result=evResult.value;
      v.notes=evNotes.value||'';
      v.next_visit_date=evNextDate.value||'';
      v.duration_minutes=minDiff(v.checkin_at,v.checkout_at);
      if(geo){
        db.repLocations ||= [];
        db.repLocations.unshift({id:uid(),rep_id:v.rep_id,lat:geo.lat,lng:geo.lng,accuracy:geo.accuracy,source:'visit_checkout',visit_id:v.id,created_at:nowIso()});
      }
      const c=customerObj(v.customer_id);
      if(c){
        c.last_visit=v.date;
        c.next_visit_date=v.next_visit_date || c.next_visit_date || '';
        c.last_visit_result=v.result;
      }
      setRepStatus(v.rep_id,'on_duty');
      saveRender();
      closeModal();
      if(v.result==='quote' && confirm('نتيجة الزيارة عرض سعر. هل تريد إنشاء عرض سعر الآن؟')){
        if(typeof openQuoteForm==='function') openQuoteForm(v.customer_id);
      }else{
        alert('تم إنهاء الزيارة');
      }
    });
  };

  window.openVisitOnMap = function(visitId,point='checkin'){
    const v=db.visits.find(x=>x.id===visitId);
    if(!v) return;
    const lat = point==='checkout' ? v.checkout_lat : v.checkin_lat;
    const lng = point==='checkout' ? v.checkout_lng : v.checkin_lng;
    if(!lat || !lng) return alert('لا يوجد موقع محفوظ لهذه النقطة');
    window.open(`https://www.google.com/maps?q=${lat},${lng}`,'_blank');
  };

  window.openCustomerRoute = function(customerId){
    const c=customerObj(customerId);
    const q = c.lat && c.lng ? `${c.lat},${c.lng}` : encodeURIComponent(`${c.name||''} ${c.city||'جدة'} ${c.location||''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank');
  };

  window.renderSmartVisits = function(){
    if(!window.smartVisitsGrid) return;
    ensureVisitData();
    if(window.smartVisitRepFilter){
      const old=smartVisitRepFilter.value||'all';
      smartVisitRepFilter.innerHTML = `<option value="all">كل المناديب</option>` + allowedReps().map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
      smartVisitRepFilter.value = old;
    }
    const todayList=allowedVisitList().filter(v=>String(v.date||'').startsWith(tdy()));
    const open=todayList.filter(v=>!v.checkout_at);
    const done=todayList.filter(v=>v.checkout_at);
    const avg=done.length ? Math.round(done.reduce((s,v)=>s+Number(v.duration_minutes||0),0)/done.length) : 0;
    const none=todayList.filter(v=>(v.result||'none')==='none').length;
    if(window.smartVisitsToday) smartVisitsToday.textContent=todayList.length;
    if(window.smartVisitsOpen) smartVisitsOpen.textContent=open.length;
    if(window.smartVisitsAvg) smartVisitsAvg.textContent=avg;
    if(window.smartVisitsNoResult) smartVisitsNoResult.textContent=none;

    const q=(smartVisitSearch?.value||'').trim();
    const rf=smartVisitResultFilter?.value||'all';
    const repf=smartVisitRepFilter?.value||'all';
    const list=allowedVisitList().filter(v=>{
      if(rf!=='all'){
        if(rf==='none' && (v.result||'none')!=='none') return false;
        if(rf!=='none' && v.result!==rf) return false;
      }
      if(repf!=='all' && v.rep_id!==repf) return false;
      if(q && !(`${customerNm(v.customer_id)} ${repNm(v.rep_id)} ${v.notes||''}`).includes(q)) return false;
      return true;
    }).slice(0,80);

    smartVisitsGrid.innerHTML=list.map(v=>{
      const isOpen=!v.checkout_at;
      return `<div class="visit-card ${isOpen?'open':'closed'}">
        <div class="visit-card-head">
          <div>
            <h3>${customerNm(v.customer_id)}</h3>
            <p>${repNm(v.rep_id)} · ${v.date||'-'}</p>
            <span class="visit-result">${resultText(v.result)}</span>
          </div>
          <span class="visit-status ${isOpen?'open':'closed'}">${isOpen?'مفتوحة':'منتهية'}</span>
        </div>
        <div class="visit-lines">
          <div><span>وقت الوصول</span><b>${timeStr(v.checkin_at)}</b></div>
          <div><span>وقت المغادرة</span><b>${timeStr(v.checkout_at)}</b></div>
          <div><span>مدة الزيارة</span><b>${v.duration_minutes||0} دقيقة</b></div>
          <div><span>الزيارة القادمة</span><b>${v.next_visit_date||'-'}</b></div>
        </div>
        <div class="smart-note">${v.notes||'لا توجد ملاحظات'}</div>
        <div class="visit-actions">
          ${isOpen?`<button class="end" onclick="endSmartVisit('${v.id}')">إنهاء الزيارة</button>`:''}
          <button class="route" onclick="openCustomerRoute('${v.customer_id}')">فتح موقع العميل</button>
          <button onclick="openVisitOnMap('${v.id}','checkin')">موقع الوصول</button>
          ${v.checkout_at?`<button onclick="openVisitOnMap('${v.id}','checkout')">موقع المغادرة</button>`:''}
          ${v.result==='quote'?`<button class="quote" onclick="openQuoteForm('${v.customer_id}')">إنشاء عرض سعر</button>`:''}
        </div>
      </div>`;
    }).join('') || '<div class="panel">لا توجد زيارات</div>';
  };

  // Override customer "تمت الزيارة" to smart visit when possible
  window.quickVisit = function(customerId){
    openSmartVisitForm(customerId);
  };

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll==='function') oldRenderAll();
    renderSmartVisits();
  };

  const oldShowApp = window.showApp;
  if(typeof oldShowApp === 'function'){
    window.showApp = function(){
      oldShowApp();
      document.querySelectorAll('.nav').forEach(btn=>{
        if(btn.dataset.page==='smartVisits'){
          btn.style.display = currentUser ? 'block' : 'none';
        }
      });
    };
  }
})();



/* VISITS REPORT FIX: rep filter + clear report rendering */
(function(){
  function ensureVisits(){
    db.visits ||= [];
    db.customers ||= [];
    db.reps ||= [];
    db.quotes ||= [];
    db.orders ||= [];
  }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function isRep(){ return currentUser?.role === 'rep'; }
  function isManager(){ return currentUser && (currentUser.role === 'admin' || currentUser.role === 'sales'); }
  function cn(id){ return (typeof customerName === 'function') ? customerName(id) : ((db.customers.find(c=>c.id===id)||{}).name || '-'); }
  function rn(id){ return (typeof repName === 'function') ? repName(id) : ((db.reps.find(r=>r.id===id)||{}).name || '-'); }
  function timeStr(iso){ if(!iso) return '-'; try{return new Date(iso).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(e){return '-'} }
  function dateStr(v){ return String(v.date || v.visit_date || v.created_at || v.checkin_at || '').slice(0,10); }
  function resultText(r){ return ({quote:'عرض سعر',sale:'تم البيع',collection:'تحصيل',no_manager:'لا يوجد مسؤول',closed:'العميل مغلق',postponed:'مؤجل',none:'بدون نتيجة',general:'ملاحظة عامة'})[r||'none'] || (r||'بدون نتيجة'); }
  function minDiff(a,b){ if(!a||!b) return 0; return Math.max(0, Math.round((new Date(b)-new Date(a))/60000)); }
  function startDate(){
    return document.getElementById('visitFrom')?.value || document.getElementById('smartVisitFrom')?.value || '';
  }
  function endDate(){
    return document.getElementById('visitTo')?.value || document.getElementById('smartVisitTo')?.value || '';
  }
  function selectedRep(){
    return document.getElementById('visitRep')?.value || document.getElementById('smartVisitRepFilter')?.value || 'all';
  }
  function selectedResult(){
    return document.getElementById('smartVisitResultFilter')?.value || 'all';
  }
  function qText(){
    return (document.getElementById('smartVisitSearch')?.value || document.getElementById('visitSearch')?.value || '').trim();
  }
  function allRepsForFilter(){
    if(isRep()) return db.reps.filter(r=>r.id===currentUser.id);
    return db.reps || [];
  }
  function normalizeVisit(v){
    const checkin = v.checkin_at || v.arrival_time || v.created_at || '';
    const checkout = v.checkout_at || v.departure_time || '';
    return {
      ...v,
      date: dateStr(v) || tdy(),
      checkin_at: checkin,
      checkout_at: checkout,
      duration_minutes: v.duration_minutes || minDiff(checkin, checkout),
      result: v.result || v.visit_result || 'none',
      notes: v.notes || v.note || '',
      rep_id: v.rep_id || v.rep || '',
      customer_id: v.customer_id || v.customer || ''
    };
  }
  function filteredVisits(){
    ensureVisits();
    const from=startDate();
    const to=endDate();
    const rep=selectedRep();
    const result=selectedResult();
    const q=qText();
    return db.visits.map(normalizeVisit).filter(v=>{
      if(isRep() && v.rep_id !== currentUser.id) return false;
      if(from && v.date < from) return false;
      if(to && v.date > to) return false;
      if(rep && rep !== 'all' && v.rep_id !== rep) return false;
      if(result && result !== 'all'){
        if(result === 'none' && (v.result || 'none') !== 'none') return false;
        if(result !== 'none' && v.result !== result) return false;
      }
      if(q && !(`${cn(v.customer_id)} ${rn(v.rep_id)} ${v.notes||''}`).includes(q)) return false;
      return true;
    }).sort((a,b)=>String(b.checkin_at||b.date).localeCompare(String(a.checkin_at||a.date)));
  }
  function renderRepFilters(){
    const reps=allRepsForFilter();
    ['visitRep','smartVisitRepFilter'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return;
      const old=el.value || 'all';
      el.innerHTML = `<option value="all">كل المناديب</option>` + reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
      if(isRep()) el.value=currentUser.id;
      else el.value = [...el.options].some(o=>o.value===old) ? old : 'all';
    });
  }
  function updateStats(list){
    const todayList=list.filter(v=>v.date===tdy());
    const open=list.filter(v=>!v.checkout_at);
    const done=list.filter(v=>v.checkout_at);
    const avg=done.length ? Math.round(done.reduce((s,v)=>s+Number(v.duration_minutes||0),0)/done.length) : 0;
    const none=list.filter(v=>(v.result||'none')==='none').length;

    if(window.smartVisitsToday) smartVisitsToday.textContent=list.length;
    if(window.smartVisitsOpen) smartVisitsOpen.textContent=open.length;
    if(window.smartVisitsAvg) smartVisitsAvg.textContent=avg;
    if(window.smartVisitsNoResult) smartVisitsNoResult.textContent=none;

    if(window.visitsPeriodCount) visitsPeriodCount.textContent=list.length;
    if(window.visitedCustomersCount) visitedCustomersCount.textContent=new Set(list.map(v=>v.customer_id).filter(Boolean)).size;
    if(window.unvisitedCustomersCount){
      const rep=selectedRep();
      const customerScope = rep && rep !== 'all' ? db.customers.filter(c=>c.rep_id===rep) : db.customers;
      const visited=new Set(list.map(v=>v.customer_id).filter(Boolean));
      unvisitedCustomersCount.textContent=customerScope.filter(c=>!visited.has(c.id)).length;
    }
  }
  function visitCard(v){
    const open=!v.checkout_at;
    const locIn = v.checkin_lat && v.checkin_lng;
    const locOut = v.checkout_lat && v.checkout_lng;
    return `<div class="visit-report-card ${open?'open':''}">
      <h3>${cn(v.customer_id)}</h3>
      <p>${rn(v.rep_id)} · ${v.date} · <b>${open?'زيارة مفتوحة':'زيارة منتهية'}</b></p>
      <span class="visit-result">${resultText(v.result)}</span>
      <div class="visit-report-meta">
        <div><span>وقت الوصول</span><b>${timeStr(v.checkin_at)}</b></div>
        <div><span>وقت المغادرة</span><b>${timeStr(v.checkout_at)}</b></div>
        <div><span>مدة الزيارة</span><b>${v.duration_minutes || 0} دقيقة</b></div>
        <div><span>الزيارة القادمة</span><b>${v.next_visit_date || '-'}</b></div>
      </div>
      <div class="smart-note">${v.notes || 'لا توجد ملاحظات'}</div>
      <div class="visit-report-actions">
        ${open?`<button onclick="endSmartVisit('${v.id}')">إنهاء الزيارة</button>`:''}
        ${locIn?`<button class="map" onclick="window.open('https://www.google.com/maps?q=${v.checkin_lat},${v.checkin_lng}','_blank')">موقع الوصول</button>`:''}
        ${locOut?`<button class="map" onclick="window.open('https://www.google.com/maps?q=${v.checkout_lat},${v.checkout_lng}','_blank')">موقع المغادرة</button>`:''}
        <button class="map" onclick="openCustomerRoute('${v.customer_id}')">موقع العميل</button>
        <button class="quote" onclick="openQuoteForm('${v.customer_id}')">عرض سعر</button>
      </div>
    </div>`;
  }
  function renderPerformance(list){
    const box=document.getElementById('repPerformanceBox') || document.getElementById('smartRepPerformance');
    if(!box) return;
    const map={};
    list.forEach(v=>{
      map[v.rep_id] ||= {visits:0,customers:new Set(),minutes:0,quotes:0};
      map[v.rep_id].visits++;
      if(v.customer_id) map[v.rep_id].customers.add(v.customer_id);
      map[v.rep_id].minutes += Number(v.duration_minutes||0);
      if(v.result==='quote') map[v.rep_id].quotes++;
    });
    const rows=Object.entries(map).sort((a,b)=>b[1].visits-a[1].visits);
    box.innerHTML = rows.map(([rep,m])=>`<div class="rep-performance-row"><b>${rn(rep)}</b><span>${m.visits} زيارة · ${m.customers.size} عميل · ${m.quotes} عروض · ${m.minutes} دقيقة</span></div>`).join('') || '<p>لا يوجد أداء في الفترة المحددة</p>';
  }

  window.renderSmartVisits = function(){
    ensureVisits();
    renderRepFilters();
    const list=filteredVisits();
    updateStats(list);
    if(window.smartVisitsGrid){
      smartVisitsGrid.innerHTML = list.map(visitCard).join('') || '<div class="panel">لا توجد زيارات حسب الفلتر المحدد</div>';
    }
    if(window.visitLog || window.visitsLog){
      const el=window.visitLog || window.visitsLog;
      el.innerHTML = list.map(visitCard).join('') || '<div class="panel">لا توجد زيارات حسب الفلتر المحدد</div>';
    }
    renderPerformance(list);
  };

  // Patch old visits report page too
  window.renderVisits = function(){
    renderSmartVisits();
  };

  window.setVisitRange = function(range){
    const fromEl=document.getElementById('visitFrom') || document.getElementById('smartVisitFrom');
    const toEl=document.getElementById('visitTo') || document.getElementById('smartVisitTo');
    const d=new Date();
    const end=d.toISOString().slice(0,10);
    let start=end;
    if(range==='week'){ const s=new Date(); s.setDate(d.getDate()-7); start=s.toISOString().slice(0,10); }
    if(range==='month'){ const s=new Date(); s.setDate(d.getDate()-30); start=s.toISOString().slice(0,10); }
    if(fromEl) fromEl.value=start;
    if(toEl) toEl.value=end;
    renderSmartVisits();
  };

  // If the existing visits page has old buttons, make them work.
  window.showVisitReport = function(){ renderSmartVisits(); };

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll === 'function') oldRenderAll();
    renderSmartVisits();
  };

  setTimeout(renderSmartVisits, 500);
})();



/* SAFE USER LANGUAGE MODULE - no core override */
(function(){
  const KEY = 'jms_safe_lang';
  const T = {
    'لوحة التحكم':'Dashboard',
    'العملاء':'Customers',
    'عروض الأسعار':'Quotations',
    'الزيارات الذكية':'Smart Visits',
    'المناديب':'Representatives',
    'طلبات التصنيع':'Production Orders',
    'المستخدمون':'Users',
    'تسجيل الخروج':'Logout',
    'إدارة المناديب':'Representatives Management',
    'إضافة مندوب':'Add Representative',
    'تحديث':'Refresh',
    'بدء الدوام':'Start Work',
    'إنهاء الدوام':'End Work',
    'تحديث الموقع':'Update Location',
    'في زيارة':'In Visit',
    'خارج الدوام':'Off Duty',
    'على الدوام':'On Duty',
    'زيارات اليوم':'Today Visits',
    'عروض اليوم':'Today Quotes',
    'طلبات اليوم':'Today Orders',
    'كل المناديب':'All Representatives',
    'بحث':'Search',
    'الحالة':'Status',
    'المنطقة':'Area',
    'إجراء':'Action',
    'بدء زيارة':'Start Visit',
    'إنهاء الزيارة':'End Visit',
    'وقت الوصول':'Check-in Time',
    'وقت المغادرة':'Check-out Time',
    'مدة الزيارة':'Visit Duration',
    'نتيجة الزيارة':'Visit Result',
    'عرض سعر':'Quotation',
    'إنشاء عرض سعر':'Create Quotation',
    'تعديل':'Edit',
    'عرض':'View',
    'اعتماد':'Approve',
    'رفض':'Reject',
    'إرسال للعميل':'Send to Customer',
    'تحويل لطلب':'Convert to Order',
    'العميل':'Customer',
    'المندوب':'Representative',
    'المنتج':'Product',
    'الخامة':'Material',
    'اللون':'Color',
    'العرض':'Width',
    'الطول':'Length',
    'السماكة':'Thickness',
    'الإجمالي':'Total',
    'ملاحظات':'Notes'
  };
  const R = Object.fromEntries(Object.entries(T).map(([a,e])=>[e,a]));

  function lang(){
    const uid = window.currentUser?.id || window.currentUser?.email || 'guest';
    return localStorage.getItem(KEY + '_' + uid) || localStorage.getItem(KEY) || 'ar';
  }
  function saveLang(v){
    const uid = window.currentUser?.id || window.currentUser?.email || 'guest';
    localStorage.setItem(KEY + '_' + uid, v);
    localStorage.setItem(KEY, v);
  }
  function trText(txt, target){
    const clean = String(txt || '').trim();
    if(!clean) return txt;
    if(target === 'en' && T[clean]) return String(txt).replace(clean, T[clean]);
    if(target === 'ar' && R[clean]) return String(txt).replace(clean, R[clean]);
    return txt;
  }
  function translateElement(el, target){
    if(!el || el.dataset.noTranslate === '1') return;
    if(!el.dataset.originalText && el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE){
      el.dataset.originalText = el.textContent;
    }
    if(el.dataset.originalText){
      const base = target === 'ar' ? (R[el.dataset.originalText] || el.dataset.originalText) : el.dataset.originalText;
      el.textContent = trText(base, target);
    }
  }
  function apply(){
    const target = lang();
    document.documentElement.lang = target === 'en' ? 'en' : 'ar';
    document.documentElement.dir = target === 'en' ? 'ltr' : 'rtl';
    document.querySelectorAll('.nav,button,th,label,h1,h2,h3,span').forEach(el=>translateElement(el,target));
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{
      if(!el.dataset.originalPlaceholder) el.dataset.originalPlaceholder = el.placeholder;
      const base = target === 'ar' ? (R[el.dataset.originalPlaceholder] || el.dataset.originalPlaceholder) : el.dataset.originalPlaceholder;
      el.placeholder = trText(base,target);
    });
    document.querySelectorAll('.jms-safe-lang button').forEach(b=>b.classList.toggle('active', b.dataset.lang === target));
  }
  function addSwitcher(){
    if(document.getElementById('jmsSafeLang')) return;
    const side = document.querySelector('aside') || document.querySelector('.sidebar') || document.body;
    const box = document.createElement('div');
    box.id='jmsSafeLang';
    box.className='jms-safe-lang';
    box.innerHTML='<button type="button" data-lang="ar">عربي</button><button type="button" data-lang="en">English</button>';
    box.querySelectorAll('button').forEach(btn=>{
      btn.onclick = function(){
        saveLang(this.dataset.lang);
        apply();
      };
    });
    side.insertBefore(box, side.children[1] || null);
  }
  window.applySafeLanguage = function(){ addSwitcher(); apply(); };

  // Only hook after rendering without replacing core functions destructively.
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(window.applySafeLanguage, 700);
    document.addEventListener('click', function(){ setTimeout(window.applySafeLanguage, 150); }, true);
  });

  const oldRenderAll = window.renderAll;
  if(typeof oldRenderAll === 'function' && !window.__safeLangRenderPatched){
    window.__safeLangRenderPatched = true;
    window.renderAll = function(){
      const r = oldRenderAll.apply(this, arguments);
      setTimeout(window.applySafeLanguage, 100);
      return r;
    };
  }
})();



/* Customer Import from Excel / CSV */
(function(){
  function ensureImportData(){
    db.customers ||= [];
    db.reps ||= [];
    db.users ||= [];
  }
  function newId(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())); }
  function clean(v){ return String(v ?? '').trim(); }
  function num(v){ const n=Number(String(v ?? '').replace(/[^\d.-]/g,'')); return isNaN(n)?0:n; }
  function defaultRepId(){
    if(currentUser?.role==='rep') return currentUser.id;
    return db.reps?.[0]?.id || 'rep-yaser';
  }
  function findRep(row){
    const repId = clean(row.rep_id || row["rep_id"] || row["كود المندوب"]);
    if(repId && db.reps.some(r=>r.id===repId)) return repId;
    const repEmail = clean(row.rep_email || row["rep_email"] || row["ايميل المندوب"] || row["إيميل المندوب"]);
    if(repEmail){
      const r = db.reps.find(x=>String(x.email||'').toLowerCase()===repEmail.toLowerCase());
      if(r) return r.id;
    }
    const repName = clean(row.rep_name || row["rep_name"] || row["اسم المندوب"]);
    if(repName){
      const r = db.reps.find(x=>String(x.name||'').includes(repName) || repName.includes(String(x.name||'')));
      if(r) return r.id;
    }
    return defaultRepId();
  }
  function normalizeRow(row){
    const name = clean(row.name || row["name"] || row["اسم العميل"] || row["العميل"] || row["Customer Name"] || row["customer"]);
    const phone = clean(row.phone || row["phone"] || row["الجوال"] || row["رقم الجوال"] || row["Mobile"] || row["Phone"]);
    const city = clean(row.city || row["city"] || row["المدينة"] || row["City"]) || 'جدة';
    const district = clean(row.district || row["district"] || row["الحي"] || row["District"]);
    const location = clean(row.location || row["location"] || row["العنوان"] || row["الموقع"] || row["Address"]);
    const category = clean(row.category || row["category"] || row["التصنيف"]) || 'عميل';
    const notes = clean(row.notes || row["notes"] || row["ملاحظات"]);
    const debt = num(row.debt_balance || row["debt_balance"] || row["المديونية"] || row["رصيد المديونية"]);
    const lat = num(row.lat || row["lat"] || row["latitude"] || row["خط العرض"]);
    const lng = num(row.lng || row["lng"] || row["longitude"] || row["خط الطول"]);
    if(!name) return null;
    return {name,phone,city,district,location,category,notes,debt_balance:debt,lat:lat||'',lng:lng||'',rep_id:findRep(row),status:'active'};
  }
  function sameCustomer(a,b){
    if(a.phone && b.phone && String(a.phone).replace(/\D/g,'') === String(b.phone).replace(/\D/g,'')) return true;
    return clean(a.name) && clean(a.name) === clean(b.name) && clean(a.city) === clean(b.city);
  }
  function parseCsv(text){
    const rows=[];
    const lines=text.replace(/\r/g,'').split('\n').filter(x=>x.trim());
    if(!lines.length) return rows;
    const splitLine = (line)=>{
      const out=[]; let cur='', inQ=false;
    };
  }
  function simpleCsv(text){
    const lines=text.replace(/\r/g,'').split('\n').filter(x=>x.trim());
    if(!lines.length) return [];
    const parseLine=(line)=>{
      const cells=[]; let cur=''; let q=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch === '"' && line[i+1] === '"'){ cur+='"'; i++; continue; }
        if(ch === '"'){ q=!q; continue; }
        if(ch === ',' && !q){ cells.push(cur); cur=''; continue; }
        cells.push ? null : null;
        cur += ch;
      }
      cells.push(cur);
      return cells.map(x=>x.trim());
    };
    const headers=parseLine(lines[0]);
    return lines.slice(1).map(line=>{
      const vals=parseLine(line);
      const obj={};
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
    if(ext==='xlsx' || ext==='xls') reader.readAsArrayBuffer(file);
    else reader.readAsText(file,'UTF-8');
  }

  window.downloadCustomerTemplate = function(){
    const csv = [
      ['name','phone','city','district','location','category','rep_email','rep_id','debt_balance','notes','lat','lng'].join(','),
      ['شركة تجريبية','0500000000','جدة','الصناعية','جدة المدينة الصناعية','عميل','yaser@jms.local','rep-yaser','0','ملاحظة','21.4858','39.1925'].join(',')
    ].join('\n');
    const blob=new Blob(["\ufeff"+csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='customers_import_template.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };

  window.openCustomerImport = function(){
    ensureImportData();
    modalBody.innerHTML = `<h2>استيراد العملاء من Excel / CSV</h2>
      <div class="import-help">
        ارفع ملف Excel أو CSV يحتوي على أعمدة مثل:<br>
        <b>name, phone, city, district, location, category, rep_email, rep_id, debt_balance, notes, lat, lng</b><br>
        النظام يمنع التكرار إذا كان رقم الجوال مكررًا أو الاسم والمدينة مكررين.
      </div>
      <div class="import-drop">
        <b>اختر ملف العملاء</b>
        <input id="customerImportFile" type="file" accept=".xlsx,.xls,.csv">
        <small>يفضل استخدام القالب الجاهز ثم تعبئته.</small>
      </div>
      <div class="import-actions">
        <button class="template" onclick="downloadCustomerTemplate()">تحميل قالب العملاء</button>
        <button class="import" onclick="runCustomerImport()">استيراد الآن</button>
      </div>
      <div id="customerImportResult" class="import-result">لم يتم الاستيراد بعد.</div>`;
    modal.classList.remove('hidden');
  };

  window.runCustomerImport = function(){
    ensureImportData();
    const file=document.getElementById('customerImportFile')?.files?.[0];
    if(!file) return alert('اختر ملف Excel أو CSV أولاً');
    customerImportResult.textContent='جاري قراءة الملف...';
    readFile(file,(rows,err)=>{
      if(err){ customerImportResult.textContent='خطأ: '+err; return; }
      let added=0, updated=0, skipped=0;
      (rows||[]).forEach(row=>{
        const c=normalizeRow(row);
        if(!c){ skipped++; return; }
        const existing=db.customers.find(x=>sameCustomer(x,c));
        if(existing){
          Object.assign(existing,{
            phone:c.phone || existing.phone,
            city:c.city || existing.city,
            district:c.district || existing.district,
            location:c.location || existing.location,
            category:c.category || existing.category,
            rep_id:c.rep_id || existing.rep_id,
            debt_balance:c.debt_balance || existing.debt_balance || 0,
            notes:[existing.notes,c.notes].filter(Boolean).join(' | '),
            lat:c.lat || existing.lat || '',
            lng:c.lng || existing.lng || ''
          });
          updated++;
        }else{
          db.customers.push({id:newId(),...c,credit_limit:0,created_at:new Date().toISOString()});
          added++;
        }
      });
      if(typeof save==='function') save();
      if(typeof renderAll==='function') renderAll();
      customerImportResult.textContent=`تم الاستيراد بنجاح\nالمضاف: ${added}\nالمحدّث: ${updated}\nالمتجاهل: ${skipped}`;
    });
  };

  function addImportButton(){
    const head=document.querySelector('#customers .page-head.with-action') || document.querySelector('#customers .page-head');
    if(!head || document.getElementById('customerImportButton')) return;
    const btn=document.createElement('button');
    btn.id='customerImportButton';
    btn.className='primary customer-import-btn';
    btn.type='button';
    btn.textContent='استيراد العملاء';
    btn.onclick=openCustomerImport;
    const actionBox=head.querySelector('.head-actions') || head;
    actionBox.appendChild(btn);
  }

  const oldRenderAll=window.renderAll;
  window.renderAll=function(){
    if(typeof oldRenderAll==='function') oldRenderAll();
    setTimeout(addImportButton,100);
  };
  setTimeout(addImportButton,700);
})();



/* FIELD SALES UPGRADE: safe language + routes + WhatsApp survey */
(function(){
  const LANG_KEY='jms_field_lang';
  const T={'العملاء':'Customers','المناديب':'Representatives','الزيارات الذكية':'Smart Visits','عروض الأسعار':'Quotations','طلبات التصنيع':'Production Orders','استيراد العملاء':'Import Customers','بدء الدوام':'Start Work','إنهاء الدوام':'End Work','تحديث الموقع':'Update Location','مسار اليوم':'Today Route','فتح المسار':'Open Route','رسالة تقييم':'Satisfaction Message','إرسال واتساب':'Send WhatsApp','العربية':'Arabic','العميل':'Customer','المندوب':'Representative','الجوال':'Mobile','المدينة':'City','الموقع':'Location','موقع العميل':'Customer Location','زيارات اليوم':'Today Visits'};
  const R=Object.fromEntries(Object.entries(T).map(([a,e])=>[e,a]));
  function curLang(){const uid=window.currentUser?.id||window.currentUser?.email||'guest';return localStorage.getItem(LANG_KEY+'_'+uid)||localStorage.getItem(LANG_KEY)||'ar'}
  window.setFieldLang=function(v){const uid=window.currentUser?.id||window.currentUser?.email||'guest';localStorage.setItem(LANG_KEY+'_'+uid,v);localStorage.setItem(LANG_KEY,v);applyFieldLang()}
  function tr(s,l){const x=String(s||'').trim();if(!x)return s;if(l==='en'&&T[x])return String(s).replace(x,T[x]);if(l==='ar'&&R[x])return String(s).replace(x,R[x]);return s}
  window.applyFieldLang=function(){const l=curLang();document.documentElement.dir=l==='en'?'ltr':'rtl';document.documentElement.lang=l;document.querySelectorAll('.nav,button,span,b,small,label,h1,h2,h3,p,th').forEach(el=>{if(el.childNodes.length===1&&el.childNodes[0].nodeType===Node.TEXT_NODE){if(!el.dataset.baseText)el.dataset.baseText=el.textContent;const base=l==='ar'?(R[el.dataset.baseText]||el.dataset.baseText):el.dataset.baseText;el.textContent=tr(base,l)}});document.querySelectorAll('.safe-lang-mini button').forEach(b=>b.classList.toggle('active',b.dataset.lang===l))}
  function addLangBox(){if(document.getElementById('fieldLangBox'))return;const side=document.querySelector('aside')||document.querySelector('.sidebar')||document.body;const box=document.createElement('div');box.id='fieldLangBox';box.className='safe-lang-mini';box.innerHTML=`<button data-lang="ar" type="button">العربية</button><button data-lang="en" type="button">English</button>`;box.querySelectorAll('button').forEach(btn=>btn.onclick=function(){setFieldLang(this.dataset.lang)});side.insertBefore(box,side.children[1]||null)}
  function ensure(){db.customers ||= [];db.reps ||= [];db.visits ||= [];db.repRoutes ||= [];db.satisfaction ||= []}
  function rid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
  function tdy(){return(typeof today==='function')?today():new Date().toISOString().slice(0,10)}
  function mapQuery(c){if(c.lat&&c.lng)return `${c.lat},${c.lng}`;return encodeURIComponent(`${c.name||''} ${c.city||'جدة'} ${c.location||c.district||''}`)}
  window.openCustomerMap=function(id){const c=db.customers.find(x=>x.id===id);if(!c)return alert('لم يتم العثور على العميل');window.open(`https://www.google.com/maps/search/?api=1&query=${mapQuery(c)}`,'_blank')}
  window.openRepRoute=function(repId){ensure();const cs=db.customers.filter(c=>c.rep_id===repId).slice(0,10);if(!cs.length)return alert('لا يوجد عملاء مربوطين بهذا المندوب');const dest=mapQuery(cs[cs.length-1]);const way=cs.slice(0,-1).map(mapQuery).join('|');window.open(`https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${dest}${way?`&waypoints=${way}`:''}&travelmode=driving`,'_blank')}
  window.saveRepRoute=function(repId){ensure();const cs=db.customers.filter(c=>c.rep_id===repId).slice(0,20);db.repRoutes.unshift({id:rid(),rep_id:repId,date:tdy(),customer_ids:cs.map(c=>c.id),created_at:new Date().toISOString()});if(typeof save==='function')save();if(typeof renderAll==='function')renderAll();alert('تم حفظ مسار اليوم للمندوب')}
  window.openRoutesPanel=function(repId=''){ensure();const reps=currentUser?.role==='rep'?db.reps.filter(r=>r.id===currentUser.id):db.reps;const selected=repId||currentUser?.id||reps[0]?.id||'';modalBody.innerHTML=`<h2>مسارات المناديب</h2><label>المندوب<select id="routeRep">${reps.map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${r.name}</option>`).join('')}</select></label><div class="field-upgrade-actions"><button class="route" onclick="saveRepRoute(routeRep.value)">حفظ مسار اليوم</button><button class="map" onclick="openRepRoute(routeRep.value)">فتح المسار في Google Maps</button></div><div id="routeCustomerList"></div>`;modal.classList.remove('hidden');routeRep.onchange=renderRouteCustomers;renderRouteCustomers()}
  window.renderRouteCustomers=function(){const repId=document.getElementById('routeRep')?.value;const box=document.getElementById('routeCustomerList');if(!box)return;const cs=db.customers.filter(c=>c.rep_id===repId).slice(0,20);box.innerHTML=cs.map((c,i)=>`<div class="customer-route-card"><b>${i+1}. ${c.name}</b><small>${c.phone||'-'} · ${c.city||'-'} · ${c.location||c.district||'-'}</small><div class="field-upgrade-actions"><button class="map" onclick="openCustomerMap('${c.id}')">موقع العميل</button></div></div>`).join('')||'<div class="panel">لا يوجد عملاء لهذا المندوب</div>'}
  window.sendSatisfactionWhatsApp=function(customerId,visitId=''){const c=db.customers.find(x=>x.id===customerId);if(!c)return alert('لم يتم العثور على العميل');const phone=String(c.phone||'').replace(/\D/g,'');if(!phone)return alert('لا يوجد رقم جوال للعميل');const sa=phone.startsWith('966')?phone:('966'+phone.replace(/^0/,''));const msg='السلام عليكم%0Aنشكر لكم التعامل مع شركة جدة النموذجية للصناعة.%0Aنأمل تقييم خدمتنا وزيارة المندوب من 1 إلى 5:%0A⭐⭐⭐⭐⭐%0Aملاحظاتكم تهمنا.';db.satisfaction.unshift({id:rid(),customer_id:customerId,visit_id:visitId,date:tdy(),phone:sa,status:'sent',created_at:new Date().toISOString()});if(typeof save==='function')save();window.open(`https://wa.me/${sa}?text=${msg}`,'_blank')}
  function addButtons(){const head=document.querySelector('#repsControl .page-head .head-actions')||document.querySelector('#repsControl .page-head');if(head&&!document.getElementById('routesPanelButton')){const b=document.createElement('button');b.id='routesPanelButton';b.className='primary';b.textContent='مسار اليوم';b.onclick=()=>openRoutesPanel();head.appendChild(b)}document.querySelectorAll('.customer-card').forEach(card=>{if(card.querySelector('.field-upgrade-actions'))return;const name=card.querySelector('h3')?.textContent?.trim();const c=db.customers.find(x=>x.name===name);if(!c)return;const div=document.createElement('div');div.className='field-upgrade-actions';div.innerHTML=`<button class="map" onclick="openCustomerMap('${c.id}')">موقع العميل</button><button class="wa" onclick="sendSatisfactionWhatsApp('${c.id}')">رسالة تقييم</button>`;card.appendChild(div)});document.querySelectorAll('.visit-report-card,.visit-card').forEach(card=>{if(card.querySelector('.wa-survey-added'))return;const title=card.querySelector('h3')?.textContent?.trim();const c=db.customers.find(x=>x.name===title);if(!c)return;const actions=card.querySelector('.visit-report-actions,.visit-actions')||card;const b=document.createElement('button');b.className='wa wa-survey-added';b.textContent='رسالة تقييم';b.onclick=()=>sendSatisfactionWhatsApp(c.id);actions.appendChild(b)})}
  const oldRenderAll=window.renderAll;window.renderAll=function(){if(typeof oldRenderAll==='function')oldRenderAll();setTimeout(()=>{addLangBox();applyFieldLang();addButtons()},150)}
  const oldShowApp=window.showApp;if(typeof oldShowApp==='function'){window.showApp=function(){oldShowApp();setTimeout(()=>{addLangBox();applyFieldLang();addButtons()},200)}}
  setTimeout(()=>{addLangBox();applyFieldLang();addButtons()},800)
})();



/* CUSTOMER CARD ACTIONS FIX: hide WhatsApp if no phone + clean buttons */
(function(){
  function ensure(){ db.customers ||= []; }
  function phoneOk(c){
    const p = String(c?.phone || c?.mobile || '').replace(/\D/g,'');
    return p.length >= 8;
  }
  function esc(s){ return String(s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
  function findCustomerFromCard(card){
    const title = card.querySelector('h3')?.textContent?.trim();
    return db.customers.find(c => String(c.name||'').trim() === title);
  }
  function safeBtn(label, cls, onclick){
    return `<button type="button" class="${cls}" onclick="${onclick}">${label}</button>`;
  }
  window.toggleCustomerMore = function(customerId){
    const el = document.getElementById('more_'+customerId);
    if(el) el.classList.toggle('open');
  };
  function rebuildCustomerCardActions(){
    ensure();
    document.querySelectorAll('.customer-card').forEach(card=>{
      const c = findCustomerFromCard(card);
      if(!c) return;
      if(card.dataset.actionsFixed === '1') return;
      card.dataset.actionsFixed = '1';

      // Hide old added field-upgrade actions to avoid duplicated buttons
      card.querySelectorAll('.field-upgrade-actions').forEach(x=>x.remove());

      // Try to hide old raw buttons area only if inside customer card and contains these labels
      const oldButtons = Array.from(card.querySelectorAll('button')).filter(b=>{
        const t = b.textContent.trim();
        return ['تمت الزيارة','طلب جديد','موعد','تحصيل','ملاحظه','ملاحظة','موقع العميل','رسالة تقييم'].includes(t);
      });
      oldButtons.forEach(b=>b.style.display='none');

      const id = c.id;
      const hasPhone = phoneOk(c);
      const actions = document.createElement('div');
      actions.className = 'customer-actions-clean';
      actions.innerHTML =
        safeBtn('تمت الزيارة','done',`quickVisit('${id}')`) +
        safeBtn('طلب جديد','order',`openQuoteForm('${id}')`) +
        safeBtn('موعد','meeting',`openCustomerMeeting ? openCustomerMeeting('${id}') : alert('سيتم إضافة المواعيد قريباً')`) +
        safeBtn('تحصيل','collection',`openCollection ? openCollection('${id}') : alert('سيتم إضافة التحصيل قريباً')`) +
        safeBtn('ملاحظة','note',`openCustomerNote ? openCustomerNote('${id}') : alert('سيتم إضافة الملاحظات قريباً')`) +
        safeBtn('موقع العميل','map',`openCustomerMap('${id}')`) +
        (hasPhone ? safeBtn('رسالة تقييم','wa',`sendSatisfactionWhatsApp('${id}')`) : '') +
        safeBtn('المزيد','more',`toggleCustomerMore('${id}')`);

      const more = document.createElement('div');
      more.id = 'more_' + id;
      more.className = 'customer-more-menu';
      more.innerHTML = `
        ${hasPhone ? `<button type="button" onclick="sendSatisfactionWhatsApp('${id}')">إرسال تقييم واتساب</button>` : `<button type="button" disabled>لا يوجد رقم جوال</button>`}
        <button type="button" onclick="openCustomerMap('${id}')">فتح موقع العميل</button>
        <button type="button" onclick="quickVisit('${id}')">تسجيل زيارة</button>
        <button type="button" onclick="openQuoteForm('${id}')">إنشاء عرض سعر</button>
      `;
      card.appendChild(actions);
      card.appendChild(more);
    });
  }

  // Safer WhatsApp function: no annoying alert for missing phone from card button; just return
  const oldSendSat = window.sendSatisfactionWhatsApp;
  window.sendSatisfactionWhatsApp = function(customerId, visitId=''){
    const c = db.customers.find(x=>x.id===customerId);
    if(!phoneOk(c)){
      alert('لا يوجد رقم جوال للعميل. أضف رقم الجوال في بطاقة العميل أولاً.');
      return;
    }
    if(typeof oldSendSat === 'function') return oldSendSat(customerId, visitId);
    const phone=String(c.phone||'').replace(/\D/g,'');
    const sa=phone.startsWith('966')?phone:('966'+phone.replace(/^0/,''));
    const msg='السلام عليكم%0Aنشكر لكم التعامل مع شركة جدة النموذجية للصناعة.%0Aنأمل تقييم خدمتنا من 1 إلى 5 نجوم:%0A⭐⭐⭐⭐⭐';
    window.open(`https://wa.me/${sa}?text=${msg}`,'_blank');
  };

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll === 'function') oldRenderAll();
    setTimeout(rebuildCustomerCardActions, 200);
  };

  const oldRenderCustomers = window.renderCustomers;
  if(typeof oldRenderCustomers === 'function'){
    window.renderCustomers = function(){
      oldRenderCustomers.apply(this, arguments);
      setTimeout(rebuildCustomerCardActions, 200);
    };
  }

  setTimeout(rebuildCustomerCardActions, 800);
})();



/* UI CLEANUP FIX: language duplicates, customer buttons, logo fallback */
(function(){
  function ensure(){ db.customers ||= []; }
  function phoneOk(c){ return String(c?.phone || c?.mobile || '').replace(/\D/g,'').length >= 8; }
  function findCustomerFromCard(card){
    const title = card.querySelector('h3')?.textContent?.trim();
    return db.customers.find(c => String(c.name||'').trim() === title);
  }

  function cleanupLanguageButtons(){
    const boxes = Array.from(document.querySelectorAll('#jmsSafeLang,#fieldLangBox,.jms-lang-switch,.safe-lang-mini'));
    if(!boxes.length) return;
    boxes.forEach((box,i)=>{
      box.style.display = i === 0 ? '' : 'none';
      if(i === 0) box.id = 'jmsMainLangSwitch';
    });
  }

  function fixLogoFallback(){
    const side = document.querySelector('aside') || document.querySelector('.sidebar') || document.querySelector('.side');
    if(!side || document.getElementById('jmsLogoFallback')) return;
    const imgs = Array.from(side.querySelectorAll('img'));
    const needsFallback = imgs.length === 0 || imgs.some(img => !img.getAttribute('src') || (img.complete && img.naturalWidth === 0));
    if(needsFallback){
      imgs.forEach(img => img.style.display='none');
      const wrap = document.createElement('div');
      wrap.id = 'jmsLogoFallback';
      wrap.className = 'jms-logo-wrap';
      wrap.innerHTML = '<div class="jms-logo-fallback">JMS</div>';
      const brand = side.querySelector('.brand') || side.firstElementChild;
      if(brand) brand.insertAdjacentElement('afterend', wrap);
      else side.insertBefore(wrap, side.firstChild);
    }
    imgs.forEach(img=>{
      img.onerror = function(){
        this.style.display='none';
        if(!document.getElementById('jmsLogoFallback')){
          const wrap = document.createElement('div');
          wrap.id = 'jmsLogoFallback';
          wrap.className = 'jms-logo-wrap';
          wrap.innerHTML = '<div class="jms-logo-fallback">JMS</div>';
          side.insertBefore(wrap, side.firstChild);
        }
      };
    });
  }

  function rebuildCleanCustomerActions(){
    ensure();
    document.querySelectorAll('.customer-card').forEach(card=>{
      const c = findCustomerFromCard(card);
      if(!c) return;

      card.querySelectorAll('.field-upgrade-actions,.customer-actions-clean,.customer-more-menu').forEach(x=>x.remove());

      Array.from(card.querySelectorAll('button')).forEach(b=>{
        const t=b.textContent.trim();
        if(['تمت الزيارة','طلب جديد','موعد','تحصيل','ملاحظه','ملاحظة','موقع العميل','رسالة تقييم','المزيد'].includes(t)){
          b.style.display='none';
        }
      });

      const id = c.id;
      const hasPhone = phoneOk(c);
      const actions = document.createElement('div');
      actions.className = 'customer-actions-clean';
      actions.innerHTML = `
        <button type="button" class="done" onclick="quickVisit('${id}')">تمت الزيارة</button>
        <button type="button" class="order" onclick="openQuoteForm('${id}')">طلب جديد</button>
        <button type="button" class="meeting" onclick="openCustomerMeeting ? openCustomerMeeting('${id}') : alert('سيتم إضافة المواعيد قريباً')">موعد</button>
        <button type="button" class="more" onclick="toggleCustomerMore('${id}')">المزيد</button>
      `;
      const more = document.createElement('div');
      more.id = 'more_' + id;
      more.className = 'customer-more-menu';
      more.innerHTML = `
        <button type="button" onclick="openCollection ? openCollection('${id}') : alert('سيتم إضافة التحصيل قريباً')">💰 التحصيل</button>
        <button type="button" onclick="openCustomerMap('${id}')">📍 موقع العميل</button>
        <button type="button" onclick="openCustomerNote ? openCustomerNote('${id}') : alert('سيتم إضافة الملاحظات قريباً')">📝 ملاحظة</button>
        ${hasPhone ? `<button type="button" onclick="sendSatisfactionWhatsApp('${id}')">💬 رسالة تقييم واتساب</button>` : `<button type="button" disabled>💬 لا يوجد رقم جوال</button>`}
        <button type="button" onclick="editCustomerPro ? editCustomerPro('${id}') : alert('تعديل العميل غير متاح في هذه النسخة')">✏️ تعديل العميل</button>
        <button type="button" onclick="openQuoteForm('${id}')">📄 إنشاء عرض سعر</button>
      `;
      card.appendChild(actions);
      card.appendChild(more);
    });
  }

  window.toggleCustomerMore = window.toggleCustomerMore || function(customerId){
    const el=document.getElementById('more_'+customerId);
    if(el) el.classList.toggle('open');
  };

  function runCleanup(){
    cleanupLanguageButtons();
    fixLogoFallback();
    rebuildCleanCustomerActions();
  }

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll === 'function') oldRenderAll();
    setTimeout(runCleanup, 200);
  };

  const oldRenderCustomers = window.renderCustomers;
  if(typeof oldRenderCustomers === 'function'){
    window.renderCustomers = function(){
      oldRenderCustomers.apply(this, arguments);
      setTimeout(runCleanup, 200);
    };
  }

  document.addEventListener('click', function(){ setTimeout(cleanupLanguageButtons, 50); }, true);
  setTimeout(runCleanup, 700);
})();



/* JMS AI PHASE 1: Arabic lock + working collection/note/edit + local AI assistant */
(function(){
  function ensure(){
    db.customers ||= [];
    db.reps ||= [];
    db.visits ||= [];
    db.quotes ||= [];
    db.orders ||= [];
    db.collections ||= [];
    db.notes ||= [];
  }
  function rid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function moneyFmt(n){ return Number(n||0).toLocaleString('ar-SA'); }
  function customerNameSafe(id){ return (typeof customerName === 'function') ? customerName(id) : ((db.customers.find(c=>c.id===id)||{}).name || '-'); }
  function repNameSafe(id){ return (typeof repName === 'function') ? repName(id) : ((db.reps.find(r=>r.id===id)||{}).name || '-'); }

  function lockArabic(){
    document.documentElement.lang='ar';
    document.documentElement.dir='rtl';
    document.body && (document.body.dir='rtl');
    document.querySelectorAll('#jmsSafeLang,#fieldLangBox,.jms-lang-switch,.safe-lang-mini,#jmsMainLangSwitch').forEach(x=>x.style.display='none');
  }
  window.setFieldLang = function(){ lockArabic(); };
  window.setJmsLanguage = function(){ lockArabic(); };
  window.applyFieldLang = lockArabic;
  window.applyJmsLanguage = lockArabic;

  window.openCollection = function(customerId){
    ensure();
    const c=db.customers.find(x=>x.id===customerId);
    if(!c) return alert('لم يتم العثور على العميل');
    modalBody.innerHTML = `<h2>تسجيل تحصيل</h2>
      <p><b>العميل:</b> ${c.name||'-'}</p>
      <div class="jms-mini-modal-field">
        <input id="colAmount" type="number" placeholder="المبلغ">
        <select id="colMethod">
          <option value="cash">نقدي</option>
          <option value="bank">تحويل بنكي</option>
          <option value="mada">مدى</option>
          <option value="other">أخرى</option>
        </select>
        <textarea id="colNotes" placeholder="ملاحظات التحصيل"></textarea>
      </div>
      <br><button class="primary" onclick="saveCollection('${customerId}')">حفظ التحصيل</button>`;
    modal.classList.remove('hidden');
  };
  window.saveCollection = function(customerId){
    const amount=Number(document.getElementById('colAmount')?.value||0);
    if(amount<=0) return alert('اكتب مبلغ التحصيل');
    db.collections.unshift({id:rid(),customer_id:customerId,amount,method:colMethod.value,notes:colNotes.value||'',date:tdy(),created_at:new Date().toISOString()});
    const c=db.customers.find(x=>x.id===customerId);
    if(c) c.debt_balance=Math.max(0, Number(c.debt_balance||0)-amount);
    if(typeof save==='function') save();
    closeModal();
    if(typeof renderAll==='function') renderAll();
    alert('تم حفظ التحصيل');
  };

  window.openCustomerNote = function(customerId){
    ensure();
    const c=db.customers.find(x=>x.id===customerId);
    if(!c) return alert('لم يتم العثور على العميل');
    modalBody.innerHTML = `<h2>ملاحظة للعميل</h2>
      <p><b>العميل:</b> ${c.name||'-'}</p>
      <div class="jms-mini-modal-field">
        <textarea id="noteText" placeholder="اكتب الملاحظة هنا"></textarea>
      </div>
      <br><button class="primary" onclick="saveCustomerNote('${customerId}')">حفظ الملاحظة</button>`;
    modal.classList.remove('hidden');
  };
  window.saveCustomerNote = function(customerId){
    const text=(document.getElementById('noteText')?.value||'').trim();
    if(!text) return alert('اكتب الملاحظة');
    db.notes.unshift({id:rid(),customer_id:customerId,text,date:tdy(),created_at:new Date().toISOString()});
    const c=db.customers.find(x=>x.id===customerId);
    if(c) c.notes=[c.notes,text].filter(Boolean).join(' | ');
    if(typeof save==='function') save();
    closeModal();
    if(typeof renderAll==='function') renderAll();
    alert('تم حفظ الملاحظة');
  };

  window.editCustomerPro = window.editCustomerPro || function(id){
    ensure();
    const c=db.customers.find(x=>x.id===id);
    if(!c) return alert('لم يتم العثور على العميل');
    modalBody.innerHTML = `<h2>تعديل العميل</h2>
      <div class="form-grid two">
        <label>اسم العميل<input id="ecName" value="${c.name||''}"></label>
        <label>الجوال<input id="ecPhone" value="${c.phone||''}"></label>
        <label>المدينة<input id="ecCity" value="${c.city||''}"></label>
        <label>الحي<input id="ecDistrict" value="${c.district||''}"></label>
        <label>الموقع / العنوان<input id="ecLocation" value="${c.location||''}"></label>
        <label>التصنيف<input id="ecCategory" value="${c.category||'عميل'}"></label>
        <label>المندوب<select id="ecRep">${db.reps.map(r=>`<option value="${r.id}" ${c.rep_id===r.id?'selected':''}>${r.name}</option>`).join('')}</select></label>
        <label>الرصيد<input id="ecDebt" type="number" value="${c.debt_balance||0}"></label>
      </div>
      <label>ملاحظات<input id="ecNotes" value="${c.notes||''}"></label>
      <br><button class="primary" onclick="saveCustomerPro('${id}')">حفظ التعديل</button>`;
    modal.classList.remove('hidden');
  };
  window.saveCustomerPro = window.saveCustomerPro || function(id){
    const c=db.customers.find(x=>x.id===id);
    if(!c) return;
    Object.assign(c,{
      name:ecName.value, phone:ecPhone.value, city:ecCity.value, district:ecDistrict.value,
      location:ecLocation.value, category:ecCategory.value, rep_id:ecRep.value,
      debt_balance:Number(ecDebt.value||0), notes:ecNotes.value
    });
    if(typeof save==='function') save();
    closeModal();
    if(typeof renderAll==='function') renderAll();
    alert('تم تعديل العميل');
  };

  function aiStats(){
    ensure();
    const today=tdy();
    const visitsToday=db.visits.filter(v=>String(v.date||v.checkin_at||'').startsWith(today));
    const collectionsToday=db.collections.filter(c=>String(c.date||c.created_at||'').startsWith(today));
    const totalCollection=collectionsToday.reduce((s,c)=>s+Number(c.amount||0),0);
    return {today,customers:db.customers.length,reps:db.reps.length,visitsToday:visitsToday.length,collectionsToday:collectionsToday.length,totalCollection};
  }
  function bestRep(){
    const map={};
    db.reps.forEach(r=>map[r.id]={name:r.name,visits:0,quotes:0,orders:0,collection:0});
    db.visits.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].visits++; });
    db.quotes.forEach(q=>{ if(map[q.rep_id]) map[q.rep_id].quotes++; });
    db.orders.forEach(o=>{ if(map[o.rep_id]) map[o.rep_id].orders++; });
    db.collections.forEach(c=>{
      const cust=db.customers.find(x=>x.id===c.customer_id);
      if(cust && map[cust.rep_id]) map[cust.rep_id].collection += Number(c.amount||0);
    });
    return Object.values(map).sort((a,b)=>(b.visits+b.quotes+b.orders)-(a.visits+a.quotes+a.orders));
  }
  function staleCustomers(days=30){
    const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-days);
    return db.customers.filter(c=>{
      const last=db.visits.filter(v=>v.customer_id===c.id).sort((a,b)=>String(b.date||b.checkin_at||'').localeCompare(String(a.date||a.checkin_at||'')))[0];
      if(!last) return true;
      const d=new Date(last.date||last.checkin_at);
      return d < cutoff;
    });
  }
  function answerAI(q){
    ensure();
    q=String(q||'').trim();
    const s=aiStats();
    if(!q) return 'اكتب سؤالك عن العملاء أو المناديب أو الزيارات.';
    if(q.includes('ملخص') || q.includes('اليوم') || q.includes('داشبورد')){
      return `ملخص اليوم ${s.today}:\n- العملاء: ${s.customers}\n- المناديب: ${s.reps}\n- زيارات اليوم: ${s.visitsToday}\n- تحصيلات اليوم: ${s.collectionsToday}\n- إجمالي التحصيل: ${moneyFmt(s.totalCollection)} ريال`;
    }
    if(q.includes('أفضل') || q.includes('افضل') || q.includes('مندوب')){
      const rows=bestRep().slice(0,5);
      return 'ترتيب المناديب:\n' + rows.map((r,i)=>`${i+1}. ${r.name}: زيارات ${r.visits} | عروض ${r.quotes} | طلبات ${r.orders} | تحصيل ${moneyFmt(r.collection)} ريال`).join('\n');
    }
    if(q.includes('لم تتم') || q.includes('مازار') || q.includes('30') || q.includes('ثلاثين')){
      const rows=staleCustomers(30).slice(0,20);
      return rows.length ? `عملاء لم تتم زيارتهم منذ 30 يوم أو لا توجد لهم زيارة:\n` + rows.map((c,i)=>`${i+1}. ${c.name} - ${c.city||'-'} - ${repNameSafe(c.rep_id)}`).join('\n') : 'كل العملاء لديهم زيارات حديثة حسب البيانات الحالية.';
    }
    if(q.includes('عميل') || q.includes('العملاء')){
      return `عدد العملاء الحالي: ${db.customers.length}\nأول 10 عملاء:\n` + db.customers.slice(0,10).map((c,i)=>`${i+1}. ${c.name} - ${c.phone||'لا يوجد جوال'} - ${repNameSafe(c.rep_id)}`).join('\n');
    }
    if(q.includes('تحصيل')){
      const total=(db.collections||[]).reduce((s,c)=>s+Number(c.amount||0),0);
      return `إجمالي التحصيلات المسجلة: ${moneyFmt(total)} ريال\nتحصيل اليوم: ${moneyFmt(s.totalCollection)} ريال`;
    }
    return `فهمت سؤالك، وهذه قراءة سريعة:\n- العملاء: ${s.customers}\n- زيارات اليوم: ${s.visitsToday}\n- تحصيل اليوم: ${moneyFmt(s.totalCollection)} ريال\n\nجرب تسأل: "من أفضل مندوب؟" أو "من العملاء الذين لم تتم زيارتهم منذ 30 يوم؟"`;
  }

  function addAI(){
    if(document.getElementById('jmsAiLaunch')) return;
    const btn=document.createElement('button');
    btn.id='jmsAiLaunch';
    btn.className='jms-ai-launch';
    btn.textContent='JMS AI';
    btn.onclick=()=>document.getElementById('jmsAiPanel').classList.toggle('open');

    const panel=document.createElement('div');
    panel.id='jmsAiPanel';
    panel.className='jms-ai-panel';
    panel.innerHTML=`
      <div class="jms-ai-head">
        <div><b>JMS AI</b><small>مساعد ذكي يحلل بيانات النظام</small></div>
        <button class="jms-ai-close" onclick="jmsAiPanel.classList.remove('open')">×</button>
      </div>
      <div id="jmsAiBody" class="jms-ai-body">
        <div class="jms-ai-msg bot">أهلاً، اسألني عن العملاء، المناديب، الزيارات، التحصيلات، أو الأداء.</div>
      </div>
      <div class="jms-ai-quick">
        <button onclick="askJmsAI('ملخص اليوم')">ملخص اليوم</button>
        <button onclick="askJmsAI('من أفضل مندوب؟')">أفضل مندوب</button>
        <button onclick="askJmsAI('عملاء لم تتم زيارتهم منذ 30 يوم')">عملاء 30 يوم</button>
        <button onclick="askJmsAI('كم التحصيل؟')">التحصيل</button>
      </div>
      <div class="jms-ai-input">
        <input id="jmsAiInput" placeholder="اكتب سؤالك هنا..." onkeydown="if(event.key==='Enter') askJmsAI(this.value)">
        <button onclick="askJmsAI(jmsAiInput.value)">إرسال</button>
      </div>`;
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }
  window.askJmsAI=function(q){
    const input=document.getElementById('jmsAiInput');
    q=String(q||input?.value||'').trim();
    if(!q) return;
    const body=document.getElementById('jmsAiBody');
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${q}</div>`);
    const a=answerAI(q);
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${a}</div>`);
    body.scrollTop=body.scrollHeight;
    if(input) input.value='';
  };

  const oldRenderAll=window.renderAll;
  window.renderAll=function(){
    if(typeof oldRenderAll==='function') oldRenderAll();
    setTimeout(()=>{lockArabic();addAI();},150);
  };
  const oldShowApp=window.showApp;
  if(typeof oldShowApp==='function'){
    window.showApp=function(){ oldShowApp(); setTimeout(()=>{lockArabic();addAI();},200); };
  }
  setInterval(lockArabic, 1200);
  setTimeout(()=>{lockArabic();addAI();},700);
})();



/* JMS AI PHASE 2 SMART ENGINE: deeper local AI + action suggestions */
(function(){
  function ensure(){
    db.customers ||= [];
    db.reps ||= [];
    db.visits ||= [];
    db.quotes ||= [];
    db.orders ||= [];
    db.collections ||= [];
    db.notes ||= [];
    db.aiReports ||= [];
  }
  function rid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()); }
  function tdy(){ return (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10); }
  function moneyFmt(n){ return Number(n||0).toLocaleString('ar-SA'); }
  function repNameSafe(id){ return (typeof repName === 'function') ? repName(id) : ((db.reps.find(r=>r.id===id)||{}).name || '-'); }
  function customerNameSafe(id){ return (typeof customerName === 'function') ? customerName(id) : ((db.customers.find(c=>c.id===id)||{}).name || '-'); }
  function dateOf(x){ return String(x.date || x.created_at || x.checkin_at || x.quote_date || x.order_date || '').slice(0,10); }
  function currentMonth(){ return new Date().toISOString().slice(0,7); }
  function includesAny(q, words){ return words.some(w => q.includes(w)); }

  function getRepStats(period='all'){
    const month=currentMonth();
    const stats={};
    db.reps.forEach(r=>stats[r.id]={id:r.id,name:r.name,customers:0,visits:0,quotes:0,orders:0,collections:0,collectionAmount:0});
    db.customers.forEach(c=>{ if(stats[c.rep_id]) stats[c.rep_id].customers++; });
    db.visits.forEach(v=>{
      if(period==='month' && !dateOf(v).startsWith(month)) return;
      if(stats[v.rep_id]) stats[v.rep_id].visits++;
    });
    db.quotes.forEach(q=>{
      if(period==='month' && !dateOf(q).startsWith(month)) return;
      if(stats[q.rep_id]) stats[q.rep_id].quotes++;
    });
    db.orders.forEach(o=>{
      if(period==='month' && !dateOf(o).startsWith(month)) return;
      if(stats[o.rep_id]) stats[o.rep_id].orders++;
    });
    db.collections.forEach(col=>{
      if(period==='month' && !dateOf(col).startsWith(month)) return;
      const c=db.customers.find(x=>x.id===col.customer_id);
      const repId=c?.rep_id || col.rep_id;
      if(stats[repId]){
        stats[repId].collections++;
        stats[repId].collectionAmount += Number(col.amount||0);
      }
    });
    return Object.values(stats);
  }

  function staleCustomers(days=30, repId='all'){
    const cutoff=new Date();
    cutoff.setDate(cutoff.getDate()-days);
    return db.customers.filter(c=>{
      if(repId !== 'all' && c.rep_id !== repId) return false;
      const last=db.visits.filter(v=>v.customer_id===c.id).sort((a,b)=>String(b.date||b.checkin_at||'').localeCompare(String(a.date||a.checkin_at||'')))[0];
      if(!last) return true;
      const d=new Date(last.date||last.checkin_at);
      return d < cutoff;
    });
  }

  function pendingQuotes(){
    return db.quotes.filter(q=>{
      const s=String(q.status||q.state||'').toLowerCase();
      return !s || s.includes('pending') || s.includes('انتظار') || s.includes('draft') || s.includes('اعتماد');
    });
  }

  function debts(){
    return db.customers.filter(c=>Number(c.debt_balance||0)>0).sort((a,b)=>Number(b.debt_balance||0)-Number(a.debt_balance||0));
  }

  function todaySummary(){
    const today=tdy();
    const visits=db.visits.filter(v=>dateOf(v)===today);
    const cols=db.collections.filter(c=>dateOf(c)===today);
    const quotes=db.quotes.filter(q=>dateOf(q)===today);
    const orders=db.orders.filter(o=>dateOf(o)===today);
    const amount=cols.reduce((s,c)=>s+Number(c.amount||0),0);
    return `ملخص اليوم ${today}:
- العملاء المسجلين: ${db.customers.length}
- المناديب: ${db.reps.length}
- زيارات اليوم: ${visits.length}
- عروض اليوم: ${quotes.length}
- طلبات اليوم: ${orders.length}
- تحصيل اليوم: ${moneyFmt(amount)} ريال`;
  }

  function salesAnalysis(){
    const reps=getRepStats('month').sort((a,b)=>(b.orders+b.quotes+b.visits)-(a.orders+a.quotes+a.visits));
    const totalCollections=reps.reduce((s,r)=>s+r.collectionAmount,0);
    const top=reps[0];
    let text=`تحليل المبيعات لهذا الشهر:
- إجمالي المناديب: ${reps.length}
- إجمالي التحصيل: ${moneyFmt(totalCollections)} ريال
- أفضل مندوب حاليًا: ${top?top.name:'لا يوجد'}${top?` (${top.visits} زيارات، ${top.quotes} عروض، ${top.orders} طلبات)`:''}

ترتيب المناديب:
`;
    text += reps.map((r,i)=>`${i+1}. ${r.name}: عملاء ${r.customers} | زيارات ${r.visits} | عروض ${r.quotes} | طلبات ${r.orders} | تحصيل ${moneyFmt(r.collectionAmount)} ريال`).join('\n');
    return text;
  }

  function riskAnalysis(){
    const stale=staleCustomers(30);
    const debt=debts();
    const pq=pendingQuotes();
    return `تنبيهات ذكية:
- عملاء لم تتم زيارتهم منذ 30 يوم: ${stale.length}
- عملاء عليهم مديونية: ${debt.length}
- عروض تحتاج متابعة/اعتماد: ${pq.length}

أعلى 10 عملاء مديونية:
${debt.slice(0,10).map((c,i)=>`${i+1}. ${c.name} - ${moneyFmt(c.debt_balance)} ريال - ${repNameSafe(c.rep_id)}`).join('\n') || 'لا توجد مديونيات مسجلة.'}`;
  }

  function customerLookup(q){
    const keyword=q.replace(/ابحث|بحث|عن|عميل|العميل|بيانات|معلومات/g,'').trim();
    if(!keyword) return null;
    const c=db.customers.find(c=>`${c.name||''} ${c.phone||''} ${c.city||''}`.includes(keyword));
    if(!c) return `لم أجد عميل مطابق لكلمة: ${keyword}`;
    const visits=db.visits.filter(v=>v.customer_id===c.id);
    const quotes=db.quotes.filter(x=>x.customer_id===c.id);
    const orders=db.orders.filter(x=>x.customer_id===c.id);
    const cols=db.collections.filter(x=>x.customer_id===c.id);
    const colAmount=cols.reduce((s,x)=>s+Number(x.amount||0),0);
    return `بطاقة العميل:
- الاسم: ${c.name}
- الجوال: ${c.phone||'لا يوجد'}
- المدينة: ${c.city||'-'}
- المندوب: ${repNameSafe(c.rep_id)}
- الزيارات: ${visits.length}
- العروض: ${quotes.length}
- الطلبات: ${orders.length}
- التحصيل: ${moneyFmt(colAmount)} ريال
- الرصيد: ${moneyFmt(c.debt_balance||0)} ريال
- ملاحظات: ${c.notes||'لا توجد'}`;
  }

  function suggestActions(q, answer){
    let buttons='';
    if(includesAny(q,['30','لم تتم','مازار','زيارة'])) {
      buttons += `<button class="blue" onclick="jmsAIShowStaleCustomers()">عرض العملاء</button>`;
    }
    if(includesAny(q,['مديونية','تحصيل','متأخر'])) {
      buttons += `<button class="orange" onclick="jmsAIShowDebts()">عرض المديونيات</button>`;
    }
    if(includesAny(q,['تقرير','pdf','ملخص'])) {
      buttons += `<button class="green" onclick="jmsAISaveReport()">حفظ التقرير</button>`;
    }
    buttons += `<button onclick="jmsAICopyLast()">نسخ الجواب</button>`;
    return buttons ? `<div class="jms-ai-action-row">${buttons}</div>` : '';
  }

  window.jmsAIShowStaleCustomers=function(){
    const rows=staleCustomers(30).slice(0,30);
    const text=rows.map((c,i)=>`${i+1}. ${c.name} - ${c.phone||'لا يوجد جوال'} - ${repNameSafe(c.rep_id)}`).join('\n') || 'لا يوجد عملاء متأخرين.';
    window.askJmsAI('قائمة العملاء غير المزورين 30 يوم');
    setTimeout(()=>window.__jmsLastAIAnswer = text,50);
  };

  window.jmsAIShowDebts=function(){
    const rows=debts().slice(0,30);
    const text=rows.map((c,i)=>`${i+1}. ${c.name} - ${moneyFmt(c.debt_balance)} ريال - ${repNameSafe(c.rep_id)}`).join('\n') || 'لا توجد مديونيات.';
    const body=document.getElementById('jmsAiBody');
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${text}</div>`);
    body.scrollTop=body.scrollHeight;
    window.__jmsLastAIAnswer=text;
  };

  window.jmsAISaveReport=function(){
    ensure();
    const text=window.__jmsLastAIAnswer || 'لا يوجد تقرير للحفظ';
    db.aiReports.unshift({id:rid(),date:tdy(),text,created_at:new Date().toISOString()});
    if(typeof save==='function') save();
    alert('تم حفظ تقرير AI داخل بيانات النظام');
  };

  window.jmsAICopyLast=function(){
    const text=window.__jmsLastAIAnswer || '';
    if(!text) return alert('لا يوجد جواب لنسخه');
    navigator.clipboard?.writeText(text);
    alert('تم نسخ الجواب');
  };

  function answerAI2(q){
    ensure();
    q=String(q||'').trim();
    let ans='';
    if(!q) ans='اكتب سؤالك عن العملاء أو المناديب أو الزيارات أو التحصيل.';
    else if(includesAny(q,['ملخص اليوم','اليوم','داشبورد'])) ans=todaySummary();
    else if(includesAny(q,['تحليل','مبيعات','الأداء','اداء'])) ans=salesAnalysis();
    else if(includesAny(q,['أفضل مندوب','افضل مندوب','ترتيب المناديب','مندوب'])) ans=salesAnalysis();
    else if(includesAny(q,['خطر','تنبيه','متأخر','مديونية','مديونيات'])) ans=riskAnalysis();
    else if(includesAny(q,['لم تتم','مازار','لم يزر','30 يوم','ثلاثين'])) {
      const rows=staleCustomers(30).slice(0,20);
      ans=rows.length ? `العملاء الذين لم تتم زيارتهم منذ 30 يوم أو لا توجد لهم زيارة:\n${rows.map((c,i)=>`${i+1}. ${c.name} - ${c.city||'-'} - ${repNameSafe(c.rep_id)} - ${c.phone||'لا يوجد جوال'}`).join('\n')}` : 'لا يوجد عملاء متأخرين عن الزيارة حسب البيانات الحالية.';
    }
    else if(includesAny(q,['عرض','عروض','اعتماد'])) {
      const rows=pendingQuotes().slice(0,20);
      ans=`عروض الأسعار:
- إجمالي العروض: ${db.quotes.length}
- عروض تحتاج متابعة/اعتماد: ${rows.length}

${rows.map((x,i)=>`${i+1}. ${x.quote_no||x.number||x.id} - ${customerNameSafe(x.customer_id)} - ${repNameSafe(x.rep_id)} - ${x.status||'بدون حالة'}`).join('\n') || 'لا توجد عروض معلقة.'}`;
    }
    else if(includesAny(q,['بحث','ابحث','عميل','بيانات العميل','معلومات العميل'])) ans=customerLookup(q) || `عدد العملاء: ${db.customers.length}`;
    else if(includesAny(q,['تحصيل','التحصيل'])) {
      const total=db.collections.reduce((s,c)=>s+Number(c.amount||0),0);
      const todayAmt=db.collections.filter(c=>dateOf(c)===tdy()).reduce((s,c)=>s+Number(c.amount||0),0);
      ans=`التحصيلات:
- إجمالي التحصيلات: ${moneyFmt(total)} ريال
- تحصيل اليوم: ${moneyFmt(todayAmt)} ريال
- عدد عمليات التحصيل: ${db.collections.length}`;
    }
    else if(includesAny(q,['رسالة','واتساب'])) {
      ans=`أقدر أساعدك في تجهيز رسائل واتساب، مثل:
- رسالة متابعة للعميل.
- رسالة تقييم بعد الزيارة.
- رسالة تذكير بالمديونية.
اكتب: "جهز رسالة للعميل [اسم العميل]"`;
    }
    else ans=`فهمت سؤالك. هذه قراءة سريعة:
${todaySummary()}

أسئلة مفيدة:
- من أفضل مندوب؟
- من العملاء الذين لم تتم زيارتهم منذ 30 يوم؟
- أعطني تحليل المبيعات
- ما هي المديونيات؟`;

    window.__jmsLastAIAnswer=ans;
    return ans;
  }

  window.answerJmsAISmart = answerAI2;

  // Override askJmsAI but keep same UI
  window.askJmsAI=function(q){
    const input=document.getElementById('jmsAiInput');
    q=String(q||input?.value||'').trim();
    if(!q) return;
    const body=document.getElementById('jmsAiBody');
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${q}</div>`);
    const a=answerAI2(q);
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${a}${suggestActions(q,a)}</div>`);
    body.scrollTop=body.scrollHeight;
    if(input) input.value='';
  };

  function upgradeQuickButtons(){
    const quick=document.querySelector('.jms-ai-quick');
    if(!quick || quick.dataset.phase2==='1') return;
    quick.dataset.phase2='1';
    quick.innerHTML=`
      <button onclick="askJmsAI('ملخص اليوم')">ملخص اليوم</button>
      <button onclick="askJmsAI('تحليل المبيعات')">تحليل المبيعات</button>
      <button onclick="askJmsAI('من أفضل مندوب؟')">أفضل مندوب</button>
      <button onclick="askJmsAI('عملاء لم تتم زيارتهم منذ 30 يوم')">عملاء 30 يوم</button>
      <button onclick="askJmsAI('ما هي المديونيات؟')">المديونيات</button>
      <button onclick="askJmsAI('عروض الأسعار المعلقة')">العروض المعلقة</button>`;
  }

  const oldRenderAll=window.renderAll;
  window.renderAll=function(){
    if(typeof oldRenderAll==='function') oldRenderAll();
    setTimeout(upgradeQuickButtons,250);
  };
  setTimeout(upgradeQuickButtons,1000);
})();



/* ARABIC STABLE LOCK: force full Arabic UI */
(function(){
  const AR = {
    'Dashboard':'لوحة التحكم',
    'Customers':'العملاء',
    'Representatives':'المناديب',
    'Smart Visits':'الزيارات الذكية',
    'Production Orders':'طلبات التصنيع',
    'Quotations':'عروض الأسعار',
    'Logout':'تسجيل الخروج',
    'Create Quotation':'إنشاء عرض سعر',
    'Start Work':'بدء الدوام',
    'End Work':'إنهاء الدوام',
    'Update Location':'تحديث موقعي',
    'I am in Visit':'أنا في زيارة',
    'Current User':'المستخدم الحالي',
    'System Admin':'مدير النظام',
    'Sales Manager':'مدير المبيعات',
    'Representative':'مندوب',
    'Search by customer name, mobile or city':'ابحث باسم العميل أو الجوال أو المدينة',
    'Customer':'العميل',
    'Product':'المنتج',
    'Thickness':'السماكة',
    'Material':'الخامة',
    'Quantity':'الكمية',
    'Price':'السعر',
    'Total':'الإجمالي',
    'Approved':'معتمد',
    'Pending Approval':'بانتظار الاعتماد',
    'All Quotes':'كل العروض',
    'Status':'الحالة',
    'Rep':'المندوب',
    'Search':'بحث',
    'Add Customer':'إضافة عميل',
    'Import Customers':'استيراد العملاء'
  };

  function forceArabic(){
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    if(document.body) document.body.dir = 'rtl';

    // remove or hide all language switchers
    document.querySelectorAll('#jmsSafeLang,#fieldLangBox,#jmsMainLangSwitch,.jms-lang-switch,.safe-lang-mini').forEach(x=>x.remove());

    // translate simple text nodes
    const els = document.querySelectorAll('button,a,span,b,small,label,h1,h2,h3,p,th,td,option');
    els.forEach(el=>{
      if(el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE){
        const txt = el.textContent.trim();
        if(AR[txt]) el.textContent = el.textContent.replace(txt, AR[txt]);
      }
    });

    // translate placeholders
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{
      const p = el.getAttribute('placeholder') || '';
      if(AR[p]) el.setAttribute('placeholder', AR[p]);
      if(p.includes('customer') || p.includes('mobile') || p.includes('city')){
        el.setAttribute('placeholder','ابحث باسم العميل أو الجوال أو المدينة');
      }
    });

    // hard fixes for common page titles/buttons
    document.querySelectorAll('h1,h2').forEach(el=>{
      const t=el.textContent.trim();
      if(t === 'Customers') el.textContent='العملاء';
      if(t === 'Dashboard') el.textContent='لوحة التحكم';
      if(t === 'Quotations') el.textContent='عروض الأسعار';
    });

    document.querySelectorAll('button').forEach(btn=>{
      const t=btn.textContent.trim();
      if(t === 'Start Work') btn.textContent='بدء الدوام';
      if(t === 'End Work') btn.textContent='إنهاء الدوام';
      if(t === 'Create Quotation') btn.textContent='إنشاء عرض سعر';
      if(t === 'Logout') btn.textContent='تسجيل الخروج';
    });
  }

  // Disable previous language functions so they never switch to English again
  window.setFieldLang = function(){ forceArabic(); };
  window.setJmsLanguage = function(){ forceArabic(); };
  window.applyFieldLang = forceArabic;
  window.applyJmsLanguage = forceArabic;

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll === 'function') oldRenderAll();
    setTimeout(forceArabic,150);
  };

  const oldShowApp = window.showApp;
  if(typeof oldShowApp === 'function'){
    window.showApp = function(){
      oldShowApp();
      setTimeout(forceArabic,150);
    };
  }

  document.addEventListener('DOMContentLoaded', forceArabic);
  document.addEventListener('click', ()=>setTimeout(forceArabic,50), true);
  setTimeout(forceArabic,300);
  setInterval(forceArabic,1500);
})();



/* AI LOGIN SECURITY FIX: AI appears only after login */
(function(){
  function isLoggedIn(){
    return !!(window.currentUser && (currentUser.id || currentUser.email || currentUser.name));
  }

  function secureAIVisibility(){
    const ok = isLoggedIn();
    document.body?.classList.toggle('jms-logged-in', ok);

    const btn = document.getElementById('jmsAiLaunch');
    const panel = document.getElementById('jmsAiPanel');

    if(!ok){
      if(btn) btn.style.display='none';
      if(panel){
        panel.classList.remove('open');
        panel.style.display='none';
      }
      return;
    }

    if(btn) btn.style.display='';
    if(panel) panel.style.display='';
  }

  // Prevent AI from being added before login
  const oldAddAI = window.addAI;
  if(typeof oldAddAI === 'function'){
    window.addAI = function(){
      if(!isLoggedIn()) return;
      return oldAddAI.apply(this, arguments);
    };
  }

  // If addAI was local in previous module, remove visible AI until login.
  const oldShowApp = window.showApp;
  if(typeof oldShowApp === 'function'){
    window.showApp = function(){
      oldShowApp.apply(this, arguments);
      setTimeout(secureAIVisibility, 100);
      setTimeout(secureAIVisibility, 500);
    };
  }

  const oldRenderAll = window.renderAll;
  if(typeof oldRenderAll === 'function'){
    window.renderAll = function(){
      oldRenderAll.apply(this, arguments);
      setTimeout(secureAIVisibility, 100);
    };
  }

  // Patch logout functions if present
  ['logout','signOut','doLogout'].forEach(fn=>{
    if(typeof window[fn] === 'function'){
      const old = window[fn];
      window[fn] = function(){
        const r = old.apply(this, arguments);
        setTimeout(secureAIVisibility, 50);
        return r;
      };
    }
  });

  // Hard guard for AI button click
  document.addEventListener('click', function(e){
    const aiTarget = e.target?.closest?.('#jmsAiLaunch,#jmsAiPanel');
    if(aiTarget && !isLoggedIn()){
      e.preventDefault();
      e.stopPropagation();
      secureAIVisibility();
      return false;
    }
  }, true);

  setTimeout(secureAIVisibility, 100);
  setTimeout(secureAIVisibility, 700);
  setInterval(secureAIVisibility, 1000);
})();



/* AI VISIBILITY FIX: show AI inside app, hide only on login */
(function(){
  function hasLoggedUser(){
    return !!(window.currentUser && (currentUser.id || currentUser.email || currentUser.name || currentUser.role));
  }
  function isLoginVisible(){
    const login = document.getElementById('login') || document.querySelector('.login') || document.querySelector('#loginScreen');
    if(!login) return !hasLoggedUser();
    const style = getComputedStyle(login);
    return style.display !== 'none' && style.visibility !== 'hidden' && !login.classList.contains('hidden');
  }
  function appIsOpen(){
    return hasLoggedUser() && !isLoginVisible();
  }
  function ensureAIExists(){
    if(document.getElementById('jmsAiLaunch') && document.getElementById('jmsAiPanel')) return;
    if(!appIsOpen()) return;

    const btn=document.createElement('button');
    btn.id='jmsAiLaunch';
    btn.className='jms-ai-launch';
    btn.textContent='JMS AI';
    btn.onclick=function(){
      const p=document.getElementById('jmsAiPanel');
      if(p) p.classList.toggle('open');
    };

    const panel=document.createElement('div');
    panel.id='jmsAiPanel';
    panel.className='jms-ai-panel';
    panel.innerHTML=`
      <div class="jms-ai-head">
        <div><b>JMS AI</b><small>مساعد ذكي يحلل بيانات النظام</small></div>
        <button class="jms-ai-close" onclick="jmsAiPanel.classList.remove('open')">×</button>
      </div>
      <div id="jmsAiBody" class="jms-ai-body">
        <div class="jms-ai-msg bot">أهلاً، اسألني عن العملاء، المناديب، الزيارات، التحصيلات، أو الأداء.</div>
      </div>
      <div class="jms-ai-quick">
        <button onclick="askJmsAI('ملخص اليوم')">ملخص اليوم</button>
        <button onclick="askJmsAI('تحليل المبيعات')">تحليل المبيعات</button>
        <button onclick="askJmsAI('من أفضل مندوب؟')">أفضل مندوب</button>
        <button onclick="askJmsAI('عملاء لم تتم زيارتهم منذ 30 يوم')">عملاء 30 يوم</button>
        <button onclick="askJmsAI('ما هي المديونيات؟')">المديونيات</button>
      </div>
      <div class="jms-ai-input">
        <input id="jmsAiInput" placeholder="اكتب سؤالك هنا..." onkeydown="if(event.key==='Enter') askJmsAI(this.value)">
        <button onclick="askJmsAI(jmsAiInput.value)">إرسال</button>
      </div>`;
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  function fallbackAnswer(q){
    const d=window.db||{};
    d.customers ||= []; d.reps ||= []; d.visits ||= []; d.quotes ||= []; d.orders ||= []; d.collections ||= [];
    const today = new Date().toISOString().slice(0,10);
    const money = n => Number(n||0).toLocaleString('ar-SA');
    const repName = id => (d.reps.find(r=>r.id===id)||{}).name || '-';
    const dateOf = x => String(x.date||x.created_at||x.checkin_at||'').slice(0,10);
    q=String(q||'');
    if(q.includes('أفضل') || q.includes('افضل') || q.includes('مندوب')){
      const map={};
      d.reps.forEach(r=>map[r.id]={name:r.name,visits:0,quotes:0,orders:0});
      d.visits.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].visits++; });
      d.quotes.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].quotes++; });
      d.orders.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].orders++; });
      return 'أفضل المناديب:\n' + Object.values(map).sort((a,b)=>(b.visits+b.quotes+b.orders)-(a.visits+a.quotes+a.orders)).map((r,i)=>`${i+1}. ${r.name}: زيارات ${r.visits} | عروض ${r.quotes} | طلبات ${r.orders}`).join('\n');
    }
    if(q.includes('30') || q.includes('لم تتم') || q.includes('مازار')){
      const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-30);
      const rows=d.customers.filter(c=>{
        const last=d.visits.filter(v=>v.customer_id===c.id).sort((a,b)=>String(b.date||b.checkin_at||'').localeCompare(String(a.date||a.checkin_at||'')))[0];
        if(!last) return true;
        return new Date(last.date||last.checkin_at) < cutoff;
      }).slice(0,20);
      return rows.length ? 'عملاء لم تتم زيارتهم منذ 30 يوم:\n'+rows.map((c,i)=>`${i+1}. ${c.name} - ${repName(c.rep_id)}`).join('\n') : 'لا يوجد عملاء متأخرين عن الزيارة.';
    }
    if(q.includes('تحصيل') || q.includes('مديونية')){
      const total=d.collections.reduce((s,c)=>s+Number(c.amount||0),0);
      const todayAmount=d.collections.filter(c=>dateOf(c)===today).reduce((s,c)=>s+Number(c.amount||0),0);
      return `التحصيلات:\n- إجمالي التحصيل: ${money(total)} ريال\n- تحصيل اليوم: ${money(todayAmount)} ريال`;
    }
    return `ملخص اليوم:\n- العملاء: ${d.customers.length}\n- المناديب: ${d.reps.length}\n- الزيارات: ${d.visits.length}\n- العروض: ${d.quotes.length}\n- الطلبات: ${d.orders.length}`;
  }

  if(typeof window.askJmsAI !== 'function'){
    window.askJmsAI=function(q){
      const input=document.getElementById('jmsAiInput');
      q=String(q||input?.value||'').trim();
      if(!q) return;
      const body=document.getElementById('jmsAiBody');
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${q}</div>`);
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${fallbackAnswer(q)}</div>`);
      body.scrollTop=body.scrollHeight;
      if(input) input.value='';
    };
  }

  function updateAIVisibility(){
    const login = isLoginVisible();
    const app = appIsOpen();
    document.body?.classList.toggle('jms-login-screen', login);
    document.body?.classList.toggle('jms-app-screen', app);

    ensureAIExists();

    const btn=document.getElementById('jmsAiLaunch');
    const panel=document.getElementById('jmsAiPanel');

    if(login || !app){
      if(btn) btn.style.display='none';
      if(panel){ panel.classList.remove('open'); panel.style.display='none'; }
    }else{
      if(btn) btn.style.display='block';
      if(panel) panel.style.display='';
    }
  }

  const oldShowApp=window.showApp;
  if(typeof oldShowApp==='function'){
    window.showApp=function(){
      oldShowApp.apply(this,arguments);
      setTimeout(updateAIVisibility,100);
      setTimeout(updateAIVisibility,700);
    };
  }

  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function'){
    window.renderAll=function(){
      oldRenderAll.apply(this,arguments);
      setTimeout(updateAIVisibility,150);
    };
  }

  ['logout','signOut','doLogout'].forEach(fn=>{
    if(typeof window[fn]==='function'){
      const old=window[fn];
      window[fn]=function(){
        const r=old.apply(this,arguments);
        setTimeout(updateAIVisibility,100);
        return r;
      };
    }
  });

  setTimeout(updateAIVisibility,200);
  setTimeout(updateAIVisibility,1000);
  setInterval(updateAIVisibility,1500);
})();



/* AI FORCE SHOW FIX: add jms-logged-in and force AI after app loads */
(function(){
  function hasUser(){
    return !!(window.currentUser && (currentUser.id || currentUser.email || currentUser.name || currentUser.role));
  }
  function loginVisible(){
    const login = document.getElementById('login') || document.querySelector('#loginScreen') || document.querySelector('.login-card')?.closest('section') || document.querySelector('.login');
    if(!login) return !hasUser();
    const st=getComputedStyle(login);
    return st.display !== 'none' && st.visibility !== 'hidden' && !login.classList.contains('hidden');
  }
  function inApp(){
    return hasUser() && !loginVisible();
  }

  function createAIIfMissing(){
    if(!inApp()) return;
    if(document.getElementById('jmsAiLaunch') && document.getElementById('jmsAiPanel')) return;

    const btn=document.createElement('button');
    btn.id='jmsAiLaunch';
    btn.className='jms-ai-launch';
    btn.textContent='JMS AI';
    btn.onclick=function(){
      const p=document.getElementById('jmsAiPanel');
      if(p) p.classList.toggle('open');
    };

    const panel=document.createElement('div');
    panel.id='jmsAiPanel';
    panel.className='jms-ai-panel';
    panel.innerHTML=`
      <div class="jms-ai-head">
        <div><b>JMS AI</b><small>مساعد ذكي يحلل بيانات النظام</small></div>
        <button class="jms-ai-close" onclick="jmsAiPanel.classList.remove('open')">×</button>
      </div>
      <div id="jmsAiBody" class="jms-ai-body">
        <div class="jms-ai-msg bot">أهلاً، اسألني عن العملاء، المناديب، الزيارات، التحصيلات، أو الأداء.</div>
      </div>
      <div class="jms-ai-quick">
        <button onclick="askJmsAI('ملخص اليوم')">ملخص اليوم</button>
        <button onclick="askJmsAI('تحليل المبيعات')">تحليل المبيعات</button>
        <button onclick="askJmsAI('من أفضل مندوب؟')">أفضل مندوب</button>
        <button onclick="askJmsAI('عملاء لم تتم زيارتهم منذ 30 يوم')">عملاء 30 يوم</button>
      </div>
      <div class="jms-ai-input">
        <input id="jmsAiInput" placeholder="اكتب سؤالك هنا..." onkeydown="if(event.key==='Enter') askJmsAI(this.value)">
        <button onclick="askJmsAI(jmsAiInput.value)">إرسال</button>
      </div>`;
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  function fallbackAnswer(q){
    const d=window.db||{};
    d.customers ||= []; d.reps ||= []; d.visits ||= []; d.quotes ||= []; d.orders ||= []; d.collections ||= [];
    const money=n=>Number(n||0).toLocaleString('ar-SA');
    q=String(q||'');
    if(q.includes('مندوب')){
      const map={};
      d.reps.forEach(r=>map[r.id]={name:r.name,visits:0,quotes:0,orders:0});
      d.visits.forEach(v=>{if(map[v.rep_id])map[v.rep_id].visits++});
      d.quotes.forEach(v=>{if(map[v.rep_id])map[v.rep_id].quotes++});
      d.orders.forEach(v=>{if(map[v.rep_id])map[v.rep_id].orders++});
      return Object.values(map).sort((a,b)=>(b.visits+b.quotes+b.orders)-(a.visits+a.quotes+a.orders)).map((r,i)=>`${i+1}. ${r.name}: زيارات ${r.visits} | عروض ${r.quotes} | طلبات ${r.orders}`).join('\n') || 'لا توجد بيانات مناديب.';
    }
    if(q.includes('تحصيل')){
      const total=d.collections.reduce((s,c)=>s+Number(c.amount||0),0);
      return `إجمالي التحصيل: ${money(total)} ريال`;
    }
    return `ملخص النظام:\n- العملاء: ${d.customers.length}\n- المناديب: ${d.reps.length}\n- الزيارات: ${d.visits.length}\n- العروض: ${d.quotes.length}\n- الطلبات: ${d.orders.length}`;
  }

  if(typeof window.askJmsAI !== 'function'){
    window.askJmsAI=function(q){
      const input=document.getElementById('jmsAiInput');
      q=String(q||input?.value||'').trim();
      if(!q) return;
      const body=document.getElementById('jmsAiBody');
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${q}</div>`);
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${fallbackAnswer(q)}</div>`);
      body.scrollTop=body.scrollHeight;
      if(input) input.value='';
    };
  }

  function forceAI(){
    const ok=inApp();
    document.body.classList.toggle('jms-logged-in', ok);
    document.body.classList.toggle('jms-app-screen', ok);
    document.body.classList.toggle('jms-login-screen', !ok);

    if(ok) createAIIfMissing();

    const btn=document.getElementById('jmsAiLaunch');
    const panel=document.getElementById('jmsAiPanel');

    if(ok){
      if(btn){
        btn.style.display='block';
        btn.style.visibility='visible';
        btn.style.opacity='1';
      }
      if(panel){
        panel.style.visibility='visible';
        panel.style.opacity='1';
        if(!panel.classList.contains('open')) panel.style.display='';
      }
    }else{
      if(btn) btn.style.display='none';
      if(panel){
        panel.classList.remove('open');
        panel.style.display='none';
      }
    }
  }

  const oldShowApp=window.showApp;
  if(typeof oldShowApp==='function'){
    window.showApp=function(){
      oldShowApp.apply(this,arguments);
      setTimeout(forceAI,100);
      setTimeout(forceAI,500);
      setTimeout(forceAI,1200);
    };
  }

  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function'){
    window.renderAll=function(){
      oldRenderAll.apply(this,arguments);
      setTimeout(forceAI,100);
      setTimeout(forceAI,500);
    };
  }

  ['logout','signOut','doLogout'].forEach(fn=>{
    if(typeof window[fn]==='function'){
      const old=window[fn];
      window[fn]=function(){
        const r=old.apply(this,arguments);
        setTimeout(forceAI,100);
        return r;
      };
    }
  });

  setTimeout(forceAI,100);
  setTimeout(forceAI,700);
  setTimeout(forceAI,1500);
  setInterval(forceAI,1000);
})();



/* AI CURRENTUSER FIX: use real lexical currentUser, not window.currentUser */
(function(){
  function realUser(){
    try{
      if(typeof currentUser !== 'undefined' && currentUser && (currentUser.id || currentUser.email || currentUser.name || currentUser.role)){
        return currentUser;
      }
    }catch(e){}
    try{
      const u = JSON.parse(sessionStorage.getItem('jms_current_user') || 'null');
      if(u && (u.id || u.email || u.name || u.role)) return u;
    }catch(e){}
    return null;
  }

  function loginIsHidden(){
    const lv = document.getElementById('loginView');
    if(!lv) return !!realUser();
    return lv.classList.contains('hidden') || getComputedStyle(lv).display === 'none';
  }

  function appIsVisible(){
    const av = document.getElementById('appView');
    if(!av) return !!realUser();
    return !av.classList.contains('hidden') && getComputedStyle(av).display !== 'none';
  }

  function shouldShowAI(){
    return !!realUser() && loginIsHidden() && appIsVisible();
  }

  function fallbackAnswer(q){
    const d = (typeof db !== 'undefined') ? db : {};
    d.customers ||= []; d.reps ||= []; d.visits ||= []; d.quotes ||= []; d.orders ||= []; d.collections ||= [];
    const money=n=>Number(n||0).toLocaleString('ar-SA');
    q=String(q||'');
    if(q.includes('مندوب')){
      const map={};
      d.reps.forEach(r=>map[r.id]={name:r.name,visits:0,quotes:0,orders:0});
      d.visits.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].visits++; });
      d.quotes.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].quotes++; });
      d.orders.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].orders++; });
      return Object.values(map).sort((a,b)=>(b.visits+b.quotes+b.orders)-(a.visits+a.quotes+a.orders)).map((r,i)=>`${i+1}. ${r.name}: زيارات ${r.visits} | عروض ${r.quotes} | طلبات ${r.orders}`).join('\n') || 'لا توجد بيانات مناديب.';
    }
    if(q.includes('تحصيل')){
      const total=d.collections.reduce((s,c)=>s+Number(c.amount||0),0);
      return `إجمالي التحصيل: ${money(total)} ريال`;
    }
    if(q.includes('30') || q.includes('زيارة')){
      return `عدد الزيارات المسجلة: ${d.visits.length}\nعدد العملاء: ${d.customers.length}`;
    }
    return `ملخص النظام:\n- العملاء: ${d.customers.length}\n- المناديب: ${d.reps.length}\n- الزيارات: ${d.visits.length}\n- العروض: ${d.quotes.length}\n- الطلبات: ${d.orders.length}`;
  }

  function ensureAsk(){
    if(typeof window.askJmsAI === 'function') return;
    window.askJmsAI=function(q){
      const input=document.getElementById('jmsAiInput');
      q=String(q||input?.value||'').trim();
      if(!q) return;
      const body=document.getElementById('jmsAiBody');
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${q}</div>`);
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${fallbackAnswer(q)}</div>`);
      body.scrollTop=body.scrollHeight;
      if(input) input.value='';
    };
  }

  function createAI(){
    if(document.getElementById('jmsAiLaunch') && document.getElementById('jmsAiPanel')) return;
    const btn=document.createElement('button');
    btn.id='jmsAiLaunch';
    btn.className='jms-ai-launch';
    btn.textContent='JMS AI';
    btn.onclick=function(){
      const p=document.getElementById('jmsAiPanel');
      if(p) p.classList.toggle('open');
    };

    const panel=document.createElement('div');
    panel.id='jmsAiPanel';
    panel.className='jms-ai-panel';
    panel.innerHTML=`
      <div class="jms-ai-head">
        <div><b>JMS AI</b><small>مساعد ذكي يحلل بيانات النظام</small></div>
        <button class="jms-ai-close" onclick="jmsAiPanel.classList.remove('open')">×</button>
      </div>
      <div id="jmsAiBody" class="jms-ai-body">
        <div class="jms-ai-msg bot">أهلاً، اسألني عن العملاء، المناديب، الزيارات، التحصيلات، أو الأداء.</div>
      </div>
      <div class="jms-ai-quick">
        <button onclick="askJmsAI('ملخص اليوم')">ملخص اليوم</button>
        <button onclick="askJmsAI('تحليل المبيعات')">تحليل المبيعات</button>
        <button onclick="askJmsAI('من أفضل مندوب؟')">أفضل مندوب</button>
        <button onclick="askJmsAI('عملاء لم تتم زيارتهم منذ 30 يوم')">عملاء 30 يوم</button>
      </div>
      <div class="jms-ai-input">
        <input id="jmsAiInput" placeholder="اكتب سؤالك هنا..." onkeydown="if(event.key==='Enter') askJmsAI(this.value)">
        <button onclick="askJmsAI(jmsAiInput.value)">إرسال</button>
      </div>`;
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  function apply(){
    const ok=shouldShowAI();
    document.body.classList.toggle('jms-logged-in', ok);
    document.body.classList.toggle('jms-login-screen', !ok);

    if(ok){
      ensureAsk();
      createAI();
    }

    const btn=document.getElementById('jmsAiLaunch');
    const panel=document.getElementById('jmsAiPanel');

    if(ok){
      if(btn){
        btn.style.display='block';
        btn.style.visibility='visible';
        btn.style.opacity='1';
      }
      if(panel){
        panel.style.visibility='visible';
        panel.style.opacity='1';
        if(!panel.classList.contains('open')) panel.style.display='';
      }
    }else{
      if(btn) btn.style.display='none';
      if(panel){
        panel.classList.remove('open');
        panel.style.display='none';
      }
    }
  }

  const oldShowApp = (typeof showApp === 'function') ? showApp : null;
  if(oldShowApp && !window.__aiCurrentUserShowAppPatched){
    window.__aiCurrentUserShowAppPatched = true;
    showApp = function(){
      oldShowApp.apply(this, arguments);
      setTimeout(apply,100);
      setTimeout(apply,500);
      setTimeout(apply,1000);
    };
  }

  const oldRenderAll = (typeof renderAll === 'function') ? renderAll : null;
  if(oldRenderAll && !window.__aiCurrentUserRenderPatched){
    window.__aiCurrentUserRenderPatched = true;
    renderAll = function(){
      oldRenderAll.apply(this, arguments);
      setTimeout(apply,150);
    };
  }

  setTimeout(apply,100);
  setTimeout(apply,500);
  setTimeout(apply,1200);
  setInterval(apply,1000);
})();



/* AI CLICK FIX: force panel open on click */
(function(){
  function ensureAsk(){
    if(typeof window.askJmsAI === 'function') return;
    window.askJmsAI=function(q){
      const input=document.getElementById('jmsAiInput');
      q=String(q||input?.value||'').trim();
      if(!q) return;
      const d=(typeof db!=='undefined')?db:{customers:[],reps:[],visits:[],quotes:[],orders:[],collections:[]};
      const body=document.getElementById('jmsAiBody');
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${q}</div>`);
      body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">ملخص النظام:\n- العملاء: ${d.customers?.length||0}\n- المناديب: ${d.reps?.length||0}\n- الزيارات: ${d.visits?.length||0}\n- العروض: ${d.quotes?.length||0}\n- الطلبات: ${d.orders?.length||0}</div>`);
      body.scrollTop=body.scrollHeight;
      if(input) input.value='';
    };
  }

  function ensurePanel(){
    let btn=document.getElementById('jmsAiLaunch');
    let panel=document.getElementById('jmsAiPanel');
    if(!btn) return;

    if(!panel){
      panel=document.createElement('div');
      panel.id='jmsAiPanel';
      panel.className='jms-ai-panel';
      panel.innerHTML=`
        <div class="jms-ai-head">
          <div><b>JMS AI</b><small>مساعد ذكي يحلل بيانات النظام</small></div>
          <button class="jms-ai-close" type="button">×</button>
        </div>
        <div id="jmsAiBody" class="jms-ai-body">
          <div class="jms-ai-msg bot">أهلاً، اسألني عن العملاء، المناديب، الزيارات، التحصيلات، أو الأداء.</div>
        </div>
        <div class="jms-ai-quick">
          <button type="button" onclick="askJmsAI('ملخص اليوم')">ملخص اليوم</button>
          <button type="button" onclick="askJmsAI('تحليل المبيعات')">تحليل المبيعات</button>
          <button type="button" onclick="askJmsAI('من أفضل مندوب؟')">أفضل مندوب</button>
          <button type="button" onclick="askJmsAI('عملاء لم تتم زيارتهم منذ 30 يوم')">عملاء 30 يوم</button>
        </div>
        <div class="jms-ai-input">
          <input id="jmsAiInput" placeholder="اكتب سؤالك هنا...">
          <button type="button" id="jmsAiSendBtn">إرسال</button>
        </div>`;
      document.body.appendChild(panel);
    }

    ensureAsk();

    btn.onclick=null;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      const p=document.getElementById('jmsAiPanel');
      if(!p) return;
      p.classList.add('open');
      p.style.display='block';
      p.style.visibility='visible';
      p.style.opacity='1';
      const input=document.getElementById('jmsAiInput');
      setTimeout(()=>input && input.focus(),80);
    }, true);

    panel.querySelector('.jms-ai-close')?.addEventListener('click', function(e){
      e.preventDefault();
      panel.classList.remove('open');
      panel.style.display='';
    });

    document.getElementById('jmsAiSendBtn')?.addEventListener('click', function(){
      const input=document.getElementById('jmsAiInput');
      askJmsAI(input?.value||'');
    });

    document.getElementById('jmsAiInput')?.addEventListener('keydown', function(e){
      if(e.key==='Enter') askJmsAI(this.value);
    });
  }

  setTimeout(ensurePanel,300);
  setTimeout(ensurePanel,1000);
  setInterval(ensurePanel,1500);
})();



/* JMS AI SIDEBAR PAGE FIX: reliable AI page inside nav */
(function(){
  function jmsData(){
    try { return (typeof db !== 'undefined') ? db : {}; } catch(e){ return {}; }
  }
  function money(n){ return Number(n||0).toLocaleString('ar-SA'); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function dateOf(x){ return String(x.date || x.created_at || x.checkin_at || x.quote_date || x.order_date || '').slice(0,10); }
  function repNameSafe(d,id){ return (d.reps||[]).find(r=>r.id===id)?.name || '-'; }
  function customerNameSafe(d,id){ return (d.customers||[]).find(c=>c.id===id)?.name || '-'; }

  function answer(q){
    const d=jmsData();
    d.customers ||= []; d.reps ||= []; d.visits ||= []; d.quotes ||= []; d.orders ||= []; d.collections ||= [];
    q=String(q||'').trim();
    const t=today();

    if(q.includes('مندوب') || q.includes('أفضل') || q.includes('افضل')){
      const map={};
      d.reps.forEach(r=>map[r.id]={name:r.name,visits:0,quotes:0,orders:0,collection:0});
      d.visits.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].visits++; });
      d.quotes.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].quotes++; });
      d.orders.forEach(v=>{ if(map[v.rep_id]) map[v.rep_id].orders++; });
      d.collections.forEach(c=>{
        const cust=d.customers.find(x=>x.id===c.customer_id);
        if(cust && map[cust.rep_id]) map[cust.rep_id].collection += Number(c.amount||0);
      });
      const rows=Object.values(map).sort((a,b)=>(b.visits+b.quotes+b.orders+b.collection)-(a.visits+a.quotes+a.orders+a.collection));
      return rows.length ? 'ترتيب المناديب:\n'+rows.map((r,i)=>`${i+1}. ${r.name}: زيارات ${r.visits} | عروض ${r.quotes} | طلبات ${r.orders} | تحصيل ${money(r.collection)} ريال`).join('\n') : 'لا توجد بيانات مناديب.';
    }

    if(q.includes('30') || q.includes('لم تتم') || q.includes('مازار') || q.includes('لم يزر')){
      const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-30);
      const rows=d.customers.filter(c=>{
        const last=d.visits.filter(v=>v.customer_id===c.id).sort((a,b)=>String(b.date||b.checkin_at||'').localeCompare(String(a.date||a.checkin_at||'')))[0];
        if(!last) return true;
        return new Date(last.date||last.checkin_at) < cutoff;
      }).slice(0,25);
      return rows.length ? 'عملاء لم تتم زيارتهم منذ 30 يوم:\n'+rows.map((c,i)=>`${i+1}. ${c.name} - ${c.phone||'لا يوجد جوال'} - ${repNameSafe(d,c.rep_id)}`).join('\n') : 'لا يوجد عملاء متأخرين عن الزيارة.';
    }

    if(q.includes('مديون') || q.includes('تحصيل')){
      const total=d.collections.reduce((s,c)=>s+Number(c.amount||0),0);
      const todayAmount=d.collections.filter(c=>dateOf(c)===t).reduce((s,c)=>s+Number(c.amount||0),0);
      const debts=d.customers.filter(c=>Number(c.debt_balance||0)>0).sort((a,b)=>Number(b.debt_balance||0)-Number(a.debt_balance||0)).slice(0,10);
      return `التحصيلات:\n- إجمالي التحصيل: ${money(total)} ريال\n- تحصيل اليوم: ${money(todayAmount)} ريال\n- عملاء عليهم مديونية: ${debts.length}\n\nأعلى مديونيات:\n${debts.map((c,i)=>`${i+1}. ${c.name} - ${money(c.debt_balance)} ريال`).join('\n') || 'لا توجد مديونيات.'}`;
    }

    if(q.includes('عرض') || q.includes('عروض')){
      const pending=d.quotes.filter(x=>String(x.status||'').includes('انتظار') || String(x.status||'').includes('pending') || !x.status);
      return `عروض الأسعار:\n- إجمالي العروض: ${d.quotes.length}\n- عروض تحتاج متابعة: ${pending.length}\n${pending.slice(0,10).map((x,i)=>`${i+1}. ${x.quote_no||x.id} - ${customerNameSafe(d,x.customer_id)}`).join('\n')}`;
    }

    return `ملخص اليوم ${t}:\n- العملاء: ${d.customers.length}\n- المناديب: ${d.reps.length}\n- الزيارات: ${d.visits.length}\n- العروض: ${d.quotes.length}\n- الطلبات: ${d.orders.length}\n- التحصيلات: ${d.collections.length}`;
  }

  window.askJmsAIPage=function(q){
    const input=document.getElementById('jmsAIPageInput');
    q=String(q||input?.value||'').trim();
    if(!q) return;
    const body=document.getElementById('jmsAIPageBody');
    if(!body) return;
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${q}</div>`);
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${answer(q)}</div>`);
    body.scrollTop=body.scrollHeight;
    if(input) input.value='';
  };

  function updateAIPage(){
    const d=jmsData();
    const el=document.getElementById('aiPageCustomerCount');
    if(el) el.textContent=(d.customers||[]).length;
  }

  const oldRenderAll = (typeof renderAll === 'function') ? renderAll : null;
  if(oldRenderAll && !window.__jmsAIPageRenderPatched){
    window.__jmsAIPageRenderPatched=true;
    renderAll=function(){
      oldRenderAll.apply(this,arguments);
      setTimeout(updateAIPage,100);
    };
  }

  setTimeout(updateAIPage,500);
  setInterval(updateAIPage,1500);
})();
