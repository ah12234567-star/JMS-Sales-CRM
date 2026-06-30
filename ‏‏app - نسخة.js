(function () {
  'use strict';

  const cfg = window.JMS_CONFIG || {};
  let supabase = null;
  try {
    if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY) {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
    }
  } catch (err) { console.warn('Supabase local mode', err); supabase = null; }

  const $ = (id) => document.getElementById(id);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const daysBetween = (date) => !date ? 9999 : Math.floor((new Date(todayISO() + 'T00:00:00') - new Date(date + 'T00:00:00')) / 86400000);
  const money = (n) => Number(n || 0).toLocaleString('ar-SA');
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  const ADMIN_EMAIL = 'admin@jms.local';
  const ADMIN_PASS = '123456';

  let db = {
    reps: [{ id: 'rep-demo-1', name: 'مندوب جدة', phone: '', email: 'rep@jms.local', status: 'نشط' }],
    users: [
      { id: 'admin-1', name: 'مدير النظام', email: ADMIN_EMAIL, password: ADMIN_PASS, role: 'admin', rep_id: null, status: 'نشط' },
      { id: 'user-rep-demo', name: 'مندوب جدة', email: 'rep@jms.local', password: '123456', role: 'rep', rep_id: 'rep-demo-1', status: 'نشط' }
    ],
    customers: [],
    visits: [],
    orders: []
  };

  let currentUser = JSON.parse(sessionStorage.getItem('jms_current_user') || 'null');
  const isAdmin = () => currentUser?.role === 'admin';
  const currentRepId = () => currentUser?.rep_id || null;

  function loadLocalData() {
    try {
      const saved = JSON.parse(localStorage.getItem('jms_crm_data') || 'null');
      if (saved && typeof saved === 'object') db = { ...db, ...saved };
      if (!Array.isArray(db.users)) db.users = [];
      if (!db.users.some(u => u.email === ADMIN_EMAIL)) db.users.unshift({ id: 'admin-1', name: 'مدير النظام', email: ADMIN_EMAIL, password: ADMIN_PASS, role: 'admin', rep_id: null, status: 'نشط' });
      if (!Array.isArray(db.reps)) db.reps = [];
      if (!Array.isArray(db.customers)) db.customers = [];
      if (!Array.isArray(db.visits)) db.visits = [];
      if (!Array.isArray(db.orders)) db.orders = [];
    } catch (err) { console.warn('local load error', err); }
  }

  function saveLocalData() { localStorage.setItem('jms_crm_data', JSON.stringify(db)); }
  function setHtml(id, html) { const el = $(id); if (el) el.innerHTML = html; }
  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
  function pageData(table) {
    if (isAdmin()) return db[table] || [];
    const rid = currentRepId();
    if (table === 'customers') return db.customers.filter(c => c.rep_id === rid);
    if (table === 'visits') return db.visits.filter(v => v.rep_id === rid);
    if (table === 'orders') return db.orders.filter(o => o.rep_id === rid);
    if (table === 'reps') return db.reps.filter(r => r.id === rid);
    return db[table] || [];
  }

  function applyRoleUI() {
    document.querySelectorAll('.admin-only,.admin-page').forEach(el => el.classList.toggle('hidden', !isAdmin()));
    if (currentUser) {
      setText('currentUserName', currentUser.name || currentUser.email);
      setText('currentUserRole', isAdmin() ? 'مدير النظام' : 'مندوب مبيعات');
      setText('pageSubtitle', isAdmin() ? 'متابعة المناديب والعملاء والزيارات والطلبات' : 'متابعة عملائك وزياراتك وطلباتك فقط');
    }
    if (!isAdmin()) {
      ['visitRep','orderRep'].forEach(id => { const el=$(id); if (el) { el.disabled = true; el.value = currentRepId(); } });
    }
  }

  function showApp() { $('loginView')?.classList.add('hidden'); $('appView')?.classList.remove('hidden'); applyRoleUI(); refreshAll(); }
  function showLogin() { $('appView')?.classList.add('hidden'); $('loginView')?.classList.remove('hidden'); }

  window.logout = function () { sessionStorage.removeItem('jms_current_user'); currentUser = null; showLogin(); };

  $('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    loadLocalData();
    const email = $('loginEmail').value.trim().toLowerCase();
    const password = $('loginPassword').value;
    const user = db.users.find(u => String(u.email).toLowerCase() === email && String(u.password) === String(password) && u.status !== 'موقوف');
    if (!user) return alert('بيانات الدخول غير صحيحة أو الحساب موقوف.');
    currentUser = { id: user.id, name: user.name, email: user.email, role: user.role, rep_id: user.rep_id || null };
    sessionStorage.setItem('jms_current_user', JSON.stringify(currentUser));
    showApp();
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.onclick = () => {
      if (!isAdmin() && button.classList.contains('admin-only')) return;
      document.querySelectorAll('.nav-item,.page').forEach((x) => x.classList.remove('active'));
      button.classList.add('active');
      $(button.dataset.tab)?.classList.add('active');
      setText('pageTitle', button.textContent);
    };
  });

  window.goTab = function (tab) { document.querySelector(`[data-tab="${tab}"]`)?.click(); };
  function repNameFn(id) { return db.reps.find((r) => r.id === id)?.name || '-'; }
  function customerNameFn(id) { return db.customers.find((c) => c.id === id)?.name || '-'; }
  function lastVisit(id) { return db.visits.filter(v => v.customer_id === id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date)))[0]?.visit_date || ''; }
  function customerStatus(customer) { const d = daysBetween(lastVisit(customer.id)); return d >= 30 ? {t:'متأخر',c:'late',d} : d >= 20 ? {t:'قريب',c:'warn',d} : {t:'منتظم',c:'ok',d}; }
  function orderBadge(status) { return status === 'تم التسليم' ? 'done' : status === 'ملغي' ? 'cancel' : 'new'; }

  async function refreshAll() {
    loadLocalData();
    if (supabase) {
      try {
        setHtml('cloudStatus', 'جاري الاتصال بقاعدة البيانات...');
        const [reps, customers, visits, orders, users] = await Promise.all([
          supabase.from('reps').select('*').order('created_at', { ascending: false }),
          supabase.from('customers').select('*').order('created_at', { ascending: false }),
          supabase.from('visits').select('*').order('visit_date', { ascending: false }),
          supabase.from('orders').select('*').order('order_date', { ascending: false }),
          supabase.from('users').select('*').order('created_at', { ascending: false })
        ]);
        const responses = [reps, customers, visits, orders, users];
        if (responses.some(r => r.error)) throw responses.find(r => r.error).error;
        db.reps = reps.data?.length ? reps.data : db.reps;
        db.customers = customers.data || [];
        db.visits = visits.data || [];
        db.orders = orders.data || [];
        db.users = users.data?.length ? users.data : db.users;
        saveLocalData();
        setHtml('cloudStatus', '✅ الاتصال بالسحابة يعمل. ملاحظة: حسابات المستخدمين هنا بسيطة وليست Supabase Auth بعد.');
      } catch (err) { console.warn(err); setHtml('cloudStatus', '⚠️ يعمل النظام بوضع محلي. للحسابات المشتركة بين الأجهزة نحتاج تفعيل جدول users في Supabase.'); }
    } else setHtml('cloudStatus', '⚠️ يعمل النظام بوضع محلي على نفس المتصفح.');
    applyRoleUI(); render();
  }
  window.refreshAll = refreshAll;

  function renderSelects() {
    const repsSource = isAdmin() ? db.reps.filter(r=>r.status!=='موقوف') : db.reps.filter(r=>r.id===currentRepId());
    const repsOptions = '<option value="">اختر المندوب</option>' + repsSource.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    const customerSource = pageData('customers');
    const customersOptions = '<option value="">اختر العميل</option>' + customerSource.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    ['customerRep','visitRep','orderRep','userRep'].forEach(id => { if ($(id)) $(id).innerHTML = repsOptions; });
    ['visitCustomer','orderCustomer'].forEach(id => { if ($(id)) $(id).innerHTML = customersOptions; });
    if (!isAdmin()) ['visitRep','orderRep'].forEach(id => { if ($(id)) { $(id).value=currentRepId(); $(id).disabled=true; }});
  }
  function renderStats() { const customers=pageData('customers'), visits=pageData('visits'), orders=pageData('orders'); setText('totalCustomers', customers.length); setText('lateCustomers', customers.filter(c=>customerStatus(c).d>=30).length); setText('todayVisits', visits.filter(v=>v.visit_date===todayISO()).length); setText('totalOrders', orders.length); setText('salesTotal', money(orders.reduce((s,o)=>s+Number(o.amount||0),0))); }

  window.renderCustomers = function () { const q=($('customerSearch')?.value||'').trim(); const list=pageData('customers').filter(c=>!q||String(c.name||'').includes(q)||String(c.phone||'').includes(q)||String(c.city||'').includes(q)); const rows=list.map(c=>{const s=customerStatus(c), maps=c.location?`<a target="_blank" href="${c.location}">الموقع</a>`:'-'; return `<tr><td>${c.name}</td><td>${c.phone||'-'}</td><td>${c.city||'-'}</td><td>${c.activity||'-'}</td><td>${repNameFn(c.rep_id)}</td><td>${lastVisit(c.id)||'لم يزر'}</td><td><span class="badge ${s.c}">${s.t}</span></td><td>${maps}</td></tr>`;}).join(''); setHtml('customersList', rows?`<table><thead><tr><th>العميل</th><th>الجوال</th><th>المدينة</th><th>النشاط</th><th>المندوب</th><th>آخر زيارة</th><th>الحالة</th><th>الخريطة</th></tr></thead><tbody>${rows}</tbody></table>`:'لا يوجد عملاء'); };
  function renderReps(){ const rows=db.reps.map(r=>`<tr><td>${r.name}</td><td>${r.phone||'-'}</td><td>${r.email||'-'}</td><td>${r.status}</td><td>${db.customers.filter(c=>c.rep_id===r.id).length}</td><td>${db.visits.filter(v=>v.rep_id===r.id).length}</td></tr>`).join(''); setHtml('repsList', rows?`<table><thead><tr><th>المندوب</th><th>الجوال</th><th>الإيميل</th><th>الحالة</th><th>عملاء</th><th>زيارات</th></tr></thead><tbody>${rows}</tbody></table>`:'لا يوجد مناديب'); }
  function renderUsers(){ const rows=db.users.map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role==='admin'?'مدير':'مندوب'}</td><td>${repNameFn(u.rep_id)}</td><td>${u.status||'نشط'}</td><td>${u.password}</td></tr>`).join(''); setHtml('usersList', rows?`<table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>المندوب المرتبط</th><th>الحالة</th><th>كلمة المرور</th></tr></thead><tbody>${rows}</tbody></table>`:'لا يوجد مستخدمين'); }
  function renderVisits(){ const visits=pageData('visits'); const rows=visits.map(v=>`<tr><td>${v.visit_date}</td><td>${customerNameFn(v.customer_id)}</td><td>${repNameFn(v.rep_id)}</td><td>${v.status}</td><td>${v.location||'-'}</td><td>${v.notes||'-'}</td></tr>`).join(''); setHtml('visitsList', rows?`<table><thead><tr><th>التاريخ</th><th>العميل</th><th>المندوب</th><th>الحالة</th><th>الموقع</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table>`:'لا توجد زيارات'); const todayRows=visits.filter(v=>v.visit_date===todayISO()).map(v=>`<tr><td>${customerNameFn(v.customer_id)}</td><td>${repNameFn(v.rep_id)}</td><td>${v.status}</td><td>${v.notes||'-'}</td></tr>`).join(''); setHtml('todayVisitsTable', todayRows?`<table><thead><tr><th>العميل</th><th>المندوب</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${todayRows}</tbody></table>`:'لا توجد زيارات اليوم'); }
  function renderOrders(){ const orders=pageData('orders'); const rows=orders.map(o=>`<tr><td>${o.order_date}</td><td>${customerNameFn(o.customer_id)}</td><td>${repNameFn(o.rep_id)}</td><td>${o.product||'-'}</td><td>${o.quantity||'-'}</td><td>${money(o.amount)}</td><td><span class="badge ${orderBadge(o.status)}">${o.status}</span></td></tr>`).join(''); setHtml('ordersList', rows?`<table><thead><tr><th>التاريخ</th><th>العميل</th><th>المندوب</th><th>الصنف</th><th>الكمية</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>`:'لا توجد طلبات'); setHtml('latestOrders', orders.length?`<table><thead><tr><th>التاريخ</th><th>العميل</th><th>الصنف</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${orders.slice(0,5).map(o=>`<tr><td>${o.order_date}</td><td>${customerNameFn(o.customer_id)}</td><td>${o.product||'-'}</td><td>${money(o.amount)}</td><td>${o.status}</td></tr>`).join('')}</tbody></table>`:'لا توجد طلبات'); }
  function renderAlerts(){ const late=pageData('customers').filter(c=>customerStatus(c).d>=30); const html=late.map(c=>`<div class="list-item"><strong>${c.name}</strong><br>متأخر ${customerStatus(c).d} يوم — المندوب: ${repNameFn(c.rep_id)}</div>`).join(''); setHtml('quickAlerts',html||'<div class="list-item">لا يوجد عملاء متأخرين حالياً</div>'); setHtml('alertsList',html||'<div class="list-item">لا توجد تنبيهات</div>'); }
  function renderTopReps(){ const ranked=db.reps.map(r=>({name:r.name,count:db.visits.filter(v=>v.rep_id===r.id).length})).sort((a,b)=>b.count-a.count).slice(0,5); setHtml('topReps', ranked.map((r,i)=>`<div class="rank-item"><b>${i+1}. ${r.name}</b><span>${r.count} زيارة</span></div>`).join('')||'لا يوجد بيانات'); }
  function render(){ renderSelects(); renderStats(); window.renderCustomers(); renderReps(); renderUsers(); renderVisits(); renderOrders(); renderAlerts(); renderTopReps(); }

  async function insertData(table,row){ if(supabase){ try{ const {error}=await supabase.from(table).insert(row); if(!error) return true; console.warn(error);}catch(err){console.warn(err);} } row.id=row.id||newId(); db[table].unshift(row); saveLocalData(); return true; }
  function bindForms(){
    $('repForm') && ($('repForm').onsubmit=async e=>{e.preventDefault(); const id=newId(); const row={id,name:$('repName').value.trim(),phone:$('repPhone').value.trim(),email:$('repEmail').value.trim(),status:$('repStatus').value}; await insertData('reps',row); e.target.reset(); refreshAll();});
    $('userForm') && ($('userForm').onsubmit=async e=>{e.preventDefault(); const role=$('userRole').value; const row={id:newId(),name:$('userName').value.trim(),email:$('userEmail').value.trim().toLowerCase(),password:$('userPassword').value.trim(),role,rep_id:role==='rep'?$('userRep').value:null,status:'نشط'}; if(!row.email||!row.password) return alert('أدخل البريد وكلمة المرور'); if(row.role==='rep'&&!row.rep_id) return alert('اختر المندوب المرتبط بالحساب'); if(db.users.some(u=>String(u.email).toLowerCase()===row.email)) return alert('هذا البريد مستخدم من قبل'); await insertData('users',row); e.target.reset(); refreshAll(); alert('تم إنشاء الحساب. يمكن للمندوب الدخول الآن بالبريد وكلمة المرور.');});
    $('customerForm') && ($('customerForm').onsubmit=async e=>{e.preventDefault(); await insertData('customers',{name:$('customerName').value.trim(),phone:$('customerPhone').value.trim(),city:$('customerCity').value.trim(),activity:$('customerActivity').value.trim(),location:$('customerLocation').value.trim(),rep_id:$('customerRep').value||null,notes:$('customerNotes').value.trim()}); e.target.reset(); refreshAll();});
    if($('visitDate')) $('visitDate').value=todayISO(); $('visitForm') && ($('visitForm').onsubmit=async e=>{e.preventDefault(); await insertData('visits',{customer_id:$('visitCustomer').value,rep_id:isAdmin()?$('visitRep').value:currentRepId(),visit_date:$('visitDate').value,status:$('visitStatus').value,location:$('visitLocation').value.trim(),notes:$('visitNotes').value.trim()}); e.target.reset(); $('visitDate').value=todayISO(); refreshAll();});
    if($('orderDate')) $('orderDate').value=todayISO(); $('orderForm') && ($('orderForm').onsubmit=async e=>{e.preventDefault(); await insertData('orders',{customer_id:$('orderCustomer').value,rep_id:isAdmin()?$('orderRep').value:currentRepId(),order_date:$('orderDate').value,product:$('orderProduct').value.trim(),quantity:$('orderQuantity').value||null,amount:$('orderAmount').value||0,status:$('orderStatus').value}); e.target.reset(); $('orderDate').value=todayISO(); refreshAll();});
  }

  window.exportCustomersCSV=function(){ const lines=[['العميل','الجوال','المدينة','النشاط','المندوب','آخر زيارة','الحالة','أيام التأخير']]; pageData('customers').forEach(c=>{const s=customerStatus(c); lines.push([c.name,c.phone,c.city,c.activity,repNameFn(c.rep_id),lastVisit(c.id)||'لم يزر',s.t,s.d]);}); const csv=lines.map(r=>r.map(x=>`"${String(x??'').replaceAll('"','""')}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'})); a.download='JMS_customers.csv'; a.click(); };
  window.requestNotifications=function(){ if(!('Notification' in window)) return alert('المتصفح لا يدعم الإشعارات'); Notification.requestPermission().then(p=>{if(p==='granted') new Notification('JMS CRM',{body:'تم تفعيل الإشعارات'});}); };
  window.seedDemoData=function(){ if(!isAdmin()) return; loadLocalData(); if(!db.customers.length){ db.customers.push({id:newId(),name:'عميل تجريبي',phone:'0500000000',city:'جدة',activity:'تغليف',location:'',rep_id:'rep-demo-1',notes:'بيانات تجربة'}); } saveLocalData(); refreshAll(); };

  bindForms(); loadLocalData(); if(currentUser) showApp(); else showLogin();
})();
