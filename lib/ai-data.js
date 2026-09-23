import { supabase } from '../api/auth-utils.js';
const TABLES={customers:'jms_customers',quotes:'jms_quotes',visits:'jms_visits',orders:'jms_orders',collections:'jms_collections'};
const STRONG_REP_KEYS=['sales_rep_id','representative_id','agent_id','salesman_id','repId'];
const ALL_REP_KEYS=[...STRONG_REP_KEYS,'rep_id'];
function clean(v){return String(v??'').trim();}
function norm(v){return clean(v).toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'').replace(/[^\p{L}\p{N}]+/gu,'');}
function zeroSmallCustomerDebt(item){
  if(!item)return item;
  const balance=Number(item.debt_balance||0);
  if(balance>0&&balance<500){
    return {
      ...item,
      debt_zeroed_under_500_original: item.debt_zeroed_under_500_original??balance,
      debt_balance:0,
      account_balance_type:'clear',
      debt_age_bucket:'zeroed_small',
      debt_age_label:'أقل من 500 ريال — محسوب صفر',
      debt_overdue:false,
      aging_30:0,
      aging_60:0,
      aging_90:0,
      aging_120:0,
      aging_150:0,
      aging_over_150:0
    };
  }
  return item;
}
function repResolver(reps){
  const byId=new Map(reps.map(r=>[clean(r.id),r.id]));
  const byEmail=new Map(reps.filter(r=>r.email).map(r=>[clean(r.email).toLowerCase(),r.id]));
  return value=>{
    const raw=clean(value);if(!raw)return '';
    if(byId.has(raw))return byId.get(raw);
    if(byEmail.has(raw.toLowerCase()))return byEmail.get(raw.toLowerCase());
    const n=norm(raw);const hit=reps.find(r=>{const rn=norm(r.name);return rn&&(rn===n||rn.includes(n)||n.includes(rn));});
    return hit?.id||'';
  };
}
function repFromKeys(item,resolve,keys=ALL_REP_KEYS){
  for(const key of keys){const id=resolve(item?.[key]);if(id)return id;}
  return '';
}
function ownedBy(auth,item){return auth.role!=='rep'||String(item?.rep_id||'')===String(auth.id);}
function activityRepByCustomer(rawTables,resolve){
  const votes=new Map();
  const add=(customerId,repId,weight=1)=>{
    const c=clean(customerId),r=clean(repId);if(!c||!r)return;
    if(!votes.has(c))votes.set(c,new Map());
    const m=votes.get(c);m.set(r,(m.get(r)||0)+weight);
  };
  for(const key of ['quotes','orders','visits','collections']){
    for(const item of rawTables[key]||[]){
      const rep=repFromKeys(item,resolve);if(!rep)continue;
      add(item.customer_id,rep,key==='quotes'||key==='orders'?3:1);
    }
  }
  const out=new Map();
  for(const [customerId,m] of votes.entries()){
    const ranked=[...m.entries()].sort((a,b)=>b[1]-a[1]);
    if(ranked[0])out.set(customerId,ranked[0][0]);
  }
  return out;
}


export async function readAll(table,select='id,data,updated_at',where='',read=supabase) {
 const out=[];const pageSize=500;
 for(let offset=0;offset<100000;offset+=pageSize){
  const rows=await read(table+'?select='+select+'&order=id.asc&limit='+pageSize+'&offset='+offset+where);
  if(!Array.isArray(rows))throw new Error('invalid_crm_response');
  out.push(...rows);if(rows.length<pageSize)return out;
 }
 throw new Error('crm_query_too_large');
}
export async function loadAiData(auth,withOperations=false,withFieldRounds=false) {
 const users=await readAll('jms_users','id,email,data,updated_at');
 const reps=users.map(u=>({id:u.id,name:u.data?.name||u.email||u.id,email:u.email||'',role:u.data?.role||'',status:u.data?.status||'active'})).filter(u=>u.role==='rep');
 const resolve=repResolver(reps),rawTables={};
 const entries=Object.entries(TABLES);
 const results=await Promise.all(entries.map(async ([key,table])=>[key,(await readAll(table)).map(r=>({...r.data,id:r.id,_cloud_updated_at:r.updated_at}))]));
 for(const [key,rows] of results)rawTables[key]=rows;
 const activity=activityRepByCustomer(rawTables,resolve);
 const out={reps:auth.role==='rep'?reps.filter(r=>String(r.id)===String(auth.id)):reps,warnings:[]};
 out.customers=rawTables.customers.map(raw=>zeroSmallCustomerDebt({...raw,rep_id:repFromKeys(raw,resolve,STRONG_REP_KEYS)||activity.get(clean(raw.id))||resolve(raw.rep_id)||''})).filter(r=>ownedBy(auth,r));
 for(const key of ['quotes','visits','orders','collections'])out[key]=rawTables[key].map(raw=>({...raw,rep_id:repFromKeys(raw,resolve)})).filter(r=>ownedBy(auth,r));
 if(withFieldRounds){
  try{
   const where='&data->>record_type=eq.field_round'+(auth.role==='rep'?'&data->>rep_id=eq.'+encodeURIComponent(auth.id):'');
   out.fieldRounds=(await readAll('jms_routes','id,data,updated_at',where)).map(r=>({...r.data,id:r.id,_cloud_updated_at:r.updated_at})).filter(r=>r.status==='submitted'&&ownedBy(auth,r));
  }catch{
   out.fieldRounds=[];out.warnings.push('تعذر قراءة تقارير الجولات الميدانية');
  }
 }
 if(withOperations){
  // Store data is manager-only, matching the existing store management API.
  const requests=[['manufacturing','jms_mfg_orders','id,order_no,source_order_id,source_quote_id,customer_id,rep_id,status,data,created_at,updated_at']];
  if(auth.role!=='rep')requests.push(['storeOrders','store_orders','id,order_no,status,created_at,customer_id']);
  else out.warnings.push('بيانات المتجر متاحة للإدارة فقط');
  for(const [key,table,select] of requests){
   try{out[key]=(await readAll(table,select,auth.role==='rep'?'&rep_id=eq.'+encodeURIComponent(auth.id):'')).map(r=>({...r,due_date:r.data?.due_date||'',rep_id:r.rep_id||(out.customers.find(c=>String(c.id)===String(r.customer_id))?.rep_id||'')})).filter(r=>ownedBy(auth,r));}
   catch{out[key]=[];out.warnings.push(key==='manufacturing'?'تعذر قراءة بيانات الإنتاج':'تعذر قراءة بيانات المتجر');}
  }

  if(out.manufacturing?.length){
   try{const ops=await readAll('jms_mfg_operations','id,manufacturing_order_id,seq,work_center,status,started_at,completed_at');for(const order of out.manufacturing)order.operations=ops.filter(o=>String(o.manufacturing_order_id)===String(order.id)).sort((a,b)=>a.seq-b.seq);}
   catch{out.warnings.push('تعذر قراءة مراحل تشغيل أوامر الإنتاج');}
  }
 }
 return out;
}
