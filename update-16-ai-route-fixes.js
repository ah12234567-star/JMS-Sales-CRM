/* JMS UPDATE 16: AI representative debt scope + route field discovery */
(function(){
  'use strict';
  const VERSION='2026-08-23-update-16-ai-route-fixes';

  function getDb(){try{return (typeof db!=='undefined'?db:window.db)||{};}catch(_){return window.db||{};}}
  function getUser(){try{return window.currentUser || (typeof currentUser!=='undefined'?currentUser:null);}catch(_){return window.currentUser||null;}}
  function saveNow(){try{if(typeof save==='function')save();else window.save?.();}catch(e){console.error('JMS update16 save failed',e);}}
  function uuid(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now()+Math.random());}
  function clean(v){return String(v??'').trim();}
  function num(v){const n=Number(String(v??0).replace(/,/g,'').replace(/[ ريالSAR\s]/gi,'').replace(/[^\d.-]/g,''));return Number.isFinite(n)?n:0;}
  function money(v){return Number(v||0).toLocaleString('ar-SA',{maximumFractionDigits:2});}
  function today(){return new Date().toISOString().slice(0,10);}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(v){return clean(v).toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'').replace(/\b(شركة|شركه|مؤسسة|موسسه|مؤسسه|مطاعم|مطعم|محلات|محل|فرع|للتجارة|للتجاره|التجارة|التجاره|مركز|عملاء|عميل|ديون|دين|مديونية|مديونيات|ابحث|اعرض|هات|كم|حق|حقت)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,'').trim();}
  function normalizePhone(v){let p=String(v??'').trim();if(/e\+?/i.test(p)){const n=Number(p);if(!isNaN(n))p=String(Math.trunc(n));}p=p.replace(/\D/g,'');if(!p)return'';if(p.startsWith('00966'))p=p.slice(2);if(p.startsWith('966'))return p;if(p.startsWith('05')&&p.length===10)return'966'+p.slice(1);if(p.startsWith('5')&&p.length===9)return'966'+p;return p;}

  function reps(){const s=getDb();const out=[...(s.reps||[])];(s.users||[]).filter(u=>u.role==='rep').forEach(u=>{if(!out.some(r=>String(r.id)===String(u.id)))out.push({id:u.id,name:u.name,email:u.email,role:'rep'});});return out;}
  function repName(id){const r=reps().find(x=>String(x.id)===String(id));return r?.name || id || 'بدون مندوب';}
  function findRepFromText(text){
    const raw=clean(text), n=norm(raw);
    if(/ياسر|yaser|yasser/i.test(raw))return 'rep-yaser';
    if(/عثمان|osman|othman/i.test(raw))return 'rep-osman';
    const all=reps();
    let hit=all.find(r=>norm(r.name)&& (n.includes(norm(r.name))||norm(r.name).includes(n)));
    if(hit)return hit.id;
    hit=all.find(r=>clean(r.email)&&raw.toLowerCase().includes(String(r.email).toLowerCase()));
    if(hit)return hit.id;
    return '';
  }
  function isDebtQuestion(text){return /(دين|ديون|مديونية|مديونيات|تحصيل|متأخر|مبالغ)/.test(clean(text));}
  function wantsAll(text){return /(كل الديون|جميع الديون|كل المديونيات|جميع المديونيات)/.test(clean(text));}
  function scopedCustomersForQuestion(text){
    const s=getDb(), u=getUser();
    let target='';
    if(u?.role==='rep') target=u.id;
    else if(!wantsAll(text)) target=findRepFromText(text);
    let customers=(s.customers||[]).slice();
    if(target) customers=customers.filter(c=>String(c.rep_id||'')===String(target));
    return {customers,target};
  }
  function buildDebtAnswer(text){
    const {customers,target}=scopedCustomersForQuestion(text);
    const debtors=customers.filter(c=>num(c.debt_balance)>0).sort((a,b)=>num(b.debt_balance)-num(a.debt_balance));
    const total=debtors.reduce((sum,c)=>sum+num(c.debt_balance),0);
    const title=target?`ديون عملاء ${repName(target)}`:'كل ديون العملاء';
    if(!debtors.length){
      return `<div class="jms-ai-scope-card"><h3>${esc(title)}</h3><p>لا توجد مديونيات مسجلة ضمن هذا النطاق.</p><small>تم تطبيق فلتر المندوب قبل التحليل حتى لا تختلط بيانات ياسر وعثمان.</small></div>`;
    }
    const rows=debtors.slice(0,15).map((c,i)=>`<tr><td>${i+1}</td><td>${esc(c.name)}</td><td>${esc(repName(c.rep_id))}</td><td>${esc(c.phone||'-')}</td><td><b>${money(c.debt_balance)}</b></td></tr>`).join('');
    return `<div class="jms-ai-scope-card"><h3>${esc(title)}</h3><div class="jms-ai-scope-kpis"><span>عدد العملاء: <b>${debtors.length}</b></span><span>الإجمالي: <b>${money(total)} ريال</b></span></div><div class="jms-ai-scope-table"><table><thead><tr><th>#</th><th>العميل</th><th>المندوب</th><th>الجوال</th><th>المديونية</th></tr></thead><tbody>${rows}</tbody></table></div>${debtors.length>15?`<small>تم عرض أعلى 15 عميل من أصل ${debtors.length}.</small>`:''}<small>تم تطبيق فلتر المندوب قبل التحليل حتى لا تختلط بيانات ياسر وعثمان.</small></div>`;
  }
  function pushAiMessage(html){
    const bodies=['jmsAiBody','repAiBody','repAiMessages','aiChatBody','aiBody'].map(id=>document.getElementById(id)).filter(Boolean);
    const body=bodies[0];
    if(!body){alert(html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());return;}
    const div=document.createElement('div');
    div.className='jms-ai-msg bot jms-update16-ai-answer';
    div.innerHTML=html;
    body.appendChild(div);
    body.scrollTop=body.scrollHeight;
  }
  function installAiPatch(){
    if(typeof window.askJmsAI==='function' && !window.askJmsAI.__jmsUpdate16Scoped){
      const original=window.askJmsAI;
      const wrapped=function(q){
        const text=clean(q ?? document.getElementById('jmsAiInput')?.value ?? '');
        if(isDebtQuestion(text) && (findRepFromText(text) || getUser()?.role==='rep' || wantsAll(text))){
          pushAiMessage(buildDebtAnswer(text));
          const input=document.getElementById('jmsAiInput'); if(input&&input.value===text)input.value='';
          return true;
        }
        return original.apply(this,arguments);
      };
      wrapped.__jmsUpdate16Scoped=true;
      wrapped.__jmsOriginal=original;
      window.askJmsAI=wrapped;
    }
    if(typeof window.askRepAI==='function' && !window.askRepAI.__jmsUpdate16Scoped){
      const original=window.askRepAI;
      const wrapped=function(q){
        const text=clean(q ?? document.getElementById('repAiInput')?.value ?? '');
        if(isDebtQuestion(text)){
          pushAiMessage(buildDebtAnswer(text));
          const input=document.getElementById('repAiInput'); if(input&&input.value===text)input.value='';
          return true;
        }
        return original.apply(this,arguments);
      };
      wrapped.__jmsUpdate16Scoped=true;
      wrapped.__jmsOriginal=original;
      window.askRepAI=wrapped;
    }
  }

  function currentOpenVisits(){
    const s=getDb(), u=getUser();
    return (s.visits||[]).filter(v=>String(v.rep_id||v.repId||'')===String(u?.id||'') && ['open','قيد الزيارة','started','in_progress'].includes(String(v.status||'open')));
  }
  function activeRouteId(){
    const s=getDb(), u=getUser();
    const row=(s.routes||[]).filter(r=>String(r.rep_id||r.repId||'')===String(u?.id||'') && String(r.date||r.created_at||'').slice(0,10)===today()).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0];
    return row?.id || '';
  }
  function duplicateCustomer(name,phone,city){
    const s=getDb(), p=normalizePhone(phone), n=norm(name);
    if(p){const hit=(s.customers||[]).find(c=>normalizePhone(c.phone)===p);if(hit)return hit;}
    if(n){const hit=(s.customers||[]).find(c=>norm(c.name)===n && (!city || !c.city || clean(c.city)===clean(city)));if(hit)return hit;}
    return null;
  }
  function repSelectHtml(){
    const u=getUser();
    if(u?.role==='rep') return '';
    const options=reps().map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    return `<label>المندوب<select id="fieldLeadRep"><option value="">اختر المندوب</option>${options}</select></label>`;
  }
  function getQuickLeadData(){
    const u=getUser();
    return {
      name:clean(document.getElementById('fieldLeadName')?.value),
      phone:normalizePhone(document.getElementById('fieldLeadPhone')?.value),
      city:clean(document.getElementById('fieldLeadCity')?.value)||'جدة',
      district:clean(document.getElementById('fieldLeadDistrict')?.value),
      category:clean(document.getElementById('fieldLeadCategory')?.value)||'فرصة من الطريق',
      notes:clean(document.getElementById('fieldLeadNotes')?.value),
      lat:clean(document.getElementById('fieldLeadLat')?.value),
      lng:clean(document.getElementById('fieldLeadLng')?.value),
      rep_id:u?.role==='rep'?u.id:clean(document.getElementById('fieldLeadRep')?.value)
    };
  }
  window.jmsCaptureFieldLeadLocation=function(){
    const status=document.getElementById('fieldLeadLocationStatus');
    if(!navigator.geolocation){if(status)status.textContent='المتصفح لا يدعم تحديد الموقع';return;}
    if(status)status.textContent='جاري تحديد الموقع...';
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat=pos.coords.latitude.toFixed(6),lng=pos.coords.longitude.toFixed(6);
      const latInput=document.getElementById('fieldLeadLat'),lngInput=document.getElementById('fieldLeadLng');
      if(latInput)latInput.value=lat;if(lngInput)lngInput.value=lng;
      if(status)status.textContent='تم حفظ الموقع الحالي';
    },err=>{if(status)status.textContent='تعذر أخذ الموقع، فعّل صلاحية الموقع أو أدخله يدويًا';console.warn(err);},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  };
  function addFieldLead(startVisit){
    const s=getDb(), u=getUser(), data=getQuickLeadData();
    if(!data.name)return alert('اكتب اسم العميل أو المحل');
    if(!data.rep_id)return alert('اختر المندوب');
    const dup=duplicateCustomer(data.name,data.phone,data.city);
    if(dup)return alert('هذا العميل موجود مسبقًا باسم: '+dup.name+'\nلن يتم إنشاء عميل مكرر.');
    s.customers ||= [];
    s.route_opportunities ||= [];
    const c={
      id:uuid(),name:data.name,phone:data.phone,city:data.city,district:data.district,location:data.lat&&data.lng?`${data.lat},${data.lng}`:'',lat:data.lat,lng:data.lng,category:data.category,status:'active',rep_id:data.rep_id,debt_balance:0,credit_limit:0,notes:data.notes,lead_source:'فرصة من الطريق',source:'route_field_discovery',created_during_route:true,route_id:activeRouteId(),created_at:new Date().toISOString(),created_by:u?.id||''
    };
    s.customers.push(c);
    s.route_opportunities.push({id:uuid(),customer_id:c.id,rep_id:data.rep_id,route_id:c.route_id,source:'field_discovery',notes:data.notes,lat:data.lat,lng:data.lng,created_at:new Date().toISOString(),open_visits_count:currentOpenVisits().length});
    if(startVisit){
      s.visits ||= [];
      s.visits.push({id:uuid(),customer_id:c.id,rep_id:data.rep_id,date:today(),started_at:new Date().toISOString(),status:'open',visit_type:'زيارة سريعة من الطريق',source:'route_field_discovery',notes:'زيارة سريعة لفرصة من الطريق - لا تغلق الزيارة الأساسية',lat:data.lat,lng:data.lng});
    }
    saveNow();
    try{if(typeof renderAll==='function')renderAll(); if(typeof renderCustomers==='function')renderCustomers(); if(typeof renderRoutes==='function')renderRoutes();}catch(e){console.warn(e);}
    if(typeof closeModal==='function')closeModal();else document.getElementById('modal')?.classList.add('hidden');
    alert(startVisit?'تمت إضافة العميل وبدء زيارة سريعة بدون إغلاق الزيارة الأولى':'تمت إضافة فرصة من الطريق بدون إغلاق الزيارة الحالية');
  }
  window.jmsSaveFieldLeadOnly=function(){addFieldLead(false);};
  window.jmsSaveFieldLeadAndVisit=function(){addFieldLead(true);};
  window.openRouteFieldLead=function(){
    const modal=document.getElementById('modal'),body=document.getElementById('modalBody');
    if(!body||!modal)return alert('تعذر فتح النموذج');
    const openCount=currentOpenVisits().length;
    body.innerHTML=`<div class="jms-field-lead-form"><h2>إضافة فرصة من الطريق</h2><p class="muted">أضف مطعم أو محل شفته وأنت في المسار. النظام لا يقفل زيارتك الحالية ولا يلغي المسار.</p>${openCount?`<div class="jms-open-visit-note">لديك ${openCount} زيارة مفتوحة. الإضافة الجديدة لن تغلقها.</div>`:''}<div class="form-grid two"><label>اسم العميل / المحل<input id="fieldLeadName" placeholder="مثال: مطعم فلة"></label><label>رقم الجوال<input id="fieldLeadPhone" inputmode="tel" placeholder="05xxxxxxxx"></label><label>المدينة<input id="fieldLeadCity" value="جدة"></label><label>الحي / المنطقة<input id="fieldLeadDistrict" placeholder="شاطئ النخيل"></label><label>النشاط<select id="fieldLeadCategory"><option>مطعم</option><option>كافيه</option><option>مصنع</option><option>محل تجاري</option><option>فرصة من الطريق</option></select></label>${repSelectHtml()}<label class="full">ملاحظة<input id="fieldLeadNotes" placeholder="شافه المندوب أثناء المسار / يحتاج زيارة لاحقة"></label><label>خط العرض<input id="fieldLeadLat" placeholder="اختياري"></label><label>خط الطول<input id="fieldLeadLng" placeholder="اختياري"></label></div><div class="jms-route-discovery-actions"><button type="button" class="secondary" onclick="jmsCaptureFieldLeadLocation()">📍 أخذ موقعي الحالي</button><span id="fieldLeadLocationStatus"></span></div><div class="jms-route-discovery-actions"><button type="button" class="primary" onclick="jmsSaveFieldLeadOnly()">حفظ كفرصة فقط</button><button type="button" class="primary secondary" onclick="jmsSaveFieldLeadAndVisit()">حفظ وبدء زيارة سريعة</button></div></div>`;
    modal.classList.remove('hidden');
  };

  function injectRouteButton(){
    const u=getUser();
    if(!u || !['rep','admin','sales'].includes(u.role))return;
    const page=document.getElementById('routes');
    if(!page || document.getElementById('jmsRouteFieldDiscoveryBtn'))return;
    const head=page.querySelector('.page-head'); if(!head)return;
    let actions=head.querySelector('.head-actions');
    if(!actions){actions=document.createElement('div');actions.className='head-actions';head.appendChild(actions);}
    const btn=document.createElement('button');
    btn.id='jmsRouteFieldDiscoveryBtn';
    btn.type='button';
    btn.className='primary small jms-route-discovery-btn';
    btn.textContent='+ فرصة من الطريق';
    btn.onclick=window.openRouteFieldLead;
    actions.appendChild(btn);
  }
  function injectStyles(){
    if(document.getElementById('jmsUpdate16Styles'))return;
    const st=document.createElement('style');
    st.id='jmsUpdate16Styles';
    st.textContent=`.jms-ai-scope-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;color:#0f172a;line-height:1.8}.jms-ai-scope-card h3{margin:0 0 8px;font-size:17px}.jms-ai-scope-kpis{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.jms-ai-scope-kpis span{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:7px 10px}.jms-ai-scope-table{overflow:auto;max-height:360px}.jms-ai-scope-table table{width:100%;border-collapse:collapse}.jms-ai-scope-table th,.jms-ai-scope-table td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;white-space:nowrap}.jms-open-visit-note{background:#ecfeff;border:1px solid #67e8f9;color:#155e75;padding:10px;border-radius:12px;margin:10px 0;font-weight:800}.jms-route-discovery-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.jms-route-discovery-actions span{font-size:12px;color:#64748b}.form-grid .full{grid-column:1/-1}@media(max-width:700px){.jms-ai-scope-table table{font-size:12px}.jms-route-discovery-actions button{width:100%}}`;
    document.head.appendChild(st);
  }
  function tick(){injectStyles();installAiPatch();injectRouteButton();}
  window.addEventListener('load',()=>setTimeout(tick,900));
  setInterval(tick,1800);
})();
