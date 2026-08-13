(function () {
  'use strict';
  const VERSION = '2026-08-mobile-menu-close-v1';

  function closeMenu() {
    document.body.classList.remove('jms-mobile-menu-open');
  }

  function ensureBackdrop() {
    let backdrop = document.getElementById('jmsMobileMenuBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.id = 'jmsMobileMenuBackdrop';
      backdrop.className = 'jms-mobile-menu-backdrop';
      backdrop.setAttribute('aria-label', 'إغلاق القائمة');
      backdrop.addEventListener('click', closeMenu);
      backdrop.addEventListener('touchend', event => {
        event.preventDefault();
        closeMenu();
      }, {passive:false});
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  function install() {
    ensureBackdrop();
    document.addEventListener('pointerdown', event => {
      if (!document.body.classList.contains('jms-mobile-menu-open')) return;
      if (event.target.closest('.sidebar,#jmsMobileMenuBtn')) return;
      closeMenu();
    }, true);
    window.addEventListener('resize', () => {
      if (window.innerWidth > 920) closeMenu();
    });
  }

  const style = document.createElement('style');
  style.id = 'jmsMobileMenuCloseFixStyle';
  style.textContent = `
    .jms-mobile-menu-backdrop{display:none}
    @media(max-width:920px){
      body.jms-mobile-menu-open{overflow:hidden!important}
      body.jms-mobile-menu-open:before{display:none!important}
      .jms-mobile-menu-backdrop{display:none;position:fixed;inset:0;z-index:99998;border:0!important;border-radius:0!important;padding:0!important;margin:0!important;background:rgba(15,23,42,.55)!important;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);cursor:pointer}
      body.jms-mobile-menu-open .jms-mobile-menu-backdrop{display:block!important}
      body.jms-mobile-menu-open .sidebar{z-index:99999!important}
    }
  `;
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.JMS_MOBILE_MENU_CLOSE_VERSION = VERSION;
})();
