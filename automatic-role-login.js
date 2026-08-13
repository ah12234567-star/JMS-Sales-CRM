(function () {
  'use strict';
  const VERSION = '2026-08-automatic-role-login-v1';
  const labels = {
    admin: 'مدير النظام',
    sales: 'مدير المبيعات',
    rep: 'مندوب مبيعات',
    warehouse: 'مسؤول الأحبار',
    production: 'مسؤول الإنتاج',
    production_manager: 'مدير الإنتاج',
    manager: 'مدير'
  };

  function current() {
    try { return currentUser; } catch (_) {
      try { return JSON.parse(sessionStorage.getItem('jms_current_user') || 'null'); } catch (_) { return null; }
    }
  }

  function applyAutomaticRoleUi() {
    document.querySelectorAll('.role-switch').forEach(element => element.remove());
    const form = document.getElementById('loginForm');
    if (form && !form.querySelector('.jms-auto-role-note')) {
      form.insertAdjacentHTML('afterbegin', '<div class="jms-auto-role-note"><span>✓</span><div><b>دخول تلقائي حسب صلاحية الحساب</b><small>اكتب بريدك وكلمة المرور، وسيعرض النظام الصفحات المسموحة لك فقط.</small></div></div>');
    }
    const user = current();
    const role = document.getElementById('currentUserRole');
    const label = user?.role ? (labels[user.role] || user.role) : '';
    if (role && label && role.textContent !== label) role.textContent = label;
  }

  function injectStyle() {
    if (document.getElementById('jmsAutomaticRoleStyle')) return;
    const style = document.createElement('style');
    style.id = 'jmsAutomaticRoleStyle';
    style.textContent = `
      .role-switch{display:none!important}
      .jms-auto-role-note{display:flex;align-items:center;gap:11px;text-align:right;margin:0 0 18px;padding:12px 13px;border:1px solid #dbe7e3;border-radius:13px;background:#f0fdf4;color:#166534}
      .jms-auto-role-note>span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:50%;background:#16a34a;color:#fff;font-weight:900}
      .jms-auto-role-note b,.jms-auto-role-note small{display:block}.jms-auto-role-note b{font-size:13px}.jms-auto-role-note small{margin-top:3px;color:#4b6358;font-size:11px;line-height:1.5}
    `;
    document.head.appendChild(style);
  }

  function install() {
    injectStyle();
    applyAutomaticRoleUi();
    new MutationObserver(applyAutomaticRoleUi).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
    document.getElementById('loginForm')?.addEventListener('submit', () => setTimeout(applyAutomaticRoleUi, 350));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.JMS_AUTOMATIC_ROLE_LOGIN_VERSION = VERSION;
})();
