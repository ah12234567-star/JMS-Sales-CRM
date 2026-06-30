
// JMS role selector patch
(function(){
  const byId = (id) => document.getElementById(id);
  function setVal(id, v){ const el = byId(id); if(el) el.value = v; }
  function selectedRole(){
    return document.querySelector('input[name="loginRole"]:checked')?.value || 'admin';
  }
  function updateRoleHint(){
    const hint = byId('roleHint');
    const role = selectedRole();
    if(hint){
      hint.textContent = role === 'admin'
        ? 'دخول المدير: admin@jms.local / 123456'
        : 'دخول المندوب: rep@jms.local / 123456';
    }
    if(role === 'admin'){
      setVal('loginEmail','admin@jms.local');
      setVal('loginPassword','123456');
    } else {
      setVal('loginEmail','yaser@jms.local');
      setVal('loginPassword','123456');
    }
  }
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('input[name="loginRole"]').forEach(r => r.addEventListener('change', updateRoleHint));
    updateRoleHint();
  });
})();

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

  window.db = {
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
      if (saved && typeof saved === 'object') window.db = { ...db, ...saved };
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
  window.renderOrders = function renderOrders(){ const orders=pageData('orders'); const rows=orders.map(o=>`<tr><td>${o.order_date}</td><td>${customerNameFn(o.customer_id)}</td><td>${repNameFn(o.rep_id)}</td><td>${o.product||'-'}</td><td>${o.quantity||'-'}</td><td>${money(o.amount)}</td><td><span class="badge ${orderBadge(o.status)}">${o.status}</span></td></tr>`).join(''); setHtml('ordersList', rows?`<table><thead><tr><th>التاريخ</th><th>العميل</th><th>المندوب</th><th>الصنف</th><th>الكمية</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>`:'لا توجد طلبات'); setHtml('latestOrders', orders.length?`<table><thead><tr><th>التاريخ</th><th>العميل</th><th>الصنف</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${orders.slice(0,5).map(o=>`<tr><td>${o.order_date}</td><td>${customerNameFn(o.customer_id)}</td><td>${o.product||'-'}</td><td>${money(o.amount)}</td><td>${o.status}</td></tr>`).join('')}</tbody></table>`:'لا توجد طلبات'); }
  function renderAlerts(){ const late=pageData('customers').filter(c=>customerStatus(c).d>=30); const html=late.map(c=>`<div class="list-item"><strong>${c.name}</strong><br>متأخر ${customerStatus(c).d} يوم — المندوب: ${repNameFn(c.rep_id)}</div>`).join(''); setHtml('quickAlerts',html||'<div class="list-item">لا يوجد عملاء متأخرين حالياً</div>'); setHtml('alertsList',html||'<div class="list-item">لا توجد تنبيهات</div>'); }
  function renderTopReps(){ const ranked=db.reps.map(r=>({name:r.name,count:db.visits.filter(v=>v.rep_id===r.id).length})).sort((a,b)=>b.count-a.count).slice(0,5); setHtml('topReps', ranked.map((r,i)=>`<div class="rank-item"><b>${i+1}. ${r.name}</b><span>${r.count} زيارة</span></div>`).join('')||'لا يوجد بيانات'); }
  function render(){ renderSelects(); renderStats(); window.renderCustomers(); renderReps(); renderUsers(); renderVisits(); renderOrders(); renderAlerts(); renderTopReps(); }

  window.insertData = async function insertData(table,row){ if(supabase){ try{ const {error}=await supabase.from(table).insert(row); if(!error) return true; console.warn(error);}catch(err){console.warn(err);} } row.id=row.id||newId(); db[table].unshift(row); saveLocalData(); return true; }
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



/* JMS plastic order fields patch */
(function(){
  function byId(id){ return document.getElementById(id); }
  function v(id){ return (byId(id)?.value || '').trim(); }

  function addPlasticFieldsToOrderForm(){
    const form = byId('orderForm');
    if(!form || byId('orderWidth')) return;

    const submitBtn = form.querySelector('button[type="submit"], .submit, button');
    const wrapper = document.createElement('div');
    wrapper.className = 'plastic-order-fields';
    wrapper.innerHTML = `
      <div class="form-section-title">بيانات طلب التصنيع</div>
      <div class="grid-4">
        <label>العرض / المقاس
          <input id="orderWidth" type="number" step="0.01" placeholder="مثال: 65">
        </label>
        <label>الطول
          <input id="orderLength" type="number" step="0.01" placeholder="مثال: 95">
        </label>
        <label>وحدة المقاس
          <select id="orderSizeUnit">
            <option value="cm">سم</option>
            <option value="mm">مم</option>
          </select>
        </label>
        <label>السماكة
          <input id="orderThickness" type="number" step="0.01" placeholder="مثال: 75">
        </label>
      </div>
      <div class="grid-4">
        <label>وحدة السماكة
          <select id="orderThicknessUnit">
            <option value="micron">ميكرون</option>
            <option value="mm">مم</option>
          </select>
        </label>
        <label>اللون
          <input id="orderColor" placeholder="شفاف / أبيض / أسود / مطبوع">
        </label>
        <label>النوع
          <select id="orderBagType">
            <option value="أكياس رول">أكياس رول</option>
            <option value="أكياس شيت">أكياس شيت</option>
            <option value="أكياس تي شيرت">أكياس تي شيرت</option>
            <option value="شرنك">شرنك</option>
            <option value="فيلم">فيلم</option>
            <option value="أكياس نفايات">أكياس نفايات</option>
            <option value="أخرى">أخرى</option>
          </select>
        </label>
        <label>المادة
          <select id="orderMaterial">
            <option value="HDPE">HDPE</option>
            <option value="LDPE">LDPE</option>
            <option value="LLDPE">LLDPE</option>
            <option value="HDPE/LDPE">HDPE/LDPE</option>
            <option value="حسب الخلطة">حسب الخلطة</option>
          </select>
        </label>
      </div>
      <div class="grid-3">
        <label>الطباعة
          <select id="orderPrint">
            <option value="بدون طباعة">بدون طباعة</option>
            <option value="طباعة وجه واحد">طباعة وجه واحد</option>
            <option value="طباعة وجهين">طباعة وجهين</option>
          </select>
        </label>
        <label>عدد الألوان
          <input id="orderPrintColors" type="number" min="0" placeholder="مثال: 2">
        </label>
        <label>ملاحظات فنية
          <input id="orderSpecsNotes" placeholder="مثال: تخريم / لحام / رول / كرتون">
        </label>
      </div>
    `;

    if(submitBtn) form.insertBefore(wrapper, submitBtn);
    else form.appendChild(wrapper);
  }

  function orderSpecsHtml(o){
    const dims = [o.width, o.length].filter(Boolean).join(' × ');
    const sizeUnit = o.size_unit || 'سم';
    const thickness = o.thickness ? `${o.thickness} ${o.thickness_unit || 'ميكرون'}` : '-';
    return `
      <div class="specs-card">
        <b>${o.bag_type || o.product || 'طلب تصنيع'}</b>
        <span>المقاس: ${dims ? dims + ' ' + sizeUnit : '-'}</span>
        <span>السماكة: ${thickness}</span>
        <span>اللون: ${o.color || '-'}</span>
        <span>المادة: ${o.material || '-'}</span>
        <span>الطباعة: ${o.print || '-'}</span>
        <span>ألوان الطباعة: ${o.print_colors || '-'}</span>
        <span>ملاحظات: ${o.specs_notes || '-'}</span>
      </div>`;
  }

  const originalInsert = window.insertData;
  if(typeof originalInsert === 'function'){
    window.insertData = async function(table, row){
      if(table === 'orders'){
        row.width = v('orderWidth');
        row.length = v('orderLength');
        row.size_unit = v('orderSizeUnit') || 'cm';
        row.thickness = v('orderThickness');
        row.thickness_unit = v('orderThicknessUnit') || 'micron';
        row.color = v('orderColor');
        row.bag_type = v('orderBagType');
        row.material = v('orderMaterial');
        row.print = v('orderPrint');
        row.print_colors = v('orderPrintColors');
        row.specs_notes = v('orderSpecsNotes');
        if(!row.product) row.product = row.bag_type || 'طلب تصنيع';
      }
      return originalInsert(table, row);
    }
  }

  const originalRenderOrders = window.renderOrders;
  if(typeof originalRenderOrders === 'function'){
    window.renderOrders = function(){
      originalRenderOrders();
      const list = byId('ordersList');
      if(list && window.db && Array.isArray(window.db.orders)){
        const cards = window.db.orders.map(o => orderSpecsHtml(o)).join('');
        const box = document.createElement('div');
        box.className = 'order-specs-list';
        box.innerHTML = cards || '<div class="list-item">لا توجد طلبات تصنيع</div>';
        if(!list.querySelector('.order-specs-list')) list.appendChild(box);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    addPlasticFieldsToOrderForm();
    setTimeout(addPlasticFieldsToOrderForm, 800);
  });
})();



/* JMS weight and pieces calculator patch */
(function(){
  const DENSITY = {
    "HDPE": 0.95,
    "LDPE": 0.92,
    "LLDPE": 0.92,
    "PP": 0.90,
    "HDPE/LDPE": 0.94,
    "حسب الخلطة": 0.93
  };

  function byId(id){ return document.getElementById(id); }
  function num(id){ return parseFloat((byId(id)?.value || '').toString().replace(',', '.')) || 0; }
  function val(id){ return (byId(id)?.value || '').trim(); }

  function ensureCalculatorFields(){
    const form = byId('orderForm');
    if(!form || byId('pieceWeightResult')) return;

    // Try to find the plastic specs block; fallback before first submit button.
    const target = form.querySelector('.plastic-order-fields') || form.querySelector('button[type="submit"], button') || form;

    const calc = document.createElement('div');
    calc.className = 'jms-calc-box';
    calc.innerHTML = `
      <div class="form-section-title">حاسبة وزن الحبة وعدد الحبات</div>

      <div class="grid-4">
        <label>كمية الطلب بالكيلو
          <input id="orderTotalKg" type="number" step="0.01" placeholder="مثال: 1000">
        </label>

        <label>كثافة الخامة
          <input id="orderDensity" type="number" step="0.001" placeholder="تلقائي حسب الخامة" readonly>
        </label>

        <label>وزن الحبة المتوقع
          <input id="pieceWeightResult" type="text" readonly placeholder="يحسب تلقائيًا">
        </label>

        <label>عدد الحبات المتوقع
          <input id="piecesCountResult" type="text" readonly placeholder="يحسب تلقائيًا">
        </label>
      </div>

      <div class="calc-note" id="calcNote">
        أدخل العرض والطول والسماكة والخامة وكمية الطلب بالكيلو ليحسب النظام وزن الحبة وعدد الحبات.
      </div>
    `;

    if(target.classList && target.classList.contains('plastic-order-fields')){
      target.appendChild(calc);
    } else if(target.parentNode){
      target.parentNode.insertBefore(calc, target);
    } else {
      form.appendChild(calc);
    }

    ["orderWidth","orderLength","orderThickness","orderMaterial","orderTotalKg","orderSizeUnit","orderThicknessUnit"].forEach(id=>{
      const el = byId(id);
      if(el) {
        el.addEventListener('input', calculatePieceWeight);
        el.addEventListener('change', calculatePieceWeight);
      }
    });
    calculatePieceWeight();
  }

  function calculatePieceWeight(){
    const width = num('orderWidth');
    const length = num('orderLength');
    const thickness = num('orderThickness');
    const material = val('orderMaterial') || 'HDPE';
    const totalKg = num('orderTotalKg');

    let density = DENSITY[material] || 0.93;

    const densityEl = byId('orderDensity');
    if(densityEl) densityEl.value = density;

    const sizeUnit = val('orderSizeUnit') || 'cm';
    const thicknessUnit = val('orderThicknessUnit') || 'micron';

    let widthM = width;
    let lengthM = length;

    if(sizeUnit === 'cm'){
      widthM = width / 100;
      lengthM = length / 100;
    } else if(sizeUnit === 'mm'){
      widthM = width / 1000;
      lengthM = length / 1000;
    }

    let thicknessMicron = thickness;
    if(thicknessUnit === 'mm'){
      thicknessMicron = thickness * 1000;
    }

    // Plastic film formula:
    // grams = width(m) * length(m) * thickness(micron) * density(g/cm3)
    const pieceGram = widthM * lengthM * thicknessMicron * density;
    const pieceKg = pieceGram / 1000;
    const pieces = pieceKg > 0 && totalKg > 0 ? Math.floor(totalKg / pieceKg) : 0;

    const weightOut = byId('pieceWeightResult');
    const piecesOut = byId('piecesCountResult');
    const note = byId('calcNote');

    if(weightOut) weightOut.value = pieceGram > 0 ? `${pieceGram.toFixed(2)} جرام` : '';
    if(piecesOut) piecesOut.value = pieces > 0 ? `${pieces.toLocaleString('ar-SA')} حبة` : '';

    if(note){
      if(pieceGram > 0 && pieces > 0){
        note.textContent = `النتيجة: وزن الحبة ${pieceGram.toFixed(2)} جرام، والطلب ${totalKg} كجم يعطي تقريبًا ${pieces.toLocaleString('ar-SA')} حبة.`;
      } else {
        note.textContent = 'أدخل العرض والطول والسماكة والخامة وكمية الطلب بالكيلو ليحسب النظام وزن الحبة وعدد الحبات.';
      }
    }
  }

  const originalInsert = window.insertData;
  if(typeof originalInsert === 'function'){
    window.insertData = async function(table, row){
      if(table === 'orders'){
        row.total_kg = val('orderTotalKg');
        row.density = val('orderDensity');
        row.piece_weight_g = (byId('pieceWeightResult')?.value || '').replace(' جرام','');
        row.estimated_pieces = (byId('piecesCountResult')?.value || '').replace(' حبة','');
      }
      return originalInsert(table, row);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureCalculatorFields();
    setTimeout(ensureCalculatorFields, 500);
    setTimeout(ensureCalculatorFields, 1500);
  });
})();



/* JMS debts aging patch - Yaser */
(function(){
  const JMS_YASER_DEBTS = [{"code": "1111010145", "name": "مطاعم شاطئ النخيل", "rep": "ياسر الحسني", "age_0_plus": 9121.56, "balance": 9121.56}, {"code": "1111040048", "name": "مطعم كباب المينا لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 0.545, "balance": 0.545}, {"code": "1111010524", "name": "بروست اطياف الفضيلة", "rep": "ياسر الحسني", "age_0_plus": 160.625, "balance": 160.625}, {"code": "1111040027", "name": "مطعم بوشة للوجبات السريعة", "rep": "ياسر الحسني", "age_0_plus": 1825.0, "balance": 1825.0}, {"code": "1111040023", "name": "مطعم كالوري دايت لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 184.5625, "balance": 184.5625}, {"code": "1111040020", "name": "شركة مطاعم فهد بندر فهد ابو حميدي الحازمي للوجبات السريعة", "rep": "ياسر الحسني", "age_0_plus": 7851.0, "balance": 7851.0}, {"code": "1111040017", "name": "مؤسسة أسماء محمد ناجي حمدان لتقديم الوجبات (شاطئ المخا)", "rep": "ياسر الحسني", "age_0_plus": 2.235, "balance": -2.235}, {"code": "1111040014", "name": "النكهة الحضرمية", "rep": "ياسر الحسني", "age_0_plus": 1.91, "balance": 1.91}, {"code": "1111040011", "name": "شركة اللقمة العملاقة لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 0.7425, "balance": 0.7425}, {"code": "1111040003", "name": "مؤسسة قلعة التخفيضات التجارية", "rep": "ياسر الحسني", "age_0_plus": 6080.335, "balance": -6080.335}, {"code": "1111040030", "name": "صيدلية صحتكم", "rep": "ياسر الحسني", "age_0_plus": 0.7, "balance": 0.7}, {"code": "1111040041", "name": "مؤسسة الفريد الجديد للتجارة", "rep": "ياسر الحسني", "age_0_plus": 0.005, "balance": 0.005}, {"code": "1111040044", "name": "سيخ بورصة للمشويات التركية", "rep": "ياسر الحسني", "age_0_plus": 2600.4425, "balance": -2600.4425}, {"code": "1111040045", "name": "مطاعم اهلين للوجبات السريعة", "rep": "ياسر الحسني", "age_0_plus": 0.7025, "balance": 0.7025}, {"code": "1111040047", "name": "شركة قطفة عنب لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 395.6275, "balance": 395.6275}, {"code": "1111040050", "name": "صيدلية هرم الصحة", "rep": "ياسر الحسني", "age_0_plus": 117.255, "balance": 117.255}, {"code": "1111040054", "name": "شركة السعر الرائع لتقديم الوجبات( السفرة البخارية)", "rep": "ياسر الحسني", "age_0_plus": 86.5, "balance": 86.5}, {"code": "1111040057", "name": "مصنع شجرة الحور للمنتجات الورقية ( مناديل اسبين )", "rep": "ياسر الحسني", "age_0_plus": 145.6025, "balance": 145.6025}, {"code": "1111040060", "name": "مؤسسة انس عبدالله سالم الزهراني لتقديم الوجبات (شعبيات العم علي)", "rep": "ياسر الحسني", "age_0_plus": 1.1825, "balance": 1.1825}, {"code": "1111040061", "name": "طريق الرشاقة لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 0.005, "balance": -0.005}, {"code": "1111040063", "name": "مؤسسة عدنان السعودية للتجارة (مخابز نعمة)", "rep": "ياسر الحسني", "age_0_plus": 63641.3775, "balance": 63641.3775}, {"code": "1111040064", "name": "مطاعم خيرات المتوسط لتقديم الوجبات (شاورما فالي)", "rep": "ياسر الحسني", "age_0_plus": 495.155, "balance": 495.155}, {"code": "1111040070", "name": "مؤسسة المنطقة الاقتصادية للاتصالات (فري زون )", "rep": "ياسر الحسني", "age_0_plus": 1.3925, "balance": 1.3925}, {"code": "1111040071", "name": "شركة الصيادية المتحدة المحدودة ( بروست لي )", "rep": "ياسر الحسني", "age_0_plus": 39.12, "balance": 39.12}, {"code": "1111040075", "name": "مؤسسة عبدالله عيد بدوي العبيدي المالكي التجارية(فنان الشاورما)", "rep": "ياسر الحسني", "age_0_plus": 200.15, "balance": 200.15}, {"code": "1111040077", "name": "مؤسسة كتيكت للتجارة", "rep": "ياسر الحسني", "age_0_plus": 63197.1, "balance": 63197.1}, {"code": "1111040079", "name": "شركة النخيل لالعاب الاطفال", "rep": "ياسر الحسني", "age_0_plus": 0.07, "balance": 0.07}, {"code": "1111040095", "name": "شركة سيف برند التجارية", "rep": "ياسر الحسني", "age_0_plus": 4000.395, "balance": 4000.395}, {"code": "1111040098", "name": "مؤسسة رؤيا الفاكهة التجارية(سلتي)", "rep": "ياسر الحسني", "age_0_plus": 1.23, "balance": 1.23}, {"code": "1111010749", "name": "شركة رمال المحيط للتجارة", "rep": "ياسر الحسني", "age_0_plus": 1.83, "balance": 1.83}, {"code": "1111010750", "name": "شركة مذاق الزهرة الغذائية", "rep": "ياسر الحسني", "age_0_plus": 0.5, "balance": 0.5}, {"code": "1111010757", "name": "مطعم امتنان ابراهيم بن حمد للاكلات الشعبية  (مطعم نجوم تهامة)", "rep": "ياسر الحسني", "age_0_plus": 354.3, "balance": 354.3}, {"code": "1111040101", "name": "مطعم حسين سعد أحمد عسيري لتقديم الوجبات (حنيذ الريشي)", "rep": "ياسر الحسني", "age_0_plus": 160.94, "balance": 160.94}, {"code": "1111040102", "name": "مؤسسة سالم محمد سالم الصيعري التجارية( عطارة كندة )", "rep": "ياسر الحسني", "age_0_plus": 355.98, "balance": -355.98}, {"code": "1111040104", "name": "شركة مطعم الدوار المصري المحدودة", "rep": "ياسر الحسني", "age_0_plus": 1.28, "balance": 1.28}, {"code": "1111040108", "name": "صيدلية أطياف المجتمع للأدوية", "rep": "ياسر الحسني", "age_0_plus": 532.68, "balance": 532.68}, {"code": "1111040110", "name": "مؤسسة طعمية المدهش للوجبات السريعة", "rep": "ياسر الحسني", "age_0_plus": 0.51, "balance": 0.51}, {"code": "1111010828", "name": "شركة الدرة التجارية ( الخليج السريع للثلج )", "rep": "ياسر الحسني", "age_0_plus": 130.93, "balance": -130.93}, {"code": "1111040113", "name": "شركة يحي ملحان واولاده", "rep": "ياسر الحسني", "age_0_plus": 1969.31, "balance": -1969.31}, {"code": "1111040117", "name": "شركة اركان طيبة (السعر الانسب)", "rep": "ياسر الحسني", "age_0_plus": 0.0025, "balance": 0.0025}, {"code": "1111010853", "name": "مؤسسة بيادر عبدالرحمن يحي العطياني التجارية", "rep": "ياسر الحسني", "age_0_plus": 32698.1375, "balance": 32698.1375}, {"code": "1111040123", "name": "مؤسسة انس حسن بن ابراهيم قاسم التجارية", "rep": "ياسر الحسني", "age_0_plus": 9530.706, "balance": 9530.706}, {"code": "1111040124", "name": "شركة الاذواق الرائدة المحدودة (حلويات لوتاز)", "rep": "ياسر الحسني", "age_0_plus": 0.44, "balance": 0.44}, {"code": "1111040125", "name": "شركة حور وشفاء الطبية (صيدلية فيدرا )", "rep": "ياسر الحسني", "age_0_plus": 7.54, "balance": -7.54}, {"code": "1111040128", "name": "شركة تركي عبدالعزيز قربان التركستاني لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 0.875, "balance": 0.875}, {"code": "1111040130", "name": "مؤسسة راكان عبدالعزيز صالح الدباسي التجارية", "rep": "ياسر الحسني", "age_0_plus": 17.775, "balance": 17.775}, {"code": "1111040131", "name": "شركة السيرة الحديثة التجارية", "rep": "ياسر الحسني", "age_0_plus": 12.8675, "balance": 12.8675}, {"code": "1111040133", "name": "مؤسسة عيون التغذية للوجبات السريعة ( شاورما الحي )", "rep": "ياسر الحسني", "age_0_plus": 0.1988, "balance": 0.1988}, {"code": "1111040134", "name": "شركة سمتيس العالمية للتجارة", "rep": "ياسر الحسني", "age_0_plus": 2.8919, "balance": 2.8919}, {"code": "1111040136", "name": "مؤسسة بندر علي محمد رومان ال شعيب", "rep": "ياسر الحسني", "age_0_plus": 2500.0, "balance": -2500.0}, {"code": "1111040138", "name": "شركة شباب صح التجارية", "rep": "ياسر الحسني", "age_0_plus": 3868.85, "balance": -3868.85}, {"code": "1111010902", "name": "مؤسسة الذائقة البخارية لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 29.625, "balance": 29.625}, {"code": "1111040139", "name": "شركة الافاق العربية الحديثة للتجارة", "rep": "ياسر الحسني", "age_0_plus": 1.215, "balance": 1.215}, {"code": "1111010911", "name": "شركة ابناء خالد العمودي للتجارة المحدودة ( تميم)", "rep": "ياسر الحسني", "age_0_plus": 0.12, "balance": -0.12}, {"code": "1111010912", "name": "مؤسسسة اصل الماكولات (باقووس)", "rep": "ياسر الحسني", "age_0_plus": 0.25, "balance": 0.25}, {"code": "1111010913", "name": "مؤسسة حسين بن منصور بن حسين الاسمري لخدمات السيارات", "rep": "ياسر الحسني", "age_0_plus": 14.135, "balance": 14.135}, {"code": "1111010920", "name": "شركة ساري المتميزة التجارية", "rep": "ياسر الحسني", "age_0_plus": 22.13, "balance": 22.13}, {"code": "1111040140", "name": "شركة بروست اكسبرس لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 0.003, "balance": -0.003}, {"code": "1111010926", "name": "مؤسسة سعيد غالب سالم الصيعري التجارية", "rep": "ياسر الحسني", "age_0_plus": 0.88, "balance": 0.88}, {"code": "1111010928", "name": "مؤسسة الفا ناو للبصريات", "rep": "ياسر الحسني", "age_0_plus": 0.3, "balance": 0.3}, {"code": "1111010964", "name": "مؤسسة حلا للسجاد", "rep": "ياسر الحسني", "age_0_plus": 1.4494, "balance": 1.4494}, {"code": "1111010965", "name": "شركة اليك المميزة لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 0.625, "balance": 0.625}, {"code": "1111040144", "name": "مطاعم تقسيم بوينت لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 166.27, "balance": 166.27}, {"code": "1111040145", "name": "مؤسسة طلال أسماعيل منصور للخدمات التجارية", "rep": "ياسر الحسني", "age_0_plus": 0.585, "balance": 0.585}, {"code": "1111040148", "name": "شركة رمال المحيط للتجارة - شركة بريكان", "rep": "ياسر الحسني", "age_0_plus": 0.58, "balance": 0.58}, {"code": "1111040149", "name": "مطعم المرساة البحرية لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 0.23, "balance": 0.23}, {"code": "1111040150", "name": "مؤسسة العناية الفضية التجارية", "rep": "ياسر الحسني", "age_0_plus": 0.26, "balance": 0.26}, {"code": "1111040152", "name": "مؤسسة منقوشة هت لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 4460.57, "balance": -4460.57}, {"code": "1111040160", "name": "مؤسسة المخازن السوداء للتجارة", "rep": "ياسر الحسني", "age_0_plus": 3.44, "balance": 3.44}, {"code": "1111040161", "name": "شركة ماس أسيا للتجارة", "rep": "ياسر الحسني", "age_0_plus": 0.95, "balance": 0.95}, {"code": "1111040162", "name": "شركة شاورما شاكر الجزيرة لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 541.42, "balance": 541.42}, {"code": "2101010556", "name": "مركز المدينة للكهرباء والسباكة ومود البناء", "rep": "ياسر الحسني", "age_0_plus": 0.25, "balance": -0.25}, {"code": "1111040166", "name": "شركة كبسة أكسبرس لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 2495.09, "balance": -2495.09}, {"code": "1111040168", "name": "شركة خيرات المنير القابضة", "rep": "ياسر الحسني", "age_0_plus": 6000.0, "balance": 6000.0}, {"code": "1111040169", "name": "مؤسسة سوبر كير الطبية", "rep": "ياسر الحسني", "age_0_plus": 0.92, "balance": 0.92}, {"code": "1111040171", "name": "مؤسسة التميز والأبداع للاثاث", "rep": "ياسر الحسني", "age_0_plus": 0.19, "balance": 0.19}, {"code": "1111040172", "name": "شركة سنابل الأندلس للتجارة", "rep": "ياسر الحسني", "age_0_plus": 10000.0, "balance": -10000.0}, {"code": "1111040173", "name": "شركة رفا للصناعة", "rep": "ياسر الحسني", "age_0_plus": 148317.9, "balance": 148317.9}, {"code": "1111040174", "name": "مطاعم شعبيات الحاتم لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 55.78, "balance": -55.78}, {"code": "1111040175", "name": "شركة منطقة الاتجاه التجارية - دينمت", "rep": "ياسر الحسني", "age_0_plus": 0.49, "balance": 0.49}, {"code": "1111040176", "name": "مؤسسة دونات اليوم التجارية", "rep": "ياسر الحسني", "age_0_plus": 375.19, "balance": 375.19}, {"code": "1111040177", "name": "مؤسسة مثلث الابتكار للتجارة", "rep": "ياسر الحسني", "age_0_plus": 0.61, "balance": 0.61}, {"code": "1111040178", "name": "شركة الحاويات الحمراء للتجارة", "rep": "ياسر الحسني", "age_0_plus": 0.12, "balance": 0.12}, {"code": "1111040179", "name": "مؤسسة أطعمة طنجة للوجبات السريعة", "rep": "ياسر الحسني", "age_0_plus": 3.13, "balance": -3.13}, {"code": "1111040180", "name": "شركة ميلانو للاسبورتات", "rep": "ياسر الحسني", "age_0_plus": 0.27, "balance": 0.27}, {"code": "1111040181", "name": "شركة طفلي فرحتي لملابس الاطفال", "rep": "ياسر الحسني", "age_0_plus": 2.32, "balance": 2.32}, {"code": "1111040182", "name": "مؤسسة عصائر الوحدة لتقديم المشروبات", "rep": "ياسر الحسني", "age_0_plus": 3230.28, "balance": -3230.28}, {"code": "1111011123", "name": "مطعم العربي الاديب لتقديم الوجبات (مطاعم سفرة القلعة )", "rep": "ياسر الحسني", "age_0_plus": 0.07, "balance": 0.07}, {"code": "1111040183", "name": "مؤسسة ثوب الحرمين للتجارة", "rep": "ياسر الحسني", "age_0_plus": 1.24, "balance": 1.24}, {"code": "1111040184", "name": "مؤسسة لوتاز ترفل", "rep": "ياسر الحسني", "age_0_plus": 2.26, "balance": 2.26}, {"code": "1111040185", "name": "اسواق رباعيات التوفير التجارية", "rep": "ياسر الحسني", "age_0_plus": 2999.5, "balance": -2999.5}, {"code": "1111040186", "name": "مطاعم مستر دايت لتقديم الوجبات", "rep": "ياسر الحسني", "age_0_plus": 1.36, "balance": 1.36}, {"code": "1111040187", "name": "شركة امواج الوافي", "rep": "ياسر الحسني", "age_0_plus": 1826.04, "balance": 1826.04}, {"code": "1111040188", "name": "مؤسسة شاورما شورو", "rep": "ياسر الحسني", "age_0_plus": 0.78, "balance": 0.78}, {"code": "1111040189", "name": "شركة الاشراقة للمقاولات شخص واحد", "rep": "ياسر الحسني", "age_0_plus": 0.09, "balance": -0.09}, {"code": "1111040190", "name": "مؤسسة الحرفه الاولى للتجارة", "rep": "ياسر الحسني", "age_0_plus": 0.96, "balance": 0.96}, {"code": "1111040191", "name": "مؤسسة النبراس المتحدة للتجارة", "rep": "ياسر الحسني", "age_0_plus": 0.27, "balance": -0.27}, {"code": "1111040192", "name": "مؤسسة خطوات الجنوب للتجارة", "rep": "ياسر الحسني", "age_0_plus": 0.37, "balance": 0.37}, {"code": "1111040193", "name": "شركة نمارق العربية للخدمات المحدودة", "rep": "ياسر الحسني", "age_0_plus": 125.06, "balance": -125.06}, {"code": "1111040194", "name": "شركة قمة النمو المستدام", "rep": "ياسر الحسني", "age_0_plus": 0.72, "balance": 0.72}, {"code": "1111040195", "name": "شركة عبدالوهاب محمد صدقه ابو نار التجارية", "rep": "ياسر الحسني", "age_0_plus": 12218.37, "balance": -12218.37}, {"code": "1111040199", "name": "مؤسسة ربع سيخ", "rep": "ياسر الحسني", "age_0_plus": 2600.3, "balance": 2600.3}, {"code": "1111040201", "name": "شركة إمبريوم ستار", "rep": "ياسر الحسني", "age_0_plus": 0.62, "balance": 0.62}, {"code": "1111040202", "name": "شركة علامة الغذاء ( بخاريزو )", "rep": "ياسر الحسني", "age_0_plus": 3264.39, "balance": 3264.39}];

  function byId(id){ return document.getElementById(id); }
  function money(n){ return Number(n || 0).toLocaleString('ar-SA', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function getCurrentUser(){ try { return JSON.parse(sessionStorage.getItem('jms_current_user') || 'null'); } catch { return null; } }
  function isAdmin(){ return getCurrentUser()?.role === 'admin'; }

  function loadStore(){
    try { return JSON.parse(localStorage.getItem('jms_crm_data') || '{}') || {}; } catch { return {}; }
  }

  function saveStore(data){
    localStorage.setItem('jms_crm_data', JSON.stringify(data));
    if(window.db) Object.assign(window.db, data);
  }

  function ensureYaserData(){
    const data = loadStore();
    data.reps = Array.isArray(data.reps) ? data.reps : (window.db?.reps || []);
    data.users = Array.isArray(data.users) ? data.users : (window.db?.users || []);
    data.debts = Array.isArray(data.debts) ? data.debts : [];

    if(!data.reps.some(r => r.id === 'rep-yaser-1' || r.name === 'ياسر الحسني')) {
      data.reps.push({ id:'rep-yaser-1', name:'ياسر الحسني', phone:'', email:'yaser@jms.local', status:'نشط' });
    }

    if(!data.users.some(u => String(u.email).toLowerCase() === 'yaser@jms.local')) {
      data.users.push({ id:'user-yaser-1', name:'ياسر الحسني', email:'yaser@jms.local', password:'123456', role:'rep', rep_id:'rep-yaser-1', status:'نشط' });
    }

    // Replace imported Yaser debts with latest spreadsheet data.
    const otherDebts = data.debts.filter(d => d.source !== 'import-yaser-aging-2026-05-09');
    data.debts = otherDebts.concat(JMS_YASER_DEBTS.map((d, i) => ({
      id: 'debt-yaser-' + (i+1),
      source: 'import-yaser-aging-2026-05-09',
      ...d
    })));

    saveStore(data);
  }

  function filteredDebts(){
    ensureYaserData();
    const data = loadStore();
    let rows = Array.isArray(data.debts) ? data.debts.slice() : [];
    const user = getCurrentUser();

    if(user?.role === 'rep') {
      const repName = (data.reps || []).find(r => r.id === user.rep_id)?.name || user.name;
      rows = rows.filter(d => d.rep === repName);
      const filter = byId('debtRepFilter');
      if(filter) { filter.value = repName; filter.disabled = true; }
    } else {
      const selected = byId('debtRepFilter')?.value || '';
      if(selected) rows = rows.filter(d => d.rep === selected);
    }

    const q = (byId('debtSearch')?.value || '').trim();
    if(q) rows = rows.filter(d => String(d.name).includes(q) || String(d.code).includes(q) || String(d.rep).includes(q));

    rows.sort((a,b) => Math.abs(Number(b.balance||0)) - Math.abs(Number(a.balance||0)));
    return rows;
  }

  window.renderDebts = function(){
    ensureYaserData();

    const data = loadStore();
    const reps = [...new Set((data.debts || []).map(d => d.rep).filter(Boolean))];
    const filter = byId('debtRepFilter');
    if(filter && !filter.dataset.loaded) {
      filter.innerHTML = '<option value="">كل المناديب</option>' + reps.map(r => `<option value="${r}">${r}</option>`).join('');
      filter.dataset.loaded = '1';
    }

    const rows = filteredDebts();
    const total = rows.reduce((s,d)=>s + Number(d.balance || 0), 0);
    const positive = rows.filter(d => Number(d.balance||0)>0).reduce((s,d)=>s+Number(d.balance||0),0);
    const negative = rows.filter(d => Number(d.balance||0)<0).reduce((s,d)=>s+Number(d.balance||0),0);

    if(byId('debtCustomerCount')) byId('debtCustomerCount').textContent = rows.length.toLocaleString('ar-SA');
    if(byId('debtTotalBalance')) byId('debtTotalBalance').textContent = money(total);
    if(byId('debtPositiveTotal')) byId('debtPositiveTotal').textContent = money(positive);
    if(byId('debtNegativeTotal')) byId('debtNegativeTotal').textContent = money(negative);
    if(byId('debtRepName')) byId('debtRepName').textContent = byId('debtRepFilter')?.value || 'كل المناديب';

    const body = rows.map(d => {
      const bal = Number(d.balance || 0);
      const cls = bal < 0 ? 'credit-row' : bal > 5000 ? 'high-debt-row' : '';
      return `<tr class="${cls}">
        <td>${d.code}</td>
        <td>${d.name}</td>
        <td>${d.rep}</td>
        <td>${money(d.age_0_plus)}</td>
        <td><b>${money(d.balance)}</b></td>
      </tr>`;
    }).join('');

    const html = body ? `<table>
      <thead><tr><th>الرمز</th><th>العميل</th><th>المندوب</th><th>فوق 0 يوم</th><th>الرصيد</th></tr></thead>
      <tbody>${body}</tbody>
    </table>` : 'لا توجد مديونية مطابقة للبحث';

    if(byId('debtsList')) byId('debtsList').innerHTML = html;
  }

  window.exportDebtsCSV = function(){
    const rows = filteredDebts();
    const lines = [['الرمز','العميل','المندوب','فوق 0 يوم','الرصيد']];
    rows.forEach(d => lines.push([d.code,d.name,d.rep,d.age_0_plus,d.balance]));
    const csv = lines.map(r => r.map(x => `"${String(x ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], {type:'text/csv'}));
    a.download = 'JMS_debts_yaser.csv';
    a.click();
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureYaserData();
    setTimeout(window.renderDebts, 700);
    document.querySelectorAll('.nav-item').forEach(btn => {
      if(btn.dataset.tab === 'debts') btn.addEventListener('click', () => setTimeout(window.renderDebts, 50));
    });
  });
})();
