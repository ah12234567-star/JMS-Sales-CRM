(function(){
  'use strict';
  const VERSION='2026-08-14-smart-suite-1';
  const DAY=86400000;
  const DEFAULT_COSTS={HDPE:4.60,LDPE:4.90,LLDPE:4.75,PP:4.80,MIX:4.75,calcium:1.20,production:0.65,printFace:0.22,waste:4,margin:18};

  function data(){try{return db}catch(_){return window.db||{}}}
  function user(){try{return currentUser}catch(_){return window.currentUser||null}}
  function persist(){try{if(typeof save==='function')save();else window.save?.()}catch(error){console.error('JMS smart suite save',error)}}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function localDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?null:new Date(date.getFullYear(),date.getMonth(),date.getDate())}
  function isoDate(date){return date.toISOString().slice(0,10)}
  function customer(id){return (data().customers||[]).find(item=>String(item.id)===String(id))}
  function allowedCustomer(item){return user()?.role!=='rep'||String(item.rep_id)===String(user()?.id)}
  function money(value){return Number(value||0).toLocaleString('ar-SA',{maximumFractionDigits:2})}
  function median(values){const sorted=values.slice().sort((a,b)=>a-b);const mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2}
  function quoteDate(item){return localDate(item.manager_approved_at||item.customer_approved_at||item.date||item.created_at)}
  function completedSales(){
    const rows=[];
    (data().orders||[]).forEach(item=>{const date=localDate(item.converted_at||item.date||item.created_at);if(date&&item.customer_id)rows.push({customer_id:item.customer_id,date,source:item.source_quote_id||item.id,kind:'order'})});
    (data().quotes||[]).forEach(item=>{if(!['accepted','manager_approved'].includes(item.status)&&item.manager_review_status!=='approved')return;const date=quoteDate(item);if(date&&item.customer_id)rows.push({customer_id:item.customer_id,date,source:item.id,kind:'quote'})});
    const seen=new Set();return rows.filter(item=>{const key=item.customer_id+'|'+isoDate(item.date)+'|'+item.source;if(seen.has(key))return false;seen.add(key);return true});
  }
  function predictions(){
    const today=localDate(new Date());const byCustomer={};
    completedSales().forEach(row=>(byCustomer[row.customer_id]||=[]).push(row));
    return Object.entries(byCustomer).map(([customerId,rows])=>{
      const client=customer(customerId);if(!client||!allowedCustomer(client))return null;
      rows.sort((a,b)=>a.date-b.date);const unique=[];rows.forEach(row=>{if(!unique.some(old=>Math.abs(old.date-row.date)<DAY))unique.push(row)});
      if(!unique.length)return null;
      const gaps=[];for(let i=1;i<unique.length;i++){const gap=Math.round((unique[i].date-unique[i-1].date)/DAY);if(gap>=7&&gap<=365)gaps.push(gap)}
      const cycle=gaps.length?Math.round(median(gaps)):Number(client.reorder_cycle_days||30);
      const last=unique[unique.length-1].date;const expected=new Date(last.getTime()+cycle*DAY);const days=Math.ceil((expected-today)/DAY);
      return {customer:client,last,expected,days,cycle,orders:unique.length,confidence:gaps.length>=2?'عالية':gaps.length===1?'متوسطة':'مبدئية'};
    }).filter(Boolean).filter(item=>item.days<=7&&item.days>=-30).sort((a,b)=>a.days-b.days);
  }
  function latestQuote(customerId){return (data().quotes||[]).filter(item=>String(item.customer_id)===String(customerId)).sort((a,b)=>String(b.created_at||b.date).localeCompare(String(a.created_at||a.date)))[0]}
  function setValue(id,value){const input=document.getElementById(id);if(!input||value===undefined||value===null)return;input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new Event('input',{bubbles:true}))}
  window.jmsRepeatLastQuote=function(customerId){
    const quote=latestQuote(customerId);if(!quote)return alert('لا يوجد عرض سابق لهذا العميل');
    if(typeof window.openQuoteForm!=='function')return alert('تعذر فتح نموذج عرض السعر');
    window.openQuoteForm();
    setTimeout(()=>{
      setValue('mqCustomer',customerId);setValue('mqRep',quote.rep_id);setValue('mqProduct',quote.product);setValue('mqMaterial',quote.material);setValue('mqColor',quote.color);setValue('mqPrint',quote.print);
      setValue('mqWidth',quote.width);setValue('mqLength',quote.length);setValue('mqSizeUnit',quote.size_unit);setValue('mqThickness',quote.thickness);setValue('mqThicknessUnit',quote.thickness_unit);
      setValue('mqKg',quote.total_kg);setValue('mqPriceKg',quote.price_kg);setValue('mqPayment',quote.payment_terms);setValue('mqDelivery',quote.delivery_terms);
      setValue('mqNotes','عرض مكرر من '+(quote.quote_no||'العرض السابق')+' — يرجى مراجعة السعر وتاريخ التسليم قبل الحفظ');
      if(Array.isArray(quote.items)&&quote.items.length&&window.JMS_QUOTE_DRAFT_ITEMS!==undefined)window.JMS_QUOTE_DRAFT_ITEMS=JSON.parse(JSON.stringify(quote.items));
      injectPricingAssistant();
    },220);
  };
  function reorderHtml(limit){
    const list=predictions().slice(0,limit||8);if(!list.length)return '<div class="jms-empty-smart">لا توجد طلبات متوقعة خلال الأيام السبعة القادمة</div>';
    return list.map(item=>'<article class="jms-reorder-card '+(item.days<0?'overdue':'')+'"><div><span>↻ إعادة طلب متوقعة</span><h3>'+esc(item.customer.name)+'</h3><p>'+(item.days<0?'متأخر عن الموعد المتوقع '+Math.abs(item.days)+' يوم':item.days===0?'الموعد المتوقع اليوم':'متبقي '+item.days+' أيام')+' · دورة '+item.cycle+' يوم · ثقة '+item.confidence+'</p></div><button type="button" onclick="jmsRepeatLastQuote(\''+esc(item.customer.id)+'\')">تكرار العرض بنفس المواصفات</button></article>').join('');
  }
  function renderReorderWidgets(){
    const dashboard=document.getElementById(user()?.role==='rep'?'repHome':'dashboard');if(!dashboard)return;
    let section=dashboard.querySelector('#jmsReorderPredictor');if(!section){section=document.createElement('section');section.id='jmsReorderPredictor';section.className='panel jms-smart-section';const anchor=dashboard.querySelector('.page-head,.rep-command-kpis');anchor?.insertAdjacentElement('afterend',section)}
    section.innerHTML='<div class="jms-smart-head"><div><small>تحليل دورات الشراء</small><h2>التنبيه الذكي لإعادة الطلب</h2></div><b>'+predictions().length+'</b></div><div class="jms-reorder-list">'+reorderHtml(6)+'</div>';
  }

  function settings(){const store=data();store.businessSettings=store.businessSettings||{};store.businessSettings.materialCosts={...DEFAULT_COSTS,...(store.businessSettings.materialCosts||{})};return store.businessSettings.materialCosts}
  function priceCalculation(){
    const material=document.getElementById('mqMaterial')?.value||'HDPE',costs=settings();const raw=Number(costs[material]||costs.MIX);
    const calcium=Math.max(0,Math.min(40,Number(document.getElementById('jmsCalciumPct')?.value||0)));const waste=Math.max(0,Number(document.getElementById('jmsWastePct')?.value||costs.waste));const margin=Math.max(0,Number(document.getElementById('jmsMarginPct')?.value||costs.margin));
    const print=document.getElementById('mqPrint')?.value||'';const faces=/وجهين/.test(print)?2:/وجه واحد/.test(print)?1:0;
    const materialCost=raw*(1-calcium/100)+Number(costs.calcium)*calcium/100;const direct=materialCost*(1+waste/100)+Number(costs.production)+faces*Number(costs.printFace);const suggested=direct/(1-margin/100);
    return {material,raw,materialCost,direct,suggested:Number.isFinite(suggested)?suggested:direct,calcium,waste,margin,faces};
  }
  window.jmsCalculateSmartPrice=function(apply){
    const result=priceCalculation();const box=document.getElementById('jmsPriceResult');if(box)box.innerHTML='<div><small>تكلفة الكيلو المتوقعة</small><b>'+money(result.direct)+' ر.س</b></div><div><small>السعر المقترح</small><b>'+money(result.suggested)+' ر.س</b></div><p>خامة '+esc(result.material)+' · هدر '+result.waste+'% · هامش '+result.margin+'% · طباعة '+result.faces+' وجه</p>';
    if(apply){setValue('mqPriceKg',result.suggested.toFixed(2));document.getElementById('mqPriceKg')?.focus()}
  };
  window.jmsOpenMaterialCosts=function(){
    if(!['admin','sales'].includes(user()?.role))return alert('تعديل أسعار الخام متاح للإدارة فقط');const values=settings();
    const body=document.getElementById('modalBody'),modal=document.getElementById('modal');if(!body||!modal)return;
    body.innerHTML='<div class="jms-cost-editor"><h2>أسعار وتكاليف التسعير</h2><p>حدّثها عند تغير أسعار المواد؛ المساعد يستخدمها لاقتراح السعر.</p><div class="form-grid three">'+['HDPE','LDPE','LLDPE','PP','MIX'].map(key=>'<label>'+key+' — ريال/كجم<input id="cost_'+key+'" type="number" step="0.01" value="'+values[key]+'"></label>').join('')+'<label>كربونات الكالسيوم<input id="cost_calcium" type="number" step="0.01" value="'+values.calcium+'"></label><label>تكلفة التشغيل/كجم<input id="cost_production" type="number" step="0.01" value="'+values.production+'"></label><label>تكلفة وجه الطباعة/كجم<input id="cost_printFace" type="number" step="0.01" value="'+values.printFace+'"></label><label>الهدر الافتراضي %<input id="cost_waste" type="number" step="0.1" value="'+values.waste+'"></label><label>هامش الربح الافتراضي %<input id="cost_margin" type="number" step="0.1" value="'+values.margin+'"></label></div><button class="primary" type="button" onclick="jmsSaveMaterialCosts()">حفظ الأسعار</button></div>';modal.classList.remove('hidden');
  };
  window.jmsSaveMaterialCosts=function(){const values=settings();Object.keys(DEFAULT_COSTS).forEach(key=>{const input=document.getElementById('cost_'+key);if(input)values[key]=Number(input.value||DEFAULT_COSTS[key])});persist();window.closeModal?.();alert('تم حفظ أسعار الخام والتكاليف')};
  function injectPricingAssistant(){
    const root=document.getElementById('modalBody');if(!root||!document.getElementById('mqPriceKg')||document.getElementById('jmsSmartPricing'))return;
    const panel=document.createElement('section');panel.id='jmsSmartPricing';panel.className='jms-pricing-assistant';panel.innerHTML='<div class="jms-smart-head"><div><small>حساب التكلفة والربحية</small><h3>مساعد التسعير الذكي</h3></div><button type="button" onclick="jmsOpenMaterialCosts()">⚙ أسعار الخام</button></div><div class="jms-price-inputs"><label>نسبة الكالسيوم %<input id="jmsCalciumPct" type="number" min="0" max="40" value="0"></label><label>نسبة الهدر %<input id="jmsWastePct" type="number" min="0" value="'+settings().waste+'"></label><label>هامش الربح %<input id="jmsMarginPct" type="number" min="0" max="80" value="'+settings().margin+'"></label></div><div id="jmsPriceResult" class="jms-price-result"></div><button class="jms-apply-price" type="button" onclick="jmsCalculateSmartPrice(true)">احتساب وتطبيق السعر المقترح</button>';
    document.getElementById('mqPriceKg').closest('label')?.parentElement?.insertAdjacentElement('afterend',panel);panel.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>window.jmsCalculateSmartPrice(false)));document.getElementById('mqMaterial')?.addEventListener('change',()=>window.jmsCalculateSmartPrice(false));document.getElementById('mqPrint')?.addEventListener('change',()=>window.jmsCalculateSmartPrice(false));window.jmsCalculateSmartPrice(false);
  }

  function coordinates(item){
    const lat=Number(item.latitude??item.lat??item.location_lat),lng=Number(item.longitude??item.lng??item.location_lng);if(Number.isFinite(lat)&&Number.isFinite(lng)&&lat&&lng)return {lat,lng};
    const text=[item.location,item.map_url,item.google_maps].filter(Boolean).join(' ');let match=text.match(/(?:q=|@|query=)(-?\d{1,2}\.\d+)[,%20\s]+(-?\d{1,3}\.\d+)/);if(!match)match=text.match(/(-?\d{1,2}\.\d+)\s*[,،]\s*(-?\d{1,3}\.\d+)/);return match?{lat:Number(match[1]),lng:Number(match[2])}:null;
  }
  function distance(a,b){const rad=n=>n*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
  function currentPosition(repId){const rows=data().repLocations||data().rep_locations||[];const row=rows.filter(item=>String(item.rep_id||item.id)===String(repId)).sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)))[0];return coordinates(row||{})}
  function optimizedRoute(repId,start){
    const candidates=(data().customers||[]).filter(item=>String(item.rep_id)===String(repId)).map(item=>({customer:item,point:coordinates(item)})).filter(item=>item.point);if(!candidates.length)return [];
    let cursor=start||currentPosition(repId)||candidates[0].point;const result=[],remaining=candidates.slice();
    while(remaining.length){remaining.forEach(item=>{item.km=distance(cursor,item.point);item.score=item.km-(Number(item.customer.debt_balance||0)>0&&item.km<=5?1.5:0)});remaining.sort((a,b)=>a.score-b.score);const next=remaining.shift();result.push(next);cursor=next.point}
    return result;
  }
  function routeUrl(rows){if(!rows.length)return '';const points=rows.slice(0,10).map(item=>item.point.lat+','+item.point.lng);return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(points.pop())+(points.length?'&waypoints='+encodeURIComponent(points.join('|')):'')}
  window.jmsOpenOptimizedRoute=function(repId){
    repId=repId||user()?.id;const rows=optimizedRoute(repId);if(!rows.length)return alert('لا توجد إحداثيات محفوظة لعملاء هذا المندوب. احفظ موقع كل عميل أولاً.');
    const body=document.getElementById('modalBody'),modal=document.getElementById('modal');if(!body||!modal)return;
    body.innerHTML='<div class="jms-route-planner"><div class="jms-smart-head"><div><small>الأقرب فالأقرب مع أولوية التحصيل القريب</small><h2>مسار الزيارات الذكي</h2></div><b>'+rows.length+'</b></div><div class="jms-route-list">'+rows.slice(0,20).map((row,index)=>'<article><i>'+(index+1)+'</i><div><b>'+esc(row.customer.name)+'</b><span>'+money(row.km)+' كم'+(Number(row.customer.debt_balance||0)>0?' · تحصيل '+money(row.customer.debt_balance)+' ريال':'')+'</span></div></article>').join('')+'</div><a class="jms-open-maps" href="'+routeUrl(rows)+'" target="_blank" rel="noopener">فتح أول 10 زيارات في خرائط Google</a></div>';modal.classList.remove('hidden');
  };
  window.openRoutesPanel=function(repId){window.jmsOpenOptimizedRoute(repId||user()?.id)};
  function enhanceRoutesPage(){const page=document.getElementById('routes');if(!page||page.querySelector('.jms-smart-route-button'))return;const button=document.createElement('button');button.type='button';button.className='primary small jms-smart-route-button';button.textContent='✦ ترتيب ذكي للمسار';button.onclick=()=>window.jmsOpenOptimizedRoute(user()?.role==='rep'?user().id:(document.querySelector('#routeRep,#repFilter')?.value||data().reps?.[0]?.id));page.querySelector('.page-head')?.appendChild(button)}

  function forcePdfTypography(){
    document.querySelectorAll('.quote-a4,.quote-doc,.jms-public-quote,.quote-public-card').forEach(doc=>{doc.style.fontFamily='Cairo,Tahoma,Arial,sans-serif';doc.style.direction='rtl';doc.setAttribute('dir','rtl')});
  }
  const oldDownload=window.downloadQuotePDF;window.downloadQuotePDF=async function(){if(document.fonts?.ready)await document.fonts.ready;forcePdfTypography();return typeof oldDownload==='function'?oldDownload.apply(this,arguments):undefined};
  const oldShare=window.pdfShare;window.pdfShare=async function(){if(document.fonts?.ready)await document.fonts.ready;forcePdfTypography();return typeof oldShare==='function'?oldShare.apply(this,arguments):undefined};

  function style(){if(document.getElementById('jmsSmartSuiteStyle'))return;const sheet=document.createElement('style');sheet.id='jmsSmartSuiteStyle';sheet.textContent='body,.quote-a4,.quote-doc,.jms-public-quote{font-family:Cairo,Tahoma,Arial,sans-serif}.jms-smart-section{margin:12px 0!important}.jms-smart-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.jms-smart-head small{color:#64748b}.jms-smart-head h2,.jms-smart-head h3{margin:2px 0;color:#0f172a}.jms-smart-head>b{display:grid;place-items:center;min-width:42px;height:42px;border-radius:13px;background:#eff6ff;color:#2563eb}.jms-smart-head button{border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:8px;color:#334155}.jms-reorder-list{display:grid;gap:8px;margin-top:10px}.jms-reorder-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #bfdbfe;border-radius:15px;background:#eff6ff}.jms-reorder-card.overdue{border-color:#fed7aa;background:#fff7ed}.jms-reorder-card span{font-size:10px;color:#2563eb;font-weight:900}.jms-reorder-card h3{margin:3px 0;color:#0f172a;font-size:15px}.jms-reorder-card p{margin:0;color:#64748b;font-size:10px}.jms-reorder-card button,.jms-apply-price,.jms-open-maps{border:0;border-radius:11px;padding:10px 12px;background:#0f172a;color:#fff;font-weight:900;text-decoration:none;text-align:center}.jms-empty-smart{padding:14px;border:1px dashed #cbd5e1;border-radius:13px;color:#64748b;text-align:center}.jms-pricing-assistant{grid-column:1/-1;margin:12px 0;padding:14px;border:1px solid #c4b5fd;border-radius:16px;background:linear-gradient(135deg,#f5f3ff,#fff)}.jms-price-inputs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:11px 0}.jms-price-inputs label{font-size:10px;font-weight:800;color:#475569}.jms-price-inputs input{width:100%;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.jms-price-result{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.jms-price-result>div{padding:10px;border-radius:11px;background:#fff}.jms-price-result small,.jms-price-result b{display:block}.jms-price-result b{margin-top:3px;color:#6d28d9;font-size:18px}.jms-price-result p{grid-column:1/-1;margin:0;color:#64748b;font-size:9px}.jms-apply-price{width:100%;background:#6d28d9}.jms-route-list{display:grid;gap:7px;margin:12px 0}.jms-route-list article{display:grid;grid-template-columns:38px 1fr;align-items:center;gap:9px;padding:9px;border:1px solid #e2e8f0;border-radius:12px}.jms-route-list i{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#eff6ff;color:#2563eb;font-style:normal;font-weight:900}.jms-route-list b,.jms-route-list span{display:block}.jms-route-list span{font-size:10px;color:#64748b}.jms-open-maps{display:block;background:#047857}.quote-a4,.quote-doc{font-family:Cairo,Tahoma,Arial,sans-serif!important;direction:rtl!important}@media(max-width:620px){.jms-reorder-card{align-items:stretch;flex-direction:column}.jms-reorder-card button{width:100%}.jms-price-inputs{grid-template-columns:1fr 1fr}.jms-price-result{grid-template-columns:1fr}.jms-price-result p{grid-column:1}.jms-smart-section{padding:12px!important}}';document.head.appendChild(sheet)}
  function observeModal(){const root=document.getElementById('modalBody');if(!root)return;let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{injectPricingAssistant();forcePdfTypography()},60)}).observe(root,{childList:true,subtree:true})}
  function install(){style();settings();enhanceRoutesPage();renderReorderWidgets();observeModal();forcePdfTypography();const oldRender=window.renderAll;window.renderAll=function(){const result=typeof oldRender==='function'?oldRender.apply(this,arguments):undefined;setTimeout(()=>{renderReorderWidgets();enhanceRoutesPage()},40);return result}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JMS_SMART_BUSINESS_SUITE=VERSION;
})();
