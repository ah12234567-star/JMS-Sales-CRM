function sendJson(res, status, data){
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
async function readBody(req){
  let raw='';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function extractJson(text){
  text = String(text || '').trim();
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fenced){ try { return JSON.parse(fenced[1]); } catch {} }
  const arr = text.match(/\[[\s\S]*\]/);
  if(arr){ try { return JSON.parse(arr[0]); } catch {} }
  const obj = text.match(/\{[\s\S]*\}/);
  if(obj){ try { return JSON.parse(obj[0]); } catch {} }
  return null;
}
export default async function handler(req,res){
  if(req.method === 'GET') return sendJson(res,200,{ok:true,route:'/api/new-customer-radar',message:'Use POST to search for new customer leads.'});
  if(req.method !== 'POST') return sendJson(res,405,{ok:false,error:'method_not_allowed',message:'Use POST only'});
  try{
    const {city='جدة',industry='مطاعم وكوفيهات جديدة',keywords='افتتاح جديد opening soon new business',limit=12,existingCustomers=[]}=await readBody(req);
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey) return sendJson(res,200,{ok:false,error:'missing_openai_key',answer:'أضف OPENAI_API_KEY في Vercel لتفعيل رادار العملاء الجدد.'});
    const n=Math.max(3,Math.min(20,Number(limit)||12));
    const prompt=`ابحث في الويب عن عملاء تجاريين جدد أو حديثي الظهور في السعودية يمكن أن يحتاجوا أكياس بلاستيك أو تغليف من مصنع.\nالمدينة/المنطقة: ${city}\nالنشاط المستهدف: ${industry}\nكلمات البحث: ${keywords}\nتجنب تكرار هؤلاء العملاء الموجودين: ${Array.isArray(existingCustomers)?existingCustomers.slice(0,80).join('، '):''}\n\nأعد JSON فقط بدون شرح، بهذا الشكل:\n[\n {"name":"اسم النشاط","business_type":"نوع النشاط","city":"المدينة","area":"الحي إن وجد","phone":"رقم منشور عام إن وجد فقط","website":"رابط الموقع إن وجد","maps_url":"رابط خرائط إن وجد","source_url":"رابط المصدر","evidence":"دليل مختصر أنه جديد/افتتاح/نشاط مناسب","fit_reason":"لماذا مناسب لمصنع أكياس وتغليف","score":80,"suggested_message":"رسالة واتساب عربية قصيرة للتواصل"}\n]\nالشروط: استخدم مصادر عامة فقط. لا تخترع رقم هاتف. إذا لم تجد رقمًا اترك phone فارغ. أعطِ ${n} نتائج كحد أقصى.`;
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        tools:[{type:'web_search_preview'}],
        input:[
          {role:'system',content:'أنت باحث مبيعات B2B لمصنع أكياس وتغليف في السعودية. أعد JSON فقط. لا تخترع أرقام اتصال. اعتمد على مصادر عامة.'},
          {role:'user',content:prompt}
        ]
      })
    });
    const result=await response.json();
    if(!response.ok) return sendJson(res,500,{ok:false,error:result.error?.message||'openai_error',details:result});
    const text=result.output_text || (result.output||[]).map(item=>(item.content||[]).map(c=>c.text||'').join('\n')).join('\n');
    let parsed=extractJson(text);
    let leads=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.leads)?parsed.leads:[]);
    leads=leads.slice(0,n).map((l,i)=>({
      id:l.id || `lead-${Date.now()}-${i}`,
      name:l.name || l.title || 'فرصة بدون اسم',
      business_type:l.business_type || l.category || industry,
      city:l.city || city,
      area:l.area || l.district || '',
      phone:l.phone || '',
      website:l.website || '',
      maps_url:l.maps_url || l.map_url || '',
      source_url:l.source_url || l.url || '',
      evidence:l.evidence || l.snippet || '',
      fit_reason:l.fit_reason || l.reason || 'نشاط محتمل يحتاج تغليف أو أكياس.',
      score:Number(l.score || 60),
      suggested_message:l.suggested_message || `السلام عليكم، معكم شركة جدة النموذجية للصناعة. نقدر نخدمكم في الأكياس والتغليف حسب احتياجكم. هل مناسب نرسل لكم عرض تعريفي؟`
    }));
    return sendJson(res,200,{ok:true,mode:'web_search',leads,raw:text});
  }catch(err){
    return sendJson(res,500,{ok:false,error:err.message||String(err)});
  }
}
