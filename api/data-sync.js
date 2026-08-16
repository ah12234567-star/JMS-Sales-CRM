import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

const TABLES={
  customers:'jms_customers',
  quotes:'jms_quotes',
  visits:'jms_visits',
  orders:'jms_orders',
  collections:'jms_collections'
};

function ownedBy(auth,key,item){
  if(auth.role!=='rep') return true;
  if(key==='customers') return String(item?.rep_id||'')===String(auth.id);
  return String(item?.rep_id||'')===String(auth.id);
}

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  try{
    if(req.method==='GET'){
      const out={};
      for(const [key,table] of Object.entries(TABLES)){
        const rows=await supabase(table+'?select=id,data,updated_at&order=updated_at.desc');
        out[key]=(rows||[]).map(r=>({...r.data,id:r.data?.id||r.id,_cloud_updated_at:r.updated_at})).filter(x=>ownedBy(auth,key,x));
      }
      return json(res,200,{ok:true,data:out});
    }
    if(req.method==='POST'){
      const body=await readBody(req), data=body?.data||{};
      const result={};
      for(const [key,table] of Object.entries(TABLES)){
        const source=Array.isArray(data[key])?data[key]:[];
        const allowed=source.filter(x=>x&&x.id&&ownedBy(auth,key,x)).slice(0,1000);
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
