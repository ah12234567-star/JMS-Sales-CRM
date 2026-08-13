(function () {
  'use strict';

  const VERSION = '2026-08-13-command-center-1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
  const num = value => Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0;
  const dateOnly = value => String(value || '').slice(0, 10);
  const today = () => new Date().toISOString().slice(0, 10);

  function daysSince(value) {
    if (!value) return 999;
    const time = new Date(dateOnly(value) + 'T00:00:00').getTime();
    return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86400000)) : 999;
  }

  function lastVisit(customerId) {
    return (db.visits || [])
      .filter(visit => visit.customer_id === customerId)
      .sort((a, b) => String(b.checkin_at || b.date || '').localeCompare(String(a.checkin_at || a.date || '')))[0];
  }

  function isIncompleteOrder(order) {
    return !order.customer_id || !String(order.product || '').trim() || num(order.width) <= 0 ||
      num(order.length) <= 0 || num(order.thickness) <= 0 || num(order.total_kg) <= 0 ||
      num(order.amount_value || order.amount) <= 0;
  }

  function hourGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 18) return 'مساء الخير';
    return 'أهلاً بك';
  }

  function pageAllowed(page) {
    const button = document.querySelector(`.nav[data-page="${page}"]`);
    return !!button && getComputedStyle(button).display !== 'none';
  }

  function go(page) {
    const button = document.querySelector(`.nav[data-page="${page}"]`);
    if (!button || getComputedStyle(button).display === 'none') return;
    button.click();
    document.body.classList.remove('menu-open', 'sidebar-open', 'mobile-menu-open');
    document.querySelector('.sidebar')?.classList.remove('open', 'active', 'show');
    document.querySelector('.mobile-overlay,.sidebar-overlay,.jms-mobile-overlay')?.click();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  window.jmsCommandGo = go;

  function buildTasks() {
    const tasks = [];
    const role = currentUser?.role;
    const customers = role === 'rep' ? (db.customers || []).filter(c => c.rep_id === currentUser.id) : (db.customers || []);
    const orders = role === 'rep' ? (db.orders || []).filter(o => o.rep_id === currentUser.id) : (db.orders || []);
    const quotes = role === 'rep' ? (db.quotes || []).filter(q => q.rep_id === currentUser.id) : (db.quotes || []);
    const visits = role === 'rep' ? (db.visits || []).filter(v => v.rep_id === currentUser.id) : (db.visits || []);

    const pendingQuotes = quotes.filter(q => q.status === 'pending');
    const incompleteOrders = orders.filter(isIncompleteOrder);
    const overdue = customers.map(customer => ({customer, days: daysSince(lastVisit(customer.id)?.checkin_at || lastVisit(customer.id)?.date)}))
      .filter(item => item.days >= 30).sort((a, b) => b.days - a.days);
    const openVisits = visits.filter(v => (v.smart || v.checkin_at) && !v.checkout_at);
    const productionOpen = role === 'rep' ? [] : (db.productionOrders || []).filter(p => p.stage !== 'delivered');

    pendingQuotes.slice(0, 2).forEach(q => tasks.push({tone:'orange', icon:'▤', title:`عرض ${q.quote_no || ''} ينتظر الاعتماد`, detail: customerName(q.customer_id), page:'quotes'}));
    incompleteOrders.slice(0, 2).forEach(o => tasks.push({tone:'red', icon:'!', title:'طلب تصنيع بياناته ناقصة', detail: customerName(o.customer_id), page:'orders'}));
    overdue.slice(0, 2).forEach(item => tasks.push({tone:'blue', icon:'⌖', title:`عميل بدون زيارة منذ ${item.days} يوم`, detail:item.customer.name, page:'customers'}));
    openVisits.slice(0, 2).forEach(v => tasks.push({tone:'green', icon:'●', title:'زيارة مفتوحة ولم تُغلق', detail:customerName(v.customer_id), page:'smartVisits'}));

    return {
      tasks: tasks.slice(0, 6),
      counts: {pendingQuotes:pendingQuotes.length, incompleteOrders:incompleteOrders.length, overdue:overdue.length, openVisits:openVisits.length, productionOpen:productionOpen.length}
    };
  }

  function signature(data) {
    return JSON.stringify([currentUser?.id, data.counts, data.tasks.map(task => task.title + task.detail)]);
  }

  function actionButton(page, icon, label) {
    if (!pageAllowed(page)) return '';
    return `<button type="button" onclick="jmsCommandGo('${page}')"><i>${icon}</i><span>${label}</span></button>`;
  }

  function render() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard || !currentUser || dashboard.closest('.hidden')) return;
    const {tasks, counts} = buildTasks();
    const nextSignature = signature({tasks, counts});
    let root = document.getElementById('jmsCommandCenter');
    if (root?.dataset.signature === nextSignature) return;
    if (!root) {
      root = document.createElement('section');
      root.id = 'jmsCommandCenter';
      root.className = 'jms-command-center';
      dashboard.querySelector('.page-head')?.insertAdjacentElement('afterend', root);
    }
    root.dataset.signature = nextSignature;
    const date = new Intl.DateTimeFormat('ar-SA', {weekday:'long', day:'numeric', month:'long'}).format(new Date());
    const attention = counts.pendingQuotes + counts.incompleteOrders + counts.overdue + counts.openVisits;
    root.innerHTML = `
      <div class="jms-command-hero">
        <div>
          <span class="jms-command-date">${esc(date)}</span>
          <h3>${hourGreeting()}، ${esc(currentUser.name || 'مدير النظام')}</h3>
          <p>${attention ? `لديك <b>${attention}</b> مهمة تحتاج متابعة اليوم.` : 'كل الأعمال المهمة تحت السيطرة اليوم.'}</p>
        </div>
        <div class="jms-command-score ${attention ? 'busy' : 'clear'}"><b>${attention}</b><span>تحتاج إجراء</span></div>
      </div>
      <div class="jms-command-kpis">
        <button onclick="jmsCommandGo('quotes')"><span class="orange">▤</span><div><b>${counts.pendingQuotes}</b><small>عروض بانتظار الاعتماد</small></div></button>
        <button onclick="jmsCommandGo('orders')"><span class="red">!</span><div><b>${counts.incompleteOrders}</b><small>طلبات بياناتها ناقصة</small></div></button>
        <button onclick="jmsCommandGo('customers')"><span class="blue">⌖</span><div><b>${counts.overdue}</b><small>عملاء متأخرون عن الزيارة</small></div></button>
        ${pageAllowed('smartVisits') ? `<button onclick="jmsCommandGo('smartVisits')"><span class="green">●</span><div><b>${counts.openVisits}</b><small>زيارات مفتوحة الآن</small></div></button>` : ''}
      </div>
      <div class="jms-command-grid">
        <div class="jms-command-tasks">
          <div class="jms-command-title"><div><b>أولويات العمل</b><small>مرتبة حسب الأهمية</small></div><span>${tasks.length}</span></div>
          <div class="jms-task-list">${tasks.length ? tasks.map(task => `
            <button type="button" class="jms-task" onclick="jmsCommandGo('${task.page}')">
              <i class="${task.tone}">${task.icon}</i><div><b>${esc(task.title)}</b><small>${esc(task.detail || 'فتح التفاصيل')}</small></div><em>‹</em>
            </button>`).join('') : '<div class="jms-command-empty"><i>✓</i><b>لا توجد مهام عاجلة</b><span>الوضع ممتاز، استمر في متابعة العمل.</span></div>'}</div>
        </div>
        <div class="jms-command-quick">
          <div class="jms-command-title"><div><b>إجراء سريع</b><small>ابدأ المهمة بضغطة واحدة</small></div></div>
          <div class="jms-quick-grid">
            ${actionButton('customers','＋','إضافة عميل')}
            ${actionButton('quotes','▤','عرض سعر')}
            ${actionButton('orders','▣','طلب تصنيع')}
            ${actionButton('smartVisits','⌖','بدء زيارة')}
            ${actionButton('productionWorkflow','▦','خط الإنتاج')}
            ${actionButton('inkStock','◈','مخزون الأحبار')}
          </div>
        </div>
      </div>`;
  }

  const style = document.createElement('style');
  style.textContent = `
    .jms-command-center{display:grid;gap:14px;margin:0 0 18px}.jms-command-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;border-radius:22px;background:linear-gradient(125deg,#0f172a,#1e293b 58%,#7f1d1d);color:#fff;box-shadow:0 18px 40px rgba(15,23,42,.16);overflow:hidden;position:relative}.jms-command-hero:after{content:'';position:absolute;width:230px;height:230px;border-radius:50%;left:-80px;top:-135px;background:rgba(255,255,255,.06)}.jms-command-date{font-size:12px;color:#cbd5e1}.jms-command-hero h3{margin:5px 0 3px;font-size:24px}.jms-command-hero p{margin:0;color:#e2e8f0;font-size:13px}.jms-command-score{min-width:100px;height:76px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.09);border-radius:18px;display:grid;place-content:center;text-align:center;backdrop-filter:blur(8px)}.jms-command-score b{font-size:28px;line-height:1}.jms-command-score span{font-size:10px;color:#cbd5e1;margin-top:5px}.jms-command-score.busy b{color:#fca5a5}.jms-command-score.clear b{color:#86efac}
    .jms-command-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.jms-command-kpis button{border:1px solid #e5e7eb;background:#fff;border-radius:17px;padding:13px;display:flex;align-items:center;gap:11px;text-align:right;cursor:pointer;box-shadow:0 8px 22px rgba(15,23,42,.045);transition:.18s}.jms-command-kpis button:hover{transform:translateY(-2px);box-shadow:0 12px 25px rgba(15,23,42,.09)}.jms-command-kpis span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;font-style:normal;font-weight:900}.jms-command-kpis span.orange{background:#fff7ed;color:#ea580c}.jms-command-kpis span.red{background:#fef2f2;color:#dc2626}.jms-command-kpis span.blue{background:#eff6ff;color:#2563eb}.jms-command-kpis span.green{background:#f0fdf4;color:#16a34a}.jms-command-kpis b{display:block;font-size:20px;color:#0f172a}.jms-command-kpis small{display:block;color:#64748b;font-size:10px;margin-top:2px}
    .jms-command-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,.7fr);gap:12px}.jms-command-tasks,.jms-command-quick{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:16px;box-shadow:0 9px 28px rgba(15,23,42,.045)}.jms-command-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.jms-command-title b{display:block;color:#0f172a}.jms-command-title small{display:block;color:#94a3b8;font-size:10px;margin-top:2px}.jms-command-title>span{background:#fee2e2;color:#b91c1c;min-width:27px;height:27px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:12px}.jms-task-list{display:grid;gap:7px}.jms-task{width:100%;display:grid;grid-template-columns:38px 1fr 20px;align-items:center;gap:10px;border:0;background:#f8fafc;border-radius:13px;padding:9px 10px;text-align:right;cursor:pointer}.jms-task:hover{background:#f1f5f9}.jms-task i{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;font-style:normal;font-weight:900}.jms-task i.orange{background:#ffedd5;color:#c2410c}.jms-task i.red{background:#fee2e2;color:#b91c1c}.jms-task i.blue{background:#dbeafe;color:#1d4ed8}.jms-task i.green{background:#dcfce7;color:#15803d}.jms-task b{display:block;color:#1e293b;font-size:12px}.jms-task small{color:#64748b;font-size:10px}.jms-task em{font-size:24px;color:#94a3b8;font-style:normal}.jms-command-empty{min-height:132px;display:grid;place-content:center;text-align:center;color:#64748b}.jms-command-empty i{margin:auto;width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#dcfce7;color:#15803d;font-style:normal;font-weight:900}.jms-command-empty b{color:#0f172a;margin-top:8px}.jms-command-empty span{font-size:11px;margin-top:3px}.jms-quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.jms-quick-grid button{border:1px solid #e2e8f0;border-radius:13px;background:#fff;min-height:66px;padding:9px;display:grid;place-items:center;gap:3px;cursor:pointer;color:#334155}.jms-quick-grid button:hover{border-color:#94a3b8;background:#f8fafc}.jms-quick-grid i{font-style:normal;font-size:20px;color:#b91c1c}.jms-quick-grid span{font-size:11px;font-weight:750}
    @media(max-width:900px){.jms-command-kpis{grid-template-columns:1fr 1fr}.jms-command-grid{grid-template-columns:1fr}.jms-command-center{margin-top:4px}.jms-command-hero{padding:18px}.jms-command-hero h3{font-size:20px}}
    @media(max-width:540px){.jms-command-hero{border-radius:18px;align-items:flex-start}.jms-command-score{min-width:74px;height:64px}.jms-command-score b{font-size:23px}.jms-command-hero h3{font-size:18px}.jms-command-hero p{font-size:11px}.jms-command-kpis{gap:7px}.jms-command-kpis button{padding:10px 9px;border-radius:14px;gap:7px}.jms-command-kpis span{width:31px;height:31px;border-radius:9px}.jms-command-kpis b{font-size:17px}.jms-command-kpis small{font-size:9px}.jms-command-tasks,.jms-command-quick{border-radius:16px;padding:12px}.jms-task{grid-template-columns:34px 1fr 16px}.jms-quick-grid{grid-template-columns:repeat(3,1fr)}.jms-quick-grid button{min-height:62px;padding:7px 3px}}
  `;
  document.head.appendChild(style);

  function install() {
    render();
    const observer = new MutationObserver(() => requestAnimationFrame(render));
    observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
    setInterval(render, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.JMS_COMMAND_CENTER_VERSION = VERSION;
})();
