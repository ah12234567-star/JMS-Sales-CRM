const DENSITY = {HDPE:0.95,LDPE:0.92,LLDPE:0.92,PP:0.90,MIX:0.93};
const stateKey='jms_pro_crm_data_v1';
let currentUser=JSON.parse(sessionStorage.getItem('jms_user')||'null');
let db=JSON.parse(localStorage.getItem(stateKey)||'null')||seed();

function seed(){
  const rep={id:'rep-yaser',name:'ياسر الحسني',email:'yaser@jms.local',role:'مندوب مبيعات'};
  return {
    reps:[rep,{id:'rep-demo',name:'مندوب جدة',email:'rep@jms.local',role:'مندوب مبيعات'}],
    customers:[
      {id:'c1',name:'مطاعم شامي الشاميل',phone:'',city:'جدة',rep_id:'rep-yaser',debt_balance:0,notes:''}
    ],
    visits:[],
    orders:[],
    users:[
      {name:'مدير النظام',email:'admin@jms.local',role:'مدير النظام'},
      {name:'ياسر الحسني',email:'yaser@jms.local',role:'مندوب مبيعات'},
      {name:'مندوب جدة',email:'rep@jms.local',role:'مندوب مبيعات'}
    ]
  };
}
function save(){localStorage.setItem(stateKey,JSON.stringify(db))}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function $(x){return document.getElementById(x)}
function today(){return new Date().toISOString().slice(0,10)}
function money(n){return Number(n||0).toLocaleString('ar-SA')}
function role(){return document.querySelector('input[name="loginRole"]:checked')?.value||'admin'}

document.querySelectorAll('input[name="loginRole"]').forEach(r=>r.onchange=()=>{
  if(role()==='admin'){loginEmail.value='admin@jms.local';roleHint.textContent='المدير: admin@jms.local / 123456'}
  else{loginEmail.value='yaser@jms.local';roleHint.textContent='المندوب: yaser@jms.local / 123456'}
  loginPassword.value='123456'
});

loginForm.onsubmit=e=>{
  e.preventDefault();
  const email=loginEmail.value.trim(), pass=loginPassword.value;
  if(pass!=='123456') return alert('كلمة المرور غير صحيحة');
  if(email==='admin@jms.local') currentUser={name:'مدير النظام',email,role:'مدير النظام',rep_id:null};
  else if(email==='yaser@jms.local') currentUser={name:'ياسر الحسني',email,role:'مندوب مبيعات',rep_id:'rep-yaser'};
  else if(email==='rep@jms.local') currentUser={name:'مندوب جدة',email,role:'مندوب مبيعات',rep_id:'rep-demo'};
  else return alert('الحساب غير موجود');
  sessionStorage.setItem('jms_user',JSON.stringify(currentUser));
  showApp();
};
logoutBtn.onclick=()=>{sessionStorage.removeItem('jms_user');location.reload()};

function showApp(){
  loginView.classList.add('hidden');appView.classList.remove('hidden');
  currentUserName.textContent=currentUser.name;currentUserRole.textContent=currentUser.role;
  if(currentUser.role!=='مدير النظام') document.querySelector('[data-page="users"]').style.display='none';
  orderDate.value=today();
  renderAll();
}
if(currentUser) showApp();

document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.nav,.page').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');$(btn.dataset.page).classList.add('active');
  renderAll();
});

function allowedCustomers(){
  return currentUser?.role==='مدير النظام'?db.customers:db.customers.filter(c=>c.rep_id===currentUser.rep_id);
}
function repName(repId){return db.reps.find(r=>r.id===repId)?.name||'-'}
function lastVisit(cid){return db.visits.filter(v=>v.customer_id===cid).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||''}
function daysFrom(d){return d?Math.floor((new Date(today())-new Date(d))/86400000):999}
function status(c){let d=daysFrom(lastVisit(c.id));return d>=30?['متأخر','late']:['منتظم','ok']}

function renderAll(){renderStats();renderSelects();renderCustomers();renderOrders();renderDebts();renderUsers();calc();}
function renderStats(){
  const cs=allowedCustomers();
  statCustomers.textContent=cs.length;
  statDebt.textContent=money(cs.reduce((s,c)=>s+Number(c.debt_balance||0),0));
  statOrders.textContent=db.orders.filter(o=>o.date===today()).length;
  statVisits.textContent=db.visits.filter(v=>v.date===today()).length;
}
function renderSelects(){
  const cs=allowedCustomers();
  orderCustomer.innerHTML='<option value="">اختر العميل</option>'+cs.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const reps=currentUser.role==='مدير النظام'?db.reps:db.reps.filter(r=>r.id===currentUser.rep_id);
  orderRep.innerHTML=reps.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}
function renderCustomers(){
  const q=(customerSearch.value||'').trim();
  const cs=allowedCustomers().filter(c=>!q||c.name.includes(q)||String(c.phone||'').includes(q));
  customersGrid.innerHTML=cs.map(c=>{
    const st=status(c);
    return `<div class="customer-card">
      <div class="customer-head"><div><h3>${c.name}</h3><p>${c.phone||'-'} · ${c.city||'-'} · ${repName(c.rep_id)}</p></div><span class="badge ${st[1]}">${st[0]}</span></div>
      <div class="metrics"><div><b>${money(c.debt_balance)}</b><span>مديونية</span></div><div><b>${lastVisit(c.id)||'-'}</b><span>آخر زيارة</span></div><div><b>${c.next_date||'-'}</b><span>موعد</span></div></div>
      <div class="customer-actions">
        <button onclick="visit('${c.id}')">تمت الزيارة</button><button onclick="newOrder('${c.id}')">طلب جديد</button><button onclick="appointment('${c.id}')">موعد</button><button onclick="collect('${c.id}')">تحصيل</button><button onclick="note('${c.id}')">ملاحظة</button>
      </div>
    </div>`
  }).join('')||'<div class="table-card">لا يوجد عملاء</div>';
}
customerSearch.oninput=renderCustomers;

function visit(cid){let c=db.customers.find(x=>x.id===cid);db.visits.unshift({id:id(),customer_id:cid,rep_id:c.rep_id,date:today(),notes:'تمت الزيارة'});save();renderAll()}
function newOrder(cid){document.querySelector('[data-page="orders"]').click();setTimeout(()=>{orderCustomer.value=cid;},100)}
function appointment(cid){let d=prompt('تاريخ الموعد YYYY-MM-DD',today());if(!d)return;let c=db.customers.find(x=>x.id===cid);c.next_date=d;save();renderAll()}
function collect(cid){let a=Number(prompt('مبلغ التحصيل','0')||0);if(!a)return;let c=db.customers.find(x=>x.id===cid);c.debt_balance=Math.max(0,Number(c.debt_balance||0)-a);save();renderAll()}
function note(cid){let n=prompt('اكتب الملاحظة');if(!n)return;let c=db.customers.find(x=>x.id===cid);c.notes=[c.notes,n].filter(Boolean).join(' | ');save();renderAll()}
function openCustomerModal(){let name=prompt('اسم العميل');if(!name)return;db.customers.push({id:id(),name,phone:'',city:'جدة',rep_id:currentUser.rep_id||'rep-yaser',debt_balance:0});save();renderAll()}

['width','length','thickness','sizeUnit','thicknessUnit','material','totalKg','priceKg'].forEach(x=>$(x).addEventListener('input',calc));
['sizeUnit','thicknessUnit','material'].forEach(x=>$(x).addEventListener('change',calc));
function calc(){
  let w=Number(width.value||0), l=Number(length.value||0), t=Number(thickness.value||0);
  if(sizeUnit.value==='cm'){w/=100;l/=100}else if(sizeUnit.value==='mm'){w/=1000;l/=1000}
  if(thicknessUnit.value==='mm') t*=1000;
  let den=DENSITY[material.value]||0.93; density.value=den;
  let gram=w*l*t*den; pieceWeight.value=gram?gram.toFixed(2)+' جرام':'';
  let kg=Number(totalKg.value||0), pcs=gram?Math.floor(kg/(gram/1000)):0;
  piecesCount.value=pcs?pcs.toLocaleString('ar-SA')+' حبة':'';
  let val=kg*Number(priceKg.value||0); orderAmount.value=val?val.toFixed(2)+' ريال':'';
}
orderForm.onsubmit=e=>{
  e.preventDefault();
  if(!orderCustomer.value) return alert('اختر العميل');
  const order={id:id(),date:orderDate.value||today(),customer_id:orderCustomer.value,rep_id:orderRep.value,product:productType.value,material:material.value,color:color.value,width:width.value,length:length.value,thickness:thickness.value,total_kg:totalKg.value,piece_weight:pieceWeight.value,pieces:piecesCount.value,amount:orderAmount.value,status:orderStatus.value,notes:orderNotes.value};
  db.orders.unshift(order);save();renderAll();alert('تم حفظ الطلب');
};
function resetOrder(){orderForm.reset();orderDate.value=today();calc()}
function customerName(cid){return db.customers.find(c=>c.id===cid)?.name||'-'}
function renderOrders(){
  ordersList.innerHTML=db.orders.map(o=>`<table><tr><th>التاريخ</th><th>العميل</th><th>المنتج</th><th>المقاس</th><th>السماكة</th><th>الكمية</th><th>وزن الحبة</th><th>عدد الحبات</th><th>القيمة</th></tr><tr><td>${o.date}</td><td>${customerName(o.customer_id)}</td><td>${o.product}</td><td>${o.width}×${o.length}</td><td>${o.thickness}</td><td>${o.total_kg} كجم</td><td>${o.piece_weight}</td><td>${o.pieces}</td><td>${o.amount}</td></tr></table>`).join('<br>')||'لا توجد طلبات';
}
function renderDebts(){
  debtsList.innerHTML='<table><tr><th>العميل</th><th>المندوب</th><th>الرصيد</th><th>آخر زيارة</th></tr>'+allowedCustomers().map(c=>`<tr><td>${c.name}</td><td>${repName(c.rep_id)}</td><td>${money(c.debt_balance)}</td><td>${lastVisit(c.id)||'-'}</td></tr>`).join('')+'</table>';
}
function renderUsers(){
  usersList.innerHTML='<table><tr><th>الاسم</th><th>البريد</th><th>الدور</th></tr>'+db.users.map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td></tr>`).join('')+'</table>';
}
