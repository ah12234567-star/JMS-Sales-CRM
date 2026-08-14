/* Professional mobile customer workspace for sales representatives. */
(function () {
  'use strict';

  const STYLE_ID = 'jmsRepMobileProStyle';
  let observer = null;
  let cleaning = false;

  function isRep() {
    return window.currentUser?.role === 'rep';
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.jms-rep-pro #customers .page-head{background:linear-gradient(135deg,#0f172a 0%,#172554 58%,#1d4ed8 100%);color:#fff;border:0;border-radius:24px;padding:18px;margin:0 0 14px;box-shadow:0 16px 34px rgba(15,23,42,.18)}
      body.jms-rep-pro #customers .page-head h2{color:#fff;font-size:24px;margin:0 0 4px}
      body.jms-rep-pro #customers .page-head p{color:#bfdbfe;font-size:13px}
      body.jms-rep-pro #customers .page-head>button{background:#fff!important;color:#172554!important;border-radius:14px!important;padding:10px 14px!important}
      .rep-pro-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px}
      .rep-pro-summary>div{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:11px;text-align:center;box-shadow:0 8px 20px rgba(15,23,42,.05)}
      .rep-pro-summary b{display:block;font-size:21px;color:#0f172a}.rep-pro-summary span{font-size:11px;color:#64748b}
      body.jms-rep-pro #customerSearch{height:50px;border-radius:16px;background:#fff;border:1px solid #dbe3ef;padding:0 16px;margin-bottom:12px;font-size:15px;box-shadow:0 7px 18px rgba(15,23,42,.04)}
      body.jms-rep-pro #customersGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}
      .rep-pro-card{position:relative!important;overflow:hidden!important;background:#fff!important;border:1px solid #e2e8f0!important;border-radius:22px!important;padding:16px!important;margin:0!important;box-shadow:0 10px 28px rgba(15,23,42,.07)!important}
      .rep-pro-card:before{content:'';position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#2563eb,#7c3aed)}
      .rep-pro-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-top:3px}
      .rep-pro-title{min-width:0}.rep-pro-title h3{margin:0 0 7px;font-size:18px;line-height:1.45;color:#0f172a;overflow-wrap:anywhere}
      .rep-pro-title p{margin:0;color:#64748b;font-size:12px;line-height:1.7}
      .rep-pro-status{flex:0 0 auto;display:flex;align-items:center;gap:6px;border-radius:999px;padding:7px 9px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:900}
      .rep-pro-status.ok{background:#ecfdf5;color:#166534}.rep-pro-status:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
      .rep-pro-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:13px 0}
      .rep-pro-metric{background:#f8fafc;border:1px solid #e8edf4;border-radius:14px;padding:9px 6px;text-align:center;min-width:0}
      .rep-pro-metric b{display:block;color:#0f172a;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rep-pro-metric span{display:block;color:#94a3b8;font-size:10px;margin-top:3px}
      .rep-pro-primary{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .rep-pro-primary button,.rep-pro-more summary,.rep-pro-more-grid button{min-height:44px;border:0;border-radius:13px;padding:10px;font:inherit;font-size:13px;font-weight:900;cursor:pointer}
      .rep-pro-primary .visit{background:#0f172a;color:#fff}.rep-pro-primary .order{background:#166534;color:#fff}.rep-pro-primary .meeting{background:#2563eb;color:#fff}.rep-pro-primary .profile{background:#ede9fe;color:#5b21b6}
      .rep-pro-more{margin-top:8px}.rep-pro-more summary{list-style:none;display:flex;align-items:center;justify-content:center;gap:8px;background:#f1f5f9;color:#334155}.rep-pro-more summary::-webkit-details-marker{display:none}.rep-pro-more summary:after{content:'⌄';font-size:16px}.rep-pro-more[open] summary:after{transform:rotate(180deg)}
      .rep-pro-more-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding-top:8px}.rep-pro-more-grid button{background:#fff;border:1px solid #dbe3ef;color:#334155}.rep-pro-more-grid button.danger{color:#b45309;background:#fff7ed;border-color:#fed7aa}
      .rep-pro-empty{grid-column:1/-1;background:#fff;border:1px dashed #cbd5e1;border-radius:20px;padding:30px;text-align:center;color:#64748b}
      @media(max-width:600px){
        body.jms-rep-pro .main{padding:12px!important}
        body.jms-rep-pro #customers .page-head{border-radius:20px;padding:15px;align-items:center!important;flex-direction:row!important}
        body.jms-rep-pro #customers .page-head h2{font-size:21px}.rep-pro-summary b{font-size:19px}
        body.jms-rep-pro #customersGrid{grid-template-columns:1fr;gap:10px}.rep-pro-card{border-radius:19px!important;padding:14px!important}
        .rep-pro-title h3{font-size:17px}.rep-pro-primary button,.rep-pro-more summary,.rep-pro-more-grid button{min-height:46px;font-size:13px}
      }
      @media(max-width:370px){.rep-pro-summary{grid-template-columns:1fr 1fr}.rep-pro-summary>div:last-child{grid-column:1/-1}.rep-pro-more-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function customerList() {
    const source = typeof allowedCustomers === 'function' ? allowedCustomers() : (db.customers || []);
    const query = String(document.getElementById('customerSearch')?.value || '').trim().toLowerCase();
    return source.filter(c => !query || [c.name,c.phone,c.city,c.district,c.location,c.account_code].join(' ').toLowerCase().includes(query));
  }

  function visitInfo(customer) {
    const date = typeof lastVisit === 'function' ? lastVisit(customer.id) : '';
    const days = typeof daysFrom === 'function' ? daysFrom(date) : 999;
    if (!date) return { date: 'لم تتم', label: 'يحتاج زيارة', late: true };
    if (days >= 30) return { date, label: `متأخر ${days} يوم`, late: true };
    return { date, label: 'متابع', late: false };
  }

  function renderSummary(list) {
    const section = document.getElementById('customers');
    const search = document.getElementById('customerSearch');
    if (!section || !search) return;
    let summary = document.getElementById('repProSummary');
    if (!summary) {
      summary = document.createElement('div');
      summary.id = 'repProSummary';
      summary.className = 'rep-pro-summary';
      search.insertAdjacentElement('beforebegin', summary);
    }
    const all = typeof allowedCustomers === 'function' ? allowedCustomers() : list;
    const late = all.filter(c => visitInfo(c).late).length;
    const todayText = new Date().toLocaleDateString('ar-SA',{weekday:'long'});
    summary.innerHTML = `<div><b>${all.length}</b><span>عملائي</span></div><div><b>${late}</b><span>يحتاجون متابعة</span></div><div><b>${esc(todayText)}</b><span>خطة اليوم</span></div>`;
  }

  function card(customer) {
    const info = visitInfo(customer);
    const debt = Number(customer.debt_balance || 0);
    const phone = String(customer.phone || '').trim();
    const place = [customer.city || 'جدة', customer.district || customer.location].filter(Boolean).join(' · ');
    const code = customer.account_code ? ` · كود ${esc(customer.account_code)}` : '';
    return `<article class="customer-card rep-pro-card" data-customer-id="${esc(customer.id)}">
      <div class="rep-pro-head"><div class="rep-pro-title"><h3>${esc(customer.name)}</h3><p>${esc(place || 'جدة')}${code}${phone ? ` · ${esc(phone)}` : ''}</p></div><span class="rep-pro-status ${info.late?'':'ok'}">${esc(info.label)}</span></div>
      <div class="rep-pro-metrics">
        <div class="rep-pro-metric"><b>${esc(info.date)}</b><span>آخر زيارة</span></div>
        <div class="rep-pro-metric"><b>${esc(customer.next_date || 'غير محدد')}</b><span>الموعد القادم</span></div>
        <div class="rep-pro-metric"><b>${debt ? esc(typeof money==='function' ? money(debt) : debt) : 'لا يوجد'}</b><span>المديونية</span></div>
      </div>
      <div class="rep-pro-primary">
        <button class="visit" type="button" onclick="quickVisit('${esc(customer.id)}')">تسجيل زيارة</button>
        <button class="order" type="button" onclick="openQuoteForm('${esc(customer.id)}')">طلب جديد</button>
        <button class="meeting" type="button" onclick="appointment('${esc(customer.id)}')">تحديد موعد</button>
        <button class="profile" type="button" onclick="jmsOpenCustomer360Growth('${esc(customer.id)}')">ملف العميل</button>
      </div>
      <details class="rep-pro-more"><summary>المزيد من الأدوات</summary><div class="rep-pro-more-grid">
        <button type="button" onclick="editCustomerPro('${esc(customer.id)}')">تعديل البيانات</button>
        <button type="button" onclick="openCustomerNote('${esc(customer.id)}')">إضافة ملاحظة</button>
        <button type="button" onclick="openCustomerMap('${esc(customer.id)}')">فتح الموقع</button>
        <button class="danger" type="button" onclick="openCollection('${esc(customer.id)}')">تسجيل تحصيل</button>
        ${phone ? `<button type="button" onclick="sendSatisfactionWhatsApp('${esc(customer.id)}')">رسالة واتساب</button>` : ''}
        <button type="button" onclick="openQuoteForm('${esc(customer.id)}')">إنشاء عرض سعر</button>
      </div></details>
    </article>`;
  }

  function renderRepCustomers() {
    if (!isRep()) return;
    injectStyle();
    document.body.classList.add('jms-rep-pro');
    const grid = document.getElementById('customersGrid');
    if (!grid) return;
    const list = customerList();
    renderSummary(list);
    cleaning = true;
    grid.innerHTML = list.map(card).join('') || '<div class="rep-pro-empty">لا يوجد عملاء مطابقون للبحث</div>';
    cleaning = false;
  }

  function cleanLegacyEnhancements() {
    if (!isRep() || cleaning) return;
    cleaning = true;
    document.querySelectorAll('.rep-pro-card').forEach(cardEl => {
      Array.from(cardEl.children).forEach(child => {
        if (!child.matches('.rep-pro-head,.rep-pro-metrics,.rep-pro-primary,.rep-pro-more')) child.remove();
      });
    });
    cleaning = false;
  }

  function activate() {
    if (!isRep()) return;
    injectStyle();
    window.renderCustomers = renderRepCustomers;
    const search = document.getElementById('customerSearch');
    if (search && search.dataset.repProBound !== '1') {
      search.dataset.repProBound = '1';
      search.placeholder = 'ابحث باسم العميل أو كود الحساب أو الجوال';
      search.addEventListener('input', renderRepCustomers);
    }
    renderRepCustomers();
    const grid = document.getElementById('customersGrid');
    if (grid && !observer) {
      observer = new MutationObserver(() => setTimeout(cleanLegacyEnhancements, 0));
      observer.observe(grid, { childList:true, subtree:true });
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(activate, 900));
  window.addEventListener('load', () => {
    setTimeout(activate, 1800);
    setTimeout(activate, 4200);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.nav[data-page="customers"]')) setTimeout(activate, 120);
  });
})();
