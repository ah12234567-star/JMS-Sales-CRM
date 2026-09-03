/* JMS global radar lead ownership: one new lead, one representative. */
(function(){
  'use strict';
  if(window.__JMS_RADAR_GLOBAL_OWNERSHIP__) return;
  window.__JMS_RADAR_GLOBAL_OWNERSHIP__ = '2026-09-03-global-ownership-1';

  function store(){try{return db}catch(_){return window.db||{}}}
  function user(){try{return currentUser}catch(_){return window.currentUser||null}}
  function token(){return sessionStorage.getItem('jms_auth_token')||''}
  function authHeaders(){return {'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})}}
  function value(id,fallback=''){return document.getElementById(id)?.value||fallback}
  function persistLocal(){try{localStorage.setItem('jms_factory_crm_pro_v4',JSON.stringify(store()))}catch(_){}}
  function render(){try{window.renderNewCustomerRadar?.()}catch(error){console.warn('Radar render failed',error)}}
  function setStatus(html){const box=document.getElementById('radarStatus');if(box)box.innerHTML=html}
  function escapeHtml(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  async function request(path,options={}){
    const response=await fetch(path,{...options,headers:{...authHeaders(),...(options.headers||{})}});
    const data=await response.json().catch(()=>({ok:false,error:'bad_response'}));
    if(!response.ok||data.ok===false){
      const error=new Error(data.message||data.error||'request_failed');
      error.code=data.error||'request_failed';
      throw error;
    }
    return data;
  }

  async function loadGlobalLeads(){
    if(!token()||!user()) return false;
    try{
      const data=await request('/api/radar-leads',{method:'GET'});
      store().leads=Array.isArray(data.leads)?data.leads:[];
      persistLocal();
      render();
      return true;
    }catch(error){
      console.warn('Global radar load failed',error);
      return false;
    }
  }

  async function runRadarSearch(){
    if(!token()||!user()) return alert('سجل الدخول أولاً');
    const baseCity=value('radarCity','جدة');
    const district=value('radarDistrict').trim();
    const city=district?`${baseCity} ${district}`:baseCity;
    const industry=value('radarIndustry','مطاعم وكوفيهات جديدة');
    const baseKeywords=value('radarKeywords','افتتاح جديد opening soon new');
    const keywords=district?`${baseKeywords} ${district} قريب nearby near me`:baseKeywords;
    const limit=Number(value('radarLimit','12'));
    setStatus('<div class="jms-thinking">جارٍ البحث وحجز النتائج الجديدة لهذا المندوب...</div>');
    try{
      const currentUser=user();
      const data=await request('/api/new-customer-radar',{
        method:'POST',
        body:JSON.stringify({
          city,industry,keywords,limit,
          assignedRepId:currentUser?.role==='rep'?currentUser.id:'',
          existingCustomers:(store().customers||[]).map(customer=>customer.name).filter(Boolean).slice(0,300)
        })
      });
      await loadGlobalLeads();
      const found=Number(data.discovered??data.leads?.length??0);
      const fresh=Array.isArray(data.leads)?data.leads.length:0;
      const skipped=Number(data.skipped||0);
      setStatus(`<div class="jms-radar-note">تم العثور على ${found} فرصة؛ حُجزت ${fresh} فرصة جديدة لهذا المندوب، واستُبعدت ${skipped} فرصة موجودة أو محجوزة لمندوب آخر.</div>`);
    }catch(error){
      setStatus(`<div class="jms-radar-note">تعذر تشغيل الرادار: ${escapeHtml(error.message)}.</div>`);
    }
  }

  async function saveManualLead(){
    const lead={
      name:value('mlName').trim(),
      business_type:value('mlType','نشاط تجاري'),
      city:value('mlCity','جدة'),
      area:value('mlArea'),
      phone:value('mlPhone'),
      website:value('mlWebsite'),
      maps_url:value('mlMaps'),
      fit_reason:value('mlReason','نشاط جديد يحتاج أكياس أو تغليف.'),
      status:'new',
      score:60,
      created_at:new Date().toISOString()
    };
    if(!lead.name) return alert('اكتب اسم النشاط');
    const selectedRep=value('mlRep');
    try{
      const result=await request('/api/radar-leads',{
        method:'POST',
        body:JSON.stringify({action:'reserve',lead,assigned_rep_id:selectedRep})
      });
      store().leads=Array.isArray(store().leads)?store().leads:[];
      store().leads.unshift(result.lead);
      persistLocal();
      window.closeModal?.();
      render();
      alert('تم حفظ الفرصة وحجزها للمندوب؛ لن تظهر لبقية المناديب');
    }catch(error){
      if(error.code==='lead_already_reserved') return alert('هذه الفرصة محجوزة مسبقًا لمندوب آخر');
      if(error.code==='already_a_customer') return alert('هذا النشاط موجود مسبقًا ضمن العملاء');
      alert('تعذر حفظ الفرصة: '+error.message);
    }
  }

  async function updateLead(id,changes){
    const result=await request('/api/radar-leads',{
      method:'POST',
      body:JSON.stringify({action:'update',id,changes})
    });
    const index=(store().leads||[]).findIndex(lead=>String(lead.id)===String(id));
    if(index>=0) store().leads[index]=result.lead;
    persistLocal();
    render();
    return result.lead;
  }

  function install(){
    if(typeof window.jmsRunRadarSearch!=='function'||typeof window.renderNewCustomerRadar!=='function'){
      return setTimeout(install,250);
    }
    window.jmsRunRadarSearch=runRadarSearch;
    window.jmsSaveManualLead=saveManualLead;

    window.jmsLeadSetStatus=async function(id,status){
      try{await updateLead(id,{status})}catch(error){alert('تعذر تحديث حالة الفرصة: '+error.message)}
    };

    window.jmsLeadAssign=async function(id){
      const lead=(store().leads||[]).find(item=>String(item.id)===String(id));
      if(!lead) return;
      const currentUser=user();
      if(currentUser?.role==='rep') return alert('الفرصة محجوزة لك بالفعل');
      const repId=prompt('اكتب ID المندوب الجديد',lead.assigned_rep_id||'');
      if(repId===null) return;
      try{await updateLead(id,{assigned_rep_id:repId});alert('تم نقل ملكية الفرصة للمندوب الجديد')}
      catch(error){alert('تعذر نقل ملكية الفرصة: '+error.message)}
    };

    const originalConvert=window.jmsLeadConvertToCustomer;
    window.jmsLeadConvertToCustomer=async function(id){
      try{
        await updateLead(id,{status:'converted',converted_at:new Date().toISOString()});
        return originalConvert?.call(this,id);
      }catch(error){
        alert('تعذر تحويل الفرصة: '+error.message);
      }
    };

    document.addEventListener('click',event=>{
      if(event.target?.closest?.('[data-page="newCustomerRadar"]')) setTimeout(loadGlobalLeads,80);
    },true);
    setTimeout(loadGlobalLeads,700);
    setInterval(()=>{if(!document.hidden)loadGlobalLeads()},45000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install);
  else install();
  window.JMSRadarOwnership={load:loadGlobalLeads,search:runRadarSearch};
})();

