import crypto from 'node:crypto';
import {json,readBody,requireRole,supabase} from './auth-utils.js';
import {ROUND_TYPE,ROUND_PROMPT,clean,validDate,validateEntries,normalizeDraft,visibleRound} from '../lib/field-rounds.js';

const ID=/^field-round-[0-9a-f-]{36}$/;
async function readRound(id){
 const rows=await supabase('jms_routes?id=eq.'+encodeURIComponent(id)+'&select=id,data&limit=1');
 return rows?.[0]?.data;
}
const publicRecord=r=>{const {generation,...rest}=r;return {...rest,analysis_status:generation?.status||'unavailable'};};
export default async function handler(req,res){
 const auth=requireRole(req,['rep','admin','sales']);
 if(!auth)return json(res,401,{ok:false,message:'سجل الدخول إلى JMS أولًا.'});
 if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,message:'طريقة غير مدعومة.'});
 try{
  const users=await supabase('jms_users?id=eq.'+encodeURIComponent(auth.id)+'&select=id,data&limit=1');
  const account=users?.[0]?.data;
  if(!account||account.status==='disabled'||account.status==='inactive'||account.role!==auth.role)return json(res,403,{ok:false,message:'الحساب غير مخوّل.'});
  const repName=clean(account.name)||'مندوب';
  if(req.method==='GET'){
   const query=new URL(req.url,'https://jms.local').searchParams;
   const id=query.get('id');
   if(id){
    if(!ID.test(id))return json(res,400,{ok:false,message:'معرف غير صالح.'});
    const record=await readRound(id);
    if(!visibleRound(record,auth))return json(res,404,{ok:false,message:'التقرير غير موجود أو غير متاح لك.'});
    return json(res,200,{ok:true,record:publicRecord(record),user:{id:auth.id,role:auth.role,name:repName}});
   }
   const offset=Math.floor(Math.max(0,Math.min(10000,Number(query.get('offset'))||0)));
   const date=query.get('date');
   if(date&&!validDate(date))return json(res,400,{ok:false,message:'تاريخ غير صالح.'});
   const scope=auth.role==='rep'?'&data->>rep_id=eq.'+encodeURIComponent(auth.id):'&or=(data->>rep_id.eq.'+encodeURIComponent(auth.id)+',data->>status.eq.submitted)';
   const rows=await supabase('jms_routes?select=id,data&data->>record_type=eq.field_round'+scope+(date?'&data->>date=eq.'+date:'')+'&order=updated_at.desc&limit=51&offset='+offset);
   const records=(rows||[]).map(r=>r.data).filter(r=>visibleRound(r,auth));
   return json(res,200,{ok:true,records:records.slice(0,50).map(publicRecord),hasMore:records.length>50,user:{id:auth.id,role:auth.role,name:repName}});
  }
  const body=await readBody(req);
  if(body.action==='prepare'){
   const source=clean(body.text,8001),area=clean(body.area,120),date=body.date;
   if(!source||source.length>8000||!area||!validDate(date))return json(res,400,{ok:false,message:'حدد الحي والتاريخ واكتب ملخصًا حتى 8000 حرف.'});
   // Owner and content determine the ID: retries cannot duplicate a generation or report.
   const hash=crypto.createHash('sha256').update(JSON.stringify([auth.id,date,area,source])).digest('hex');
   const id='field-round-'+[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join('-');
   const existing=await readRound(id);
   if(existing){
    if(existing.rep_id!==auth.id)return json(res,409,{ok:false,message:'تعارض في المعرف.'});
    return json(res,200,{ok:true,record:publicRecord(existing)});
   }
   const stamp=new Date().toISOString();
   const record={id,record_type:ROUND_TYPE,rep_id:auth.id,rep_name:repName,date,area,source_text:source,status:'draft',entries:[],clarification:'',created_at:stamp,updated_at:stamp,entry_method:'rep_report',generation:{id:crypto.randomUUID(),status:'pending',model:process.env.OPENAI_MODEL||'gpt-4.1-mini',usage:null,estimated_cost:null}};
   // Insert once, never overwrite an existing draft during simultaneous retries.
   const inserted=await supabase('jms_routes?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify([{id,data:record,updated_at:stamp}])});
   if(!inserted?.length)return json(res,200,{ok:true,record:publicRecord(await readRound(id))});
   if(process.env.OPENAI_API_KEY){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
    try{
     const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model:record.generation.model,max_output_tokens:4500,input:[{role:'system',content:ROUND_PROMPT},{role:'user',content:JSON.stringify({text:source,area,date})}]})});
     if(!response.ok)throw new Error('model_unavailable');
     const result=await response.json();
     const text=result.output_text||(result.output||[]).flatMap(x=>(x.content||[]).map(c=>c.text||'')).join('\n');
     record.generation={...record.generation,status:'complete',usage:result.usage||null,raw_output:text};
     Object.assign(record,normalizeDraft(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,'').trim()),area));
    }catch{
     record.generation.status='error';
     record.clarification='تعذر التحليل الآلي. كلامك محفوظ؛ أضف الأماكن يدويًا في الجدول ثم اعتمد التقرير.';
    }finally{clearTimeout(timer);}
   }else{
    record.generation.status='unavailable';
    record.clarification='خدمة الذكاء الاصطناعي غير مهيأة. كلامك محفوظ؛ أضف الأماكن يدويًا.';
   }
   record.updated_at=new Date().toISOString();
   // Conditional patch avoids overwriting a report manually submitted while AI was running.
   await supabase('jms_routes?id=eq.'+encodeURIComponent(id)+'&data->>status=eq.draft&data->generation->>status=eq.pending',{method:'PATCH',body:JSON.stringify({data:record,updated_at:record.updated_at})});
   return json(res,200,{ok:true,record:publicRecord(await readRound(id))});
  }
  if(body.action==='submit'){
   if(!ID.test(body.id||''))return json(res,400,{ok:false,message:'معرف غير صالح.'});
   const record=await readRound(body.id);
   // Only the author can attest to their field activity, even for a manager account.
   if(!record||record.record_type!==ROUND_TYPE||record.rep_id!==auth.id)return json(res,404,{ok:false,message:'المسودة غير موجودة أو ليست لك.'});
   if(record.status==='submitted')return json(res,200,{ok:true,record:publicRecord(record)});
   if(body.confirmed!==true)return json(res,400,{ok:false,message:'راجع التقرير وأكد صحة ما سجلته.'});
   let entries;try{entries=validateEntries(body.entries);}catch(e){return json(res,400,{ok:false,message:e.message});}
   const stamp=new Date().toISOString();
   const saved={...record,entries,status:'submitted',submitted_at:stamp,updated_at:stamp};
   const updated=await supabase('jms_routes?id=eq.'+encodeURIComponent(record.id)+'&data->>status=eq.draft',{method:'PATCH',body:JSON.stringify({data:saved,updated_at:stamp})});
   return json(res,200,{ok:true,record:publicRecord(updated?.[0]?.data||await readRound(record.id))});
  }
  return json(res,400,{ok:false,message:'إجراء غير مدعوم.'});
 }catch(e){
  console.error('field rounds failed',e?.name||'Error');
  return json(res,503,{ok:false,message:'تعذر الحفظ أو تحميل التقرير. لا تغلق المسودة؛ أعد المحاولة.'});
 }
}
