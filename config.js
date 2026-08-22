// JMS Factory CRM - authenticated same-origin cloud APIs only.
// Supabase credentials are server-side environment variables on Vercel and are never exposed to the browser.
window.JMS_CLOUD = {
  ENABLED: false,
  API_SYNC: true
};

// JMS Update 15 + 15B loader: smart customer/debt import by representative + duplicate/conflict protection.
(function(){
  function addScript(id, src){
    if(document.getElementById(id)) return;
    var s=document.createElement('script');
    s.id=id;
    s.src=src;
    s.defer=true;
    document.body.appendChild(s);
  }
  function loadUpdates(){
    addScript('jms-update-15-smart-import','smart-import-rep-conflicts.js?v=20260822-1115');
    addScript('jms-update-15b-smart-debt-import','smart-debt-import-rep-conflicts.js?v=20260822-1115');
  }
  if(document.readyState==='complete') setTimeout(loadUpdates, 200);
  else window.addEventListener('load', function(){ setTimeout(loadUpdates, 200); });
})();
