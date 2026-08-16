import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

function isMissingColumn(error, column){
  const msg=String(error?.message||error||'').toLowerCase();
  return msg.includes(String(column).toLowerCase()) && (msg.includes('column') || msg.includes('pgrst') || msg.includes('42703'));
}

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  try{
    if(req.method==='GET'){
      let rows=[];
      try{
        const filter=auth.role==='rep'?'&rep_id=eq.'+encodeURIComponent(auth.id):'';
        rows=await supabase('jms_ready_goods?select=id,rep_id,customer_id,data,updated_at'+filter+'&order=updated_at.desc');
      }catch(e){
        if(!isMissingColumn(e,'rep_id')&&!isMissingColumn(e,'customer_id')) throw e;
        const legacy=await supabase('jms_ready_goods?select=id,data,updated_at&order=updated_at.desc');
        rows=(legacy||[]).filter(r=>auth.role!=='rep'||String(r?.data?.rep_id||'')===String(auth.id));
      }
      return json(res,200,{ok:true,items:(rows||[]).map(r=>({...r.data,id:r.data?.id||r.id,_cloud_updated_at:r.updated_at}))});
    }
    if(req.method==='POST'){
      const body=await readBody(req), items=Array.isArray(body.items)?body.items:[];
      const allowed=items.filter(x=>x&&x.id&&(auth.role!=='rep'||String(x.rep_id)===String(auth.id))).slice(0,200);
      if(!allowed.length) return json(res,200,{ok:true,count:0});
      const now=new Date().toISOString();
      const normalized=allowed.map(x=>({id:String(x.id),rep_id:String(x.rep_id||auth.id),customer_id:String(x.customer_id||''),data:{...x,rep_id:String(x.rep_id||auth.id),customer_id:String(x.customer_id||''),updated_at:x.updated_at||now},updated_at:x.updated_at||now}));
      try{
        await supabase('jms_ready_goods?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(normalized)});
      }catch(e){
        if(!isMissingColumn(e,'rep_id')&&!isMissingColumn(e,'customer_id')) throw e;
        const legacy=normalized.map(({id,data,updated_at})=>({id,data,updated_at}));
        await supabase('jms_ready_goods?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(legacy)});
      }
      return json(res,200,{ok:true,count:normalized.length});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(e){console.error('ready-goods-sync failed',e);return json(res,500,{ok:false,error:'server_error',message:e.message})}
}
