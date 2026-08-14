(function () {
  'use strict';
  const VERSION = '2026-08-mobile-sidebar-v1';

  function addSearch(sidebar) {
    if (!sidebar || sidebar.querySelector('.jms-mobile-nav-search')) return;
    const nav = sidebar.querySelector('nav');
    if (!nav) return;
    const wrap = document.createElement('div');
    wrap.className = 'jms-mobile-nav-search';
    wrap.innerHTML = '<span>⌕</span><input type="search" placeholder="ابحث في القائمة" aria-label="ابحث في القائمة">';
    nav.parentNode.insertBefore(wrap, nav);
    wrap.querySelector('input').addEventListener('input', event => {
      const term = event.target.value.trim().toLowerCase();
      nav.querySelectorAll('.nav').forEach(button => {
        button.classList.toggle('jms-nav-search-hidden', !!term && !button.textContent.toLowerCase().includes(term));
      });
    });
  }

  function addIcons(sidebar) {
    const icons = {
      dashboard:'⌂', whatsappCampaigns:'◉', jmsAI:'✦', aiCommands:'✦', repsControl:'♟',
      smartVisits:'⌖', leadRadar:'◌', customers:'●', repAiAssistant:'✦', visits:'✓',
      orders:'▣', productionWorkflow:'▦', quotes:'▤', routes:'⌁', alerts:'!', inkStock:'◈',
      visitNotes:'✎', users:'♟', profile:'○'
    };
    sidebar?.querySelectorAll('.nav').forEach(button => {
      if (button.querySelector('.jms-nav-icon')) return;
      const icon = document.createElement('span');
      icon.className = 'jms-nav-icon';
      icon.textContent = icons[button.dataset.page] || '•';
      button.prepend(icon);
    });
  }

  function enhance() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.add('jms-mobile-sidebar-pro');
    addSearch(sidebar);
    addIcons(sidebar);
  }

  const style = document.createElement('style');
  style.id = 'jmsMobileSidebarUpgradeStyle';
  style.textContent = `
    .jms-mobile-nav-search,.jms-nav-icon{display:none}
    @media(max-width:920px){
      .sidebar.jms-mobile-sidebar-pro{width:min(82vw,330px)!important;max-width:330px!important;padding:calc(env(safe-area-inset-top,0px) + 12px) 12px 18px!important;gap:8px!important;background:linear-gradient(180deg,#0f172a,#111827)!important}
      .sidebar.jms-mobile-sidebar-pro .jms-mobile-close{position:absolute!important;top:calc(env(safe-area-inset-top,0px) + 12px)!important;left:12px!important;width:38px!important;height:38px!important;margin:0!important;border-radius:12px!important;background:rgba(255,255,255,.08)!important;font-size:20px!important}
      .sidebar.jms-mobile-sidebar-pro .brand{min-height:64px!important;margin:0 48px 7px 0!important;padding:0 0 12px!important;border-bottom:1px solid rgba(255,255,255,.1)!important;gap:9px!important}
      .sidebar.jms-mobile-sidebar-pro .sidebar-brand-mark,.sidebar.jms-mobile-sidebar-pro .brand img{width:46px!important;height:46px!important;min-width:46px!important;border-radius:13px!important}
      .sidebar.jms-mobile-sidebar-pro .brand b{font-size:16px!important}.sidebar.jms-mobile-sidebar-pro .brand span{font-size:10px!important;line-height:1.35!important}
      .sidebar.jms-mobile-sidebar-pro .user-box{position:relative!important;margin:0 0 7px!important;padding:10px 13px!important;min-height:auto!important;border-radius:14px!important;background:rgba(255,255,255,.065)!important}
      .sidebar.jms-mobile-sidebar-pro .user-box:before{content:'';position:absolute;left:13px;top:50%;width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.15);transform:translateY(-50%)}
      .sidebar.jms-mobile-sidebar-pro .user-box small{font-size:10px!important;margin:0!important}.sidebar.jms-mobile-sidebar-pro .user-box b{font-size:15px!important;line-height:1.4!important}.sidebar.jms-mobile-sidebar-pro .user-box span{font-size:10px!important;margin:1px 0 0!important}
      .jms-mobile-nav-search{display:flex!important;align-items:center;gap:7px;margin:0 0 6px;padding:0 11px;height:39px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.06);color:#94a3b8}
      .jms-mobile-nav-search input{width:100%!important;height:36px!important;padding:0!important;border:0!important;outline:0!important;background:transparent!important;color:#fff!important;font-size:13px!important}.jms-mobile-nav-search input::placeholder{color:#94a3b8}
      .sidebar.jms-mobile-sidebar-pro nav{gap:5px!important;margin:0!important;padding:0 0 5px!important}
      .sidebar.jms-mobile-sidebar-pro .nav{display:flex!important;align-items:center!important;gap:10px!important;min-height:46px!important;padding:9px 11px!important;border-radius:12px!important;background:rgba(255,255,255,.055)!important;font-size:13px!important;line-height:1.25!important;font-weight:750!important}
      .sidebar.jms-mobile-sidebar-pro .nav[style*="display: none"],.sidebar.jms-mobile-sidebar-pro .nav.jms-nav-search-hidden{display:none!important}
      .sidebar.jms-mobile-sidebar-pro .nav.active{background:linear-gradient(135deg,#dc2626,#ef4444)!important;box-shadow:0 7px 17px rgba(220,38,38,.2)!important}
      .jms-nav-icon{display:grid!important;place-items:center!important;min-width:27px!important;width:27px!important;height:27px!important;border-radius:8px!important;background:rgba(255,255,255,.08)!important;color:#cbd5e1!important;font-size:13px!important;font-style:normal!important}
      .sidebar.jms-mobile-sidebar-pro .nav.active .jms-nav-icon{background:rgba(255,255,255,.18)!important;color:#fff!important}
      .sidebar.jms-mobile-sidebar-pro #logoutBtn{min-height:44px!important;margin:5px 0 0!important;padding:9px 12px!important;font-size:13px!important}
    }
    @media(max-width:390px){.sidebar.jms-mobile-sidebar-pro{width:88vw!important}}
  `;
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
  setTimeout(enhance,500);
  setTimeout(enhance,1800);
  window.JMS_MOBILE_SIDEBAR_VERSION = VERSION;
})();
