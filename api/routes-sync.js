import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

function allowed(auth,route){
  return auth.role!=='rep'||String(route?.rep_id||'')===String(auth.id);
}

function isRadarLead(route){
  return route?.record_type==='radar_lead'||String(route?.id||'').startsWith('radar-lead-');
}

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth)return json(res,401,{ok:false,error:'unauthorized'});
  try{
    if(req.method==='GET'){
      const rows=await supabase('jms_routes?select=id,data,updated_at&order=updated_at.desc');
      const items=(rows||[]).map(r=>({...r.data,id:r.data?.id||r.id,_cloud_updated_at:r.updated_at})).filter(r=>!isRadarLead(r)&&allowed(auth,r));
      return json(res,200,{ok:true,items});
    }
    if(req.method==='POST'){
      const body=await readBody(req),items=Array.isArray(body.items)?body.items:[];
      const allowedItems=items.filter(r=>r&&r.id&&!isRadarLead(r)&&allowed(auth,r)).slice(0,500);
      if(!allowedItems.length)return json(res,200,{ok:true,count:0});
      const now=new Date().toISOString();
      const rows=allowedItems.map(r=>({id:String(r.id),data:{...r,updated_at:r.updated_at||now},updated_at:r.updated_at||now}));
      await supabase('jms_routes?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
      return json(res,200,{ok:true,count:rows.length});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(e){console.error('routes-sync failed',e);return json(res,500,{ok:false,error:'server_error'});}
}
