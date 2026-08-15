/* Manager view for completed representative field visits. */
(function(){
'use strict';
const VERSION='2026-08-15-manager-field-visits-1';
let timer=0;
function user(){try{return window.currentUser||JSON.parse(sessionStorage.getItem('jms_current_user')||'null')}catch(_){return null}}
function isManager(){return ['admin','sales'].includes(user()?.role)}
function token(){return sessionStorage.getItem('jms_auth_token')||''}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function age(iso){if(!iso)return'';const ms=Date.now()-new Date(iso).getTime();const min=Math.max(0,Math.round(ms/60000));if(min<1)return'الآن';if(min<60)return`قبل ${min} دقيقة`;const h=Math.round(min/60);if(h<24)return`قبل ${h} ساعة`;return new Date(iso).toLocaleDateString('ar-SA')}
async function fetchReps(){const res=await fetch('/api/rep-location',{headers:{Authorization:'Bearer '+token()}});const data=await res.json().catch(()=>({ok:false}));if(!res.ok||data.ok===false)throw new Error(data.error||'request_failed');return data.reps||[]}
function lastVisit(rep){
  if(rep.last_completed_visit)return rep.last_completed_visit;
  const s=rep.work_state||{};
  if(s.last_completed_at&&s.last_customer_name)return {
    customer_name:s.last_customer_name,
    customer_id:s.last_customer_id||'',
    ended_at:s.last_completed_at,
    duration_min:s.last_duration_min??null,
    legacy:true
  };
  return null;
}
function ensurePanel(){
  const page=document.getElementById('repsControl');if(!page)return null;
  let panel=document.getElementById('jmsCompletedFieldVisits');if(panel)return panel;
  panel=document.createElement('div');panel.id='jmsCompletedFieldVisits';panel.className='panel jms-completed-visits';
  panel.innerHTML='<div class="jms-cv-head"><div><b>آخر الزيارات المكتملة</b><small>آخر زيارة أنهى كل مندوب تسجيلها ميدانيًا</small></div><button type="button">تحديث</button></div><div id="jmsCompletedVisitsList"><div class="muted">جاري التحميل...</div></div>';
  const live=document.getElementById('jmsRepLivePanel');
  if(live)live.insertAdjacentElement('afterend',panel);else page.prepend(panel);
  panel.querySelector('button').onclick=load;
  return panel;
}
async function load(){
  if(!isManager())return;
  const panel=ensurePanel();if(!panel)return;
  const list=panel.querySelector('#jmsCompletedVisitsList');
  try{
    const reps=await fetchReps();
    const rows=reps.map(r=>({rep:r,visit:lastVisit(r)})).filter(x=>x.visit).sort((a,b)=>new Date(b.visit.ended_at||0)-new Date(a.visit.ended_at||0));
    if(!rows.length){list.innerHTML='<div class="jms-cv-empty">لا توجد زيارات مكتملة مسجلة حتى الآن.</div>';return}
    list.innerHTML=rows.map(({rep,visit})=>`<div class="jms-cv-row"><div class="jms-cv-dot"></div><div><b>${esc(rep.name||rep.id)}</b><span>أنهى زيارة: ${esc(visit.customer_name||'عميل')}</span><small>${esc(age(visit.ended_at))}${Number.isFinite(Number(visit.duration_min))?' · مدة الزيارة '+Math.max(0,Math.round(Number(visit.duration_min)))+' دقيقة':''}${visit.legacy?' · سجل سابق':''}</small></div><strong>مكتملة</strong></div>`).join('');
  }catch(e){list.innerHTML='<div class="jms-cv-empty">تعذر تحميل الزيارات المكتملة. اضغط تحديث.</div>'}
}
function style(){if(document.getElementById('jmsManagerFieldVisitStyle'))return;const s=document.createElement('style');s.id='jmsManagerFieldVisitStyle';s.textContent=`.jms-completed-visits{margin-top:12px}.jms-cv-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.jms-cv-head b,.jms-cv-head small{display:block}.jms-cv-head small{margin-top:3px;color:#64748b}.jms-cv-head button{border:0;border-radius:12px;padding:9px 13px;background:#0f172a;color:#fff;font-weight:900}.jms-cv-row{display:grid;grid-template-columns:10px 1fr auto;gap:10px;align-items:center;padding:12px;border:1px solid #e2e8f0;border-radius:15px;background:#fff;margin-bottom:8px}.jms-cv-dot{width:9px;height:9px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 5px #dcfce7}.jms-cv-row b,.jms-cv-row span,.jms-cv-row small{display:block}.jms-cv-row span{margin-top:3px;color:#0f172a;font-weight:800}.jms-cv-row small{margin-top:3px;color:#64748b}.jms-cv-row strong{color:#166534;background:#ecfdf5;padding:6px 9px;border-radius:999px;font-size:11px}.jms-cv-empty{padding:20px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:14px}@media(max-width:700px){.jms-cv-row{grid-template-columns:8px 1fr}.jms-cv-row strong{grid-column:2;justify-self:start}}`;document.head.appendChild(s)}
function boot(){style();if(!isManager())return;setTimeout(load,900);document.addEventListener('click',e=>{if(e.target.closest('.nav[data-page="repsControl"]'))setTimeout(load,180)});clearInterval(timer);timer=setInterval(()=>{if(document.getElementById('repsControl')?.classList.contains('active'))load()},30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.jmsManagerFieldVisits={version:VERSION,refresh:load};
})();
