// Pure, read-only CRM query execution. Model output is a plan, never executable code.
export const ACTIONS = ['debts','collections','visits','quotes','customer_summary','attention','daily_plan','rep_activity','order_tracking','quote_draft','general'];
export const norm = v => String(v ?? '').toLowerCase().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}\s.-]/gu,' ').replace(/\s+/g,' ').trim();
const clean = v => String(v ?? '').trim().slice(0,160);
export function number(v) { const s=String(v??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,]/g,'').replace(/٫/g,'.').replace(/\s/g,''); if(!s)return null; const n=Number(s); return Number.isFinite(n)?n:null; }
const money = v => Number(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
const sum = rows => rows.reduce((s,r)=>s+Math.round(r.amount*100),0)/100;
export function saudiDate(now=new Date()) { return new Date(new Date(now).getTime()+10800000).toISOString().slice(0,10); }
export function validDate(v) { if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return '';const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v?v:''; }
const dateOf=r=>String(r.date||r.created_at||r.checkin_at||'').slice(0,10);
const latest=rows=>rows.slice().sort((a,b)=>dateOf(b).localeCompare(dateOf(a)))[0];
export function normalizePlan(raw={}) {
 const p={action:ACTIONS.includes(raw.action)?raw.action:'general',rep:clean(raw.rep),customer:clean(raw.customer),sort:raw.sort==='asc'?'asc':'desc',sortBy:raw.sortBy==='delay'?'delay':'amount',dueOnly:raw.dueOnly===true,groupBy:raw.groupBy==='rep'?'rep':'customer',limit:Math.max(1,Math.min(50,Math.floor(Number(raw.limit)||10))),from:validDate(raw.from),to:validDate(raw.to),status:clean(raw.status),reference:clean(raw.reference),clarification:clean(raw.clarification)};
 p.changes={};
 for(const key of ['total_kg','price_kg','print_colors','width','length','thickness']) {
  if(raw.changes?.[key]!==undefined&&raw.changes[key]!==null){const n=number(raw.changes[key]);if(n!==null&&n>0&&n<=10000000&&(key!=='print_colors'||(Number.isInteger(n)&&n<=8)))p.changes[key]=n;else p.clarification='إحدى الكميات أو المواصفات غير صالحة؛ وضّح القيمة المطلوبة.';}
 }
 for(const key of ['product','material','color','print','payment_terms','delivery_terms','fold_bottom','fold_top','fold_side','handle_type','handle_color'])if(typeof raw.changes?.[key]==='string')p.changes[key]=clean(raw.changes[key]);
 if((raw.from&&!p.from)||(raw.to&&!p.to)||(p.from&&p.to&&p.from>p.to))p.clarification='وضح الفترة المطلوبة بتاريخ بداية ونهاية صحيحين.';
 return p;
}
function distance(a,b) {const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
export function resolveEntity(query,rows) {
 if(!query)return {item:null};
 const q=norm(query),matches=rows.filter(r=>String(r.id)===query||norm(r.name)===q);
 if(matches.length===1)return {item:matches[0]};
 let candidates=matches.length?matches:rows.filter(r=>norm(r.name).split(' ').includes(q)||norm(r.name).includes(q));
 if(!candidates.length&&q.length>=4)candidates=rows.filter(r=>norm(r.name).split(' ').some(w=>w.length>=4&&distance(q,w)<=1));
 return candidates.length===1?{item:candidates[0]}:candidates.length?{question:'وجدت أكثر من اسم: '+candidates.slice(0,6).map(r=>r.name).join('، ')+'؛ اكتب الاسم الكامل.'}:{question:'لم أجد «'+query+'» ضمن البيانات المسموح لك بها. اكتب الاسم الكامل.'};
}
export function scopeData(data,auth) {
 if(!auth||!['admin','sales','rep'].includes(auth.role))throw new Error('unauthorized');
 const out={...data};if(auth.role!=='rep')return out;
 for(const key of ['customers','quotes','orders','visits','collections','fieldRounds','manufacturing','storeOrders'])out[key]=(data[key]||[]).filter(r=>String(r.rep_id||'')===String(auth.id));
 out.reps=(data.reps||[]).filter(r=>String(r.id)===String(auth.id));
 return out;
}
const LABELS={planned:'مخطط',released:'مطلق للإنتاج',on_hold:'موقوف مؤقتًا',waiting:'بانتظار البدء',blocked:'متعطل',mixing:'الخلط',extrusion:'الفيلم',printing:'الطباعة',cutting:'القص',pending:'بانتظار المراجعة',sent:'مرسل للعميل',customer_approved:'معتمد من العميل',manager_approved:'معتمد من الإدارة',accepted:'مقبول',approved:'معتمد',rejected:'مرفوض',cancelled:'ملغي',new:'جديد',picking:'قيد التجهيز',ready:'جاهز',delivered:'تم التسليم',in_progress:'قيد التنفيذ',pending_manager:'بانتظار اعتماد الإدارة',completed:'مكتمل'};
const label=r=>LABELS[r.status||r.stage]||r.status||r.stage||'غير مسجلة';
const openQuote=r=>['pending','sent','customer_approved','pending_manager'].includes(r.status);
const source=(type,row)=>({type,id:String(row.id),label:row.name||row.quote_no||row.order_no||String(row.id)});
function due(c) {
 // Aging buckets are NOT invoice due dates. Never assume that all debt is due.
 for(const key of ['due_balance','due_amount','overdue_amount'])if(c[key]!==undefined&&c[key]!==null&&c[key]!==''){const n=number(c[key]);if(n!==null&&n>=0&&n<=Math.max(0,number(c.debt_balance)||0))return n;}
 return null;
}
export function executePlan(raw,data,auth,now=new Date()) {
 const p=normalizePlan(raw),d=scopeData(data,auth),today=saudiDate(now);
 const result=(answer,extra={})=>({ok:true,mode:'crm_verified',answer,context:p,sources:[],...extra});
 if(p.clarification)return result(p.clarification,{mode:'clarification'});
 const rep=resolveEntity(p.rep,d.reps||[]);if(rep.question)return result(rep.question,{mode:'clarification'});
 const customer=resolveEntity(p.customer,d.customers||[]);if(customer.question)return result(customer.question,{mode:'clarification'});
 const selectedRep=rep.item,selectedCustomer=customer.item;
 if(selectedRep&&selectedCustomer&&String(selectedCustomer.rep_id)!==String(selectedRep.id))return result('العميل المختار غير مرتبط بهذا المندوب. وضّح النطاق المطلوب.',{mode:'clarification'});
 const scoped=(rows,dates=false)=>(rows||[]).filter(r=>(!selectedRep||String(r.rep_id)===String(selectedRep.id))&&(!selectedCustomer||String(r.customer_id||r.id)===String(selectedCustomer.id))&&(!dates||((!p.from||dateOf(r)>=p.from)&&(!p.to||dateOf(r)<=p.to)&&(!(p.from||p.to)||!!dateOf(r)))));
 const customers=scoped(d.customers);
 const clientName=id=>(d.customers||[]).find(c=>String(c.id)===String(id))?.name||'عميل غير محدد';
 const repName=id=>(d.reps||[]).find(r=>String(r.id)===String(id))?.name||'بدون مندوب';
 const scopeTitle=selectedCustomer?selectedCustomer.name:selectedRep?'عملاء '+selectedRep.name:auth.role==='rep'?'عملاؤك':'جميع العملاء';
 const period=(p.from||p.to)?'\nالفترة: '+(p.from||'البداية')+' إلى '+(p.to||today):'';
 if(p.action==='debts') {
  if(p.from||p.to)return result('الأرصدة المتاحة حالية ولا تمثل رصيدًا تاريخيًا. لعرض المديونية خلال فترة نحتاج كشف فواتير وتسويات مؤرخًا؛ أو اسأل عن التحصيل خلال الفترة.',{mode:'clarification'});
  if(p.sortBy==='delay')return result('لا تتوفر تواريخ استحقاق مفصلة تكفي لترتيب جميع العملاء حسب أيام التأخير. أعمار الأرصدة وحدها لا تثبت موعد الاستحقاق.',{mode:'missing_data'});
  let unknown=0,credits=0;let rows=[];
  for(const c of customers){const balance=number(c.debt_balance);if(balance===null){unknown++;continue;}if(balance<0)credits+=Math.round(balance*100);const amount=p.dueOnly?due(c):balance;if(amount===null){if(balance>0)unknown++;continue;}if(amount>0)rows.push({id:c.id,name:c.name||c.id,rep_id:c.rep_id,amount});}
  const total=sum(rows),count=rows.length;
  const sources=rows.map(r=>source('customer',r));
  if(p.groupBy==='rep'){const m=new Map();for(const r of rows){const id=r.rep_id||'';const item=m.get(id)||{id,name:repName(id),amount:0};item.amount+=Math.round(r.amount*100);m.set(id,item);}rows=[...m.values()].map(r=>({...r,amount:r.amount/100}));}
  rows.sort((a,b)=>(p.sort==='asc'?1:-1)*(a.amount-b.amount)||String(a.name).localeCompare(String(b.name)));
  const shown=rows.slice(0,p.limit);
  let answer=(p.dueOnly?'المديونية المستحقة المسجلة':'المديونية الحالية')+' — '+scopeTitle+'\n'+(unknown?'إجمالي البيانات المتوفرة فقط: ':'الإجمالي: ')+money(total)+' ريال · '+count+' عميل مدين.\n'+(p.sort==='asc'?'الترتيب من الأقل إلى الأعلى':'الترتيب من الأعلى إلى الأقل')+'\n'+shown.map((r,i)=>(i+1)+'. '+r.name+': '+money(r.amount)+' ريال').join('\n');
  if(!shown.length)answer+='\nلا توجد مبالغ موجبة مؤكدة ضمن هذا النطاق.';
  if(rows.length>shown.length)answer+='\nالمعروض '+shown.length+' من '+rows.length+'؛ الإجمالي يشمل جميع النتائج.';
  if(unknown)answer+='\nبيانات '+unknown+' عميل غير مكتملة'+(p.dueOnly?' لتحديد المستحق؛ يلزم مبلغ مستحق موثّق أو فواتير بمواعيد استحقاق وتسويات.':'؛ لم أعتبرها صفرًا.') ;
  if(!p.dueOnly&&credits)answer+='\nأرصدة دائنة منفصلة: '+money(-credits/100)+' ريال؛ صافي الأرصدة المعروفة: '+money(total+credits/100)+' ريال.';
  return result(answer,{sources:p.groupBy==='rep'?sources.slice(0,50):shown.map(r=>source('customer',r)),metrics:{total,count,unknown,creditBalance:-credits/100}});
 }
 if(p.action==='collections'||p.action==='visits') {
  const rows=scoped(d[p.action],true);const missingDate=(p.from||p.to)?scoped(d[p.action]).filter(r=>!dateOf(r)).length:0;
  const values=rows.map(r=>({...r,amount:p.action==='visits'?1:number(r.amount)}));const missing=values.filter(r=>r.amount===null).length;const valid=values.filter(r=>r.amount!==null);
  const grouped=new Map();for(const r of valid){const id=p.groupBy==='rep'?r.rep_id:r.customer_id;const item=grouped.get(id)||{name:p.groupBy==='rep'?repName(id):clientName(id),amount:0};item.amount+=Math.round(r.amount*100);grouped.set(id,item);}
  const out=[...grouped.values()].map(r=>({...r,amount:r.amount/100})).sort((a,b)=>(p.sort==='asc'?1:-1)*(a.amount-b.amount));
  return result((p.action==='visits'?'الزيارات المسجلة':'التحصيل المسجل')+' — '+scopeTitle+period+'\nالإجمالي: '+money(sum(valid))+(p.action==='visits'?' زيارة':' ريال')+'\n'+out.slice(0,p.limit).map((r,i)=>(i+1)+'. '+r.name+': '+money(r.amount)).join('\n')+((missing||missingDate)?'\nسجلات مستبعدة لنقص المبلغ: '+missing+'؛ لنقص التاريخ: '+missingDate:''));
 }
 if(p.action==='quotes') {
  const rows=scoped(d.quotes,true).filter(r=>!p.status||(p.status==='open'?openQuote(r):r.status===p.status)).sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));
  return result('عروض الأسعار — '+scopeTitle+period+'\nعدد النتائج: '+rows.length+'\n'+rows.slice(0,p.limit).map((r,i)=>(i+1)+'. '+(r.quote_no||r.id)+' — '+clientName(r.customer_id)+' — '+label(r)+' — '+dateOf(r)).join('\n'),{sources:rows.slice(0,p.limit).map(r=>source('quote',r))});
 }
 if(p.action==='customer_summary') {
  if(!selectedCustomer)return result('اكتب اسم العميل الذي تريد مراجعة ملفه.',{mode:'clarification'});
  const c=selectedCustomer,q=latest(scoped(d.quotes)),v=latest(scoped(d.visits)),pay=latest(scoped(d.collections)),balance=number(c.debt_balance);
  return result(c.name+'\nالمندوب: '+repName(c.rep_id)+'\nالرصيد الحالي: '+(balance===null?'غير مسجل':money(balance)+' ريال')+'\nالمستحق: '+(due(c)===null?'غير موثّق':money(due(c))+' ريال')+'\nآخر زيارة: '+(v?dateOf(v)+' — '+(v.result||v.notes||'بدون نتيجة مسجلة'):'لا توجد')+'\nآخر عرض: '+(q?(q.quote_no||q.id)+' — '+label(q):'لا يوجد')+'\nآخر سداد: '+(pay?dateOf(pay)+' — '+(number(pay.amount)===null?'مبلغ غير مسجل':money(number(pay.amount))+' ريال'):'لا يوجد')+'\nالمتابعة المقترحة: '+(q&&openQuote(q)?'متابعة العرض '+(q.quote_no||q.id)+' لأنه ما زال '+label(q):!v?'تسجيل أول زيارة أو اتصال بالعميل.':'مراجعة نتيجة آخر زيارة قبل التواصل.'),{sources:[source('customer',c),...(q?[source('quote',q)]:[])]});
 }
 if(p.action==='daily_plan') {
  if(p.from&&p.from!==today||p.to&&p.to!==today)return result('خطة اليوم تعتمد على الأرصدة والحالات الحالية. اطلب «خطة يومي» بدون فترة تاريخية.',{mode:'clarification'});
  const visits=scoped(d.visits),quotes=scoped(d.quotes),tasks=[];
  let unknownDue=0,unknownVisitDates=0;
  for(const c of customers){
   const id=String(c.id),reasons=[],steps=[];let priority=0;
   const amount=due(c);if(amount===null&&number(c.debt_balance)>0)unknownDue++;
   if(amount>0){priority=3;reasons.push('مستحق موثّق: '+money(amount)+' ريال');steps.push('راجع السداد مع العميل');}
   const pending=quotes.filter(q=>String(q.customer_id)===id&&openQuote(q));
   if(pending.length){priority=Math.max(priority,2);reasons.push(pending.length+' عرض يحتاج متابعة');steps.push(pending.some(q=>['customer_approved','pending_manager'].includes(q.status))?'راجع اعتماد الإدارة للعروض الموافق عليها':'تابع رد العميل على العرض');}
   const history=visits.filter(v=>String(v.customer_id)===id&&v.record_type!=='field_round'&&!['planned','cancelled','not_visited'].includes(v.status));
   const dated=history.map(v=>validDate(dateOf(v))).filter(day=>day&&day<=today).sort();
   const last=dated.at(-1),hasUnknown=history.some(v=>!validDate(dateOf(v))||dateOf(v)>today);
   if(hasUnknown)unknownVisitDates++;
   if(!hasUnknown&&last){const days=Math.floor((Date.parse(today)-Date.parse(last))/86400000);if(days>=30){priority=Math.max(priority,1);reasons.push('آخر زيارة مسجلة قبل '+days+' يومًا');steps.push('رتّب زيارة متابعة');}}
   else if(!history.length){priority=Math.max(priority,1);reasons.push('لا توجد زيارة مسجلة');steps.push('رتّب أول تواصل وسجّل نتيجته');}
   if(reasons.length)tasks.push({customer:c,priority,amount:amount||0,reasons,steps});
  }
  tasks.sort((a,b)=>b.priority-a.priority||b.amount-a.amount||b.reasons.length-a.reasons.length||String(a.customer.name||a.customer.id).localeCompare(String(b.customer.name||b.customer.id)));
  const shown=tasks.slice(0,p.limit);
  let answer='خطة اليوم — '+scopeTitle+' — '+today+'\nالأولوية: المستحق الموثّق، ثم العروض المفتوحة، ثم متابعة الزيارات.\n'+(shown.length?shown.map((t,i)=>(i+1)+'. '+(t.customer.name||t.customer.id)+'\nالسبب: '+t.reasons.join('؛ ')+'\nالخطوة المقترحة: '+t.steps.join('؛ ')).join('\n\n'):'لا توجد أولويات بهذه المعايير ضمن البيانات المتاحة.');
  if(tasks.length>shown.length)answer+='\nالمعروض '+shown.length+' من '+tasks.length+' عميل يحتاج متابعة.';
  if(unknownDue)answer+='\n'+unknownDue+' عميل لديه رصيد دون مبلغ مستحق موثّق؛ لم أعتبر الرصيد كله مستحقًا.';
  if(unknownVisitDates)answer+='\nتعذر تقييم انقطاع الزيارات لدى '+unknownVisitDates+' عميل بسبب تواريخ ناقصة أو مستقبلية.';
  answer+='\nهذه اقتراحات متابعة؛ لم يتم إنشاء زيارات أو إرسال رسائل. قائمة العملاء المسجلين فقط، ولا تشمل منشآت الجولات غير المسجلة.';
  return result(answer,{sources:shown.map(t=>source('customer',t.customer)),metrics:{count:tasks.length,shown:shown.length,unknownDue,unknownVisitDates}});
 }
 if(p.action==='rep_activity') {
  const from=p.from||today,to=p.to||today;
  const inPeriod=r=>{const day=validDate(dateOf(r));return day&&day>=from&&day<=to;};
  const reps=selectedRep?[selectedRep]:(auth.role==='rep'?(d.reps||[]).filter(r=>String(r.id)===String(auth.id)):(d.reps||[]));
  if(!reps.length)return result('لا يوجد مندوب مطابق ضمن النطاق المسموح لك.',{mode:'missing_data'});
  const summaries=reps.map(repRow=>{
   const id=String(repRow.id);
   const visits=(d.visits||[]).filter(r=>String(r.rep_id)===id&&inPeriod(r));
   const quotes=(d.quotes||[]).filter(r=>String(r.rep_id)===id&&inPeriod(r));
   const collections=(d.collections||[]).filter(r=>String(r.rep_id)===id&&inPeriod(r));
   const rounds=(d.fieldRounds||[]).filter(r=>String(r.rep_id)===id&&r.status==='submitted'&&inPeriod(r));
   const entries=rounds.flatMap(r=>Array.isArray(r.entries)?r.entries:[]);
   const outcomes={entered:0,passed:0,closed:0,not_visited:0,unspecified:0};
   for(const entry of entries)if(Object.hasOwn(outcomes,entry?.outcome))outcomes[entry.outcome]++;
   const collected=collections.reduce((total,row)=>{const value=number(row.amount);return total+(value===null?0:value);},0);
   const activity=visits.length+quotes.length+collections.length+entries.length;
   return {rep:repRow,visits:visits.length,quotes:quotes.length,collections:collections.length,collected,rounds:rounds.length,places:entries.length,outcomes,activity};
  });
  const lines=summaries.map((s,i)=>{
   const roundDetails=s.places?' — المنشآت: '+s.places+' (دخل '+s.outcomes.entered+'، مرّ '+s.outcomes.passed+'، مغلق '+s.outcomes.closed+'، لم يُزر '+s.outcomes.not_visited+'، غير محدد '+s.outcomes.unspecified+')':'';
   return (i+1)+'. '+s.rep.name+'\nزيارات العملاء: '+s.visits+' · الجولات المعتمدة: '+s.rounds+roundDetails+'\nالعروض: '+s.quotes+' · التحصيلات: '+s.collections+' بإجمالي '+money(s.collected)+' ريال'+(s.activity?'':'\nتنبيه: لا يوجد نشاط مسجل في مصادر البرنامج خلال هذه الفترة؛ راجع المندوب لمعرفة السبب.');
  });
  const inactive=summaries.filter(s=>!s.activity).length;
  let answer='ملخص نشاط المندوبين\nالفترة: '+from+' إلى '+to+'\n'+lines.join('\n\n');
  if(inactive)answer+='\n\nمراجعة مطلوبة: '+inactive+' مندوب دون نشاط مسجل. هذا لا يثبت عدم العمل؛ يعني فقط أنه لم يُسجل في البرنامج.';
  if(d.warnings?.length)answer+='\nنقص التغطية: '+d.warnings.join('؛ ');
  return result(answer,{metrics:{representatives:summaries.length,inactive,from,to,activity:summaries.map(s=>({repId:s.rep.id,visits:s.visits,rounds:s.rounds,places:s.places,quotes:s.quotes,collections:s.collections,collected:s.collected}))}});
 }
 if(p.action==='attention') {
  const quotes=scoped(d.quotes).filter(openQuote),orders=scoped(d.orders).filter(r=>r.manager_approval_required&&!r.manager_approved_at);
  const missingDue=scoped(d.manufacturing).filter(r=>!validDate(r.due_date)&&!['completed','cancelled'].includes(r.status)).length;
  const late=scoped(d.manufacturing).filter(r=>validDate(r.due_date)&&r.due_date<today&&!['completed','delivered','cancelled'].includes(r.status||r.stage));
  const store=scoped(d.storeOrders).filter(r=>['new','approved','picking'].includes(r.status));
  return result('أولويات المتابعة حسب الحالات المسجلة:\n'+
   '1. عروض تحتاج متابعة أو اعتماد: '+quotes.length+'\n'+quotes.slice(0,5).map(r=>'• '+(r.quote_no||r.id)+' — '+clientName(r.customer_id)+' — '+label(r)).join('\n')+
   '\n2. أوامر تنتظر اعتماد الإدارة: '+orders.length+
   '\n3. أوامر إنتاج تجاوزت موعد التسليم المسجل: '+late.length+(missingDue?'؛ '+missingDue+' أمر بدون موعد مسجل ولا يمكن تحديد تأخره':'')+'\n'+late.slice(0,5).map(r=>'• '+(r.order_no||r.id)+' — '+r.due_date).join('\n')+
   '\n4. طلبات متجر تحتاج مراجعة أو تجهيز: '+store.length+
   '\nافتح السجل لمراجعة التفاصيل قبل اتخاذ الإجراء.'+(d.warnings?.length?'\nنقص التغطية: '+d.warnings.join('؛ '):''),{sources:[...quotes.slice(0,5).map(r=>source('quote',r)),...orders.slice(0,5).map(r=>source('order',r))]});
 }
 if(p.action==='order_tracking') {
  if(!selectedCustomer&&!p.reference)return result('اكتب اسم العميل أو رقم الطلب لتتبع مراحله.',{mode:'clarification'});
  const ref=norm(p.reference);
  const match=r=>!ref||[r.id,r.order_no,r.quote_no,r.source_quote_no].some(x=>norm(x)===ref);
  const initialQuotes=scoped(d.quotes).filter(match);
  const initialManufacturing=scoped(d.manufacturing).filter(match);
  const orders=scoped(d.orders).filter(r=>match(r)||initialQuotes.some(q=>String(q.id)===String(r.source_quote_id))||initialManufacturing.some(m=>String(m.source_order_id)===String(r.id))),store=scoped(d.storeOrders).filter(match);
  const quotes=scoped(d.quotes).filter(r=>match(r)||orders.some(o=>String(o.source_quote_id)===String(r.id)));
  const manufacturing=scoped(d.manufacturing).filter(r=>match(r)||orders.some(o=>String(r.source_order_id)===String(o.id))||quotes.some(q=>String(r.source_quote_id)===String(q.id)));
  const lines=[];for(const [name,rows] of [['العرض',quotes],['أمر البيع',orders],['الإنتاج',manufacturing],['المتجر',store]])for(const r of rows.slice(0,p.limit))lines.push(name+': '+(r.quote_no||r.order_no||r.id)+' — '+label(r)+(r.due_date?' — التسليم المسجل: '+r.due_date:''));
  for(const m of manufacturing)for(const op of m.operations||[])lines.push('مرحلة '+(LABELS[op.work_center]||op.work_center)+' — '+label(op));
  return result((lines.length?lines.join('\n'):'لم أجد طلبًا مطابقًا ضمن نطاقك.')+'\nالحالات أعلاه من السجلات؛ لا يُستنتج الإنجاز من اعتماد العرض وحده.'+(d.warnings?.length?'\n'+d.warnings.join('؛ '):''),{sources:[...quotes.slice(0,10).map(r=>source('quote',r)),...orders.slice(0,10).map(r=>source('order',r))]});
 }
 if(p.action==='quote_draft') {
  if(!selectedCustomer)return result('لأي عميل تريد تجهيز مسودة العرض؟',{mode:'clarification'});
  const q=latest(scoped(d.quotes));if(!q)return result('لا يوجد عرض سابق لهذا العميل لتكراره. افتح عرضًا جديدًا وأدخل المواصفات.');
  if((q.items||[]).length>1||/كليش/.test(q.product||''))return result('العرض يحتوي أصنافًا متعددة أو كلايش. حدّد الصنف الذي تريد تغييره؛ لن أطبق كمية بالكيلو على جميع الأصناف.',{mode:'clarification',sources:[source('quote',q)]});
  const fields=['product','material','color','print','width','length','size_unit','thickness','thickness_unit','total_kg','price_kg','print_colors','payment_terms','delivery_terms','fold_bottom','fold_top','fold_side','handle_type','handle_color'];
  const item={...q,...(q.items?.[0]||{})},draft={customer_id:selectedCustomer.id,rep_id:selectedCustomer.rep_id};
  for(const k of fields)if(item[k]!==undefined)draft[k]=item[k];
  Object.assign(draft,p.changes);
  const missing=['product','material','width','length','thickness','total_kg','price_kg'].filter(k=>!draft[k]);
  const fieldsAr={total_kg:'الكمية بالكيلو',price_kg:'سعر الكيلو',print_colors:'ألوان الطباعة',width:'العرض',length:'الطول',thickness:'السماكة',product:'المنتج',material:'الخامة',color:'اللون',print:'الطباعة',payment_terms:'شروط الدفع',delivery_terms:'التسليم'};
  const changes=Object.entries(p.changes).map(([key,value])=>({key,before:item[key]??'',after:value}));
  return result('مسودة جديدة مبنية على العرض '+(q.quote_no||q.id)+' للعميل '+selectedCustomer.name+'.\n'+changes.map(c=>(fieldsAr[c.key]||c.key)+': '+c.before+' ← '+c.after).join('\n')+'\nراجع السعر والمواصفات وتاريخ التسليم قبل الحفظ.'+(missing.length?'\nحقول ناقصة: '+missing.join('، '):'')+'\nلم يتم حفظ أو إرسال أو اعتماد العرض.',{draft,changes,sources:[source('quote',q)]});
 }
 return result('وضح المطلوب من بيانات البرنامج: تحليل ديون أو تحصيل، ملخص نشاط مندوب، متابعة عميل أو عرض، تجهيز مسودة من عرض سابق، أو تتبع طلب.',{mode:'clarification'});
}
export function fallbackPlan(question,previous={},data={},today=saudiDate()) {
 const q=norm(question),follow=/^(و|طيب|فقط|منهم|منها|رتب|المستحق|الاقل|الاعلي|اعلي|اقل|كم منهم)/.test(q);
 const p=follow?{...previous}:{action:'general'};delete p.clarification;
 const repMatches=(data.reps||[]).filter(r=>norm(r.name).split(' ').some(w=>w.length>=3&&q.split(' ').includes(w)));
 if(repMatches.length===1)p.rep=repMatches[0].name;
 else if(repMatches.length>1)p.clarification='حدد الاسم الكامل للمندوب.';
 const customerMatches=(data.customers||[]).filter(c=>norm(c.name).length>=3&&q.includes(norm(c.name)));
 if(customerMatches.length===1)p.customer=customerMatches[0].name;
 if(/دين|ديون|مديون|مستحق/.test(q))p.action='debts';
 if(/تحصيل|سداد|دفعات/.test(q))p.action='collections';
 if(/زيار/.test(q))p.action='visits';
 if(/عرض|عروض/.test(q))p.action='quotes';
 if(/تدخل|اولويات|وش اسوي|ايش اسوي/.test(q))p.action='attention';
 if(/وين وصل|تتبع|حاله الطلب/.test(q))p.action='order_tracking';
 if(/كرر|مسوده/.test(q))p.action='quote_draft';
 if(/وش صار مع|ملف العميل/.test(q))p.action='customer_summary';
 if(/خطه يومي|خطه اليوم|رتب يومي|مين اتابع|من اتابع|مين ازور|من ازور|ابدا بمين/.test(q)){p.action='daily_plan';p.from='';p.to='';}
 if(/ملخص.*(?:مندوب|مناديب)|نشاط.*(?:مندوب|مناديب)|تقرير.*(?:مندوب|مناديب)|وش سوي|ايش سوي|ماذا فعل/.test(q))p.action='rep_activity';
 if(/مستحق|متاخر/.test(q)&&p.action==='debts')p.dueOnly=true;
 if(/كل الديون|اجمالي الدين|كامل الدين/.test(q))p.dueOnly=false;
 if(/اقل|اصغر|تصاعد/.test(q))p.sort='asc';else if(/اعلي|اكبر|اكثر|تنازل/.test(q))p.sort='desc';
 if(/حسب التاخير|ايام التاخير/.test(q))p.sortBy='delay';
 if(/حسب المندوب|كل مندوب|كل المناديب/.test(q))p.groupBy='rep';
 const limit=q.match(/(?:اعلي|اقل|اول|اكبر)\s*(\d+)/);if(limit)p.limit=Number(limit[1]);
 if(/اليوم/.test(q)){p.from=today;p.to=today;}
 if(/هذا الشهر|الشهر الحالي/.test(q)){p.from=today.slice(0,7)+'-01';p.to=today;}
 const range=q.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);if(range){p.from=range[1];p.to=range[2];}
 if(/الشهر الماضي/.test(q)){const d=new Date(today.slice(0,7)+'-01T00:00:00Z');d.setUTCDate(0);p.to=d.toISOString().slice(0,10);p.from=p.to.slice(0,7)+'-01';}
 if(/كل الفترات|بدون فتره/.test(q)){p.from='';p.to='';}
 if(/معلق|مفتوح/.test(q)&&p.action==='quotes')p.status='open';
 // A named scope that cannot be resolved must not silently become all customers.
 if(/ديون|مديون/.test(q)&&!p.rep&&!p.customer&&!/عملائي|العملاء|كل|جميع|اجمالي|اعلي|اقل|اكبر|اكثر/.test(q))p.clarification='اكتب الاسم الكامل للمندوب أو العميل المقصود.';
 if(p.action==='quote_draft')p.clarification='صياغة تعديلات العرض تحتاج فهمًا تفصيليًا. أعد المحاولة عند توفر خدمة فهم الأسئلة، أو استخدم نموذج العرض.';
 if(p.action==='debts'&&!p.rep&&!p.customer){
  const rest=q.replace(/(?:ال)?(?:ديون|دين|مديونيات|مديونيه|اعلي|اقل|اكبر|اكثر|مستحق|مستحقه|اجمالي|عملائي|عملاء|جميع|كل|اعطني|عطني|هات|ابي|ابغي|ابغى|كم|من|ريال|فقط|الحاليه|حسب|مندوب|مناديب|رتبهم|رتب|الي|اليوم|هذا|الشهر|الماضي|الحالي|الارصده|ارصده|المبالغ|مبالغ)|[\d\s.-]/g,'').trim();
  if(rest.length>=3)p.clarification='لم أستطع تحديد النطاق بأمان. اكتب الاسم الكامل للمندوب أو العميل.';
 }
 return normalizePlan(p);
}
