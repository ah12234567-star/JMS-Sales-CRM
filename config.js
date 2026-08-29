// JMS Factory CRM - authenticated same-origin cloud APIs only.
// Supabase credentials are server-side environment variables on Vercel and are never exposed to the browser.
window.JMS_CLOUD = {
  ENABLED: false,
  API_SYNC: true
};

// JMS Core 2.0 + temporary compatibility layer.
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
    // Core services first.
    addScript('jms-authenticated-cloud-sync','authenticated-cloud-sync.js?v=20260829-core2-3');
    addScript('jms-routes-cloud-sync','routes-cloud-sync.js?v=20260829-core2-3');
    addScript('jms-core-v2','jms-core-v2.js?v=20260829-core2-3');
    addScript('jms-core-v2-workflows','jms-core-v2-workflows.js?v=20260829-core2-3');

    // Compatibility tools retained until their UI is fully absorbed by Core 2.0.
    addScript('jms-update-15-smart-import','smart-import-rep-conflicts.js?v=20260829-core2-3');
    addScript('jms-update-15b-smart-debt-import-v2','smart-debt-import-rep-conflicts-v2.js?v=20260829-core2-3');
    addScript('jms-update-15c-customer-phone-update-v2','smart-customer-phone-update-v2.js?v=20260829-core2-3');
    addScript('jms-update-16-ai-route-fixes','update-16-ai-route-fixes.js?v=20260829-core2-3');
    addScript('jms-update-17-factory-rep','update-17-factory-rep.js?v=20260829-core2-3');
  }
  if(document.readyState==='complete') setTimeout(loadUpdates, 120);
  else window.addEventListener('load', function(){ setTimeout(loadUpdates, 120); });
})();
