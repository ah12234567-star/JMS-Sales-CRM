Warning: truncated output (original token count: 134627)
Total output lines: 6407


// JMS login safety fix: never render dashboard before a valid currentUser exists.
if(location.pathname.startsWith('/api/')){
  document.body.innerHTML = '<pre>{"ok":false,"error":"api_route_not_reached"}</pre>';
  throw new Error('api route not reached by Vercel function');
}

const DENSITY={HDPE:.95,LDPE:.92,LLDPE:.92,PP:.90,MIX:.93};
const STORE='jms_factory_crm_pro_v4';
let db=load();
let currentUser=JSON.parse(sessionStorage.getItem('jms_current_user')||'null');
window.currentUser = currentUser;

function load(){
  try{
    const saved=localStorage.getItem(STORE);
    if(saved) return JSON.parse(saved);
  }catch(error){
    console.error('JMS local data recovery:',error);
    try{localStorage.setItem(STORE+'_corrupt_backup_'+Date.now(),localStorage.getItem(STORE)||'');localStorage.removeItem(STORE);}catch(_){}
  }
  const yaserNames=(window.JMS_IMPORTED_CUSTOMERS||[]).slice(0,160);
  const reps=[
    {id:'rep-yaser',name:'ياسر الحسني',email:'yaser@jms.local',role:'rep',status:'active'},
    {id:'rep-demo',name:'مندوب جدة',email:'rep@jms.local',role:'rep',status:'active'}
  ];
  return {
    users:[
      {id:'u-admin',name:'مدير النظام',email:'admin@jms.local',role:'admin',status:'active'},
      {id:'u-sales',name:'مدير المبيعات',email:'sales@jms.local',role:'sales',status:'active'},
      ...reps.map(r=>({...r}))
    ],
    reps,
    customers:yaserNames.map((name,i)=>({id:'c'+i,name,phone:'',city:'جدة',district:'',location:'',category:'عميل',status:'active',rep_id:'rep-yaser',debt_balance:0,credit_limit:0,notes:''})),
    visits:[],orders:[],collections:[],routes:[]
  };
}
function save(){
  try{localStorage.setItem(STORE, JSON.stringify(db));}
  catch(error){console.error('JMS local save failed:',error);throw new Error('local_storage_failed');}
  // Coalesce rapid edits into one cloud write. Previously every keystroke/action
  // could schedule a full five-table upload, which caused mobile lag.
  if(typeof window.pushCloudData === 'function'){
    clearTimeout(window.__jmsCloudPushTimer);
    window.__jmsCloudPushTimer=setTimeout(() => window.pushCloudData(), 1200);
  }
}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function $(id){return document.getElementById(id)}
function today(){return new Date().toISOString().slice(0,10)}
function month(){return today().slice(0,7)}
function money(n){return Number(n||0).toLocaleString('ar-SA')}
function roleText(r){return r==='admin'?'مدير النظام':r==='sales'?'مدير مبيعات':'مندوب'}
function allowedCustomers(){return (currentUser&&currentUser.role)==='rep'?db.customers.filter(c=>c.rep_id===(currentUser&&currentUser.id)):db.customers}
function allowedOrders(){return (currentUser&&currentUser.role)==='rep'?db.orders.filter(o=>o.rep_id===(currentUser&&currentUser.id)):db.orders}
function requireLogin(){
  if(!currentUser || !currentUser.role){
    if(typeof appView!=='undefined' && appView) appView.classList.add('hidden');
    if(typeof loginView!=='undefined' && loginView) loginView.classList.remove('hidden');
    return false;
  }
  return true;
}

document.querySelectorAll('input[name=loginRole]').forEach(x=>x.onchange=()=>{
  loginEmail.value='';
  loginPassword.value='';
  loginHint.textContent='لن تظهر بيانات الدخول على الصفحة حفاظًا على الأمان';
});

async function jmsPostJson(url, payload){
  const token=sessionStorage.getItem('jms_auth_token')||'';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify(payload||{}),
      signal:controller.signal
    });
    const data = await res.json().catch(()=>({ok:false,error:'bad_response'}));
    if(!res.ok || data.ok === false) throw new Error(data.message || data.error || 'request_failed');
    return data;
  }catch(error){
    if(error?.name==='AbortError') throw new Error('انتهت مهلة الاتصال، تحقق من الشبكة وحاول مجددًا');
    throw error;
  }finally{clearTimeout(timer);}
}

loginForm.onsubmit=async e=>{
  e.preventDefault();
  const email=loginEmail.value.trim();
  const password=loginPassword.value;
  const role=document.querySelector('input[name=loginRole]:checked')?.value||'';
  if(!email || !password) return alert('اكتب البريد وكلمة المرور');
  try{
    const data=await jmsPostJson('/api/auth-login',{email,password,role});
    const u=data.user;
    if(!u) return alert('بيانات الدخول غير صحيحة');
    currentUser={id:u.id,name:u.name,email:u.email,role:u.role};
    window.currentUser=currentUser;
    sessionStorage.setItem('jms_current_user',JSON.stringify(currentUser));
    if(data.token) sessionStorage.setItem('jms_auth_token', data.token);
    // Keep a local copy only for display/permissions; password is not stored in browser.
    db.users = (db.users||[]).filter(x=>x.email!==u.email);
    db.users.push({id:u.id,name:u.name,email:u.email,role:u.role,status:u.status||'active'});
    save();
    showApp();
  }catch(err){
    console.error('JMS login error', err);
    alert('بيانات الدخول غير صحيحة أو تعذر الاتصال بخدمة الدخول');
  }
};

function openPasswordReset(){
  modalBody.innerHTML=`<h2>استعادة كلمة المرور</h2>
    <p class="muted">اكتب البريد المسجل. سنرسل رمز تحقق عبر واتساب أو رسالة SMS حسب الإعدادات.</p>
    <div class="form-grid">
      <label>البريد الإلكتروني<input id="resetEmail" type="email" placeholder="name@example.com" autocomplete="username"></label>
      <label>رقم الجوال / واتساب اختياري<input id="resetPhone" placeholder="9665xxxxxxxx" inputmode="tel"></label>
    </div>
    <br><button class="primary" onclick="requestPasswordReset()">إرسال رمز التحقق</button>
    <hr>
    <div class="form-grid">
      <label>رمز التحقق<input id="resetCode" inputmode="numeric" maxlength="6"></label>
      <label>كلمة المرور الجديدة<input id="resetNewPassword" type="password" autocomplete="new-password"></label>
    </div>
    <br><button onclick="confirmPasswordReset()">تغيير كلمة المرور</button>`;
  modal.classList.remove('hidden');
}
window.openPasswordReset=openPasswordReset;

window.requestPasswordReset=async function(){
  const email=resetEmail.value.trim();
  const phone=resetPhone.value.trim();
  if(!email && !phone) return alert('اكتب البريد أو رقم الجوال');
  try{
    const data=await jmsPostJson('/api/auth-reset-request',{email,phone});
    alert(data.message || 'تم إرسال رمز التحقق إذا كان الحساب موجودًا');
  }catch(e){
    alert('تعذر إرسال رمز التحقق. تأكد من إعداد واتساب/SMS في Vercel.');
  }
}

window.confirmPasswordReset=async function(){
  const email=resetEmail.value.trim();
  const phone=resetPhone.value.trim();
  const code=resetCode.value.trim();
  const newPassword=resetNewPassword.value;
  if(!code || !newPassword) return alert('اكتب الرمز وكلمة المرور الجديدة');
  try{
    const data=await jmsPostJson('/api/auth-reset-confirm',{email,phone,code,newPassword});
    alert(data.message || 'تم تغيير كلمة المرور');
    closeModal();
  }catch(e){
    alert('رمز غير صحيح أو منتهي الصلاحية');
  }
}
logoutBtn.onclick=()=>{currentUser=null;window.currentUser=null;sessionStorage.removeItem('jms_current_user');sessionStorage.removeItem('jms_auth_token');location.reload()};

function resetAppViewport(){
  try{history.scrollRestoration='manual'}catch(_){}
  const reset=()=>{
    const main=document.querySelector('.main');
    if(main){main.scrollTop=0;try{main.scrollTo({top:0,left:0,behavior:'auto'})}catch(_){}}
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch(_){window.scrollTo(0,0)}
  };
  reset();
  requestAnimationFrame(reset);
  setTimeout(reset,80);
  setTimeout(reset,260);
}
window.jmsResetAppViewport=resetAppViewport;

function showApp(){
  if(!currentUser || !currentUser.role){ loginView.classList.remove('hidden'); appView.classList.add('hidden'); return; }
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  currentUserName.textContent=((currentUser&&currentUser.name)||"");
  currentUserRole.textContent=roleText((currentUser&&currentUser.role));

  const repAllowed = ['customers','visits','orders','quotes','routes','profile','newCustomerRadar','repAiAssistant'];
  document.querySelectorAll('.nav').forEach(btn=>{
    const page = btn.dataset.page;
    const repAllowed = ['customers','visits','orders','quotes','routes','profile','newCustomerRadar','repAiAssistant'];
    if((currentUser&&currentUser.role) === 'rep' && !repAllowed.includes(page)){
      btn.style.display='none';
    } else if(btn.classList.contains('admin-only') && (currentUser&&currentUser.role) !== 'admin'){
      btn.style.display='none';
    } else if(btn.classList.contains('manager-only') && !['admin','sales'].includes((currentUser&&currentUser.role))){
      btn.style.display='none';
    } else {
      btn.style.display='block';
    }
  });

  if((currentUser&&currentUser.role) === 'rep'){
    document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
    const first = document.querySelector('.nav[data-page="customers"]');
    const page = document.getElementById('customers');
    if(first) first.classList.add('active');
    if(page) page.classList.add('active');
  }

  if(window.orderDate) orderDate.value=today();
  renderAll();
  resetAppViewport();
}
if(currentUser) showApp();

document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');$(btn.dataset.page).classList.add('active');
  renderAll();
  resetAppViewport();
});
window.addEventListener('pageshow',()=>{if(currentUser&&!document.querySelector('.modal:not(.hidden)'))resetAppViewport();});

function renderAll(){if(!requireLogin()) return; renderStats();renderCustomers();renderSelects();if(typeof renderVisitFilters==='function')renderVisitFilters();if(typeof renderVisits==='function')renderVisits();if(typeof renderQuotes==='function')renderQuotes();if(typeof renderVisitNotes==='function')renderVisitNotes();renderOrders();renderRoutes();renderAlerts();renderUsers();calc();if(typeof renderJmsAI==='function')renderJmsAI()}
function repName(id){return db.reps.find(r=>r.id===id)?.name||'-'}
function customerName(id){return db.customers.find(c=>c.id===id)?.name||'-'}
function lastVisit(cid){return db.visits.filter(v=>v.customer_id===cid).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||''}
function daysFrom(d){return d?Math.floor((new Date(today())-new Date(d))/86400000):999}
function customerState(c){let d=daysFrom(lastVisit(c.id));if(d>=30)return ['متأخر '+d+' يوم','late'];if(d>=20)return ['قريب '+d+' يوم','warn'];return ['منتظم','ok']}
function monthOrders(){return allowedOrders().filter(o=>String(o.date).startsWith(month()))}
function monthCollections(){return db.collections.filter(c=>String(c.date).startsWith(month())&&((currentUser&&currentUser.role)!=='rep'||c.rep_id===(currentUser&&currentUser.id)))}

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
  const reps=(currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;orderRep.innerHTML=reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
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
  const repId=(currentUser&&currentUser.role)==='rep'?(currentUser&&currentUser.id):prompt('اكتب ID المندوب: rep-yaser أو rep-demo','rep-yaser');
  const customers=allowedCustomers().filter(c=>c.rep_id===repId).slice(0,10);
  db.routes.unshift({id:id(),date:today(),rep_id:repId,items:customers.map((c,i)=>({customer_id:c.id,order:i+1,status:'pending'}))});save();renderRoutes();
}
function renderRoutes(){
  routesList.innerHTML=db.routes.filter(r=>(currentUser&&currentUser.role)!=='rep'||r.rep_id===(currentUser&&currentUser.id)).map(r=>`<div class="route-card"><b>مسار ${r.date} - ${repName(r.rep_id)}</b><div class="route-items">${r.items.map(i=>`<div class="route-item">${i.order}. ${customerName(i.customer_id)} <button onclick="visit('${i.customer_id}')">تمت الزيارة</button></div>`).join('')}</div></div>`).join('')||'<div class="panel">لا توجد مسارات</div>';
}
function openUserForm(){
  modalBody.innerHTML=`<h2>إضافة مستخدم / مندوب</h2><p class="muted">سيتم حفظ كلمة المرور مشفرة في السيرفر، ولن تظهر في الصفحة أو الكود.</p><div class="form-grid two"><label>الاسم<input id="muName"></label><label>البريد<input id="muEmail" type="email" autocomplete="username"></label><label>رقم الجوال / واتساب<input id="muPhone" placeholder="9665xxxxxxxx" inputmode="tel"></label><label>كلمة مرور مؤقتة<input id="muPass" type="password" autocomplete="new-password" placeholder="اكتب كلمة مرور مؤقتة"></label><label>الدور<select id="muRole"><option value="rep">مندوب</option><option value="sales">مدير مبيعات</option><option value="admin">مدير نظام</option></select></label></div><br><button class="primary" onclick="saveUser()">حفظ</button>`;modal.classList.remove('hidden');
}
async function saveUser(){const u={id:id(),name:muName.value.trim(),email:muEmail.value.trim(),phone:muPhone.value.trim(),password:muPass.value,role:muRole.value,status:'active'};if(!u.name||!u.email||!u.password)return alert('اكتب الاسم والبريد وكلمة المرور المؤقتة');try{await jmsPostJson('/api/auth-create-user',{id:u.id,name:u.name,email:u.email,phone:u.phone,password:u.password,role:u.role,status:u.status});}catch(e){return alert('تعذر إنشاء المستخدم في السيرفر. تأكد أنك داخل بحساب مدير النظام وأن متغيرات Vercel مضبوطة.');}delete u.password;db.users.push(u);if(u.role==='rep')db.reps.push({...u});save();closeModal();renderAll()}
function renderUsers(){
  usersList.innerHTML=`<table><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>إجراءات</th></tr>${db.users.map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td>${roleText(u.role)}</td><td>${u.status==='active'?'نشط':'موقوف'}</td><td><div class="row-actions"><button onclick="toggleUser('${u.id}')">${u.status==='active'?'إيقاف':'تفعيل'}</button><button onclick="resetPass('${u.id}')">إعادة كلمة المرور</button></div></td></tr>`).join('')}</table>`;
}
function toggleUser(uid){let u=db.users.find(x=>x.id===uid);u.status=u.status==='active'?'disabled':'active';let r=db.reps.find(x=>x.id===uid);if(r)r.status=u.status;save();renderUsers()}
async function resetPass(uid){let u=db.users.find(x=>x.id===uid);let p=prompt('كلمة المرور الجديدة');if(!p)return;try{await jmsPostJson('/api/auth-admin-reset-password',{userId:uid,newPassword:p});alert('تم تغيير كلمة المرور لجميع الأجهزة');}catch(e){alert('تعذر تغيير كلمة المرور في السيرفر')}}
async function changeMyPassword(){if(!currentUser)return;if(!oldPassword.value||!newPassword.value)return alert('اكتب كلمة المرور الحالية والجديدة');try{await jmsPostJson('/api/auth-change-password',{email:((currentUser&&currentUser.email)||""),oldPassword:oldPassword.value,newPassword:newPassword.value});oldPassword.value='';newPassword.value='';alert('تم تغيير كلمة المرور لجميع الأجهزة');}catch(e){alert('كلمة المرور الحالية غير صحيحة أو تعذر الحفظ')}}
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
  const reps=(currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;
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
  if((currentUser&&currentUser.role)==='rep') vs=vs.filter(v=>v.rep_id===(currentUser&&currentUser.id));
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
  const reps=(currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;
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
      <label>المندوب<select id="mvRep">${((currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
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
  return (currentUser&&currentUser.role)==='rep' ? db.quotes.filter(q=>q.rep_id===(currentUser&&currentUser.id)) : db.quotes;
}
function renderQuoteFilters(){
  if(!window.quoteRepFilter) return;
  const reps=(currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;
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
  const canApprove=(currentUser&&currentUser.role)==='admin'||(currentUser&&currentUser.role)==='sales';
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
  const reps=(currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;
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
    created_by:((currentUser&&currentUser.name)||""),created_at:new Date().toISOString()
  });
  save();closeModal();renderAll();alert('تم حفظ العرض وإرساله للمدير للاعتماد');
}
function approveQuote(qid){
  const q=db.quotes.find(x=>x.id===qid); if(!q) return;
  q.status='approved'; q.approved_by=((currentUser&&currentUser.name)||""); q.approved_at=today();
  save();renderQuotes();alert('تم اعتماد عرض السعر');
}
function rejectQuote(qid){
  const q=db.quotes.find(x=>x.id===qid); if(!q) return;
  const reason=prompt('سبب الرفض');
  if(!reason) return;
  q.status='rejected'; q.reject_reason=reason; q.rejected_by=((currentUser&&currentUser.name)||""); q.rejected_at=today();
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
    const coll=(db.collections||[]).filter(c=>String(c.date||'').startsWith(safeMonth())&&((currentUser&&currentUser.role)!=='rep'||c.rep_id===(currentUser&&currentUser.id))).reduce((s,c)=>s+Number(c.amount||0),0);
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
  window.allowedQuotes = function(){ ensureQuotes(); return (currentUser&&currentUser.role)==='rep' ? db.quotes.filter(q=>q.rep_id===(currentUser&&currentUser.id)) : db.quotes; };

  window.renderQuoteFilters = function(){
    if(!window.quoteRepFilter) return;
    const reps=(currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;
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
    const canApprove=(currentUser&&currentUser.role)==='admin'||(currentUser&&currentUser.role)==='sales';
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
    const reps=(currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;
    const defaultRep=(currentUser&&currentUser.role)==='rep'?(currentUser&&currentUser.id):(reps[0]?.id||'');
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
    let repId=(window.mqRep && mqRep.value) ? mqRep.value : (currentUser&&currentUser.id);
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
    db.quotes.unshift({id:newLocalId(),quote_no:no,status:'pending',customer_id:customerId,rep_id:repId,date:mqDate.value||safeToday(),valid_until:mqValid.value,product:mqProduct.value,material:mqMaterial.value,color:mqColor.value,print:mqPrint.value,width:mqWidth.value,length:mqLength.value,size_unit:mqSizeUnit.value,thickness:mqThickness.value,thickness_unit:mqThicknessUnit.value,total_kg:mqKg.value,price_kg:mqPriceKg.value,total_amount:mqTotal.value,piece_weight:mqPiece.value,pieces:mqPieces.value,payment_terms:mqPayment.value,delivery_terms:mqDelivery.value,notes:mqNotes.value,created_by:((currentUser&&currentUser.name)||""),created_at:new Date().toISOString()});
    saveDB(); closeModal(); renderAll(); alert('تم حفظ العرض وإرساله للمدير للاعتماد');
  };

  window.approveQuote=function(x){const q=db.quotes.find(q=>q.id===x);if(!q)return;q.status='approved';q.approved_by=((currentUser&&currentUser.name)||"");q.approved_at=safeToday();saveDB();renderQuotes();alert('تم اعتماد عرض السعر');};
  window.rejectQuote=function(x){const q=db.quotes.find(q=>q.id===x);if(!q)return;const reason=prompt('سبب الرفض');if(!reason)return;q.status='rejected';q.reject_reason=reason;q.rejected_by=((currentUser&&currentUser.name)||"");q.rejected_at=safeToday();saveDB();renderQuotes();alert('تم رفض العرض');};
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
    const reps = (currentUser&&currentUser.role) === 'rep' ? db.reps.filter(r=>r.id===(currentUser&&currentUser.id)) : db.reps;
    const cur = visitNoteRepFilter.value;
    visitNoteRepFilter.innerHTML = '<option value="all">كل المناديب</option>' + reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    if(cur) visitNoteRepFilter.value = cur;
  };

  window.renderVisitNotes = function(){
    if(!window.visitNotesList) return;
    ensureVisitReports();
    renderVisitNoteFilters();

    let reports = (currentUser&&currentUser.role) === 'rep' ? db.visitReports.filter(r=>r.rep_id===(currentUser&&currentUser.id)) : db.visitReports;
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
    const repId = c.rep_id || (currentUser&&currentUser.id);
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
      created_by: ((currentUser&&currentUser.name)||""),
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
    r.closed_by = ((currentUser&&currentUser.name)||"");
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
    const reps = (currentUser&&currentUser.role)==='rep'?db.reps.filter(r=>r.id===(currentUser&&currentUser.id)):db.reps;
    const defaultRep=(currentUser&&currentUser.role)==='rep'?(currentUser&&currentUser.id):(reps[0]?.id||'');

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
    let repId=(window.mqRep && mqRep.value) ? mqRep.value : (currentUser&&currentUser.id);

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
      payment_terms:mqPayment.value,delivery_terms:mqDelivery.value,notes:mqNotes.value,created_by:((currentUser&&currentUser.name)||""),created_at:new Date().toISOString()
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
  const JMS_LOGO_DATA = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAkACQAAD/4QECRXhpZgAATU0AKgAAAAgABwEOAAIAAAALAAAAYgESAAMAAAABAAEAAAEaAAUAAAABAAAAbgEbAAUAAAABAAAAdgEoAAMAAAABAAIAAAEyAAIAAAAUAAAAfodpAAQAAAABAAAAkgAAAABTY3JlZW5zaG90AAAAAACQAAAAAQAAAJAAAAABMjAyNjowNjozMCAxNTozMzoyNQAABZADAAIAAAAUAAAA1JKGAAcAAAASAAAA6KABAAMAAAAB//8AAKACAAQAAAABAAADzKADAAQAAAABAAADdQAAAAAyMDI2OjA2OjMwIDE1OjMzOjI1AEFTQ0lJAAAAU2NyZWVuc2hvdP/tAG5QaG90b3Nob3AgMy4wADhCSU0EBAAAAAAANhwBWgADGyVHHAIAAAIAAhwCeAAKU2NyZWVuc2hvdBwCPAAGMTUzMzI1HAI3AAgyMDI2MDYzMDhCSU0EJQAAAAAAEF8wABuq12VGwA86c7dv083/4gIoSUNDX1BST0ZJTEUAAQEAAAIYYXBwbAQAAABtbnRyUkdCIFhZWiAH5gABAAEAAAAAAABhY3NwQVBQTAAAAABBUFBMAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWFwcGwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApkZXNjAAAA/AAAADBjcHJ0AAABLAAAAFB3dHB0AAABfAAAABRyWFlaAAABkAAAABRnWFlaAAABpAAAABRiWFlaAAABuAAAABRyVFJDAAABzAAAACBjaGFkAAAB7AAAACxiVFJDAAABzAAAACBnVFJDAAABzAAAACBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAABQAAAAcAEQAaQBzAHAAbABhAHkAIABQADNtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADQAAAAcAEMAbwBwAHkAcgBpAGcAaAB0ACAAQQBwAHAAbABlACAASQBuAGMALgAsACAAMgAwADIAMlhZWiAAAAAAAAD21QABAAAAANMsWFlaIAAAAAAAAIPfAAA9v////7tYWVogAAAAAAAASr8AALE3AAAKuVhZWiAAAAAAAAAoOAAAEQsAAMi5cGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltzZjMyAAAAAAABDEIAAAXe///zJgAAB5MAAP2Q///7ov///aMAAAPcAADAbv/AABEIA3UDzAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAICAgICAgMCAgMFAwMDBQYFBQUFBggGBgYGBggKCAgICAgICgoKCgoKCgoMDAwMDAwODg4ODg8PDw8PDw8PDw//2wBDAQIDAwQEBAcEBAcQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/3QAEAD3/2gAMAwEAAhEDEQA/AP38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAQjNJtp1FO4DdtG0U6ii4DCMU0jNPbrTapDuIBilooosFxCM0AYpaKlhcMZ4pfLHrQOtPpBcj2Ac5op56UyhaCEwKNq+lLRQ0AhAxTeMdKfS7fahaCsQ4FLUu32o2+1NsLEWcUhGam2+1G32pBYhAxS4FS7fajb7U7jIqTHOam2+1G32pNXFYiGPSnZHpT9vtRt9qBkeTQFzzUm32pMYp3AQDFITg06jGe1IViJhuOalUBhz2pdvtTlGBTbGJsWlCgUtFIBCoNMK46VJTWppgMHSlHHSiii4BTSMc9adRjNIBmR6U3Aqbb7UbfancViHApal2+1G32qbBYipMc5qbb7UbfaquMZ+FH4U/b7UbfakBFSYFTbfajb7U0wIlwoxQMDtUu32o2+1O4FYcDFKMKc4qTBowakdxu80m40/Bowaq4hwOQKWiipAXJFJRRQAw9aMmn7c9qXb7UFXGg5p2TSYxRQK47GeTS7RQvSloEJtFG0UtFO47jdtG2nUUXEN20badRRcBAMUtFFIAooooAKKKKACiiigAooooAKKKKACiiigAooooA//0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBCM0m2nUUmwG7aNtOopXAbto206iqAQDFLRRQAdabtp1FADdtG2nUUAN206iigAooooAKKKKACiiigAooooAKKKKACkIzS0UAN20oGKWigAooooAKKKKACkIzS0UAN20badRQA3bSgYpaKACiiigAooooAKKKKACiiigAooooAKKKKAG7aNtOooAbto206igBu2jbTqKAG7aNtOooAOlFFFACEZpNtOooAQDFLRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/9H9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//T/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBCcUm6gnFM3D0p2Cz6D91G6m7hRTsCTHbqNxptJkUOwD9xo3GmZFJupXQnJdiTdS5FRbqNxpXQJpkuRRuFRbjTqrQY7cKN1Noo0Aduo3UmTRzRoFvMXdSg5pv40hPc1OgW8ySiosijIqtCtCWiosijIo0DQloqLIoyKNA0JaQnFR5FIST7VOgaEu4Um6ohn1pRk0XQaEm6jdTMH1oAxTuhOw/caNxpmRQDmi6C67D9xo3GmE4puec0XRLkuxLuNG40zJ9KMn0qrC5kP3GjcaZk+lJuNLQOZEm40bjUe40bjUXDmRJuNG6o9xoBJNFxcw/eKXdUZZR2pwYGr1L5ZD88Zpu+jOeKbkUJdwuluSA5paQdKWpAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//U/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBrYxzUJZAcVM3TNVjNEnMjBfqapEtyvZEhwB9abkiqDX8O7BcYHuKX+0Lb/noPzFQ52NnSqNaF7cTxTNrZqst9ak/6xfzFTG7tv8Anqp/EU1NdSFGpDRokAenYaqjXVtn/Wj8xUn221/56j8xV88Svff2SYtt600SI3QfpVdr6z7yr+YpovbUdJF/MVPPAFSlL4olzIFBYjmqn263J4dfzFTfabVh/rF/MVDnAPZ26DxLTxKuOah861/vr+YpPtdoODIv5in7SmNQ8ix5q+lL5g9Kr/bLP/nov5ik+12n99fzFHtKZTh5FnzB6UoZTVb7Zaf31/MUhvbQfxj8xR7SBPI30LeVoytU/t1p/fH50f2hZDguv50e1gHsn2Le4Um5ari/sj/y0X86Df2Q/wCWi/nR7SAeyfYsblo3JVb+0LL++v5003lm/wDy0UfiKPaQD2fkXdyUwsueKq/abP8A56j86glvrWPG2RTn3FUpw7g6WmzNLHGaZuFUBqFswx5g/MU03sCnIcH8RWM6kE9RxoPsaG/tTuo7VTW8tXHMij8ab9otgf8AWA/jWqnGxLpNO6Rd2n1FJ93nNU/tVr/fX86Ptdp/fX86XPEfv/yloyZ70gbmq32m0/56L+dH2q0HRlJ+tV7SA0p/ylzefWjefWqn2u3/ANn86Ptdv/s/nR7SBfI/5S3vPrRvPrVX7XB6r+dH2uD1X86PaRDkf8pa3n1o3n1qr9rg9V/Oj7XB6r+dPngHI/5S15lODE1U+1W3qv50v223H8S/nS54C5H2LHU0oB6iqP2+3H8S/nSHUoB0K/nSVVERp1epoE460o56VTivUc4BBq8DuHFO9yJU7bkoGBilpB0paQgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/1f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAgnbahNfDv7RfxM8a+E22+Hbd5P92vuOdQ0ZBrj9W8L6HrgxqFss2PUVlNvZHdhqkIO8j8jJv2ivjKiKDp8o3HHU/wCFVj+0V8YhwbGX8/8A61fq5J8NPCU2FXTkG3pwP8Kgb4WeFz/y4R/98j/CsHBs+qp5jQSs4n5T/wDDR3xgHWyl/Wnr+0d8Xyf+POX9f8K/U/8A4VR4XY4+wR/98j/Cj/hUvhkH/jxj/wC+R/hXPOlK+jO2OZ4RfFE/L2P9of4vuQPsUvP1/wAK0x8d/jC4+Wxl6Z6n/Cv03i+FnhhP+XKP/vkf4VYf4deG4+Vs48EH+Ef4VDoztuNZzhFK3Ij8itc/an+I+hq0uoxSxKnUnNc8f21PF+3cHbH1r72/aD+Bvh7UvBt7eWluiSKpbhfSvwv1iySxvJ7PPMbsuPoa8HG1qtFo/XOHcPl+YU5S5NUfdmlfti+N9VuUtLLdJLIcAA16FD+0F8W2wfscvPvX54eAtf8A+EZ1u3vZ4vMRWB5r9ZPhF8X/AIc+L4YbO9jhjlChcHGcjj0rDD4p1HZsM3ydYeDqU6Sa9DzE/tA/FscCyl/M/wCFNPx9+K45NnL+v+FfpBo/gzwdqNqLi1topFYZ4A/wrc/4Vl4akUE2cYz/ALI/wr6WNBSWjPyt5thacmqlNfcfmL/wvr4s4yLOXH+farCfHv4rbAfskv5//Wr9ND8M/DW3AtI/++R/hUP/AArDw8elon/fI/woeGfc0WeYB/YR+af/AAvv4rf8+kv6/wCFPX47/FUjP2ST86/SkfC/w/8A8+af98j/AAp3/CrfCx5ks0z9BU/V5dGUs7wKf8Nfcfmt/wAL1+K3/PpJSj44/FV/m+xyfma/Sn/hVfhP/n0T8qkX4X+F1GFtkA+g/wAKf1afc0/t7A/8+/wPzZT44/FLvaSfrU6/HD4nsMm0k/M1+kP/AArDwx/z7p+Q/wAKevwy8MqMfZk/75H+FNYafcl5/gf+ff4H5u/8Lv8Aid/z6SfrSr8bPie/S1k/M1+kn/CtPDP/AD6p/wB80n/CtvDq/ctU/wC+RVfVpdyf7fwP/Ps/OD/hdHxRP/LrL+ZpD8ZPikwJ+xynHua/SEfDnQP+fVP++RQ/gDQo12iyRs+wo9hJa3Inn2EatGmrn5f6l+0B8SNLQy3NvIijuTXJL+154mEhiLNuHbNfo38QfhZ4e1DR7jbaKrBT0Ar8UfiRoMfh/wAYXVrEu1Vbp+Jr5zMKlSiuZM/U+FqWAzR8soK/ofUOn/tX+Kr67W1jZt7HAGa9ctfit8Tr6BZIIXG7kEHNfm/Z3smmXUeoQrkoQfyr7u+Dnx50SUQ6drMSR4AGWx1rgwWYTqNQkz6HiDhqnhYc+GppneD4hfFonAikND/ED4tqdrQyg19n+EpvCmv20d1aCOQsAcDFehHw5osmD9lTd9B/hX1MaUpbM/AMRm1PDz5KlO3yPzpPxC+LA/5Zy/5/Cnp8Qvi2p3CKU4r9Dj4T0vORapj/AHRUv/CMaUF/49Uz/uiun6tPuYTzmk/hgj87/wDhZHxd/wCeEn+fwoHxI+LveCT/AD+FfoZ/wjGmf8+qf98igeGNMz/x6p/3yKr6tLuZ/wBq0v5Efnp/wsr4tf8APCT/AD+FH/Cyvi1/zwk/z+Ffob/wi+l/8+qf98ikPhfS8f8AHqn/AHyKPq8+4f2rS/kR+ef/AAsr4t/88Jab/wALK+Lf/PCWv0L/AOEW0z/n1T8h/hR/wi2mf8+qfkP8Kr6tLuP+1aX8iPzxPxM+LnaCX/P4Uw/Ev4v9fIk/z+Ffoh/wimm/8+qfkP8ACj/hFNN/59U/75H+FS8NLuH9q0v5EfnafiR8XiP+PeWoz8SPjB/z7yV+jo8LaV/z6p/3yP8ACnr4W0n/AJ9U/If4U402upzzzOm1ZRR8ffDb4h+Pr+8SLWLV0GcZJr7W0ueSaySSX5WIFZcfhzTreQPBaqpHcAVvi3HlBPu13wVj5rEVI1GXEOVFOpka7UCnnFPqzgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAawyOagK7Purmp2pgz3ppCcb6kZjyR2Hel8pPU1Lg0lOyGo+ZGIlHIzTWwexqQMTmkyO9Q3Zi0W4mxSPSq4Co/llSRjrVknNRdXH0NNy0Mvc5jyn4qiA+D9QRoyR5bd/Y1/Nh47UN4uvlRdoErcfjX9KnxVQDwdqB/6Zt/I1/Nh45P8AxV18f+mrfzr4vOXdRP6R8PUnGbXkVYFDRIcZxU1nqF9o1+l3YSvCyHPDHn8qpWspEYqxvYSDzF4+lfCxqyhK5/R9SlTr0uSSP0E/Z/8A2t7zSruHRfEDFYVwN7kY/rX6y+EfHmi+KbGK8064WdZFDfKema/mVNuyzedbvsP1xX098Dv2iNe8C6xBp+pTFrTIXJ9Onc19ll+YpO0j8B4m4Ki17WktT+gRJ1l+4pIqwoVu9eKfDj4l6R4x0yG7sZ1dnUEgHPWvaoX3KJAOor7inUhNXR/NuNwMsNNxmrWFZVHGTS/Pj5eacyhunBpV3BQD1rdtLU5VKKWgz956U0qxOSDU+Woy1HP5D5/Ig2H0NKIz6GpstQCaXN5Cc/Ij8s+hoCsOgqbj/Io4/wAiquHN5EBVvSkBZWAI61Y4/wAiq0zYdKL30GnfSxha7bB7C4L9Npr8E/j4wj+I17Gq/Lkc/ia/ffXP+QZcf7hr8Cvj6CfiLe49f6mvh86jamfv/hi5PFSPI9oMe3d1qk4ngIeJyhByCCRTy5FPcsyfKMmvzSE5Qd0f2BVUKsXGSPoD4T/HrXvA99BFdSPJbggEk5GPxr9bPhh8ZtB8c2cDx3CmZkztB5r8DEkJ+WQYrvvBPxE8QeCdWgvLO4IhQ4I5xgn619plmbuD5ah+KcU8E4XGUpVaStI/ouiljkj8xeVPeljw7ZAyvrXyv8Cvjpo/jjR4LaedRcAAEE8k19SQ…84627 tokens truncated…ا عندكم طلب أو مقاس معين نجهزه لكم بعرض مناسب.\n${company}`;
  }
  function buildMessage(c){
    const type=document.getElementById('wcType')?.value||'followup';
    const tone=document.getElementById('wcTone')?.value||'professional';
    const custom=(document.getElementById('wcPrompt')?.value||'').trim();
    let msg = custom || defaultMessageFor(c,type,tone);
    msg=msg.replaceAll('{{name}}', c.name||'عميلنا الكريم')
           .replaceAll('{{phone}}', c.phone||'')
           .replaceAll('{{city}}', c.city||'')
           .replaceAll('{{rep}}', repLabel(c.rep_id))
           .replaceAll('{{debt}}', String(c.debt_balance||0))
           .replaceAll('{{category}}', c.category||'');
    return msg;
  }
  function targetStatus(c){
    const phone=normalizePhone(c.phone);
    if(!phone) return {ready:false,reason:'لا يوجد رقم جوال'};
    if(c.whatsapp_opt_out===true || c.whatsapp_opt_out==='yes') return {ready:false,reason:'موقوف واتساب'};
    if(messageCooldownBlocked(c)) return {ready:false,reason:'تم إرسال رسالة خلال آخر '+(db.whatsappSettings?.cooldownDays||7)+' أيام'};
    return {ready:true,reason:'جاهز'};
  }
  function campaignPreviewRows(){
    return getCampaignTargets().map(c=>({customer:c,phone:normalizePhone(c.phone),message:buildMessage(c),status:targetStatus(c)}));
  }
  function injectCampaignStyle(){
    if(document.getElementById('jmsWhatsappCampaignStyle')) return;
    const st=document.createElement('style'); st.id='jmsWhatsappCampaignStyle'; st.textContent=`
      .jms-campaign-toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:end}.jms-campaign-toolbar input,.jms-campaign-toolbar select,.jms-campaign-toolbar textarea{width:100%;border:1px solid #dbe3ef;border-radius:14px;padding:10px;background:#fff}.jms-campaign-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.jms-campaign-actions button{border:0;border-radius:14px;padding:10px 14px;background:#0f172a;color:#fff;cursor:pointer}.jms-campaign-actions button.green{background:#16a34a}.jms-campaign-actions button.blue{background:#2563eb}.jms-campaign-actions button.orange{background:#ea580c}.jms-campaign-actions button.gray{background:#475569}.jms-campaign-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:12px 0}.jms-campaign-card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:14px;box-shadow:0 8px 26px rgba(15,23,42,.06)}.jms-campaign-card b{font-size:24px;color:#0f172a}.jms-campaign-card span{display:block;color:#64748b}.jms-campaign-table{width:100%;border-collapse:separate;border-spacing:0 8px}.jms-campaign-table th{font-size:12px;color:#64748b;text-align:right}.jms-campaign-table td{background:#fff;padding:10px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;vertical-align:top}.jms-campaign-table td:first-child{border-radius:0 14px 14px 0;border-right:1px solid #e5e7eb}.jms-campaign-table td:last-child{border-radius:14px 0 0 14px;border-left:1px solid #e5e7eb}.jms-campaign-badge{display:inline-flex;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:800;background:#eef2ff;color:#3730a3}.jms-campaign-badge.ok{background:#dcfce7;color:#166534}.jms-campaign-badge.warn{background:#fef3c7;color:#92400e}.jms-campaign-badge.bad{background:#fee2e2;color:#991b1b}.jms-campaign-note{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:16px;padding:12px;margin:10px 0}.jms-message-preview{white-space:pre-wrap;max-width:390px;color:#334155;font-size:13px}.jms-campaign-log{display:grid;gap:8px}.jms-campaign-log-row{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:10px}.jms-muted{color:#64748b;font-size:12px}.jms-link-btn{border:0;border-radius:999px;background:#16a34a;color:#fff;padding:7px 10px;cursor:pointer}
    `; document.head.appendChild(st);
  }
  function repOptions(){ return '<option value="all">كل المناديب</option>'+(db.reps||[]).map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join(''); }
  function addCampaignPage(){
    const nav=document.querySelector('.sidebar nav'); const main=document.querySelector('main.main') || document.querySelector('.main');
    if(!nav || !main) return;
    if(!document.querySelector('[data-page="whatsappCampaigns"]')){
      const btn=document.createElement('button'); btn.className='nav manager-only'; btn.dataset.page='whatsappCampaigns'; btn.textContent='حملات واتساب الذكية';
      nav.insertBefore(btn, nav.querySelector('[data-page="jmsAI"]') || null);
    }
    if(!document.getElementById('whatsappCampaigns')){
      const sec=document.createElement('section'); sec.id='whatsappCampaigns'; sec.className='page';
      sec.innerHTML=`
        <div class="page-head with-action"><div><h1>حملات واتساب الذكية</h1><p>الذكاء يختار العملاء، يكتب الرسائل، يعرضها عليك للموافقة، ثم يجهز الإرسال تحت تحكم المدير.</p></div><div class="head-actions"><button class="primary" onclick="jmsGenerateWhatsappCampaign()">توليد حملة</button><button onclick="jmsRenderWhatsappCampaigns()">تحديث</button></div></div>
        <div class="panel"><div class="jms-campaign-toolbar">
          <label>نوع الحملة<select id="wcType"><option value="followup">متابعة عامة</option><option value="debt">تحصيل</option><option value="inactive">إعادة تنشيط العملاء المتوقفين</option><option value="offer">عرض خاص</option><option value="visit">ترتيب زيارات</option><option value="lead">عملاء محتملين</option></select></label>
          <label>اختيار العملاء<select id="wcSegment"><option value="all">كل العملاء</option><option value="debt">عليهم تحصيل</option><option value="late_visit">لم تتم زيارتهم 30 يوم</option><option value="inactive">متوقفين / لا يوجد طلب حديث</option><option value="hot_leads">عملاء محتملين من الرادار</option><option value="no_location">بدون موقع</option><option value="no_order_30">بدون طلب 30 يوم</option></select></label>
          <label>المندوب<select id="wcRep">${repOptions()}</select></label>
          <label>المدينة / الحي<input id="wcCity" placeholder="جدة، مكة، الصناعية"></label>
          <label>عدد العملاء<select id="wcLimit"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></label>
          <label>النبرة<select id="wcTone"><option value="professional">رسمية ومختصرة</option><option value="friendly">ودية</option><option value="firm">حازمة للتحصيل</option></select></label>
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="wcOptInOnly"> إرسال/تجهيز فقط للعملاء الموافقين على رسائل واتساب</label>
        <label style="margin-top:12px;display:block">تعليمات خاصة للذكاء / قالب الرسالة<textarea id="wcPrompt" rows="4" placeholder="اكتب رسالة مخصصة أو استخدم المتغيرات: {{name}} {{city}} {{rep}} {{debt}}. اتركها فارغة ليكتب الذكاء رسالة مناسبة حسب نوع الحملة."></textarea></label>
        <div class="jms-campaign-note">نظام الأمان: لا يتم الإرسال مباشرة إلا بعد اعتماد المدير. يمنع التكرار لنفس العميل خلال 7 أيام، ويستبعد العملاء بدون رقم أو الموقوفين من واتساب.</div>
        <div class="jms-campaign-actions"><button class="blue" onclick="jmsGenerateWhatsappCampaign()">توليد ومعاينة</button><button class="green" onclick="jmsSaveWhatsappCampaignDraft()">حفظ كمسودة</button><button class="orange" onclick="jmsApproveAndSendCampaign()">اعتماد وإرسال الدفعة الجاهزة</button><button class="gray" onclick="jmsExportCampaignPreview()">نسخ القائمة</button></div></div>
        <div class="jms-campaign-grid"><div class="jms-campaign-card"><b id="wcTotal">0</b><span>مختار</span></div><div class="jms-campaign-card"><b id="wcReady">0</b><span>جاهز للإرسال</span></div><div class="jms-campaign-card"><b id="wcBlocked">0</b><span>مستبعد</span></div><div class="jms-campaign-card"><b id="wcSentMonth">0</b><span>رسائل هذا الشهر</span></div></div>
        <div id="wcPreview" class="panel"></div>
        <div class="panel" style="margin-top:14px"><div class="panel-head"><b>سجل الحملات والرسائل</b><span>كل عملية إرسال تحفظ للمراجعة</span></div><div id="wcLog" class="jms-campaign-log"></div></div>`;
      main.appendChild(sec);
    }
    document.querySelectorAll('.nav').forEach(btn=>{
      if(btn.dataset.jmsCampaignBound==='1') return; btn.dataset.jmsCampaignBound='1';
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active'); const page=document.getElementById(btn.dataset.page); if(page) page.classList.add('active');
        if(btn.dataset.page==='whatsappCampaigns') jmsRenderWhatsappCampaigns();
      });
    });
    if(currentUser && currentUser.role==='rep') document.querySelectorAll('.manager-only,.admin-only').forEach(x=>x.style.display='none');
  }
  function renderPreview(rows){
    const box=document.getElementById('wcPreview'); if(!box) return;
    const ready=rows.filter(r=>r.status.ready); const blocked=rows.length-ready.length;
    const set=(id,val)=>{const e=document.getElementById(id); if(e)e.textContent=val;};
    set('wcTotal',rows.length); set('wcReady',ready.length); set('wcBlocked',blocked);
    const month=todaySafe().slice(0,7); set('wcSentMonth',(db.whatsappMessageLog||[]).filter(x=>String(x.at||'').startsWith(month)).length);
    box.innerHTML=`<div class="panel-head"><b>معاينة قبل الإرسال</b><span>${ready.length} جاهز من ${rows.length}. راجع الرسائل قبل الاعتماد.</span></div>
      <table class="jms-campaign-table"><tr><th>العميل</th><th>الجوال</th><th>المندوب</th><th>الحالة</th><th>الرسالة</th><th>إجراء</th></tr>
      ${rows.map(r=>`<tr><td><b>${esc(r.customer.name)}</b><br><span class="jms-muted">${esc(r.customer.city||'')} · ${esc(r.customer.category||'')}</span></td><td>${esc(r.phone||'-')}</td><td>${esc(repLabel(r.customer.rep_id))}</td><td><span class="jms-campaign-badge ${r.status.ready?'ok':'bad'}">${esc(r.status.reason)}</span></td><td><div class="jms-message-preview">${esc(r.message)}</div></td><td>${r.phone?`<button class="jms-link-btn" onclick="jmsOpenWaLink('${r.phone}',\`${esc(r.message).replace(/`/g,'&#96;')}\`)">فتح واتساب</button>`:''}<br><button onclick="jmsCopyCampaignMessage('${r.customer.id}')">نسخ</button><br><button onclick="jmsCampaignSetOptOut('${r.customer.id}',true)">إيقاف رسائل</button></td></tr>`).join('') || '<tr><td colspan="6">لا يوجد عملاء مطابقين.</td></tr>'}
      </table>`;
  }
  window.jmsGenerateWhatsappCampaign=function(){
    if(!canUseCampaigns()) return alert('حملات واتساب للمدير ومدير المبيعات فقط');
    ensureCampaignDb(); const rows=campaignPreviewRows(); window.JMS_LAST_CAMPAIGN_ROWS=rows; renderPreview(rows);
  };
  window.jmsSaveWhatsappCampaignDraft=function(){
    if(!canUseCampaigns()) return alert('لا تملك صلاحية'); ensureCampaignDb();
    const rows=window.JMS_LAST_CAMPAIGN_ROWS || campaignPreviewRows();
    const campaign={id:uid(),type:document.getElementById('wcType')?.value||'followup',type_label:campaignTypeLabel(document.getElementById('wcType')?.value),segment:document.getElementById('wcSegment')?.value||'all',status:'draft',count:rows.length,ready_count:rows.filter(r=>r.status.ready).length,created_by:currentUser?.name||'',created_at:nowIso(),items:rows.map(r=>({customer_id:r.customer.id,customer_name:r.customer.name,phone:r.phone,message:r.message,ready:r.status.ready,reason:r.status.reason}))};
    db.whatsappCampaigns.unshift(campaign); save(); jmsRenderWhatsappCampaigns(); alert('تم حفظ الحملة كمسودة');
  };
  window.jmsApproveAndSendCampaign=async function(){
    if(!canUseCampaigns()) return alert('لا تملك صلاحية'); ensureCampaignDb();
    const rows=(window.JMS_LAST_CAMPAIGN_ROWS || campaignPreviewRows()).filter(r=>r.status.ready).slice(0, Number(db.whatsappSettings?.maxBatch||50));
    if(!rows.length) return alert('لا يوجد عملاء جاهزين للإرسال');
    const ok=confirm(`سيتم اعتماد وإرسال ${rows.length} رسالة. هل توافق؟`); if(!ok) return;
    const campaign={id:uid(),type:document.getElementById('wcType')?.value||'followup',type_label:campaignTypeLabel(document.getElementById('wcType')?.value),segment:document.getElementById('wcSegment')?.value||'all',status:'approved',count:rows.length,ready_count:rows.length,created_by:currentUser?.name||'',created_at:nowIso(),items:rows.map(r=>({customer_id:r.customer.id,customer_name:r.customer.name,phone:r.phone,message:r.message,ready:true}))};
    db.whatsappCampaigns.unshift(campaign); save();
    try{
      const payload={campaign_id:campaign.id,previewOnly:false,messages:rows.map(r=>({customer_id:r.customer.id,name:r.customer.name,phone:r.phone,message:r.message}))};
      const res=await fetch('/api/whatsapp-campaign-send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({ok:false,error:'bad_response'}));
      const results=data.results||[];
      results.forEach((x,i)=>{
        const r=rows[i]; db.whatsappMessageLog.unshift({id:uid(),campaign_id:campaign.id,customer_id:r.customer.id,customer_name:r.customer.name,phone:r.phone,message:r.message,status:x.ok?'sent':(x.mode==='fallback_link'?'fallback_link':'failed'),error:x.error||'',url:x.url||'',at:nowIso(),by:currentUser?.name||''});
      });
      campaign.status=data.ok?'sent':'partial'; campaign.sent_at=nowIso(); campaign.api_mode=data.mode||''; save(); jmsRenderWhatsappCampaigns();
      const fallback=results.find(x=>x.url)?.url; if(fallback && confirm('بعض الرسائل تحتاج فتح واتساب يدويًا. هل تفتح أول رابط؟')) window.open(fallback,'_blank');
      alert(data.ok?'تم تنفيذ الإرسال/التجهيز وحفظ السجل':'تمت المحاولة. راجع السجل لمعرفة الرسائل التي تحتاج إرسال يدوي أو إعداد WhatsApp API.');
    }catch(e){ console.error(e); campaign.status='failed'; save(); alert('تعذر الاتصال بخدمة الإرسال. تأكد من رفع api/whatsapp-campaign-send.js وإعداد متغيرات واتساب.'); }
  };
  window.jmsRenderWhatsappCampaigns=function(){
    ensureCampaignDb(); addCampaignPage();
    const rows=window.JMS_LAST_CAMPAIGN_ROWS || campaignPreviewRows(); renderPreview(rows);
    const log=document.getElementById('wcLog'); if(log){
      const campaigns=(db.whatsappCampaigns||[]).slice(0,10); const messages=(db.whatsappMessageLog||[]).slice(0,20);
      log.innerHTML=`<h3>آخر الحملات</h3>${campaigns.map(c=>`<div class="jms-campaign-log-row"><b>${esc(c.type_label||c.type)}</b> — ${esc(c.status)} — ${c.ready_count||0}/${c.count||0}<br><span class="jms-muted">${esc(c.created_at||'')} · ${esc(c.created_by||'')}</span></div>`).join('')||'<div class="jms-muted">لا توجد حملات محفوظة.</div>'}<h3>آخر الرسائل</h3>${messages.map(m=>`<div class="jms-campaign-log-row"><b>${esc(m.customer_name)}</b> — <span class="jms-campaign-badge ${m.status==='sent'?'ok':m.status==='failed'?'bad':'warn'}">${esc(m.status)}</span><br><span class="jms-muted">${esc(m.at||'')} · ${esc(m.phone||'')}</span>${m.url?`<br><button class="jms-link-btn" onclick="window.open('${esc(m.url)}','_blank')">فتح رابط الإرسال</button>`:''}</div>`).join('')||'<div class="jms-muted">لا توجد رسائل.</div>'}`;
    }
  };
  window.jmsOpenWaLink=function(phone,msg){ const to=normalizePhone(phone); if(!to) return alert('لا يوجد رقم'); window.open('https://wa.me/'+to+'?text='+encodeURIComponent(msg||''),'_blank'); };
  window.jmsCopyCampaignMessage=function(cid){ const rows=window.JMS_LAST_CAMPAIGN_ROWS || campaignPreviewRows(); const r=rows.find(x=>x.customer.id===cid); if(!r) return; navigator.clipboard?.writeText(r.message); alert('تم نسخ الرسالة'); };
  window.jmsCampaignSetOptOut=function(cid,val){ const c=(db.customers||[]).find(x=>x.id===cid); if(!c)return; c.whatsapp_opt_out=!!val; save(); jmsRenderWhatsappCampaigns(); alert('تم تحديث حالة واتساب للعميل'); };
  window.jmsExportCampaignPreview=function(){ const rows=window.JMS_LAST_CAMPAIGN_ROWS || campaignPreviewRows(); const txt=rows.map((r,i)=>`${i+1}. ${r.customer.name} | ${r.phone||'-'} | ${r.status.reason}\n${r.message}`).join('\n\n'); navigator.clipboard?.writeText(txt); alert('تم نسخ قائمة الحملة'); };
  const oldLocal=window.jmsAiLocalAnswerFinal;
  window.jmsAiLocalAnswerFinal=function(q){
    q=String(q||'');
    if(/حملة|واتساب|رسائل العملاء|ارسل للعملاء|رسالة للعملاء|إرسال جماعي/.test(q)){
      return 'افتح صفحة "حملات واتساب الذكية". اختر نوع الحملة والعملاء، ثم اضغط "توليد ومعاينة". النظام سيكتب الرسائل ويعرضها عليك، ولا يرسل إلا بعد اعتمادك.';
    }
    return oldLocal?oldLocal(q):null;
  };
  const oldRenderAll=window.renderAll;
  window.renderAll=function(){ if(typeof oldRenderAll==='function') oldRenderAll(); ensureCampaignDb(); injectCampaignStyle(); addCampaignPage(); if(document.getElementById('whatsappCampaigns')?.classList.contains('active')) jmsRenderWhatsappCampaigns(); };
  ready(()=>{ ensureCampaignDb(); injectCampaignStyle(); addCampaignPage(); setTimeout(()=>{ if(typeof jmsRenderWhatsappCampaigns==='function') jmsRenderWhatsappCampaigns(); },600); });
  window.JMS_AI_WHATSAPP_CAMPAIGNS_VERSION=CAMPAIGN_VERSION;
})();

/* JMS UPDATE 11A - PRODUCTION ORDERS & WORKFLOW */
(function(){
  const VERSION='11A-PRODUCTION-ORDERS-WORKFLOW';
  const STAGES=[
    {key:'pending_manager',label:'بانتظار موافقة المدير',short:'موافقة المدير',icon:'🕘'},
    {key:'manager_approved',label:'تم اعتماد المدير',short:'اعتماد',icon:'✅'},
    {key:'payment_confirmed',label:'تم تسجيل التحويل',short:'التحويل',icon:'💳'},
    {key:'sent_to_production',label:'أرسل للإنتاج',short:'إرسال للإنتاج',icon:'📤'},
    {key:'production_received',label:'استلام مدير الإنتاج',short:'استلام الإنتاج',icon:'🏭'},
    {key:'technical_plan',label:'تجهيز الخطة الفنية',short:'الخطة الفنية',icon:'📋'},
    {key:'film_production',label:'إنتاج الفيلم',short:'الفيلم',icon:'🎞️'},
    {key:'sent_to_cutting',label:'إرسال للمقص',short:'إلى المقص',icon:'➡️'},
    {key:'cutting',label:'التقطيع / المقص',short:'المقص',icon:'✂️'},
    {key:'packing',label:'التغليف',short:'التغليف',icon:'📦'},
    {key:'ready_delivery',label:'جاهز للتسليم',short:'جاهز',icon:'🚚'},
    {key:'delivered',label:'تم التسليم',short:'مكتمل',icon:'✅'}
  ];
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn); else fn(); }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
  function uid(){ try{return crypto.randomUUID()}catch(e){return 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2)} }
  function todaySafe(){ return (typeof today==='function') ? today() : new Date().toISOString().slice(0,10); }
  function nowIso(){ return new Date().toISOString(); }
  function canManageProduction(){ const r=currentUser?.role; return ['admin','sales','production','production_manager','manager'].includes(r); }
  function customerLabel(id){ try{return customerName(id)}catch(e){ return (db.customers||[]).find(c=>c.id===id)?.name || '-'; } }
  function repLabel(id){ try{return repName(id)}catch(e){ return (db.reps||[]).find(r=>r.id===id)?.name || '-'; } }
  function moneySafe(n){ try{return money(n)}catch(e){ return Number(n||0).toLocaleString('ar-SA'); } }
  function stageIndex(key){ return Math.max(0, STAGES.findIndex(s=>s.key===key)); }
  function stageObj(key){ return STAGES[stageIndex(key)] || STAGES[0]; }
  function stageLabel(key){ return stageObj(key).label; }
  function nextStage(key){ const i=stageIndex(key); return STAGES[Math.min(i+1,STAGES.length-1)]?.key || key; }
  function productionNo(){ const n=(db.productionOrders||[]).length+1; return 'MO-'+todaySafe().slice(0,4)+'-'+String(n).padStart(5,'0'); }
  function ensureDb(){
    if(!window.db) return;
    db.productionOrders ||= [];
    db.productionLogs ||= [];
    db.productionSettings ||= { defaultStages: STAGES.map(s=>s.key) };
    (db.productionOrders||[]).forEach(p=>{
      p.stage ||= p.status_key || 'pending_manager';
      p.production_no ||= productionNo();
      p.created_at ||= nowIso();
      p.technical ||= {};
      p.notes ||= [];
    });
  }
  function baseOrder(o){ return (db.orders||[]).find(x=>x.id===o.order_id) || {}; }
  function productionByOrder(orderId){ return (db.productionOrders||[]).find(p=>p.order_id===orderId); }
  function logProduction(pid, action, note){
    db.productionLogs ||= [];
    const p=(db.productionOrders||[]).find(x=>x.id===pid);
    db.productionLogs.unshift({id:uid(),production_id:pid,order_id:p?.order_id||'',stage:p?.stage||'',action, note:note||'',by:currentUser?.name||'',by_id:currentUser?.id||'',at:nowIso()});
  }
  function saveDb(){ if(typeof save==='function') save(); }
  function createProductionFromOrder(orderId){
    ensureDb();
    if(!canManageProduction()) return alert('هذه الصلاحية للمدير أو مدير الإنتاج فقط');
    const o=(db.orders||[]).find(x=>x.id===orderId);
    if(!o) return alert('لم يتم العثور على الطلب');
    let existing=productionByOrder(orderId);
    if(existing){ window.openProductionOrder(existing.id); return; }
    const p={
      id:uid(), production_no:productionNo(), order_id:o.id,
      customer_id:o.customer_id, rep_id:o.rep_id, date:o.date||todaySafe(),
      product:o.product||'', material:o.material||'', color:o.color||'',
      width:o.width||'', length:o.length||'', thickness:o.thickness||'', total_kg:o.total_kg||'', pieces:o.pieces||'', piece_weight:o.piece_weight||'',
      amount_value:o.amount_value||0, stage:'pending_manager', priority:'normal', due_date:'',
      created_by:currentUser?.name||'', created_at:nowIso(), updated_at:nowIso(),
      technical:{
        production_type:o.product||'', machine:'', operator:'', film_width:o.width||'', film_thickness:o.thickness||'', film_unit:'micron',
        film_micron:o.thickness||'', roll_count:'', roll_weight:'', expected_kg:o.total_kg||'', actual_kg:'', waste_kg:'',
        cut_width:o.width||'', cut_length:o.length||'', bag_size:'', seal_type:'', opening_side:'', print_status:'',
        film_notes:'', cutting_notes:'', packing_notes:'', floor_notes:''
      },
      notes:[]
    };
    db.productionOrders.unshift(p);
    o.production_id=p.id;
    o.status='بانتظار موافقة المدير';
    logProduction(p.id,'إنشاء أمر تصنيع','تم إنشاء أمر التصنيع من طلب المبيعات');
    saveDb(); window.renderProductionWorkflow?.(); alert('تم إنشاء أمر التصنيع');
  }
  function addStyle(){
    if(document.getElementById('jmsProduction11AStyle')) return;
    const st=document.createElement('style'); st.id='jmsProduction11AStyle';
    st.textContent=`
      .jms-prod-wrap{display:grid;gap:16px}.jms-prod-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.jms-prod-kpi{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:15px;box-shadow:0 10px 26px rgba(15,23,42,.05)}.jms-prod-kpi span{display:block;color:#64748b;font-size:12px}.jms-prod-kpi b{font-size:24px;color:#0f172a}.jms-prod-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.jms-prod-col{background:#f8fafc;border:1px solid #e5e7eb;border-radius:18px;padding:12px;min-height:150px}.jms-prod-col h3{margin:0 0 10px;font-size:15px;display:flex;align-items:center;justify-content:space-between}.jms-prod-count{background:#e2e8f0;border-radius:999px;padding:3px 9px;font-size:12px}.jms-prod-card{background:#fff;border:1px solid #e5e7eb;border-radius:15px;padding:12px;margin-bottom:10px;box-shadow:0 8px 22px rgba(15,23,42,.06)}.jms-prod-card h4{margin:0 0 6px}.jms-prod-card p{margin:3px 0;color:#475569;font-size:13px}.jms-prod-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.jms-prod-actions button,.jms-prod-btn{border:0;border-radius:10px;padding:8px 11px;cursor:pointer;background:#e2e8f0}.jms-prod-actions .primary,.jms-prod-btn.primary{background:#2563eb;color:#fff}.jms-prod-btn.green{background:#16a34a;color:#fff}.jms-prod-btn.orange{background:#ea580c;color:#fff}.jms-stage-line{display:flex;gap:4px;margin-top:10px;overflow:auto}.jms-stage-dot{height:8px;min-width:22px;border-radius:999px;background:#e2e8f0}.jms-stage-dot.done{background:#16a34a}.jms-production-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.jms-production-form label{font-size:12px;color:#475569}.jms-production-form input,.jms-production-form select,.jms-production-form textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px;margin-top:4px}.jms-prod-timeline{border-right:3px solid #e2e8f0;padding-right:12px;margin-top:12px}.jms-prod-log{background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:10px;margin-bottom:8px}.jms-prod-log b{color:#0f172a}.jms-prod-log span{color:#64748b;font-size:12px}.jms-prod-note{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px;margin:8px 0}.jms-prod-muted{color:#64748b;font-size:12px}.jms-prod-badge{display:inline-block;border-radius:999px;padding:4px 9px;background:#dbeafe;color:#1d4ed8;font-size:12px}.jms-prod-badge.done{background:#dcfce7;color:#166534}.jms-prod-badge.warn{background:#fef3c7;color:#92400e}.jms-prod-table{width:100%;border-collapse:collapse}.jms-prod-table th,.jms-prod-table td{border-bottom:1px solid #e5e7eb;padding:10px;text-align:right;font-size:13px}.jms-prod-table th{color:#475569;background:#f8fafc}.jms-prod-public{background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:12px}
    `;
    document.head.appendChild(st);
  }
  function addPage(){
    const main=document.querySelector('main.main') || document.querySelector('.main');
    const nav=document.querySelector('aside nav') || document.querySelector('nav');
    if(!main || !nav) return;
    if(!document.querySelector('.nav[data-page="productionWorkflow"]')){
      const btn=document.createElement('button'); btn.className='nav manager-only'; btn.dataset.page='productionWorkflow'; btn.textContent='خط الإنتاج 11A';
      const ordersBtn=nav.querySelector('[data-page="orders"]');
      if(ordersBtn && ordersBtn.nextSibling) nav.insertBefore(btn, ordersBtn.nextSibling); else nav.appendChild(btn);
    }
    if(!document.getElementById('productionWorkflow')){
      const sec=document.createElement('section'); sec.id='productionWorkflow'; sec.className='page';
      sec.innerHTML=`
        <div class="page-head with-action"><div><h1>خط الإنتاج وأوامر التصنيع</h1><p>تحويل طلب المبيعات إلى أمر تصنيع ومتابعته: اعتماد → تحويل → إنتاج → فيلم → مقص → تغليف.</p></div><div class="head-actions"><button class="primary" onclick="renderProductionWorkflow()">تحديث</button></div></div>
        <div class="jms-prod-wrap">
          <div class="jms-prod-kpis"><div class="jms-prod-kpi"><span>أوامر مفتوحة</span><b id="prodOpenCount">0</b></div><div class="jms-prod-kpi"><span>تحت الإنتاج</span><b id="prodActiveCount">0</b></div><div class="jms-prod-kpi"><span>جاهز للتسليم</span><b id="prodReadyCount">0</b></div><div class="jms-prod-kpi"><span>مكتمل</span><b id="prodDoneCount">0</b></div></div>
          <div class="panel"><div class="panel-head"><b>إنشاء أمر تصنيع من طلب موجود</b><span>المندوب يدخل الطلب مختصرًا، ومدير الإنتاج يفصله فنيًا من هنا.</span></div><div class="jms-production-form"><label>طلب المبيعات<select id="prodOrderSelect"></select></label><label>ملاحظة أولية<input id="prodCreateNote" placeholder="مثلاً: تحويل بعد اعتماد المدير"></label><div style="display:flex;align-items:end"><button class="jms-prod-btn primary" onclick="createProductionFromSelectedOrder()">إنشاء أمر تصنيع</button></div></div></div>
          <div class="panel"><div class="panel-head"><b>لوحة مراحل الإنتاج</b><span>كل مرحلة تسجل وقت واسم المستخدم والملاحظات.</span></div><div id="productionBoard" class="jms-prod-board"></div></div>
          <div class="panel"><div class="panel-head"><b>آخر حركة في الإنتاج</b><span>سجل زمني مختصر</span></div><div id="productionTimelineShort"></div></div>
        </div>`;
      main.appendChild(sec);
    }
    document.querySelectorAll('.nav').forEach(btn=>{
      if(btn.dataset.prod11aBound==='1') return;
      btn.dataset.prod11aBound='1';
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active'); const p=document.getElementById(btn.dataset.page); if(p) p.classList.add('active');
        if(btn.dataset.page==='productionWorkflow') window.renderProductionWorkflow?.();
      });
    });
  }
  function availableOrders(){
    ensureDb();
    const existing=new Set((db.productionOrders||[]).map(p=>p.order_id));
    return (db.orders||[]).filter(o=>!existing.has(o.id));
  }
  function renderOrderSelect(){
    const sel=document.getElementById('prodOrderSelect'); if(!sel) return;
    const rows=availableOrders();
    sel.innerHTML=rows.map(o=>`<option value="${esc(o.id)}">${esc(customerLabel(o.customer_id))} — ${esc(o.product||'-')} — ${esc(o.date||'-')} — ${moneySafe(o.amount_value||0)} ريال</option>`).join('') || '<option value="">لا توجد طلبات جديدة للتحويل</option>';
  }
  function renderKpis(){
    const ps=db.productionOrders||[];
    const open=ps.filter(p=>p.stage!=='delivered').length;
    const active=ps.filter(p=>['sent_to_production','production_received','technical_plan','film_production','sent_to_cutting','cutting','packing'].includes(p.stage)).length;
    const ready=ps.filter(p=>p.stage==='ready_delivery').length;
    const done=ps.filter(p=>p.stage==='delivered').length;
    const set=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;};
    set('prodOpenCount',open); set('prodActiveCount',active); set('prodReadyCount',ready); set('prodDoneCount',done);
  }
  function renderStageLine(stage){
    const idx=stageIndex(stage);
    return `<div class="jms-stage-line">${STAGES.map((s,i)=>`<span title="${esc(s.label)}" class="jms-stage-dot ${i<=idx?'done':''}"></span>`).join('')}</div>`;
  }
  function card(p){
    const o=baseOrder(p); const s=stageObj(p.stage);
    const tech=p.technical||{};
    return `<div class="jms-prod-card"><h4>${s.icon} ${esc(p.production_no)}</h4><p><b>${esc(customerLabel(p.customer_id||o.customer_id))}</b> · ${esc(p.product||o.product||'-')}</p><p>المقاس: ${esc(p.width||o.width||'-')} × ${esc(p.length||o.length||'-')} · السماكة: ${esc(p.thickness||o.thickness||'-')} · الكمية: ${esc(p.total_kg||o.total_kg||'-')} كجم</p><p>المندوب: ${esc(repLabel(p.rep_id||o.rep_id))} · التسليم: ${esc(p.due_date||'-')}</p><p class="jms-prod-muted">الفيلم: ${esc(tech.film_width||'-')} عرض · ${esc(tech.film_micron||tech.film_thickness||'-')} ميكرون · الرولات: ${esc(tech.roll_count||'-')}</p>${renderStageLine(p.stage)}<div class="jms-prod-actions"><button class="primary" onclick="openProductionOrder('${p.id}')">فتح</button>${canManageProduction()&&p.stage!=='delivered'?`<button onclick="advanceProductionStage('${p.id}')">المرحلة التالية</button>`:''}<button onclick="addProductionQuickNote('${p.id}')">ملاحظة</button></div></div>`;
  }
  function renderBoard(){
    const board=document.getElementById('productionBoard'); if(!board) return;
    const ps=db.productionOrders||[];
    board.innerHTML=STAGES.map(s=>{
      const rows=ps.filter(p=>(p.stage||'pending_manager')===s.key);
      return `<div class="jms-prod-col"><h3><span>${s.icon} ${s.short}</span><span class="jms-prod-count">${rows.length}</span></h3>${rows.map(card).join('') || '<div class="jms-prod-muted">لا يوجد أوامر في هذه المرحلة</div>'}</div>`;
    }).join('');
  }
  function renderTimelineShort(){
    const box=document.getElementById('productionTimelineShort'); if(!box) return;
    const rows=(db.productionLogs||[]).slice(0,12);
    box.innerHTML=rows.map(l=>`<div class="jms-prod-log"><b>${esc(l.action)}</b> — ${esc(stageLabel(l.stage))}<br><span>${esc(new Date(l.at).toLocaleString('ar-SA'))} · ${esc(l.by||'-')} · ${esc((db.productionOrders||[]).find(p=>p.id===l.production_id)?.production_no||'')}</span>${l.note?`<div>${esc(l.note)}</div>`:''}</div>`).join('') || '<div class="jms-prod-muted">لا يوجد سجل حركة حتى الآن.</div>';
  }
  window.renderProductionWorkflow=function(){ ensureDb(); addStyle(); addPage(); renderOrderSelect(); renderKpis(); renderBoard(); renderTimelineShort(); };
  window.createProductionFromSelectedOrder=function(){
    const sel=document.getElementById('prodOrderSelect');
    const oid=sel?.value;
    if(!oid) return alert('اختر طلبًا أولًا');
    createProductionFromOrder(oid);
    const p=productionByOrder(oid); const note=document.getElementById('prodCreateNote')?.value||''; if(p && note){ logProduction(p.id,'ملاحظة إنشاء',note); saveDb(); }
    window.renderProductionWorkflow();
  };
  window.openProductionOrder=function(pid){
    ensureDb();
    const p=(db.productionOrders||[]).find(x=>x.id===pid); if(!p) return alert('لم يتم العثور على أمر التصنيع');
    const o=baseOrder(p); const tech=p.technical ||= {}; const s=stageObj(p.stage);
    const logs=(db.productionLogs||[]).filter(l=>l.production_id===pid).slice(0,30);
    const notes=p.notes||[];
    const statusOptions=STAGES.map(x=>`<option value="${x.key}" ${x.key===p.stage?'selected':''}>${x.label}</option>`).join('');
    const html=`<h2>أمر تصنيع ${esc(p.production_no)}</h2><p><span class="jms-prod-badge ${p.stage==='delivered'?'done':''}">${s.icon} ${esc(s.label)}</span></p>
      <div class="jms-prod-public"><b>طلب العميل المختصر:</b><br>العميل: ${esc(customerLabel(p.customer_id||o.customer_id))} · المنتج: ${esc(p.product||o.product||'-')} · المقاس: ${esc(p.width||o.width||'-')} × ${esc(p.length||o.length||'-')} · السماكة: ${esc(p.thickness||o.thickness||'-')} · الكمية: ${esc(p.total_kg||o.total_kg||'-')} كجم</div>
      <h3>تفاصيل مدير الإنتاج / كرت التصنيع</h3>
      <div class="jms-production-form">
        <label>الحالة<select id="poStage">${statusOptions}</select></label><label>الأولوية<select id="poPriority"><option value="normal" ${p.priority==='normal'?'selected':''}>عادي</option><option value="high" ${p.priority==='high'?'selected':''}>عاجل</option><option value="hold" ${p.priority==='hold'?'selected':''}>إيقاف مؤقت</option></select></label><label>تاريخ التسليم المتوقع<input id="poDue" type="date" value="${esc(p.due_date||'')}"></label>
        <label>نوع الإنتاج<input id="poType" value="${esc(tech.production_type||p.product||'')}"></label><label>الماكينة<input id="poMachine" value="${esc(tech.machine||'')}"></label><label>المشغل<input id="poOperator" value="${esc(tech.operator||'')}"></label>
      </div>
      <h3>بيانات أمر التشغيل الورقي</h3>
      <div class="jms-production-form">
        <label>رقم أمر التشغيل / OR No<input id="poOrNo" value="${esc(tech.or_no||p.production_no||'')}"></label><label>تاريخ الأمر<input id="poFormDate" value="${esc(tech.form_date||'')}" placeholder="مثال: 04/01/2026"></label><label>مدة التسليم<input id="poDeliveryTime" value="${esc(tech.delivery_time||'')}" placeholder="مثال: 3 يوم"></label>
        <label>التعبئة / Packing<input id="poPackingSpec" value="${esc(tech.packing_spec||'')}" placeholder="مثال: SABIC BAG 20KG"></label><label>المقاس / Size<input id="poPaperSize" value="${esc(tech.paper_size||'')}" placeholder="مثال: 1/1"></label><label>المنطقة / Region<input id="poRegion" value="${esc(tech.region||'')}"></label>
        <label>المندوب / Salesman<input id="poSalesman" value="${esc(tech.salesman||repLabel(p.rep_id||o.rep_id)||'')}"></label><label>مكان التسليم<input id="poDeliveryTo" value="${esc(tech.delivery_to||'')}"></label><label>رقم العقد<input id="poContractNo" value="${esc(tech.contract_no||'')}"></label>
        <label>العميل<input id="poCustomerName" value="${esc(tech.customer_name||customerLabel(p.customer_id||o.customer_id)||'')}"></label><label>الكمية المطلوبة كجم<input id="poRequiredKg" value="${esc(tech.required_kg||p.total_kg||'')}"></label><label>ملاحظات البيان<input id="poStatementNote" value="${esc(tech.statement_note||'')}" placeholder="مثل: PACKING COVER"></label>
      </div>
      <h3>مواصفات الفيلم والكيس</h3>
      <div class="jms-production-form">
        <label>نوع البلاستيك<select id="poPlasticType"><option value="">اختر</option>${['LD','HD','LLD','PP','Mix'].map(x=>`<option value="${x}" ${tech.plastic_type===x?'selected':''}>${x}</option>`).join('')}</select></label><label>نوع الكيس<input id="poBagType" value="${esc(tech.bag_type||'')}" placeholder="مثال: HANDLE"></label><label>لون اليد<input id="poHandleColor" value="${esc(tech.handle_color||'')}" placeholder="مثال: GOLD"></label>
        <label>موديل اليد<input id="poHandleModel" value="${esc(tech.handle_model||'')}"></label><label>نوع اليد<input id="poHandleType" value="${esc(tech.handle_type||'')}"></label><label>نوع السوليد<input id="poSolidType" value="${esc(tech.solid_type||'')}"></label>
        <label>الطول سم<input id="poLengthCm" value="${esc(tech.length_cm||p.length||'')}"></label><label>العرض سم<input id="poWidthCm" value="${esc(tech.width_cm||p.width||'')}"></label><label>الكاست / Gusset<input id="poGusset" value="${esc(tech.gusset||'')}" placeholder="مثال: 7 + 7"></label>
        <label>السماكة ميكرون<input id="poMicron" value="${esc(tech.micron||tech.film_micron||p.thickness||'')}"></label><label>لون البلاستيك<input id="poPlasticColor" value="${esc(tech.plastic_color||'')}" placeholder="WHITE"></label><label>الماستر باتش<input id="poMasterBatch" value="${esc(tech.master_batch||'')}"></label>
        <label>اسم ألوان الطباعة<input id="poPrintColorName" value="${esc(tech.print_color_name||'')}"></label><label>لون الحبر<input id="poInkColor" value="${esc(tech.ink_color||'')}"></label><label>شكل الإنتاج<select id="poOutputShape"><option value="">اختر</option>${['ONE SIDE OPEN','SINGLE SHEET','TUBE','JUMBO'].map(x=>`<option value="${x}" ${tech.output_shape===x?'selected':''}>${x}</option>`).join('')}</select></label>
        <label>عرض التيوب / الجنب<input id="poTubeWidth" value="${esc(tech.tube_width||'')}" placeholder="مثال: 54 cm"></label><label>مقاس الكيس النهائي<input id="poBagSize" value="${esc(tech.bag_size||'')}"></label><label>مكان الفتح<input id="poOpenSide" value="${esc(tech.opening_side||'')}"></label>
      </div>
      <h3>اللحام والطباعة والكليشة</h3>
      <div class="jms-production-form">
        <label>طريقة اللحام<select id="poSeal"><option value="">اختر</option>${['No Sealing','T-Shirt','Side Sealing','Bottom Sealing'].map(x=>`<option value="${x}" ${tech.seal_type===x?'selected':''}>${x}</option>`).join('')}</select></label><label>طباعة وجه واحد<select id="poOneSidePrinting"><option value="">اختر</option><option value="yes" ${tech.one_side_printing==='yes'?'selected':''}>نعم</option><option value="no" ${tech.one_side_printing==='no'?'selected':''}>لا</option></select></label><label>طباعة وجهين<select id="poTwoSidePrinting"><option value="">اختر</option><option value="yes" ${tech.two_side_printing==='yes'?'selected':''}>نعم</option><option value="no" ${tech.two_side_printing==='no'?'selected':''}>لا</option></select></label>
        <label>الطباعة خارج الكاست<select id="poPrintingOutGusset"><option value="">اختر</option><option value="yes" ${tech.printing_out_gusset==='yes'?'selected':''}>نعم</option><option value="no" ${tech.printing_out_gusset==='no'?'selected':''}>لا</option></select></label><label>الطباعة داخل الكاست<select id="poPrintingInsideGusset"><option value="">اختر</option><option value="yes" ${tech.printing_inside_gusset==='yes'?'selected':''}>نعم</option><option value="no" ${tech.printing_inside_gusset==='no'?'selected':''}>لا</option></select></label><label>حالة الطباعة<input id="poPrintStatus" value="${esc(tech.print_status||'')}"></label>
        <label>الكليشة<select id="poClicheStatus"><option value="">اختر</option>${['Cancel','Additional','Correction','Exist in Factory','Old Attach','New Attach'].map(x=>`<option value="${x}" ${tech.cliche_status===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Size Block<input id="poSizeBlock" value="${esc(tech.size_block||'')}" placeholder="S / M / L / XL"></label><label>ملاحظات الكليشة<input id="poClicheNotes" value="${esc(tech.cliche_notes||'')}"></label>
      </div>
      <h3>الإنتاج الفعلي والملاحظات الفنية</h3>
      <div class="jms-production-form">
        <label>عرض الفيلم<input id="poFilmWidth" value="${esc(tech.film_width||p.width||'')}"></label><label>سماكة الفيلم / ميكرون<input id="poFilmMicron" value="${esc(tech.film_micron||tech.film_thickness||p.thickness||'')}"></label><label>عدد الرولات<input id="poRollCount" value="${esc(tech.roll_count||'')}"></label>
        <label>وزن الرول<input id="poRollWeight" value="${esc(tech.roll_weight||'')}"></label><label>الوزن المتوقع كجم<input id="poExpectedKg" value="${esc(tech.expected_kg||p.total_kg||'')}"></label><label>الوزن الفعلي كجم<input id="poActualKg" value="${esc(tech.actual_kg||'')}"></label>
        <label>هالك كجم<input id="poWasteKg" value="${esc(tech.waste_kg||'')}"></label><label>عرض القص<input id="poCutWidth" value="${esc(tech.cut_width||p.width||'')}"></label><label>طول القص<input id="poCutLength" value="${esc(tech.cut_length||p.length||'')}"></label>
        <label>ملاحظات الفيلم<textarea id="poFilmNotes">${esc(tech.film_notes||'')}</textarea></label><label>ملاحظات المقص<textarea id="poCuttingNotes">${esc(tech.cutting_notes||'')}</textarea></label><label>ملاحظات التغليف<textarea id="poPackingNotes">${esc(tech.packing_notes||'')}</textarea></label>
        <label>ترتيشات / تعديلات أرض المصنع<textarea id="poFloorNotes" placeholder="أي تعديل في المقاس، السماكة، الحرارة، الخلطة، القص، أو ملاحظة للمشغل">${esc(tech.floor_notes||'')}</textarea></label>
      </div>
      <div class="jms-prod-actions"><button class="jms-prod-btn primary" onclick="saveProductionTechnical('${p.id}')">حفظ كرت التصنيع</button><button class="jms-prod-btn green" onclick="advanceProductionStage('${p.id}')">إرسال للمرحلة التالية</button><button class="jms-prod-btn orange" onclick="addProductionQuickNote('${p.id}')">إضافة ملاحظة / مشكلة</button></div>
      <h3>الملاحظات الفنية</h3>${notes.map(n=>`<div class="jms-prod-note"><b>${esc(n.type||'ملاحظة')}</b> — ${esc(n.by||'')}<br><span class="jms-prod-muted">${esc(new Date(n.at).toLocaleString('ar-SA'))}</span><div>${esc(n.text||'')}</div></div>`).join('') || '<div class="jms-prod-muted">لا توجد ملاحظات فنية.</div>'}
      <h3>سجل الحركة</h3><div class="jms-prod-timeline">${logs.map(l=>`<div class="jms-prod-log"><b>${esc(l.action)}</b><br><span>${esc(new Date(l.at).toLocaleString('ar-SA'))} · ${esc(l.by||'-')} · ${esc(stageLabel(l.stage))}</span>${l.note?`<div>${esc(l.note)}</div>`:''}</div>`).join('') || '<div class="jms-prod-muted">لا يوجد سجل.</div>'}</div>`;
    if(window.modalBody && window.modal){ modalBody.innerHTML=html; modal.classList.remove('hidden'); } else { alert('تعذر فتح نافذة التفاصيل'); }
  };
  window.saveProductionTechnical=function(pid){
    const p=(db.productionOrders||[]).find(x=>x.id===pid); if(!p) return;
    p.stage=document.getElementById('poStage')?.value || p.stage; p.priority=document.getElementById('poPriority')?.value || p.priority; p.due_date=document.getElementById('poDue')?.value || '';
    const v=id=>document.getElementById(id)?.value||'';
    p.technical={...(p.technical||{}),
      production_type:v('poType'), machine:v('poMachine'), operator:v('poOperator'),
      or_no:v('poOrNo'), form_date:v('poFormDate'), delivery_time:v('poDeliveryTime'), packing_spec:v('poPackingSpec'), paper_size:v('poPaperSize'), region:v('poRegion'), salesman:v('poSalesman'), delivery_to:v('poDeliveryTo'), contract_no:v('poContractNo'), customer_name:v('poCustomerName'), required_kg:v('poRequiredKg'), statement_note:v('poStatementNote'),
      plastic_type:v('poPlasticType'), bag_type:v('poBagType'), handle_color:v('poHandleColor'), handle_model:v('poHandleModel'), handle_type:v('poHandleType'), solid_type:v('poSolidType'), length_cm:v('poLengthCm'), width_cm:v('poWidthCm'), gusset:v('poGusset'), micron:v('poMicron'), plastic_color:v('poPlasticColor'), master_batch:v('poMasterBatch'), print_color_name:v('poPrintColorName'), ink_color:v('poInkColor'), output_shape:v('poOutputShape'), tube_width:v('poTubeWidth'),
      film_width:v('poFilmWidth'), film_micron:v('poFilmMicron'), film_thickness:v('poFilmMicron'), roll_count:v('poRollCount'), roll_weight:v('poRollWeight'), expected_kg:v('poExpectedKg'), actual_kg:v('poActualKg'), waste_kg:v('poWasteKg'), cut_width:v('poCutWidth'), cut_length:v('poCutLength'), bag_size:v('poBagSize'), seal_type:v('poSeal'), opening_side:v('poOpenSide'),
      one_side_printing:v('poOneSidePrinting'), two_side_printing:v('poTwoSidePrinting'), printing_out_gusset:v('poPrintingOutGusset'), printing_inside_gusset:v('poPrintingInsideGusset'), print_status:v('poPrintStatus'), cliche_status:v('poClicheStatus'), size_block:v('poSizeBlock'), cliche_notes:v('poClicheNotes'),
      film_notes:v('poFilmNotes'), cutting_notes:v('poCuttingNotes'), packing_notes:v('poPackingNotes'), floor_notes:v('poFloorNotes')};
    p.updated_at=nowIso();
    const o=baseOrder(p); if(o){ o.status=stageLabel(p.stage); o.production_stage=p.stage; o.production_id=p.id; }
    logProduction(pid,'تحديث كرت التصنيع','تم حفظ التفاصيل الفنية وحالة الإنتاج'); saveDb(); window.renderProductionWorkflow(); window.openProductionOrder(pid); alert('تم حفظ كرت التصنيع');
  };
  window.advanceProductionStage=function(pid){
    const p=(db.productionOrders||[]).find(x=>x.id===pid); if(!p) return;
    if(!canManageProduction()) return alert('هذه الصلاحية للمدير أو مدير الإنتاج فقط');
    const old=p.stage; const next=nextStage(old);
    if(next===old) return alert('الأمر مكتمل بالفعل');
    const note=prompt(`نقل من: ${stageLabel(old)}\nإلى: ${stageLabel(next)}\nاكتب ملاحظة اختيارية:`) || '';
    p.stage=next; p.updated_at=nowIso();
    const o=baseOrder(p); if(o){ o.status=stageLabel(next); o.production_stage=next; o.production_id=p.id; }
    logProduction(pid,'تغيير مرحلة الإنتاج',note || `تم النقل من ${stageLabel(old)} إلى ${stageLabel(next)}`); saveDb(); window.renderProductionWorkflow();
    if(window.modal && !modal.classList.contains('hidden')) window.openProductionOrder(pid);
  };
  window.addProductionQuickNote=function(pid){
    const p=(db.productionOrders||[]).find(x=>x.id===pid); if(!p) return;
    const type=prompt('نوع الملاحظة: مشكلة / تعديل / توجيه / هالك / ملاحظة') || 'ملاحظة';
    const text=prompt('اكتب الملاحظة الفنية أو مشكلة أرض المصنع:');
    if(!text) return;
    p.notes ||= []; p.notes.unshift({id:uid(),type,text,by:currentUser?.name||'',at:nowIso(),stage:p.stage});
    logProduction(pid,'ملاحظة إنتاج',`${type}: ${text}`); saveDb(); window.renderProductionWorkflow(); if(window.modal && !modal.classList.contains('hidden')) window.openProductionOrder(pid);
  };
  window.createProductionFromOrder=createProductionFromOrder;
  const oldRenderAll=window.renderAll;
  window.renderAll=function(){ if(typeof oldRenderAll==='function') oldRenderAll(); ensureDb(); addStyle(); addPage(); if(document.getElementById('productionWorkflow')?.classList.contains('active')) window.renderProductionWorkflow(); };
  const oldApiData=window.jmsAiApiDataFinal;
  window.jmsAiApiDataFinal=function(){ const data=oldApiData?oldApiData():{customers:db.customers||[],reps:db.reps||[],orders:db.orders||[]}; data.productionOrders=db.productionOrders||[]; data.productionLogs=db.productionLogs||[]; return data; };
  const oldLocal=window.jmsAiLocalAnswerFinal;
  window.jmsAiLocalAnswerFinal=function(q){
    q=String(q||'');
    if(/خط الإنتاج|التصنيع|أمر تصنيع|اوامر التصنيع|أوامر التصنيع|الفيلم|المقص|التغليف|وين وصل الطلب/.test(q)){
      ensureDb();
      const ps=db.productionOrders||[];
      if(!ps.length) return 'لا توجد أوامر تصنيع حتى الآن. افتح صفحة "خط الإنتاج 11A" وأنشئ أمر تصنيع من طلب مبيعات موجود.';
      const open=ps.filter(p=>p.stage!=='delivered');
      const lines=open.slice(0,12).map((p,i)=>`${i+1}. ${p.production_no} - ${customerLabel(p.customer_id)} - ${p.product||'-'} - الحالة: ${stageLabel(p.stage)} - التسليم: ${p.due_date||'-'}`);
      return `تقرير خط الإنتاج:\n- إجمالي أوامر التصنيع: ${ps.length}\n- أوامر مفتوحة: ${open.length}\n- جاهز للتسليم: ${ps.filter(p=>p.stage==='ready_delivery').length}\n- مكتمل: ${ps.filter(p=>p.stage==='delivered').length}\n\nالأوامر المفتوحة:\n${lines.join('\n') || 'لا توجد أوامر مفتوحة.'}`;
    }
    return oldLocal?oldLocal(q):null;
  };
  ready(()=>{ ensureDb(); addStyle(); addPage(); setTimeout(()=>{ if(document.getElementById('productionWorkflow')) window.renderProductionWorkflow(); },500); });
  window.JMS_PRODUCTION_WORKFLOW_VERSION=VERSION;
})();

/* =========================================================
   JMS UPDATE 11A-V3 — Sales approval to production execution
   Fix: approved quotes/orders now become actionable production orders.
   ========================================================= */
(function(){
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn); else fn(); }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
  function uid(){ try{return crypto.randomUUID()}catch(e){return 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2)} }
  function todaySafe(){ return (typeof today==='function') ? today() : new Date().toISOString().slice(0,10); }
  function nowIso(){ return new Date().toISOString(); }
  function saveDb(){ try{ if(typeof save==='function') save(); else localStorage.setItem('jms_factory_crm_pro_v4', JSON.stringify(window.db||{})); }catch(e){} }
  function canManager(){ const r=(window.currentUser||{}).role; return ['admin','sales','manager','production','production_manager'].includes(r); }
  function customerLabel(id){ try{return customerName(id)}catch(e){ return (db.customers||[]).find(c=>c.id===id)?.name || '-'; } }
  function repLabel(id){ try{return repName(id)}catch(e){ return (db.reps||[]).find(r=>r.id===id)?.name || '-'; } }
  function fmt(n){ try{return money(n)}catch(e){ return Number(n||0).toLocaleString('ar-SA'); } }
  function ensureProdDb(){
    window.db ||= {};
    db.orders ||= [];
    db.quotes ||= [];
    db.productionOrders ||= [];
    db.productionLogs ||= [];
  }
  function productionNo(){ const n=(db.productionOrders||[]).length+1; return 'MO-'+todaySafe().slice(0,4)+'-'+String(n).padStart(5,'0'); }
  function prodByOrder(orderId){ return (db.productionOrders||[]).find(p=>p.order_id===orderId); }
  function logProd(pid, action, note){
    const p=(db.productionOrders||[]).find(x=>x.id===pid);
    db.productionLogs ||= [];
    db.productionLogs.unshift({id:uid(),production_id:pid,order_id:p?.order_id||'',stage:p?.stage||'',action,note:note||'',by:(window.currentUser||{}).name||'',by_id:(window.currentUser||{}).id||'',at:nowIso()});
  }
  function publicStage(stage){
    const map={pending_manager:'بانتظار موافقة المدير',approved_manager:'تم اعتماد المدير',payment_received:'تم تسجيل التحويل',sent_to_production:'أرسل للإنتاج',production_received:'استلام الإنتاج',technical_plan:'تجهيز الخطة الفنية',film_production:'إنتاج الفيلم',sent_to_cutting:'إرسال للمقص',cutting:'المقص',packing:'التغليف',ready_delivery:'جاهز للتسليم',delivered:'تم التسليم'};
    return map[stage] || stage || '-';
  }
  function orderFromQuote(q){
    ensureProdDb();
    if(!q) return null;
    let o=(db.orders||[]).find(x=>x.quote_id===q.id || x.source_quote_id===q.id || String(x.notes||'').includes(q.quote_no||'---'));
    if(o) return o;
    o={
      id:uid(), quote_id:q.id, source_quote_id:q.id,
      date:todaySafe(), customer_id:q.customer_id, rep_id:q.rep_id,
      product:q.product||'', material:q.material||'', color:q.color||'', print:q.print||'',
      width:q.width||'', length:q.length||'', size_unit:q.size_unit||'cm', thickness:q.thickness||'', thickness_unit:q.thickness_unit||'micron',
      total_kg:q.total_kg||'', piece_weight:q.piece_weight||'', pieces:q.pieces||'',
      amount:(q.total_amount||0)+' ريال', amount_value:Number(q.total_amount||0),
      status:'بانتظار التحويل', notes:'تم الإنشاء من عرض السعر '+(q.quote_no||''),
      created_by:(window.currentUser||{}).name||'', created_at:nowIso()
    };
    db.orders.unshift(o);
    q.converted_to_order=true;
    q.converted_order_id=o.id;
    q.converted_at=nowIso();
    return o;
  }
  function createOrUpdateProductionFromOrder(orderId, stage, note){
    ensureProdDb();
    const o=(db.orders||[]).find(x=>x.id===orderId);
    if(!o) return null;
    let p=prodByOrder(orderId);
    if(!p){
      p={
        id:uid(), production_no:productionNo(), order_id:o.id,
        customer_id:o.customer_id, rep_id:o.rep_id, date:o.date||todaySafe(),
        product:o.product||'', material:o.material||'', color:o.color||'',
        width:o.width||'', length:o.length||'', thickness:o.thickness||'', total_kg:o.total_kg||'', pieces:o.pieces||'', piece_weight:o.piece_weight||'',
        amount_value:o.amount_value||0, stage:stage||'pending_manager', priority:'normal', due_date:o.delivery_date||'',
        created_by:(window.currentUser||{}).name||'', created_at:nowIso(), updated_at:nowIso(),
        technical:{
          production_type:o.product||'', machine:'', operator:'', film_width:o.width||'', film_thickness:o.thickness||'', film_unit:'micron',
          film_micron:o.thickness||'', roll_count:'', roll_weight:'', expected_kg:o.total_kg||'', actual_kg:'', waste_kg:'',
          cut_width:o.width||'', cut_length:o.length||'', bag_size:'', seal_type:'', opening_side:'', print_status:o.print||'',
          film_notes:'', cutting_notes:'', packing_notes:'', floor_notes:'',
          or_no:'', form_date:'', delivery_time:o.delivery_terms||'', packing:'', region:'', delivery_to:'', contract_no:'',
          plastic_type:o.material||'', bag_type:o.product||'', handle_color:'', gusset:'', plastic_color:o.color||'', master_batch:'', print_colors:'', ink_color:''
        },
        notes:[]
      };
      db.productionOrders.unshift(p);
      logProd(p.id,'إنشاء أمر تصنيع', note || 'تم إنشاء أمر التصنيع من طلب المبيعات');
    }else{
      p.stage=stage||p.stage||'pending_manager';
      p.updated_at=nowIso();
      logProd(p.id,'تحديث حالة أمر التصنيع', note || ('تم تحديث الحالة إلى '+publicStage(p.stage)));
    }
    if(stage) p.stage=stage;
    o.production_id=p.id;
    o.production_stage=p.stage;
    o.status=publicStage(p.stage);
    return p;
  }
  function quoteReady(q){ return ['approved','sent','accepted'].includes(q.status) && !q.converted_to_order; }
  function orderNeedsProduction(o){ return o && !o.production_id && !prodByOrder(o.id); }
  window.jms11aQuoteToProduction=function(qid){
    if(!canManager()) return alert('هذه الصلاحية للمدير أو مدير الإنتاج فقط');
    const q=(db.quotes||[]).find(x=>x.id===qid); if(!q) return alert('لم يتم العثور على العرض');
    if(!['approved','sent','accepted'].includes(q.status)) return alert('اعتمد عرض السعر أولًا');
    const o=orderFromQuote(q);
    const p=createOrUpdateProductionFromOrder(o.id,'sent_to_production','تم تحويل العرض المعتمد إلى أمر تصنيع وإرساله للإنتاج');
    saveDb();
    window.renderProductionWorkflow?.();
    alert('تم تحويل العرض إلى طلب وإرساله للإنتاج');
    if(p) setTimeout(()=>window.openProductionOrder?.(p.id),150);
  };
  window.jms11aApproveOrder=function(orderId){
    if(!canManager()) return alert('هذه الصلاحية للمدير فقط');
    const p=createOrUpdateProductionFromOrder(orderId,'approved_manager','تم اعتماد طلب المبيعات من المدير');
    saveDb(); window.renderProductionWorkflow?.(); if(p) window.openProductionOrder?.(p.id);
  };
  window.jms11aMarkPaid=function(orderId){
    if(!canManager()) return alert('هذه الصلاحية للمدير فقط');
    const p=createOrUpdateProductionFromOrder(orderId,'payment_received','تم تسجيل تحويل / دفعة العميل');
    saveDb(); window.renderProductionWorkflow?.(); if(p) window.openProductionOrder?.(p.id);
  };
  window.jms11aSendOrderToProduction=function(orderId){
    if(!canManager()) return alert('هذه الصلاحية للمدير أو مدير الإنتاج فقط');
    const p=createOrUpdateProductionFromOrder(orderId,'sent_to_production','تم إرسال الطلب إلى الإنتاج');
    saveDb(); window.renderProductionWorkflow?.(); if(p) window.openProductionOrder?.(p.id);
  };
  function renderBridgePanel(){
    ensureProdDb();
    const page=document.getElementById('productionWorkflow');
    if(!page) return;
    let host=document.getElementById('prodSalesBridgePanel');
    if(!host){
      const wrap=page.querySelector('.jms-prod-wrap');
      if(!wrap) return;
      host=document.createElement('div');
      host.id='prodSalesBridgePanel';
      host.className='panel';
      const kpis=wrap.querySelector('.jms-prod-kpis');
      if(kpis && kpis.nextSibling) wrap.insertBefore(host,kpis.nextSibling); else wrap.prepend(host);
    }
    const quotes=(db.quotes||[]).filter(quoteReady).slice(0,10);
    const orders=(db.orders||[]).filter(orderNeedsProduction).slice(0,15);
    const qHtml=quotes.map(q=>`<div class="jms-prod-card"><h4>عرض معتمد ${esc(q.quote_no||'')}</h4><p><b>${esc(customerLabel(q.customer_id))}</b> · ${esc(q.product||'-')} · ${fmt(q.total_amount||0)} ريال</p><p>المقاس: ${esc(q.width||'-')} × ${esc(q.length||'-')} · الكمية: ${esc(q.total_kg||'-')} كجم · الحالة: ${esc(q.status)}</p><div class="jms-prod-actions"><button class="primary" onclick="jms11aQuoteToProduction('${q.id}')">تحويل وإرسال للإنتاج</button></div></div>`).join('');
    const oHtml=orders.map(o=>`<div class="jms-prod-card"><h4>طلب مبيعات جاهز للتحويل</h4><p><b>${esc(customerLabel(o.customer_id))}</b> · ${esc(o.product||'-')} · ${fmt(o.amount_value||0)} ريال</p><p>المقاس: ${esc(o.width||'-')} × ${esc(o.length||'-')} · السماكة: ${esc(o.thickness||'-')} · الكمية: ${esc(o.total_kg||'-')} كجم</p><p>الحالة الحالية: ${esc(o.status||'جديد')} · المندوب: ${esc(repLabel(o.rep_id))}</p><div class="jms-prod-actions"><button onclick="jms11aApproveOrder('${o.id}')">اعتماد المدير</button><button onclick="jms11aMarkPaid('${o.id}')">تسجيل التحويل</button><button class="primary" onclick="jms11aSendOrderToProduction('${o.id}')">إرسال للإنتاج</button></div></div>`).join('');
    host.innerHTML=`<div class="panel-head"><b>طلبات جاهزة للتحويل للإنتاج</b><span>هنا يبدأ التشغيل الفعلي: اعتماد السعر → تسجيل التحويل → إرسال للإنتاج.</span></div>
      <div class="jms-prod-note">إذا اعتمدت السعر أو سجلت تحويل العميل، سيظهر الطلب هنا. اضغط <b>إرسال للإنتاج</b> ليظهر فورًا في لوحة المراحل ويفتح كرت أمر التشغيل.</div>
      <div class="jms-prod-board">
        <div class="jms-prod-col"><h3><span>عروض معتمدة لم تتحول</span><span class="jms-prod-count">${quotes.length}</span></h3>${qHtml || '<div class="jms-prod-muted">لا توجد عروض معتمدة تنتظر التحويل.</div>'}</div>
        <div class="jms-prod-col"><h3><span>طلبات مبيعات بدون أمر تصنيع</span><span class="jms-prod-count">${orders.length}</span></h3>${oHtml || '<div class="jms-prod-muted">لا توجد طلبات تنتظر الإرسال للإنتاج.</div>'}</div>
      </div>`;
  }
  const oldRenderProduction=window.renderProductionWorkflow;
  window.renderProductionWorkflow=function(){
    if(typeof oldRenderProduction==='function') oldRenderProduction.apply(this,arguments);
    renderBridgePanel();
  };
  // Make newly converted orders visible in production queue immediately.
  const oldConvert=window.convertQuoteToOrder;
  if(typeof oldConvert==='function' && !oldConvert.jms11aV3Wrapped){
    const wrapped=function(qid){
      const q=(db.quotes||[]).find(x=>x.id===qid);
      oldConvert.apply(this,arguments);
      setTimeout(()=>{
        ensureProdDb();
        if(q){
          const o=(db.orders||[]).find(x=>x.quote_id===q.id || x.source_quote_id===q.id || String(x.notes||'').includes(q.quote_no||'---'));
          if(o && !o.production_id){ o.status='بانتظار التحويل'; saveDb(); }
        }
        window.renderProductionWorkflow?.();
      },100);
    };
    wrapped.jms11aV3Wrapped=true;
    window.convertQuoteToOrder=wrapped;
  }
  ready(()=>setTimeout(()=>{ if(document.getElementById('productionWorkflow')) window.renderProductionWorkflow?.(); },700));
})();


/* JMS UPDATE 12 - MOBILE PWA UI FIX
   Fixes installed iPhone/Android view: sidebar becomes a drawer and main pages take full width. */
(function(){
  const STYLE_ID='jmsUpdate12MobilePwaStyle';
  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .jms-mobile-topbar{display:none}
      @media (max-width: 920px){
        html,body{width:100%;max-width:100%;overflow-x:hidden!important;background:#f8fafc!important;}
        body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial!important;}
        #appView.app:not(.hidden), .app:not(.hidden){display:block!important;min-height:100vh!important;background:#f8fafc!important;}
        .main{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:74px 12px 110px!important;box-sizing:border-box!important;background:#f8fafc!important;color:#0f172a!important;overflow-x:hidden!important;}
        .page{width:100%!important;max-width:100%!important;box-sizing:border-box!important;}
        .page:not(.active){display:none!important;}
        .page-head,.page-head.with-action{display:block!important;margin:0 0 14px!important;padding:12px!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 24px rgba(15,23,42,.06)!important;}
        .page-head h1,.page-head h2{font-size:22px!important;margin:0 0 6px!important;line-height:1.25!important;color:#0f172a!important;}
        .page-head p{font-size:13px!important;margin:0!important;color:#64748b!important;}
        .head-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin-top:10px!important;}
        .stats,.grid2,.form-grid,.form-grid.two,.form-grid.three,.form-grid.four,.jms-prod-kpis,.jms-prod-board,.jms-campaign-grid{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;}
        .panel,.stat,.customer-card,.order-card,.visit-card,.quote-card,.jms-prod-card,.jms-prod-col{width:100%!important;box-sizing:border-box!important;border-radius:18px!important;overflow:hidden!important;}
        input,select,textarea,button{font-size:16px!important;max-width:100%!important;box-sizing:border-box!important;}
        table{display:block!important;width:100%!important;overflow-x:auto!important;white-space:nowrap!important;}
        .sidebar{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:auto!important;width:min(86vw,360px)!important;max-width:360px!important;height:100dvh!important;z-index:99999!important;transform:translateX(105%)!important;transition:transform .22s ease!important;overflow-y:auto!important;overflow-x:hidden!important;padding:18px 14px 24px!important;box-sizing:border-box!important;background:#0f172a!important;color:#fff!important;border-left:1px solid rgba(255,255,255,.10)!important;box-shadow:-18px 0 40px rgba(15,23,42,.30)!important;}
        body.jms-mobile-menu-open .sidebar{transform:translateX(0)!important;}
        body.jms-mobile-menu-open:before{content:'';position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99998;backdrop-filter:blur(2px);}
        .sidebar .brand{display:flex!important;gap:10px!important;align-items:center!important;margin-bottom:12px!important;}
        .sidebar .brand img{width:54px!important;height:54px!important;border-radius:16px!important;object-fit:cover!important;}
        .sidebar .brand b{color:#fff!important;font-size:18px!important;display:block!important;}
        .sidebar .brand span{color:#cbd5e1!important;font-size:12px!important;}
        .sidebar .user-box{background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:18px!important;margin:10px 0 14px!important;padding:12px!important;color:#fff!important;}
        .sidebar .user-box small,.sidebar .user-box span{color:#cbd5e1!important;}
        .sidebar nav{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:10px!important;}
        .sidebar .nav{width:100%!important;text-align:right!important;border:0!important;border-radius:14px!important;padding:13px 14px!important;background:rgba(255,255,255,.08)!important;color:#f8fafc!important;font-weight:800!important;}
        .sidebar .nav.active{background:#dc2626!important;color:#fff!important;}
        .sidebar .danger,#logoutBtn{width:100%!important;border-radius:14px!important;margin-top:12px!important;padding:13px 14px!important;background:#b91c1c!important;color:#fff!important;border:0!important;}
        .jms-mobile-topbar{display:flex!important;position:fixed!important;top:0!important;right:0!important;left:0!important;height:60px!important;z-index:99990!important;align-items:center!important;gap:10px!important;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px!important;background:#0f172a!important;color:#fff!important;box-shadow:0 10px 24px rgba(15,23,42,.16)!important;box-sizing:content-box!important;}
        .jms-mobile-topbar button{width:44px!important;height:44px!important;border:0!important;border-radius:14px!important;background:#dc2626!important;color:#fff!important;font-size:22px!important;display:grid!important;place-items:center!important;}
        .jms-mobile-topbar b{font-size:16px!important;line-height:1.1!important;}
        .jms-mobile-topbar small{display:block!important;color:#cbd5e1!important;font-size:11px!important;font-weight:500!important;margin-top:2px!important;}
        .jms-mobile-close{display:block!important;position:sticky!important;top:0!important;margin:0 0 10px!important;width:44px!important;height:44px!important;border:0!important;border-radius:14px!important;background:#1f2937!important;color:#fff!important;font-size:22px!important;z-index:1!important;}
        .modal,.modal-card{max-width:calc(100vw - 24px)!important;width:calc(100vw - 24px)!important;box-sizing:border-box!important;}
        .cloud-sync-status{left:12px!important;right:auto!important;bottom:14px!important;max-width:calc(100vw - 24px)!important;}
      }
    `;
    document.head.appendChild(st);
  }
  function ensureMobileTopbar(){
    injectStyle();
    const app=document.getElementById('appView') || document.querySelector('.app');
    const sidebar=document.querySelector('.sidebar');
    if(!app || !sidebar) return;
    if(!document.querySelector('.jms-mobile-topbar')){
      const bar=document.createElement('div');
      bar.className='jms-mobile-topbar';
      bar.innerHTML=`<button type="button" id="jmsMobileMenuBtn" aria-label="فتح القائمة">☰</button><div><b>JMS Factory CRM</b><small id="jmsMobilePageName">القائمة والصفحات</small></div>`;
      app.insertBefore(bar, app.firstChild);
    }
    if(!sidebar.querySelector('.jms-mobile-close')){
      const close=document.createElement('button');
      close.type='button'; close.className='jms-mobile-close'; close.textContent='×'; close.setAttribute('aria-label','إغلاق القائمة');
      sidebar.insertBefore(close, sidebar.firstChild);
      close.onclick=()=>document.body.classList.remove('jms-mobile-menu-open');
    }
    const btn=document.getElementById('jmsMobileMenuBtn');
    if(btn && btn.dataset.bound!=='1'){
      btn.dataset.bound='1';
      btn.onclick=()=>document.body.classList.toggle('jms-mobile-menu-open');
    }
    document.querySelectorAll('.sidebar .nav').forEach(n=>{
      if(n.dataset.mobileCloseBound==='1') return;
      n.dataset.mobileCloseBound='1';
      n.addEventListener('click',()=>{
        const label=n.textContent.trim();
        const pageName=document.getElementById('jmsMobilePageName'); if(pageName) pageName.textContent=label;
        if(window.matchMedia('(max-width:920px)').matches) setTimeout(()=>document.body.classList.remove('jms-mobile-menu-open'),80);
      });
    });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.body.classList.remove('jms-mobile-menu-open'); });
  }
  document.addEventListener('DOMContentLoaded', ensureMobileTopbar);
  setTimeout(ensureMobileTopbar,300);
  setTimeout(ensureMobileTopbar,1200);
  window.jmsFixMobilePwaUI = ensureMobileTopbar;
})();

/* JMS UPDATE 12B - MOBILE MODAL SCROLL AND CLOSE FIX
   Fixes mobile popups that cover the page and cannot scroll or close. */
(function(){
  const STYLE_ID='jmsUpdate12BMobileModalFixStyle';
  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .jms-modal-close-btn{position:sticky!important;top:0!important;z-index:50!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;width:100%!important;min-height:44px!important;margin:0 0 12px!important;border:0!important;border-radius:14px!important;background:#dc2626!important;color:#fff!important;font-weight:900!important;font-size:16px!important;box-shadow:0 10px 18px rgba(220,38,38,.18)!important;}
      @media (max-width:920px){
        .modal:not(.hidden){position:fixed!important;inset:0!important;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:100dvh!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;padding:calc(env(safe-area-inset-top,0px) + 76px) 10px calc(env(safe-area-inset-bottom,0px) + 22px)!important;box-sizing:border-box!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;background:rgba(15,23,42,.62)!important;z-index:100500!important;}
        .modal:not(.hidden) .modal-card,.modal:not(.hidden) .modal-content,.modal:not(.hidden)>div{width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 110px)!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;box-sizing:border-box!important;border-radius:22px!important;margin:0 auto!important;padding:14px!important;}
        #modalBody{display:block!important;width:100%!important;max-width:100%!important;overflow:visible!important;box-sizing:border-box!important;}
        #modalBody h1,#modalBody h2,#modalBody h3{font-size:22px!important;line-height:1.25!important;margin:8px 0 12px!important;}
        #modalBody input,#modalBody select,#modalBody textarea,#modalBody button{font-size:16px!important;max-width:100%!important;box-sizing:border-box!important;}
        #modalBody .form-grid,#modalBody .form-grid.two,#modalBody .form-grid.three,#modalBody .form-grid.four{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;}
        body:has(.modal:not(.hidden)){overflow:hidden!important;}
      }
    `;
    document.head.appendChild(st);
  }
  function getModal(){ return window.modal || document.getElementById('modal') || document.querySelector('.modal'); }
  function closeAnyModal(){
    try{ if(typeof window.closeModal==='function') return window.closeModal(); }catch(e){}
    const m=getModal(); if(m) m.classList.add('hidden');
    const b=window.modalBody || document.getElementById('modalBody'); if(b) b.innerHTML='';
  }
  function ensureCloseButton(){
    injectStyle();
    const m=getModal(); if(!m || m.classList.contains('hidden')) return;
    const card=m.querySelector('.modal-card') || m.querySelector('.modal-content') || m.firstElementChild || m;
    if(!card.querySelector('.jms-modal-close-btn')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='jms-modal-close-btn';
      btn.textContent='إغلاق النافذة';
      btn.onclick=closeAnyModal;
      card.insertBefore(btn, card.firstChild);
    }
  }
  window.jmsCloseModalFix=closeAnyModal;
  window.jmsEnsureMobileModalFix=ensureCloseButton;
  document.addEventListener('DOMContentLoaded',()=>{
    injectStyle();
    document.addEventListener('click',()=>setTimeout(ensureCloseButton,0),true);
    const m=getModal();
    if(m)new MutationObserver(ensureCloseButton).observe(m,{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAnyModal(); });
  });
  setTimeout(()=>{injectStyle(); ensureCloseButton();},300);
  setTimeout(ensureCloseButton,1200);
})();


/* JMS UPDATE 12C: permissions and rep nearby radar enhancement */
(function(){
  function enhanceRadarForRep(){
    try{
      const btn=document.querySelector('[data-page="newCustomerRadar"]');
      if(btn){ btn.classList.remove('manager-only','admin-only'); btn.style.display='block'; }
      const importBtn=document.getElementById('customerImportButton');
      if(importBtn && (!currentUser || currentUser.role!=='admin')) importBtn.remove();
      const toolbar=document.querySelector('#newCustomerRadar .jms-radar-toolbar');
      if(toolbar && !document.getElementById('radarDistrict')){
        const label=document.createElement('label');
        label.innerHTML='الحي / القرب من<input id="radarDistrict" placeholder="مثال: الخمرة، الصناعية الثانية، بحرة">';
        const city=document.getElementById('radarCity');
        if(city && city.closest('label')) city.closest('label').insertAdjacentElement('afterend',label);
        else toolbar.insertBefore(label, toolbar.firstChild);
      }
      if(currentUser && currentUser.role==='rep'){
        const title=document.querySelector('#newCustomerRadar h1'); if(title) title.textContent='رادار العملاء القريبين';
        const hint=document.querySelector('#newCustomerRadar .page-head p');
        if(hint) hint.textContent='ابحث عن أنشطة جديدة قريبة من الحي أو موقع المندوب، ثم حوّل الفرصة إلى عميل أو افتح الخريطة للزيارة.';
      }
    }catch(e){}
  }
  const oldRenderAll=window.renderAll;
  window.renderAll=function(){ if(typeof oldRenderAll==='function') oldRenderAll(); setTimeout(enhanceRadarForRep,150); };
  const oldShowApp=window.showApp;
  if(typeof oldShowApp==='function') window.showApp=function(){ oldShowApp(); setTimeout(enhanceRadarForRep,250); };
  setTimeout(enhanceRadarForRep,1000);
})();


/* JMS UPDATE 13 - Rep AI Sales Assistant: permission-safe AI for reps */
(function(){
  if(window.__JMS_UPDATE_13_REP_AI__) return;
  window.__JMS_UPDATE_13_REP_AI__ = true;

  function h(v){return String(v??'').replace(/[&<>"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));}
  function arMoney(n){return Number(n||0).toLocaleString('ar-SA');}
  function safeDate(v){return String(v||'').slice(0,10) || '-';}
  function norm(s){
    return String(s||'').toLowerCase()
      .replace(/[\u064B-\u0652]/g,'')
      .replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[^\p{L}\p{N}\s]/gu,' ')
      .replace(/\s+/g,' ').trim();
  }
  function repScope(){
    const user=window.currentUser || currentUser || {};
    if(user.role==='rep') return (db.customers||[]).filter(c=>c.rep_id===user.id);
    return (db.customers||[]);
  }
  function repQuotes(){
    const user=window.currentUser || currentUser || {};
    if(user.role==='rep') return (db.quotes||[]).filter(q=>q.rep_id===user.id);
    return (db.quotes||[]);
  }
  function repVisits(){
    const user=window.currentUser || currentUser || {};
    if(user.role==='rep') return (db.visits||[]).filter(v=>v.rep_id===user.id);
    return (db.visits||[]);
  }
  function customerById(cid){return (db.customers||[]).find(c=>c.id===cid)||{};}
  function repDisplayName(rid){return (db.reps||[]).find(r=>r.id===rid)?.name || rid || '-';}
  function lastVisitFor(cid){
    return (db.visits||[]).filter(v=>v.customer_id===cid)
      .sort((a,b)=>String(b.date||b.checkin_at||b.created_at||'').localeCompare(String(a.date||a.checkin_at||a.created_at||'')))[0];
  }
  function lastQuoteFor(cid){
    return (db.quotes||[]).filter(q=>q.customer_id===cid)
      .sort((a,b)=>String(b.date||b.quote_date||b.created_at||'').localeCompare(String(a.date||a.quote_date||a.created_at||'')))[0];
  }
  function daysSince(d){
    if(!d) return 9999;
    const x=new Date(String(d).slice(0,10)); if(isNaN(x)) return 9999;
    return Math.floor((new Date(new Date().toISOString().slice(0,10))-x)/86400000);
  }
  function findCustomer(q){
    const nq=norm(q);
    const words=nq.split(' ').filter(w=>w.length>=3 && !['كم','دين','الدين','رصيد','عليه','فلان','متى','عرض','سعر','زيارة','اخر','آخر','سويت','عملت','للعميل','للعميل'].includes(w));
    const scored=repScope().map(c=>{
      const name=norm(c.name);
      let score=0;
      if(name && nq.includes(name)) score+=100;
      for(const w of words){ if(name.includes(w)) score+=20; }
      const phone=String(c.phone||'').replace(/\D/g,'');
      if(phone && nq.includes(phone.slice(-7))) score+=60;
      return {c,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!scored.length) return {none:true};
    const top=scored[0].score;
    const matches=scored.filter(x=>x.score>=Math.max(20, top-10)).slice(0,6).map(x=>x.c);
    if(matches.length>1 && top<100) return {ambiguous:true,matches};
    return {customer:matches[0]};
  }
  function statusText(s){
    const m={pending:'بانتظار اعتماد',approved:'معتمد',sent:'مرسل للعميل',accepted:'العميل وافق',rejected:'مرفوض',cancelled:'ملغي'};
    return m[String(s||'').toLowerCase()] || s || 'بدون حالة';
  }
  function customerSummary(c){
    const lv=lastVisitFor(c.id), lq=lastQuoteFor(c.id);
    const quotes=(db.quotes||[]).filter(q=>q.customer_id===c.id);
    const orders=(db.orders||[]).filter(o=>o.customer_id===c.id);
    const collections=(db.collections||[]).filter(x=>x.customer_id===c.id);
    const lastCol=collections.sort((a,b)=>String(b.date||b.created_at||'').localeCompare(String(a.date||a.created_at||'')))[0];
    return `ملف العميل: ${c.name}\n- المندوب: ${repDisplayName(c.rep_id)}\n- الجوال: ${c.phone||'غير مسجل'}\n- الرصيد/الدين: ${arMoney(c.debt_balance||0)} ريال\n- آخر زيارة: ${lv ? safeDate(lv.date||lv.checkin_at) : 'لا توجد زيارة'}${lv?.notes?' - '+lv.notes:''}\n- آخر عرض سعر: ${lq ? (lq.quote_no||lq.id)+' بتاريخ '+safeDate(lq.date||lq.quote_date||lq.created_at)+' - الحالة: '+statusText(lq.status)+' - القيمة: '+arMoney(lq.total_amount||lq.amount_value||0)+' ريال' : 'لا يوجد'}\n- عدد العروض: ${quotes.length}\n- عدد الطلبات: ${orders.length}\n- آخر تحصيل: ${lastCol ? arMoney(lastCol.amount||0)+' ريال بتاريخ '+safeDate(lastCol.date||lastCol.created_at) : 'لا يوجد'}\n\nالإجراء المقترح: ${Number(c.debt_balance||0)>0?'متابعة تحصيل برسالة محترمة ثم اتصال.':(lq && !['accepted','rejected','cancelled'].includes(String(lq.status||''))?'متابعة عرض السعر المفتوح.':'تحديد زيارة متابعة أو عرض جديد حسب احتياج العميل.')}`;
  }
  function collectionList(){
    const rows=repScope().filter(c=>Number(c.debt_balance||0)>0).sort((a,b)=>Number(b.debt_balance||0)-Number(a.debt_balance||0)).slice(0,25);
    if(!rows.length) return 'لا توجد مديونيات مسجلة على عملائك.';
    return 'ديون عملائك حسب الأعلى:\n'+rows.map((c,i)=>`${i+1}. ${c.name} - ${arMoney(c.debt_balance)} ريال - ${c.phone||'لا يوجد رقم'}`).join('\n');
  }
  function quoteList(){
    const rows=repQuotes().filter(q=>!['accepted','rejected','cancelled'].includes(String(q.status||'').toLowerCase())).sort((a,b)=>String(b.date||b.created_at||'').localeCompare(String(a.date||a.created_at||''))).slice(0,25);
    if(!rows.length) return 'لا توجد عروض مفتوحة تحتاج متابعة.';
    return 'عروضك المفتوحة:\n'+rows.map((q,i)=>`${i+1}. ${q.quote_no||q.id} - ${customerById(q.customer_id).name||'-'} - ${safeDate(q.date||q.created_at)} - ${statusText(q.status)} - ${arMoney(q.total_amount||q.amount_value||0)} ريال`).join('\n');
  }
  function lateVisitsList(){
    const rows=repScope().map(c=>({c,lv:lastVisitFor(c.id)})).map(x=>({...x,days:daysSince(x.lv?.date||x.lv?.checkin_at)})).filter(x=>x.days>=30).sort((a,b)=>b.days-a.days).slice(0,25);
    if(!rows.length) return 'لا يوجد عملاء متأخرين عن الزيارة أكثر من 30 يوم.';
    return 'عملاء يحتاجون زيارة:\n'+rows.map((x,i)=>`${i+1}. ${x.c.name} - ${x.days>=9000?'لم تتم زيارته سابقًا':x.days+' يوم'} - ${x.c.phone||'لا يوجد رقم'} - ${x.c.district||x.c.city||'-'}`).join('\n');
  }
  function visitPlan(){
    const rows=repScope().map(c=>({c,lv:lastVisitFor(c.id)})).map(x=>({c:x.c, days:daysSince(x.lv?.date||x.lv?.checkin_at), debt:Number(x.c.debt_balance||0)}))
      .sort((a,b)=>(b.days*2+b.debt/1000)-(a.days*2+a.debt/1000)).slice(0,12);
    if(!rows.length) return 'لا توجد بيانات عملاء لترتيب الزيارات.';
    return 'ترتيب زيارات مقترح للمندوب:\n'+rows.map((x,i)=>`${i+1}. ${x.c.name} - ${x.c.district||x.c.city||'-'} - الرصيد ${arMoney(x.debt)} ريال - آخر زيارة: ${x.days>=9000?'لا توجد':x.days+' يوم'}`).join('\n')+'\n\nملاحظة: إذا كان موقع العملاء محفوظًا، استخدم صفحة الزيارات الذكية لفتح مسار الخريطة.';
  }
  function makeMessage(q,c){
    if(/تحصيل|دين|مديون|رصيد|سداد/.test(q)){
      return `رسالة تحصيل مقترحة:\nالسلام عليكم ${c.name}\nنذكركم بوجود رصيد مستحق بقيمة ${arMoney(c.debt_balance||0)} ريال. نأمل التكرم بالسداد أو تزويدنا بموعد مناسب للتنسيق. شاكرين لكم تعاونكم.`;
    }
    if(/عرض|سعر|متابعة/.test(q)){
      const lq=lastQuoteFor(c.id);
      return `رسالة متابعة عرض سعر:\nالسلام عليكم ${c.name}\nحبيت أتابع معكم بخصوص عرض السعر ${lq?(lq.quote_no||''):'المرسل'}، هل يوجد أي تعديل مطلوب على المقاس أو الكمية؟ جاهزين لخدمتكم.`;
    }
    return `رسالة متابعة عامة:\nالسلام عليكم ${c.name}\nمعكم شركة جدة النموذجية للصناعة. نحب نتابع احتياجكم من الأكياس والتغليف، وهل مناسب نرتب زيارة أو نرسل عرض حسب طلبكم؟`;
  }
  function repAiAnswer(q){
    q=String(q||'').trim();
    if(!q) return '';
    const role=(window.currentUser||currentUser||{}).role;
    const scopedNote = role==='rep' ? 'حسب صلاحياتك: تم البحث داخل عملائك فقط.\n\n' : '';
    if(/ديون عملائي|عملائي.*دين|عليهم تحصيل|تحصيل عملائي|المديونيات/.test(q)) return scopedNote+collectionList();
    if(/عروضي المفتوحة|عروض مفتوحة|العروض المفتوحة|عروض.*متابعة/.test(q)) return scopedNote+quoteList();
    if(/ما زرت|لم ازر|لم تتم زيارتهم|عملاء.*زيارة|زيارات متأخرة/.test(q)) return scopedNote+lateVisitsList();
    if(/رتب.*زيارة|زيارات اليوم|مين ازور|مين أزور|خطة زيارة/.test(q)) return scopedNote+visitPlan();
    // إذا كتب المندوب اسم العميل فقط مثل: "كتيكت" أو "كتيكت عميلي" اعرض ملف العميل مباشرة.
    const customerLookup = findCustomer(q);
    const hasCustomer = !!customerLookup.customer;
    const asksCustomerData = /كم.*(دين|رصيد)|الدين|مديون|عليه|رصيد|وش عليه|كم عليه|متى.*عرض|عرض سعر|اخر زيارة|آخر زيارة|زيارة|رسالة|واتساب|اكتب|عميل|عميلي/.test(q);
    if(hasCustomer || asksCustomerData){
      const f = customerLookup;
      if(f.none) return scopedNote+'لم أجد العميل داخل نطاق صلاحياتك. اكتب جزءًا أوضح من اسم العميل أو رقم الجوال.';
      if(f.ambiguous) return scopedNote+'وجدت أكثر من عميل، اختر الاسم المطلوب واكتب السؤال مرة ثانية:\n'+f.matches.map((c,i)=>`${i+1}. ${c.name} - ${c.phone||'لا يوجد رقم'} - ${c.district||c.city||'-'}`).join('\n');
      const c=f.customer;
      if(/رسالة|واتساب|اكتب/.test(q)) return scopedNote+makeMessage(q,c);
      if(/عرض/.test(q)){
        const lq=lastQuoteFor(c.id);
        if(!lq) return scopedNote+`لا يوجد عرض سعر مسجل للعميل ${c.name}.`;
        return scopedNote+`آخر عرض سعر للعميل ${c.name}:\n- رقم العرض: ${lq.quote_no||lq.id}\n- التاريخ: ${safeDate(lq.date||lq.quote_date||lq.created_at)}\n- الحالة: ${statusText(lq.status)}\n- المنتج: ${lq.product||'-'}\n- الكمية: ${lq.total_kg||'-'} كجم\n- القيمة: ${arMoney(lq.total_amount||lq.amount_value||0)} ريال`;
      }
      if(/زيارة/.test(q)){
        const lv=lastVisitFor(c.id);
        return scopedNote+`آخر زيارة للعميل ${c.name}:\n${lv ? '- التاريخ: '+safeDate(lv.date||lv.checkin_at)+'\n- الملاحظة: '+(lv.notes||'-') : 'لا توجد زيارة مسجلة.'}`;
      }
      return scopedNote+customerSummary(c);
    }
    return scopedNote+'أقدر أساعدك في: ديون عملائي، عروضي المفتوحة، آخر زيارة لعميل، آخر عرض سعر، ترتيب زيارات اليوم، أو كتابة رسالة واتساب. تقدر تكتب اسم العميل فقط مثل: "كتيكت" أو تسأل: "كتيكت كم الدين عليه؟"';
  }
  window.jmsRepAiAnswer = repAiAnswer;

  function ensureRepAi(){
    const nav=document.querySelector('.sidebar nav') || document.querySelector('aside nav') || document.querySelector('nav');
    const main=document.querySelector('main.main') || document.querySelector('.main') || document.body;
    if(!main) return;
    if(nav && !document.querySelector('[data-page="repAiAssistant"]')){
      const btn=document.createElement('button');
      btn.className='nav rep-ai-only';
      btn.dataset.page='repAiAssistant';
      btn.textContent='مساعد المندوب AI';
      const before=nav.querySelector('[data-page="visits"]') || nav.querySelector('[data-page="customers"]')?.nextSibling;
      nav.insertBefore(btn, before || null);
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        const p=document.getElementById('repAiAssistant'); if(p) p.classList.add('active');
        renderRepAiDashboard();
        if(document.body.classList.contains('jms-mobile-menu-open')) document.body.classList.remove('jms-mobile-menu-open');
      });
    }
    if(!document.getElementById('repAiAssistant')){
      const sec=document.createElement('section');
      sec.id='repAiAssistant';
      sec.className='page';
      sec.innerHTML=`
        <div class="page-head with-action"><div><h1>مساعد المندوب الذكي</h1><p>اسأل عن عملائك فقط: الدين، آخر عرض سعر، آخر زيارة، التحصيل، وترتيب الزيارات.</p></div><div class="head-actions"><button class="primary" onclick="jmsRepAiAsk('ديون عملائي')">ديون عملائي</button><button onclick="jmsRepAiAsk('عروضي المفتوحة')">عروضي المفتوحة</button></div></div>
        <div class="jms-rep-ai-grid"><div class="jms-rep-ai-card"><b id="repAiCustomersCount">0</b><span>عملاء في نطاقك</span></div><div class="jms-rep-ai-card"><b id="repAiDebtTotal">0</b><span>إجمالي الرصيد</span></div><div class="jms-rep-ai-card"><b id="repAiOpenQuotes">0</b><span>عروض مفتوحة</span></div><div class="jms-rep-ai-card"><b id="repAiLateVisits">0</b><span>زيارات متأخرة</span></div></div>
        <div class="panel jms-rep-ai-panel"><div class="jms-rep-ai-actions"><button onclick="jmsRepAiAsk('رتب زيارات اليوم')">رتب زيارات اليوم</button><button onclick="jmsRepAiAsk('عملاء لم تتم زيارتهم من شهر')">عملاء لم أزرهم</button><button onclick="jmsRepAiAsk('عليهم تحصيل')">أولويات التحصيل</button><button onclick="jmsRepAiAsk('اكتب رسالة متابعة')">رسالة متابعة</button></div><div id="repAiBody" class="jms-rep-ai-body"><div class="jms-ai-msg bot">اكتب اسم العميل فقط أو سؤالك مثل: <b>كتيكت</b> أو <b>كتيكت كم الدين عليه؟</b> أو <b>متى سويت عرض سعر لفلان؟</b></div></div><div class="jms-rep-ai-input"><input id="repAiInput" placeholder="مثال: كتيكت أو كتيكت كم الدين عليه؟"><button class="primary" onclick="jmsRepAiAsk()">اسأل</button></div></div>`;
      main.appendChild(sec);
    }
    injectRepAiStyle();
    applyRepAiVisibility();
  }
  function applyRepAiVisibility(){
    const user=window.currentUser || currentUser || {};
    document.querySelectorAll('.rep-ai-only').forEach(x=>{x.style.display = user.role ? 'block' : 'none';});
  }
  function injectRepAiStyle(){
    if(document.getElementById('jmsRepAiStyle')) return;
    const st=document.createElement('style');
    st.id='jmsRepAiStyle';
    st.textContent=`
      .jms-rep-ai-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:12px 0}.jms-rep-ai-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:16px;box-shadow:0 8px 26px rgba(15,23,42,.06)}.jms-rep-ai-card b{font-size:26px;color:#0f172a}.jms-rep-ai-card span{display:block;color:#64748b;margin-top:6px}.jms-rep-ai-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.jms-rep-ai-actions button{border:0;border-radius:999px;background:#eef2ff;color:#1e3a8a;padding:9px 12px;font-weight:700}.jms-rep-ai-body{min-height:260px;max-height:52vh;overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:12px;display:grid;gap:10px}.jms-rep-ai-body .jms-ai-msg{padding:12px 14px;border-radius:16px;white-space:pre-wrap;line-height:1.8}.jms-rep-ai-body .user{background:#0f172a;color:#fff;margin-inline-start:20%}.jms-rep-ai-body .bot{background:#fff;border:1px solid #e2e8f0;color:#0f172a;margin-inline-end:8%}.jms-rep-ai-input{display:flex;gap:8px;margin-top:10px}.jms-rep-ai-input input{flex:1;border:1px solid #dbe3ef;border-radius:14px;padding:12px}.jms-rep-ai-input button{border:0;border-radius:14px;background:#0f172a;color:#fff;padding:12px 18px}@media(max-width:700px){.jms-rep-ai-input{flex-direction:column}.jms-rep-ai-body .user,.jms-rep-ai-body .bot{margin:0}.jms-rep-ai-grid{grid-template-columns:1fr 1fr}.jms-rep-ai-card b{font-size:20px}}`;
    document.head.appendChild(st);
  }
  window.renderRepAiDashboard=function(){
    const cs=repScope();
    const debt=cs.reduce((s,c)=>s+Number(c.debt_balance||0),0);
    const open=repQuotes().filter(q=>!['accepted','rejected','cancelled'].includes(String(q.status||'').toLowerCase())).length;
    const late=cs.filter(c=>daysSince(lastVisitFor(c.id)?.date||lastVisitFor(c.id)?.checkin_at)>=30).length;
    const set=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;};
    set('repAiCustomersCount', cs.length);
    set('repAiDebtTotal', arMoney(debt));
    set('repAiOpenQuotes', open);
    set('repAiLateVisits', late);
  };
  window.jmsRepAiAsk=function(q){
    const inp=document.getElementById('repAiInput');
    q=String(q||inp?.value||'').trim(); if(!q) return;
    const body=document.getElementById('repAiBody'); if(!body) return;
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg user">${h(q)}</div>`);
    const ans=repAiAnswer(q);
    body.insertAdjacentHTML('beforeend', `<div class="jms-ai-msg bot">${h(ans)}</div>`);
    body.scrollTop=body.scrollHeight;
    if(inp) inp.value='';
  };

  // Hook existing JMS AI safely: for reps, answer only within their scope.
  const oldJmsAiAnswer = window.jmsAiAnswer || (typeof jmsAiAnswer==='function' ? jmsAiAnswer : null);
  window.jmsAiAnswer = function(q){
    const user=window.currentUser || currentUser || {};
    if(user.role==='rep') return repAiAnswer(q);
    if(typeof oldJmsAiAnswer==='function') return oldJmsAiAnswer(q);
    return repAiAnswer(q);
  };
  try{ if(typeof jmsAiAnswer==='function') jmsAiAnswer = window.jmsAiAnswer; }catch(e){}

  const oldRenderAll=window.renderAll || (typeof renderAll==='function' ? renderAll : null);
  window.renderAll=function(){
    const r=typeof oldRenderAll==='function'?oldRenderAll.apply(this,arguments):undefined;
    setTimeout(()=>{ensureRepAi(); renderRepAiDashboard();},80);
    return r;
  };
  try{ if(typeof renderAll==='function') renderAll=window.renderAll; }catch(e){}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ensureRepAi(); renderRepAiDashboard();},800));
  setTimeout(()=>{ensureRepAi(); renderRepAiDashboard();},1200);
})();

/* JMS UPDATE 14: ink-only warehouse access */
(function(){
  function user(){ return window.currentUser || (typeof currentUser!=='undefined' ? currentUser : null); }
  function applyInkAccess(){
    const u=user(); if(!u) return;
    const allowed=!!u.permissions?.manage_ink || ['admin','sales','warehouse'].includes(u.role);
    const inkButton=document.querySelector('.nav[data-page="inkStock"]');
    const inkPage=document.getElementById('inkStock');
    if(inkButton) inkButton.style.display=allowed?'block':'none';
    if(u.role!=='warehouse') return;
    document.querySelectorAll('.sidebar .nav').forEach(btn=>btn.style.display=btn.dataset.page==='inkStock'?'block':'none');
    document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
    if(inkButton) inkButton.classList.add('active');
    if(inkPage) inkPage.classList.add('active');
    const roleBox=document.getElementById('currentUserRole'); if(roleBox) roleBox.textContent='مسؤول مخزون الأحبار';
  }
  const oldShow=window.showApp;
  if(typeof oldShow==='function') window.showApp=function(){ const r=oldShow.apply(this,arguments); setTimeout(applyInkAccess,80); return r; };
  const oldRender=window.renderAll;
  if(typeof oldRender==='function') window.renderAll=function(){ const r=oldRender.apply(this,arguments); setTimeout(applyInkAccess,80); return r; };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(applyInkAccess,700));
  setTimeout(applyInkAccess,1200);
})();
