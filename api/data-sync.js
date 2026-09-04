import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

const TABLES={customers:'jms_customers',quotes:'jms_quotes',visits:'jms_visits',orders:'jms_orders',collections:'jms_collections'};
const REP_KEYS=['sales_rep_id','representative_id','agent_id','salesman_id','repId','rep_id'];
function clean(v){return String(v??'').trim();}
function norm(v){return clean(v).toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'').replace(/[^\p{L}\p{N}]+/gu,'');}
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
function canonicalRepId(item,resolve){
  for(const key of REP_KEYS){const id=resolve(item?.[key]);if(id)return id;}
  return '';
}
function ownedBy(auth,item){return auth.role!=='rep'||String(item?.rep_id||'')===String(auth.id);}

export default async function handler(req,res){
  const auth=authFromRequest(req);if(!auth)return json(res,401,{ok:false,error:'unauthorized'});
  try{
    // jms_users stores display name/role/status inside the JSON `data` column.
    const users=await supabase('jms_users?select=id,email,data,updated_at&order=updated_at.desc');
    let reps=(users||[]).map(u=>({
      id:u.id,
      name:u.data?.name||u.email||u.id,
      email:u.email||'',
      role:u.data?.role||'',
      status:u.data?.status||'active'
    })).filter(u=>u.role==='rep');
    if(auth.role==='rep')reps=reps.filter(r=>String(r.id)===String(auth.id));
    const resolve=repResolver(reps);

    if(req.method==='GET'){
      const out={reps};let unmappedCustomers=0,unmappedDebt=0;
      for(const [key,table] of Object.entries(TABLES)){
        const rows=await supabase(table+'?select=id,data,updated_at&order=updated_at.desc');
        out[key]=(rows||[]).map(r=>{
          const raw={...r.data,id:r.data?.id||r.id,_cloud_updated_at:r.updated_at};
          const rep_id=canonicalRepId(raw,resolve);
          const item={...raw,rep_id};
          if(key==='customers'&&!rep_id){unmappedCustomers++;unmappedDebt+=Number(item.debt_balance||0);}
          return item;
        }).filter(x=>ownedBy(auth,x));
      }
      return json(res,200,{ok:true,data:out,diagnostics:{unmappedCustomers,unmappedDebt}});
    }
    if(req.method==='POST'){
      const body=await readBody(req),data=body?.data||{},result={};
      for(const [key,table] of Object.entries(TABLES)){
        const source=Array.isArray(data[key])?data[key]:[];
        const normalized=source.map(x=>({...x,rep_id:canonicalRepId(x,resolve)||clean(x?.rep_id)}));
        const allowed=normalized.filter(x=>x&&x.id&&ownedBy(auth,x)).slice(0,1000);
        if(!allowed.length){result[key]=0;continue;}
        const now=new Date().toISOString();
        const rows=allowed.map(x=>({id:String(x.id),data:{...x,updated_at:x.updated_at||now},updated_at:x.updated_at||now}));
        await supabase(table+'?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
        result[key]=rows.length;
      }
      return json(res,200,{ok:true,count:result});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(e){console.error('data-sync failed',e);return json(res,500,{ok:false,error:'server_error'});}
}
