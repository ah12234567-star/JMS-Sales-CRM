// JMS Factory CRM - authenticated same-origin cloud APIs only.
// Supabase credentials are server-side environment variables on Vercel and are never exposed to the browser.
window.JMS_CLOUD = {
  ENABLED: false,
  API_SYNC: true
};

// JMS Core 2.0 + compatibility updates loader.
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
    // Core must load first: one ownership model + authenticated sync.
    addScript('jms-authenticated-cloud-sync','authenticated-cloud-sync.js?v=20260829-core2-1');
    addScript('jms-core-v2','jms-core-v2.js?v=20260829-core2-1');

    // Compatibility layer: retained temporarily until merged into Core 2.0.
    addScript('jms-update-15-smart-import','smart-import-rep-conflicts.js?v=20260829-0915');
    addScript('jms-update-15b-smart-debt-import','smart-debt-import-rep-conflicts.js?v=20260829-0915');
    addScript('jms-update-15b-smart-debt-import-v2','smart-debt-import-rep-conflicts-v2.js?v=20260829-0915');
    addScript('jms-update-15c-customer-phone-update-v2','smart-customer-phone-update-v2.js?v=20260829-0915');
    addScript('jms-update-16-ai-route-fixes','update-16-ai-route-fixes.js?v=20260829-0915');
    addScript('jms-update-17-factory-rep','update-17-factory-rep.js?v=20260829-0915');
  }
  if(document.readyState==='complete') setTimeout(loadUpdates, 150);
  else window.addEventListener('load', function(){ setTimeout(loadUpdates, 150); });
})();
