(function () {
  'use strict';

  const cfg = window.JMS_CONFIG || {};
  let supabase = null;

  try {
    if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY) {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
    }
  } catch (err) {
    console.warn('Supabase is not available. Local mode enabled.', err);
    supabase = null;
  }

  const $ = (id) => document.getElementById(id);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const daysBetween = (date) => {
    if (!date) return 9999;
    return Math.floor((new Date(todayISO() + 'T00:00:00') - new Date(date + 'T00:00:00')) / 86400000);
  };
  const money = (n) => Number(n || 0).toLocaleString('ar-SA');
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  let db = {
    reps: [{ id: 'rep-demo-1', name: 'مندوب جدة', phone: '', email: '', status: 'نشط' }],
    customers: [],
    visits: [],
    orders: []
  };

  let currentUser = JSON.parse(sessionStorage.getItem('jms_current_user') || 'null');

  function loadLocalData() {
    try {
      const saved = JSON.parse(localStorage.getItem('jms_crm_data') || 'null');
      if (saved && typeof saved === 'object') db = { ...db, ...saved };
    } catch (err) {
      console.warn('Could not read local data', err);
    }
  }

  function saveLocalData() {
    localStorage.setItem('jms_crm_data', JSON.stringify(db));
  }

  function showLogin() {
    $('appView')?.classList.add('hidden');
    $('loginView')?.classList.remove('hidden');
  }

  function showApp() {
    $('loginView')?.classList.add('hidden');
    $('appView')?.classList.remove('hidden');
    if ($('currentUserName')) $('currentUserName').textContent = currentUser?.name || 'مدير النظام';
    refreshAll();
  }

  window.logout = function () {
    sessionStorage.removeItem('jms_current_user');
    currentUser = null;
    showLogin();
  };

  window.goTab = function (tab) {
    document.querySelector(`[data-tab="${tab}"]`)?.click();
  };

  function repNameFn(id) {
    return db.reps.find((r) => r.id === id)?.name || '-';
  }

  function customerNameFn(id) {
    return db.customers.find((c) => c.id === id)?.name || '-';
  }

  function lastVisit(id) {
    return db.visits
      .filter((v) => v.customer_id === id)
      .sort((a, b) => String(b.visit_date).localeCompare(String(a.visit_date)))[0]?.visit_date || '';
  }

  function customerStatus(customer) {
    const d = daysBetween(lastVisit(customer.id));
    if (d >= 30) return { t: 'متأخر', c: 'late', d };
    if (d >= 20) return { t: 'قريب', c: 'warn', d };
    return { t: 'منتظم', c: 'ok', d };
  }

  function orderBadge(status) {
    if (status === 'تم التسليم') return 'done';
    if (status === 'ملغي') return 'cancel';
    return 'new';
  }

  function setHtml(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  async function refreshAll() {
    loadLocalData();

    if (supabase) {
      try {
        setHtml('cloudStatus', 'جاري الاتصال بقاعدة البيانات...');
        const [reps, customers, visits, orders] = await Promise.all([
          supabase.from('reps').select('*').order('created_at', { ascending: false }),
          supabase.from('customers').select('*').order('created_at', { ascending: false }),
          supabase.from('visits').select('*').order('visit_date', { ascending: false }),
          supabase.from('orders').select('*').order('order_date', { ascending: false })
        ]);

        const responses = [reps, customers, visits, orders];
        if (responses.some((r) => r.error)) throw responses.find((r) => r.error).error;

        db.reps = reps.data?.length ? reps.data : db.reps;
        db.customers = customers.data || [];
        db.visits = visits.data || [];
        db.orders = orders.data || [];
        saveLocalData();
        setHtml('cloudStatus', '✅ الاتصال بالسحابة يعمل بنجاح');
      } catch (err) {
        console.warn('Cloud error, local mode enabled:', err);
        setHtml('cloudStatus', '⚠️ يعمل النظام الآن بوضع محلي. إذا أردت الحفظ السحابي شغّل ملف supabase_schema.sql في Supabase.');
      }
    } else {
      setHtml('cloudStatus', '⚠️ يعمل النظام الآن بوضع محلي على نفس الجهاز.');
    }

    render();
  }

  window.refreshAll = refreshAll;

  function renderSelects() {
    const repsOptions = '<option value="">اختر المندوب</option>' + db.reps
      .filter((r) => r.status !== 'موقوف')
      .map((r) => `<option value="${r.id}">${r.name}</option>`)
      .join('');
    const customersOptions = '<option value="">اختر العميل</option>' + db.customers
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join('');

    ['customerRep', 'visitRep', 'orderRep'].forEach((id) => { if ($(id)) $(id).innerHTML = repsOptions; });
    ['visitCustomer', 'orderCustomer'].forEach((id) => { if ($(id)) $(id).innerHTML = customersOptions; });
  }

  function renderStats() {
    setText('totalCustomers', db.customers.length);
    setText('lateCustomers', db.customers.filter((c) => customerStatus(c).d >= 30).length);
    setText('todayVisits', db.visits.filter((v) => v.visit_date === todayISO()).length);
    setText('totalOrders', db.orders.length);
    setText('salesTotal', money(db.orders.reduce((s, o) => s + Number(o.amount || 0), 0)));
  }

  window.renderCustomers = function () {
    const q = ($('customerSearch')?.value || '').trim();
    const list = db.customers.filter((c) => !q || String(c.name || '').includes(q) || String(c.phone || '').includes(q) || String(c.city || '').includes(q));
    const rows = list.map((c) => {
      const s = customerStatus(c);
      const maps = c.location ? `<a target="_blank" href="${c.location}">الموقع</a>` : '-';
      return `<tr><td>${c.name}</td><td>${c.phone || '-'}</td><td>${c.city || '-'}</td><td>${c.activity || '-'}</td><td>${repNameFn(c.rep_id)}</td><td>${lastVisit(c.id) || 'لم يزر'}</td><td><span class="badge ${s.c}">${s.t}</span></td><td>${maps}</td></tr>`;
    }).join('');
    setHtml('customersList', rows ? `<table><thead><tr><th>العميل</th><th>الجوال</th><th>المدينة</th><th>النشاط</th><th>المندوب</th><th>آخر زيارة</th><th>الحالة</th><th>الخريطة</th></tr></thead><tbody>${rows}</tbody></table>` : 'لا يوجد عملاء');
  };

  function renderReps() {
    const rows = db.reps.map((r) => `<tr><td>${r.name}</td><td>${r.phone || '-'}</td><td>${r.email || '-'}</td><td>${r.status}</td><td>${db.customers.filter((c) => c.rep_id === r.id).length}</td><td>${db.visits.filter((v) => v.rep_id === r.id).length}</td></tr>`).join('');
    setHtml('repsList', rows ? `<table><thead><tr><th>المندوب</th><th>الجوال</th><th>الإيميل</th><th>الحالة</th><th>عملاء</th><th>زيارات</th></tr></thead><tbody>${rows}</tbody></table>` : 'لا يوجد مناديب');
  }

  function renderVisits() {
    const rows = db.visits.map((v) => `<tr><td>${v.visit_date}</td><td>${customerNameFn(v.customer_id)}</td><td>${repNameFn(v.rep_id)}</td><td>${v.status}</td><td>${v.location || '-'}</td><td>${v.notes || '-'}</td></tr>`).join('');
    setHtml('visitsList', rows ? `<table><thead><tr><th>التاريخ</th><th>العميل</th><th>المندوب</th><th>الحالة</th><th>الموقع</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table>` : 'لا توجد زيارات');

    const todayRows = db.visits.filter((v) => v.visit_date === todayISO()).map((v) => `<tr><td>${customerNameFn(v.customer_id)}</td><td>${repNameFn(v.rep_id)}</td><td>${v.status}</td><td>${v.notes || '-'}</td></tr>`).join('');
    setHtml('todayVisitsTable', todayRows ? `<table><thead><tr><th>العميل</th><th>المندوب</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${todayRows}</tbody></table>` : 'لا توجد زيارات اليوم');
  }

  function renderOrders() {
    const rows = db.orders.map((o) => `<tr><td>${o.order_date}</td><td>${customerNameFn(o.customer_id)}</td><td>${repNameFn(o.rep_id)}</td><td>${o.product || '-'}</td><td>${o.quantity || '-'}</td><td>${money(o.amount)}</td><td><span class="badge ${orderBadge(o.status)}">${o.status}</span></td></tr>`).join('');
    setHtml('ordersList', rows ? `<table><thead><tr><th>التاريخ</th><th>العميل</th><th>المندوب</th><th>الصنف</th><th>الكمية</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>` : 'لا توجد طلبات');
    setHtml('latestOrders', db.orders.length ? `<table><thead><tr><th>التاريخ</th><th>العميل</th><th>الصنف</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${db.orders.slice(0, 5).map((o) => `<tr><td>${o.order_date}</td><td>${customerNameFn(o.customer_id)}</td><td>${o.product || '-'}</td><td>${money(o.amount)}</td><td>${o.status}</td></tr>`).join('')}</tbody></table>` : 'لا توجد طلبات');
  }

  function renderAlerts() {
    const late = db.customers.filter((c) => customerStatus(c).d >= 30);
    const html = late.map((c) => `<div class="list-item"><strong>${c.name}</strong><br>متأخر ${customerStatus(c).d} يوم — المندوب: ${repNameFn(c.rep_id)}</div>`).join('');
    setHtml('quickAlerts', html || '<div class="list-item">لا يوجد عملاء متأخرين حالياً</div>');
    setHtml('alertsList', html || '<div class="list-item">لا توجد تنبيهات</div>');
  }

  function renderTopReps() {
    const ranked = db.reps.map((r) => ({ name: r.name, count: db.visits.filter((v) => v.rep_id === r.id).length })).sort((a, b) => b.count - a.count).slice(0, 5);
    setHtml('topReps', ranked.map((r, i) => `<div class="rank-item"><b>${i + 1}. ${r.name}</b><span>${r.count} زيارة</span></div>`).join('') || 'لا يوجد بيانات');
  }

  function render() {
    renderSelects();
    renderStats();
    window.renderCustomers();
    renderReps();
    renderVisits();
    renderOrders();
    renderAlerts();
    renderTopReps();
  }

  async function insertData(table, row) {
    if (supabase) {
      try {
        const { error } = await supabase.from(table).insert(row);
        if (!error) return true;
        console.warn(error);
      } catch (err) {
        console.warn(err);
      }
    }
    row.id = row.id || newId();
    db[table].unshift(row);
    saveLocalData();
    return true;
  }

  function bindForms() {
    if ($('repForm')) $('repForm').onsubmit = async (e) => {
      e.preventDefault();
      await insertData('reps', { name: $('repName').value.trim(), phone: $('repPhone').value.trim(), email: $('repEmail').value.trim(), status: $('repStatus').value });
      e.target.reset();
      refreshAll();
    };

    if ($('customerForm')) $('customerForm').onsubmit = async (e) => {
      e.preventDefault();
      await insertData('customers', { name: $('customerName').value.trim(), phone: $('customerPhone').value.trim(), city: $('customerCity').value.trim(), activity: $('customerActivity').value.trim(), location: $('customerLocation').value.trim(), rep_id: $('customerRep').value || null, notes: $('customerNotes').value.trim() });
      e.target.reset();
      refreshAll();
    };

    if ($('visitDate')) $('visitDate').value = todayISO();
    if ($('visitForm')) $('visitForm').onsubmit = async (e) => {
      e.preventDefault();
      await insertData('visits', { customer_id: $('visitCustomer').value, rep_id: $('visitRep').value, visit_date: $('visitDate').value, status: $('visitStatus').value, location: $('visitLocation').value.trim(), notes: $('visitNotes').value.trim() });
      e.target.reset();
      $('visitDate').value = todayISO();
      refreshAll();
    };

    if ($('orderDate')) $('orderDate').value = todayISO();
    if ($('orderForm')) $('orderForm').onsubmit = async (e) => {
      e.preventDefault();
      await insertData('orders', { customer_id: $('orderCustomer').value, rep_id: $('orderRep').value, order_date: $('orderDate').value, product: $('orderProduct').value.trim(), quantity: $('orderQuantity').value || null, amount: $('orderAmount').value || 0, status: $('orderStatus').value });
      e.target.reset();
      $('orderDate').value = todayISO();
      refreshAll();
    };
  }

  window.exportCustomersCSV = function () {
    const lines = [['العميل', 'الجوال', 'المدينة', 'النشاط', 'المندوب', 'آخر زيارة', 'الحالة', 'أيام التأخير']];
    db.customers.forEach((c) => {
      const s = customerStatus(c);
      lines.push([c.name, c.phone, c.city, c.activity, repNameFn(c.rep_id), lastVisit(c.id) || 'لم يزر', s.t, s.d]);
    });
    const csv = lines.map((r) => r.map((x) => `"${String(x ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'JMS_customers.csv';
    a.click();
  };

  window.requestNotifications = function () {
    if (!('Notification' in window)) return alert('المتصفح لا يدعم الإشعارات');
    Notification.requestPermission().then((p) => {
      if (p === 'granted') new Notification('JMS CRM', { body: 'تم تفعيل الإشعارات' });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('loginForm');
    if (loginForm) {
      loginForm.onsubmit = (e) => {
        e.preventDefault();
        const email = $('loginEmail')?.value.trim();
        const password = $('loginPassword')?.value;
        if (email === 'admin@jms.local' && password === '123456') {
          currentUser = { name: 'مدير النظام', email };
          sessionStorage.setItem('jms_current_user', JSON.stringify(currentUser));
          showApp();
        } else {
          alert('بيانات الدخول غير صحيحة. استخدم admin@jms.local / 123456');
        }
      };
    }

    document.querySelectorAll('.nav-item').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('.nav-item,.page').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        $(b.dataset.tab)?.classList.add('active');
        setText('pageTitle', b.textContent);
      };
    });

    bindForms();
    if (currentUser) showApp(); else showLogin();
  });
})();
