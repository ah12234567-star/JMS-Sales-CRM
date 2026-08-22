/* JMS Update 15B HOTFIX: remove old Yaser-only debt importer and delegate to smart representative-aware debt importer. */
(function(){
  'use strict';
  function loadSmartDebtImport(cb){
    if(window.openSmartDebtImport){ cb && cb(); return; }
    var existing=document.getElementById('jms-update-15b-smart-debt-import');
    if(!existing){
      var s=document.createElement('script');
      s.id='jms-update-15b-smart-debt-import';
      s.src='smart-debt-import-rep-conflicts.js?v=20260822-1115';
      s.defer=true;
      s.onload=function(){ cb && cb(); };
      document.body.appendChild(s);
    }else{
      setTimeout(function(){ cb && cb(); }, 500);
    }
  }
  function openSmart(){
    loadSmartDebtImport(function(){
      if(window.openSmartDebtImport) window.openSmartDebtImport();
      else alert('جاري تحميل استيراد الديون الذكي. حدث الصفحة ثم جرب مرة أخرى.');
    });
  }
  function fixOldButton(){
    if(!window.currentUser || window.currentUser.role!=='admin') return;
    var oldInput=document.getElementById('jmsDebtAgingFileInput');
    if(oldInput) oldInput.remove();
    var old=document.getElementById('jmsDebtAgingImportBtn');
    if(old){
      old.textContent='استيراد الديون الذكي';
      old.onclick=openSmart;
      old.removeAttribute('data-old-yaser-import');
      return;
    }
    var page=document.getElementById('customers');
    if(!page) return;
    var head=page.querySelector('.page-head');
    if(!head) return;
    var actions=head.querySelector('.head-actions');
    if(!actions){ actions=document.createElement('div'); actions.className='head-actions'; head.appendChild(actions); }
    if(document.getElementById('jmsSmartDebtImportBtn')) return;
    var btn=document.createElement('button');
    btn.id='jmsSmartDebtImportBtn';
    btn.type='button';
    btn.className='primary secondary';
    btn.textContent='استيراد الديون الذكي';
    btn.onclick=openSmart;
    actions.appendChild(btn);
  }
  window.openDebtAgingImport=openSmart;
  window.openSmartDebtImportSafe=openSmart;
  window.addEventListener('load',function(){ setTimeout(function(){ loadSmartDebtImport(fixOldButton); },300); });
  setInterval(fixOldButton,1200);
})();