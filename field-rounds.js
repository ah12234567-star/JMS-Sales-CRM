const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={entered:'دخلت / تحدثت مع المنشأة',passed:'مرور من أمام المكان فقط',closed:'المكان مغلق',not_visited:'لم تتم الزيارة / مخطط',unspecified:'نوع المرور غير محدد'};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let user=null,record=null,records=[],offset=0,busy=false;
function token(){return sessionStorage.getItem('jms_auth_token')||localStorage.getItem('jms_auth_token')||'';}
let voiceRecognition=null,voiceActive=false,voiceBase='';
function setupVoiceInput(){
 const button=$('voiceInput'),status=$('voiceStatus');if(!button)return;
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){button.hidden=true;return;}
 const setActive=active=>{voiceActive=active;button.textContent=active?'⏹ إيقاف الإملاء':'🎙 ابدأ الإملاء';button.setAttribute('aria-pressed',String(active));};
 button.onclick=()=>{
  if(voiceActive){voiceRecognition?.stop();return;}
  try{
   voiceRecognition=new Recognition();voiceRecognition.lang='ar-SA';voiceRecognition.continuous=true;voiceRecognition.interimResults=true;voiceBase=$('source').value.trim();
   voiceRecognition.onstart=()=>{setActive(true);status.textContent='أستمع الآن… اضغط إيقاف عند الانتهاء.';};
   voiceRecognition.onresult=event=>{
    let finalText='',interimText='';
    for(let i=0;i<event.results.length;i++){const transcript=event.results[i][0]?.transcript||'';if(event.results[i].isFinal)finalText+=transcript+' ';else interimText+=transcript+' ';}
    $('source').value=[voiceBase,finalText.trim(),interimText.trim()].filter(Boolean).join(' ').trim().slice(0,8000);persist();
   };
   voiceRecognition.onerror=event=>{
    if(event.error==='not-allowed'||event.error==='service-not-allowed')message('اسمح للمتصفح باستخدام الميكروفون، أو اكتب ملخص الجولة.',true);
    else if(event.error==='no-speech')message('لم أسمع كلامًا. حاول مرة أخرى أو اكتب الملخص.',true);
    else if(event.error!=='aborted')message('تعذر إكمال الإملاء. يمكنك كتابة الملخص يدويًا.',true);
   };
   voiceRecognition.onend=()=>{setActive(false);status.textContent='تحدث بشكل طبيعي؛ راجع النص قبل إنشاء الجدول.';if($('source').value.trim())message('انتهى الإملاء. راجع النص ثم رتّب كلامك في جدول.');};
   voiceRecognition.start();setActive(true);
  }catch{setActive(false);message('تعذر بدء الإملاء. تحقق من إذن الميكروفون أو اكتب الملخص.',true);}
 };
}
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
async function request(path='',body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
 try{
  const r=await fetch('/api/field-rounds'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
  const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.message||'تعذر إكمال العملية.');return data;
 }catch(e){throw new Error(e.name==='AbortError'?'تأخر الرد. أعد المحاولة؛ لن يُنشأ تقرير مكرر.':e.message);}finally{clearTimeout(timer);}
}
function cacheKey(){return 'jms-field-round-draft:'+user.id;}
function persist(){if(!user)return;try{localStorage.setItem(cacheKey(),JSON.stringify({source:$('source').value,area:$('area').value,date:$('date').value,record:record?.status==='draft'?record:null}));}catch{}}
async function operation(button,fn){if(busy)return;busy=true;const text=button.textContent;button.disabled=true;button.textContent='جاري التنفيذ…';message('جاري التنفيذ؛ يرجى الانتظار.');try{await fn();}catch(e){message(e.message,true);}finally{button.disabled=false;button.textContent=text;busy=false;}}
function rowHtml(row,i,readOnly){
 return `<article class="entry" data-index="${i}"><div class="entry-head"><h3>منشأة ${i+1}</h3>${readOnly?'':`<button data-remove="${i}" aria-label="حذف المنشأة ${i+1}">حذف</button>`}</div><div class="two"><label>اسم المنشأة<input data-field="name" maxlength="160" value="${esc(row.name)}" ${readOnly?'disabled':''}></label><label>الحي<input data-field="area" maxlength="120" value="${esc(row.area)}" ${readOnly?'disabled':''}></label><label>ماذا حدث؟<select data-field="outcome" ${readOnly?'disabled':''}>${Object.entries(labels).map(([v,l])=>`<option value="${v}" ${row.outcome===v?'selected':''}>${l}</option>`).join('')}</select></label><label>متابعة قادمة (اختياري)<input data-field="follow_up_date" type="date" value="${esc(row.follow_up_date)}" ${readOnly?'disabled':''}></label></div><label>النتيجة والملاحظة<textarea data-field="notes" rows="2" maxlength="1000" ${readOnly?'disabled':''}>${esc(row.notes)}</textarea></label></article>`;
}
function showRecord(next,restore=true){
 record=next;const readOnly=record.status==='submitted';
 if(restore&&!readOnly){try{const old=JSON.parse(localStorage.getItem(cacheKey())||'{}').record;if(old?.id===record.id&&old.locallyEdited&&Array.isArray(old.entries))record={...record,entries:old.entries,locallyEdited:true};}catch{}}
 $('compose').hidden=true;$('review').hidden=false;$('reviewActions').hidden=readOnly;$('reviewTitle').textContent=readOnly?'تم اعتماد الجولة':'راجع المسودة قبل الاعتماد';
 $('roundMeta').textContent=`${record.rep_name} · ${record.date} · ${record.area}`;$('original').textContent=record.source_text;
 $('clarification').textContent=record.analysis_status==='pending'?'التحليل قيد التنفيذ أو لم يكتمل. أعد فتح المسودة لاحقًا، أو أضف الأماكن يدويًا.':record.clarification||'راجع أسماء المنشآت والنتائج، وعدّل أي تفسير غير دقيق.';
 $('entries').innerHTML=record.entries.map((r,i)=>rowHtml(r,i,readOnly)).join('');$('confirmed').checked=false;
 history.replaceState(null,'','?id='+encodeURIComponent(record.id));persist();
}
function table(r){return `<div class="table-wrap"><table><thead><tr><th>المنشأة</th><th>الحي</th><th>حالة المرور</th><th>النتيجة</th><th>المتابعة</th></tr></thead><tbody>${r.entries.map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.area)}</td><td>${esc(labels[e.outcome])}</td><td>${esc(e.notes||'—')}</td><td>${esc(e.follow_up_date||'—')}</td></tr>`).join('')}</tbody></table></div>`;}
function renderReports(){
 const q=$('search').value.trim().toLowerCase();const list=records.filter(r=>[r.rep_name,r.area,...r.entries.flatMap(e=>[e.name,e.area,e.notes])].join(' ').toLowerCase().includes(q));
 const submitted=list.filter(r=>r.status==='submitted'),entries=submitted.flatMap(r=>r.entries);
 $('totals').textContent=`المعروض: ${submitted.length} جولة معتمدة · ${entries.filter(e=>e.outcome==='entered').length} دخول مُبلّغ عنه · ${entries.length} مكان مسجل`;
 $('reports').innerHTML=list.map(r=>`<article class="report"><div class="heading"><b>${esc(r.rep_name)} · ${esc(r.date)} · ${esc(r.area)}</b><span class="tag ${r.status==='submitted'?'submitted':''}">${r.status==='submitted'?'معتمد من المندوب':'مسودة خاصة'}</span></div>${r.status==='submitted'?table(r):`<p>${esc(r.source_text.slice(0,180))}</p><button data-open="${esc(r.id)}">مراجعة المسودة</button>`}<p class="hint">تسجيل المندوب؛ لا تُحتسب هذه المنشآت ضمن زيارات العملاء المسجلين.</p></article>`).join('')||'<p>لا توجد تقارير مطابقة.</p>';
}
async function loadReports(append=false){
 const date=$('filterDate').value;if(!append)offset=0;
 const result=await request('?offset='+offset+(date?'&date='+date:''));user=result.user;$('userName').textContent=user.name;
 $('reportsTitle').textContent=user.role==='rep'?'تقاريري':'جولات المناديب';
 records=append?[...records,...result.records]:result.records;offset=records.length;$('more').hidden=!result.hasMore;renderReports();
}
setupVoiceInput();
$('prepare').onclick=()=>operation($('prepare'),async()=>{
 if(!$('date').value||!$('area').value.trim()||!$('source').value.trim())throw new Error('حدد الحي والتاريخ واكتب ما حدث في الجولة.');
 persist();const result=await request('',{action:'prepare',date:$('date').value,area:$('area').value,text:$('source').value});showRecord(result.record);message(result.record.status==='submitted'?'هذه الجولة معتمدة مسبقًا؛ لم تُكرر.':'المسودة جاهزة للمراجعة؛ لم تُرسل للمدير بعد.');
});
$('entries').oninput=e=>{const field=e.target.dataset.field;const i=Number(e.target.closest('[data-index]')?.dataset.index);if(record?.status==='draft'&&field&&record.entries[i]){record.entries[i][field]=e.target.value;record.locallyEdited=true;$('confirmed').checked=false;persist();}};
$('entries').onclick=e=>{const button=e.target.closest('[data-remove]');if(button&&record?.status==='draft'){record.entries.splice(Number(button.dataset.remove),1);record.locallyEdited=true;showRecord(record,false);}};
$('addRow').onclick=()=>{if(record.entries.length>=50)return message('الحد الأقصى 50 منشأة.',true);record.entries.push({name:'',area:record.area,outcome:'unspecified',notes:'',follow_up_date:''});record.locallyEdited=true;showRecord(record,false);};
$('submit').onclick=()=>operation($('submit'),async()=>{
 if(!$('confirmed').checked)throw new Error('راجع الأسماء والنتائج ثم ضع علامة التأكيد.');
 const result=await request('',{action:'submit',id:record.id,entries:record.entries,confirmed:true});showRecord(result.record,false);message('تم الحفظ على السيرفر. الجولة متاحة للمدير، ولم يُضف أي عميل.');await loadReports();
});
$('newRound').onclick=()=>{if(voiceActive)voiceRecognition?.stop();if(record?.status==='draft'&&!confirm('المسودة محفوظة ويمكن العودة إليها. فتح جولة جديدة؟'))return;record=null;$('review').hidden=true;$('compose').hidden=false;$('source').value='';$('date').value=today();history.replaceState(null,'',location.pathname);persist();message('');};
$('reports').onclick=e=>{const button=e.target.closest('[data-open]');if(button)operation(button,async()=>{const r=await request('?id='+button.dataset.open);showRecord(r.record);message('المسودة جاهزة للمراجعة.');$('review').scrollIntoView({behavior:'smooth'});});};
$('refresh').onclick=()=>operation($('refresh'),async()=>{await loadReports();message('تم تحديث التقارير.');});
$('more').onclick=()=>operation($('more'),async()=>{await loadReports(true);message('تم تحميل المزيد.');});
$('filterDate').onchange=()=>$('refresh').click();$('search').oninput=renderReports;
for(const id of ['area','source','date'])$(id).addEventListener('input',persist);
async function init(){
 $('date').value=today();$('filterDate').value=today();
 if(!token()){message('سجل الدخول في JMS ثم افتح جولة اليوم.',true);$('prepare').disabled=true;return;}
 try{
  await loadReports();
  try{const cached=JSON.parse(localStorage.getItem(cacheKey())||'{}');for(const id of ['source','area','date'])if(cached[id])$(id).value=cached[id];}catch{}
  const id=new URLSearchParams(location.search).get('id');if(id){const result=await request('?id='+encodeURIComponent(id));showRecord(result.record);}
  message('');
 }catch(e){message(e.message,true);}
}
init();
