(function(){
'use strict';
const VERSION='2026-08-14-quote-smart-assistant-1';
const $=id=>document.getElementById(id);
const value=(id,v)=>{const el=$(id);if(!el||v===undefined||v===null||v==='')return;if(el.tagName==='SELECT'){const wanted=String(v).toLowerCase();const option=[...el.options].find(o=>String(o.value).toLowerCase()===wanted||String(o.textContent).toLowerCase()===wanted);if(option)el.value=option.value;}else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
const normalizeDigits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,]/g,'').replace(/٫/g,'.');
const num=v=>{const n=Number(normalizeDigits(v).replace(/[^0-9.]/g,''));return Number.isFinite(n)?n:'';};

function localParse(text){
 const t=normalizeDigits(text).replace(/×/g,'*');
 const size=t.match(/(\d+(?:\.\d+)?)\s*[*xX]\s*(\d+(?:\.\d+)?)/);
 const thickness=t.match(/(?:سمك|سماك[هة]|سماكة)\s*(\d+(?:\.\d+)?)/i)||t.match(/(\d+(?:\.\d+)?)\s*(?:مايكرون|ميكرون|micron)/i);
 const kg=t.match(/(?:كمية|الكمية)?\s*(\d+(?:\.\d+)?)\s*(?:كيلو|كجم|kg)/i);
 const price=t.match(/(?:بسعر|سعر(?:\s*الكيلو)?|بـ?)\s*(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س)?/i);
 const colors=t.match(/(?:طباعة\s*)?(لون|لونين|ثلاثة\s*ألوان|ثلاث\s*الوان|4\s*ألوان|4\s*الوان|أربعة\s*ألوان|اربعة\s*الوان)/i);
 let print_colors='';
 if(colors){const x=colors[1];print_colors=/لونين/.test(x)?2:/ثلاث/.test(x)?3:/(?:4|أربع|اربع)/.test(x)?4:1;}
 return {
  product_type:/رول/.test(t)?'رول بلاستيك':'أكياس بلاستيك',
  material:/\bHD(?:PE)?\b/i.test(t)?'HDPE':/\bLD(?:PE)?\b/i.test(t)?'LDPE':'',
  color:(t.match(/\b(أبيض|ابيض|شفاف|أسود|اسود|أحمر|احمر|أزرق|ازرق|أخضر|اخضر)\b/)||[])[1]||'',
  width_cm:size?num(size[1]):'',length_cm:size?num(size[2]):'',thickness_micron:thickness?num(thickness[1]):'',
  printing:/بدون\s*طباعة/.test(t)?'بدون طباعة':/طباعة/.test(t)?'طباعة وجه واحد':'',print_colors,
  quantity_kg:kg?num(kg[1]):'',price_per_kg:price?num(price[1]):''
 };
}

function extractJson(answer){
 const cleaned=String(answer||'').replace(/```json/gi,'').replace(/```/g,'').trim();
 try{return JSON.parse(cleaned)}catch(_){const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');if(start>=0&&end>start){try{return JSON.parse(cleaned.slice(start,end+1))}catch(__){}}}
 return null;
}

async function aiParse(text){
 const question=`حوّل وصف عرض السعر التالي إلى JSON فقط بدون شرح. لا تخترع أي قيمة غير موجودة. استخدم هذا الشكل بالضبط:\n{"product_type":"أكياس بلاستيك أو رول بلاستيك أو فارغ","material":"LDPE أو HDPE أو فارغ","color":"","width_cm":null,"length_cm":null,"thickness_micron":null,"printing":"بدون طباعة أو طباعة وجه واحد أو طباعة وجهين أو فارغ","print_colors":null,"quantity_kg":null,"price_per_kg":null}\nملاحظات: LD يعني LDPE وHD يعني HDPE. إذا قيل طباعة لونين فعدد الألوان 2. النص: ${text}`;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const token=sessionStorage.getItem('jms_auth_token')||'';
  const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({question,allowWeb:false}),signal:controller.signal});
  const data=await res.json();
  if(!res.ok||data.ok===false)throw new Error(data.answer||data.error||'AI unavailable');
  return extractJson(data.answer);
 }finally{clearTimeout(timer)}
}

function applyParsed(data){
 if(!data)return false;
 const product=/رول/.test(data.product_type||'')?'رول بلاستيك':/كيس|أكياس/.test(data.product_type||'')?'أكياس بلاستيك':'';
 if(product)value('mqProduct',product);
 if(data.material)value('mqMaterial',/^HD/i.test(data.material)?'HDPE':'LDPE');
 value('mqColor',data.color);value('mqWidth',data.width_cm);value('mqLength',data.length_cm);value('mqThickness',data.thickness_micron);value('mqKg',data.quantity_kg);value('mqPriceKg',data.price_per_kg);
 if($('mqSizeUnit'))value('mqSizeUnit','cm');if($('mqThicknessUnit'))value('mqThicknessUnit','micron');
 if(data.printing)value('mqPrint',data.printing);if(data.print_colors)value('mqPrintColors',data.print_colors);
 if(typeof window.calcQuoteForm==='function')window.calcQuoteForm();
 if(typeof window.jmsCalcQuote==='function')window.jmsCalcQuote();
 return true;
}

async function analyze(){
 const input=$('jmsQuoteAiText'),status=$('jmsQuoteAiStatus'),button=$('jmsQuoteAiAnalyze');
 const text=input?.value?.trim();if(!text)return alert('اكتب تفاصيل العرض أو استخدم زر الميكروفون');
 button.disabled=true;status.textContent='جاري قراءة تفاصيل العرض...';
 try{
  let parsed=null;
  try{parsed=await aiParse(text)}catch(error){console.warn('JMS quote AI fallback',error)}
  parsed={...localParse(text),...(parsed||{})};
  applyParsed(parsed);
  status.textContent='تمت تعبئة الحقول. راجعها ثم اضغط حفظ وإرساله للمدير للاعتماد.';
 }catch(error){console.error(error);status.textContent='تعذر تحليل النص. حاول بصياغة أوضح.';}
 finally{button.disabled=false}
}

function startVoice(){
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition)return alert('التسجيل الصوتي غير مدعوم في هذا المتصفح. استخدم الكتابة حالياً.');
 const button=$('jmsQuoteAiMic'),status=$('jmsQuoteAiStatus');
 const recognition=new Recognition();recognition.lang='ar-SA';recognition.interimResults=false;recognition.maxAlternatives=1;
 button.disabled=true;status.textContent='🎙️ أتكلم الآن...';
 recognition.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';if(text){$('jmsQuoteAiText').value=text;status.textContent='تم تحويل الصوت إلى نص. اضغط تعبئة العرض.';}};
 recognition.onerror=()=>{status.textContent='تعذر التعرف على الصوت. جرّب مرة أخرى أو اكتب النص.';};
 recognition.onend=()=>{button.disabled=false;};recognition.start();
}

function mount(){
 const product=$('mqProduct');if(!product||$('jmsQuoteSmartAssistant'))return;
 const formAnchor=product.closest('.form-grid');if(!formAnchor)return;
 const panel=document.createElement('div');panel.id='jmsQuoteSmartAssistant';panel.className='jms-quote-ai';
 panel.innerHTML=`<div class="jms-quote-ai-head"><div><b>✨ مساعد ذكي</b><span>اكتب أو سجل تفاصيل العرض وسيتم تعبئة الحقول تلقائياً</span></div></div><textarea id="jmsQuoteAiText" rows="3" placeholder="مثال: كيس 50*60 LD أبيض سمك 70 مايكرون طباعة لونين كمية 1000 كيلو بسعر 8 ريال"></textarea><div class="jms-quote-ai-actions"><button id="jmsQuoteAiMic" type="button">🎙️ صوت</button><button id="jmsQuoteAiAnalyze" class="primary" type="button">✨ تعبئة العرض</button></div><small id="jmsQuoteAiStatus">بعد التعبئة راجع البيانات، وعند الحفظ ينتقل العرض تلقائياً لاعتماد المدير.</small>`;
 formAnchor.insertAdjacentElement('beforebegin',panel);
 $('jmsQuoteAiAnalyze').addEventListener('click',analyze);$('jmsQuoteAiMic').addEventListener('click',startVoice);
}

function style(){if($('jmsQuoteAiStyle'))return;const el=document.createElement('style');el.id='jmsQuoteAiStyle';el.textContent='.jms-quote-ai{margin:12px 0 16px;padding:14px;border:1px solid #c7d2fe;border-radius:16px;background:linear-gradient(135deg,#eef2ff,#fff)}.jms-quote-ai-head{display:flex;justify-content:space-between;margin-bottom:9px}.jms-quote-ai-head div{display:grid;gap:3px}.jms-quote-ai-head b{font-size:15px;color:#312e81}.jms-quote-ai-head span,.jms-quote-ai small{font-size:11px;color:#64748b}.jms-quote-ai textarea{width:100%;min-height:76px;resize:vertical;border:1px solid #cbd5e1;border-radius:12px;padding:11px;font:inherit;box-sizing:border-box}.jms-quote-ai-actions{display:flex;gap:8px;margin:9px 0}.jms-quote-ai-actions button{min-height:42px;border-radius:10px;padding:8px 14px;cursor:pointer}.jms-quote-ai-actions button:first-child{border:1px solid #cbd5e1;background:#fff}@media(max-width:620px){.jms-quote-ai-actions button{flex:1}.jms-quote-ai textarea{font-size:16px}}';document.head.appendChild(el)}

function wrap(name){const old=window[name];if(typeof old!=='function'||old.__jmsQuoteAiWrapped)return;const wrapped=function(){const result=old.apply(this,arguments);setTimeout(mount,0);return result};wrapped.__jmsQuoteAiWrapped=true;window[name]=wrapped;}
function boot(){style();['openQuoteForm','forceQuoteForm','editQuote'].forEach(wrap);setTimeout(mount,0)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.JMS_QUOTE_SMART_ASSISTANT=VERSION;
})();