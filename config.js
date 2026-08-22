// JMS Factory CRM - authenticated same-origin cloud APIs only.
// Supabase credentials are server-side environment variables on Vercel and are never exposed to the browser.
window.JMS_CLOUD = {
  ENABLED: false,
  API_SYNC: true
};

// JMS Update 15 loader: smart import by representative + duplicate/conflict protection.
(function(){
  function loadUpdate15(){
    if(document.getElementById('jms-update-15-smart-import')) return;
    var s=document.createElement('script');
    s.id='jms-update-15-smart-import';
    s.src='smart-import-rep-conflicts.js?v=20260822-1046';
    s.defer=true;
    document.body.appendChild(s);
  }
  if(document.readyState==='complete'){
    setTimeout(loadUpdate15, 300);
  }else{
    window.addEventListener('load', function(){ setTimeout(loadUpdate15, 300); });
  }
})();
