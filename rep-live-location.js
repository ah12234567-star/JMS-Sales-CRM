/* JMS live representative GPS: rep publishes last location, managers see map/status. */
(function(){
'use strict';
const VERSION='2026-08-15-rep-live-location-1';
let client=null,watchId=null,lastSentAt=0,lastPoint=null,managerTimer=0;
function user(){try{return window.currentUser||JSON.parse(sessionStorage.getItem('jms_current_user')||'null')}catch(_){return null}}
function isRep(){return user()?.role==='rep'}
function isManager(){return ['admin','sales'].includes(user()?.role)}
function getClient(){
  if(client)return client;
  const cfg=window.JMS_CLOUD;
  if(!cfg?.ENABLED||!window.supabase?.createClient)return null;
  client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  return client;
}
function distance(a,b){if(!a||!b)return Infinity;const R=6371000,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lng-a.lng)*p,x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
async function publish(pos){
  const u=user(),c=getClient();if(!u||!c)return;
  const now=Date.now(),point={lat:pos.coords.latitude,lng:pos.coords.longitude};
  if(now-lastSentAt<15000&&distance(lastPoint,point)<20)return;
  lastSentAt=now;lastPoint=point;
  const data={rep_id:u.id,rep_name:u.name||'',lat:point.lat,lng:point.lng,accuracy:Math.round(pos.coords.accuracy||0),speed:Number.isFinite(pos.coords.speed)?pos.coords.speed:null,heading:Number.isFinite(pos.coords.heading)?pos.coords.heading:null,updated_at:new Date().toISOString(),online:navigator.onLine,source:'browser_gps'};
  try{await c.from('jms_rep_locations').upsert({id:String(u.id),data,updated_at:data.updated_at},{onConflict:'id'});setRepStatus('تم تحديث موقعك الآن','ok')}catch(e){console.warn('JMS rep location publish failed',e);setRepStatus('تعذر إرسال الموقع','bad')}
}
function setRepStatus(text,type){
  if(!isRep())return;let el=document.getElementById('jmsRepGpsStatus');if(!el){el=document.createElement('div');el.id='jmsRepGpsStatus';document.body.appendChild(el)}el.className=type||'';el.textContent=text;
}
function startRepTracking(){
  if(!isRep()||watchId!==null)return;
  if(!('geolocation' in navigator)){setRepStatus('هذا الجهاز لا يدعم تحديد الموقع','bad');return}
  setRepStatus('فعّل إذن الموقع لبدء التتبع','warn');
  watchId=navigator.geolocation.watchPosition(publish,err=>{
    const msg=err.code===1?'الموقع غير مسموح — فعّله من إعدادات المتصفح':err.code===2?'تعذر تحديد الموقع':'انتهت مهلة تحديد الموقع';
    setRepStatus(msg,'bad');
  },{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
}
function ageText(iso){if(!iso)return'لا يوجد تحديث';const sec=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/1000));if(sec<60)return`منذ ${sec} ثانية`;const min=Math.round(sec/60);if(min<60)return`منذ ${min} دقيقة`;const hr=Math.round(min/60);return`منذ ${hr} ساعة`}
function freshness(iso){if(!iso)return'offline';const mins=(Date.now()-new Date(iso).getTime())/60000;return mins<=2?'live':mins<=15?'recent':'offline'}
function ensureManagerPanel(){
  if(!isManager())return null;const page=document.getElementById('repsControl');if(!page)return null;
  let panel=document.getElementById('jmsRepLivePanel');if(panel)return panel;
  panel=document.createElement('div');panel.id='jmsRepLivePanel';panel.className='jms-live-panel panel';panel.innerHTML=`<div class="jms-live-head"><div><b>مواقع المناديب</b><small>آخر موقع GPS مسجل من جوال المندوب</small></div><button type="button" id="jmsRefreshRepLocations">تحديث الآن</button></div><div class="jms-live-layout"><div id="jmsRepLocationList" class="jms-rep-location-list"><div class="muted">جاري تحميل المواقع...</div></div><div class="jms-live-map-wrap"><iframe id="jmsRepLiveMap" title="خريطة المندوب" loading="lazy"></iframe><div id="jmsRepMapEmpty">اختر مندوبًا لعرض موقعه على الخريطة</div></div></div>`;
  const anchor=page.querySelector('.stats')||page.querySelector('.panel');anchor?.insertAdjacentElement('afterend',panel);
  panel.querySelector('#jmsRefreshRepLocations')?.addEventListener('click',loadManagerLocations);
  return panel;
}
function openOnMap(lat,lng){window.open(`https://www.google.com/maps?q=${encodeURIComponent(lat+','+lng)}`,'_blank','noopener')}
function showMap(rec){const frame=document.getElementById('jmsRepLiveMap'),empty=document.getElementById('jmsRepMapEmpty');if(!frame)return;const d=rec?.data||{};if(!Number.isFinite(Number(d.lat))||!Number.isFinite(Number(d.lng))){frame.removeAttribute('src');if(empty)empty.style.display='grid';return}if(empty)empty.style.display='none';frame.src=`https://maps.google.com/maps?q=${encodeURIComponent(d.lat+','+d.lng)}&z=16&output=embed`}
async function loadManagerLocations(){
  if(!isManager())return;ensureManagerPanel();const c=getClient(),list=document.getElementById('jmsRepLocationList');if(!c||!list)return;
  try{
    const {data,error}=await c.from('jms_rep_locations').select('id,data,updated_at').order('updated_at',{ascending:false});if(error)throw error;
    const rows=data||[];if(!rows.length){list.innerHTML='<div class="jms-no-location"><b>لا يوجد موقع مسجل حتى الآن</b><small>لازم المندوب يفتح النظام من جواله ويوافق على إذن الموقع.</small></div>';showMap(null);return}
    list.innerHTML=rows.map((r,i)=>{const d=r.data||{},state=freshness(d.updated_at||r.updated_at),label=state==='live'?'مباشر الآن':state==='recent'?'تحديث حديث':'آخر موقع';return `<button type="button" class="jms-rep-location-card ${state}" data-i="${i}"><span class="dot"></span><div><b>${escapeHtml(d.rep_name||r.id)}</b><small>${label} · ${ageText(d.updated_at||r.updated_at)} · دقة ±${Math.round(Number(d.accuracy)||0)}م</small></div><i>عرض</i></button>`}).join('');
    list.querySelectorAll('.jms-rep-location-card').forEach(btn=>btn.addEventListener('click',()=>{const r=rows[Number(btn.dataset.i)];showMap(r);list.querySelectorAll('.jms-rep-location-card').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');const d=r.data||{};if(Number.isFinite(Number(d.lat))&&Number.isFinite(Number(d.lng))){let actions=document.getElementById('jmsRepMapActions');if(!actions){actions=document.createElement('div');actions.id='jmsRepMapActions';document.querySelector('.jms-live-map-wrap')?.appendChild(actions)}actions.innerHTML=`<button type="button">فتح في خرائط Google</button>`;actions.querySelector('button').onclick=()=>openOnMap(d.lat,d.lng)}}));
    list.querySelector('.jms-rep-location-card')?.click();
  }catch(e){console.error('JMS manager locations failed',e);list.innerHTML='<div class="jms-no-location"><b>تعذر تحميل مواقع المناديب</b><small>تحقق من اتصال Supabase وجدول jms_rep_locations.</small></div>'}
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function installStyle(){if(document.getElementById('jmsRepLiveLocationStyle'))return;const s=document.createElement('style');s.id='jmsRepLiveLocationStyle';s.textContent=`#jmsRepGpsStatus{position:fixed;z-index:100300;left:14px;top:calc(80px + env(safe-area-inset-top,0px));max-width:280px;padding:8px 12px;border-radius:999px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;font-size:10px;font-weight:900;box-shadow:0 8px 22px #0002}#jmsRepGpsStatus.ok{background:#ecfdf5;color:#166534;border-color:#bbf7d0}#jmsRepGpsStatus.bad{background:#fef2f2;color:#991b1b;border-color:#fecaca}.jms-live-panel{margin-top:12px}.jms-live-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.jms-live-head b,.jms-live-head small{display:block}.jms-live-head small{color:#64748b;margin-top:3px}.jms-live-head button,#jmsRepMapActions button{border:0;border-radius:12px;padding:10px 13px;background:#0f172a;color:white;font-weight:900}.jms-live-layout{display:grid;grid-template-columns:minmax(260px,.75fr) minmax(420px,1.25fr);gap:12px}.jms-rep-location-list{display:grid;gap:8px;align-content:start;max-height:440px;overflow:auto}.jms-rep-location-card{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:15px;background:white;text-align:right}.jms-rep-location-card .dot{width:9px;height:9px;border-radius:50%;background:#94a3b8}.jms-rep-location-card.live .dot{background:#16a34a;box-shadow:0 0 0 5px #dcfce7}.jms-rep-location-card.recent .dot{background:#f59e0b}.jms-rep-location-card.selected{border-color:#2563eb;background:#eff6ff}.jms-rep-location-card b,.jms-rep-location-card small{display:block}.jms-rep-location-card small{margin-top:3px;color:#64748b;font-size:10px}.jms-rep-location-card i{font-style:normal;color:#2563eb;font-size:11px;font-weight:900}.jms-live-map-wrap{position:relative;min-height:360px;border-radius:18px;overflow:hidden;background:#f1f5f9;border:1px solid #e2e8f0}.jms-live-map-wrap iframe{width:100%;height:400px;border:0}.jms-live-map-wrap #jmsRepMapEmpty{position:absolute;inset:0;display:grid;place-items:center;color:#64748b}.jms-live-map-wrap #jmsRepMapActions{position:absolute;left:12px;bottom:12px}.jms-no-location{padding:24px;border:1px dashed #cbd5e1;border-radius:15px;text-align:center}.jms-no-location b,.jms-no-location small{display:block}.jms-no-location small{margin-top:6px;color:#64748b}@media(max-width:800px){.jms-live-layout{grid-template-columns:1fr}.jms-live-map-wrap{min-height:300px}.jms-live-map-wrap iframe{height:330px}}`;document.head.appendChild(s)}
function boot(){installStyle();const u=user();if(!u)return;if(isRep())startRepTracking();if(isManager()){ensureManagerPanel();loadManagerLocations();clearInterval(managerTimer);managerTimer=setInterval(()=>{if(document.getElementById('repsControl')?.classList.contains('active'))loadManagerLocations()},20000)}document.addEventListener('click',e=>{if(e.target.closest('.nav[data-page="repsControl"]'))setTimeout(()=>{ensureManagerPanel();loadManagerLocations()},120)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));else setTimeout(boot,700);
window.jmsRepLiveLocation={version:VERSION,refresh:loadManagerLocations,start:startRepTracking};
})();