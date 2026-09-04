import { sendJson, allowMethods, readBody, compactCrmData } from "./_helpers.js";

const JMS_AI_SYSTEM = `
أنت JMS AI، مساعد ذكي داخل CRM/ERP لمصنع منتجات بلاستيكية.
افهم العربية الطبيعية واللهجات الخليجية/السعودية والأخطاء الإملائية البسيطة. بيانات CRM هي المصدر الأساسي للحقيقة. لا تخترع أرقاماً أو أسماء. اربط العملاء بالمناديب عبر المعرفات، واحسب الإجماليات رقمياً. لا تعرض للمندوب بيانات مندوب آخر. أجب بالعربية مباشرة وباختصار مفيد.
`;

function norm(v=""){
  return String(v).toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
}
function money(n){return Number(n||0).toLocaleString("ar-SA",{maximumFractionDigits:2});}
function repName(data,id){return data.reps.find(r=>String(r.id)===String(id))?.name||"بدون مندوب";}
function findNamedRep(q,data){
  const nq=norm(q);return data.reps.find(r=>{const n=norm(r.name);return n&&n.split(" ").some(w=>w.length>=3&&nq.includes(w))||nq.includes(n);});
}
function localAnswer(question,data){
  const q=norm(question), debt=/(دين|ديون|مديوني|مديونيات|مستحق)/.test(q), collection=/(تحصيل|سداد|دفعات)/.test(q), sales=/(مبيعات|بيع|مباع)/.test(q), visits=/(زيارات|زياره|زيارة)/.test(q);
  const allReps=/(كل مندوب|كل المناديب|مندوب لوحده|مندوب لحاله|حسب المندوب)/.test(q);
  const high=/(اعلي|اعلى|اكبر|اكثر|الأعلى|الاعلى)/.test(q);
  const namedRep=findNamedRep(question,data);
  if(debt&&allReps){
    const totals=new Map(data.reps.map(r=>[String(r.id),0]));
    data.customers.forEach(c=>totals.set(String(c.rep_id),Number(totals.get(String(c.rep_id))||0)+Number(c.debt_balance||0)));
    const rows=[...totals.entries()].map(([id,total])=>({name:repName(data,id),total})).sort((a,b)=>b.total-a.total);
    return "مجموع ديون كل مندوب:\n"+rows.map((r,i)=>`${i+1}. ${r.name}: ${money(r.total)} ريال`).join("\n")+`\nالإجمالي: ${money(rows.reduce((s,r)=>s+r.total,0))} ريال`;
  }
  if(debt&&high){
    let rows=data.customers.filter(c=>Number(c.debt_balance||0)>0);
    if(namedRep)rows=rows.filter(c=>String(c.rep_id)===String(namedRep.id));
    rows.sort((a,b)=>Number(b.debt_balance||0)-Number(a.debt_balance||0));
    if(!rows.length)return namedRep?`لا توجد مديونيات مسجلة لعملاء ${namedRep.name}.`:"لا توجد مديونيات مسجلة.";
    return `${namedRep?`أعلى مديونيات عملاء ${namedRep.name}`:"أعلى المديونيات"}:\n`+rows.slice(0,10).map((c,i)=>`${i+1}. ${c.name}: ${money(c.debt_balance)} ريال`).join("\n");
  }
  if(debt){
    const total=data.customers.reduce((s,c)=>s+Number(c.debt_balance||0),0);
    return `إجمالي المديونيات الحالية: ${money(total)} ريال.`;
  }
  if(collection&&allReps){
    const totals=new Map(data.reps.map(r=>[String(r.id),0]));data.collections.forEach(c=>totals.set(String(c.rep_id),Number(totals.get(String(c.rep_id))||0)+Number(c.amount||0)));
    return "التحصيل حسب المندوب:\n"+[...totals.entries()].map(([id,total])=>({name:repName(data,id),total})).sort((a,b)=>b.total-a.total).map((r,i)=>`${i+1}. ${r.name}: ${money(r.total)} ريال`).join("\n");
  }
  if(sales&&allReps){
    const totals=new Map(data.reps.map(r=>[String(r.id),0]));data.orders.forEach(o=>totals.set(String(o.rep_id),Number(totals.get(String(o.rep_id))||0)+Number(o.total||0)));
    return "المبيعات حسب المندوب:\n"+[...totals.entries()].map(([id,total])=>({name:repName(data,id),total})).sort((a,b)=>b.total-a.total).map((r,i)=>`${i+1}. ${r.name}: ${money(r.total)} ريال`).join("\n");
  }
  if(visits&&allReps){
    const totals=new Map(data.reps.map(r=>[String(r.id),0]));data.visits.forEach(v=>totals.set(String(v.rep_id),Number(totals.get(String(v.rep_id))||0)+1));
    return "عدد الزيارات حسب المندوب:\n"+[...totals.entries()].map(([id,total])=>({name:repName(data,id),total})).sort((a,b)=>b.total-a.total).map((r,i)=>`${i+1}. ${r.name}: ${r.total} زيارة`).join("\n");
  }
  if(/(عروض).*(معلق|انتظار)|معلق.*عرض/.test(q)){
    const rows=data.quotes.filter(x=>["pending","sent"].includes(String(x.status||"").toLowerCase()));
    return rows.length?`عروض الأسعار المعلقة: ${rows.length}\n`+rows.slice(0,10).map((x,i)=>`${i+1}. ${x.quote_no||x.id} — ${money(x.total)} ريال`).join("\n"):"لا توجد عروض أسعار معلقة حالياً.";
  }
  return null;
}

export default async function handler(req,res){
  if(req.method==="GET")return sendJson(res,200,{ok:true,route:"/api/ai",message:"JMS AI backend is running. Use POST."});
  if(!allowMethods(req,res,["POST"]))return;
  try{
    const {question,data,allowWeb=false,conversation=[]}=await readBody(req);
    if(!question||typeof question!=="string")return sendJson(res,400,{ok:false,error:"question is required"});
    const crmData=compactCrmData(data||{});
    const deterministic=localAnswer(question,crmData);
    if(deterministic)return sendJson(res,200,{ok:true,mode:"crm_local",answer:deterministic});
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)return sendJson(res,200,{ok:false,mode:"missing_key",answer:"مفتاح OpenAI API غير مضبوط."});
    const recentConversation=Array.isArray(conversation)?conversation.slice(-8).filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string"):[];
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",tools:allowWeb?[{type:"web_search_preview"}]:[],input:[{role:"system",content:JMS_AI_SYSTEM},...recentConversation,{role:"user",content:JSON.stringify({question:question.trim(),crm_data:crmData})}]})});
    const result=await response.json();
    if(!response.ok){
      const msg=result.error?.message||"OpenAI API error";
      if(response.status===429&&/credit|quota|billing/i.test(msg))return sendJson(res,200,{ok:false,mode:"billing_required",answer:"رصيد OpenAI API غير متوفر حالياً. أسئلة CRM الأساسية تعمل محلياً، أما الأسئلة الحرة فتحتاج رصيد API."});
      return sendJson(res,500,{ok:false,mode:"openai_error",error:msg});
    }
    const answer=result.output_text||(result.output||[]).map(item=>(item.content||[]).map(c=>c.text||"").join("\n")).join("\n")||"لم يصل رد واضح من الذكاء الاصطناعي.";
    return sendJson(res,200,{ok:true,mode:allowWeb?"openai_web_search":"openai",answer});
  }catch(err){return sendJson(res,500,{ok:false,mode:"server_error",error:err.message||String(err)});}
}
