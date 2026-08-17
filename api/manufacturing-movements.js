import { json, authFromRequest, readBody, supabase } from './auth-utils.js';
export default async function handler(req,res){
 const auth=authFromRequest(req); if(!auth)return json(res,401,{ok:false,error:'unauthorized'});
 if(!['admin','sales','rep','production','mfg_operator'].includes(auth.role))return json(res,403,{ok:false,error:'forbidden'});
 try{
  if(req.method==='GET'){const op=String(req.query?.operation_id||'').trim();if(!op)return json(res,400,{ok:false,error:'operation_id_required'});const movements=await supabase('jms_mfg_movements?select=*&operation_id=eq.'+encodeURIComponent(op)+'&order=roll_no.asc');return json(res,200,{ok:true,movements:movements||[],total_net_kg:(movements||[]).reduce((a,x)=>a+Number(x.net_kg||0),0)});}
  if(req.method==='POST'){const b=await readBody(req);const op=String(b.operation_id||'');if(!op)return json(res,400,{ok:false,error:'operation_id_required'});const payload={p_operation_id:op,p_machine_id:String(b.machine_id||''),p_gross_kg:Number(b.gross_kg||0),p_tube_kg:Number(b.tube_kg||0),p_qty_pcs:b.qty_pcs==null?null:Number(b.qty_pcs),p_packs_or_cartons:b.packs_or_cartons==null?null:Number(b.packs_or_cartons),p_attributes:b.attributes||{},p_client_event_id:String(b.client_event_id||('move-'+Date.now())),p_actor_id:auth.id};const out=await supabase('rpc/jms_mfg_add_movement',{method:'POST',body:JSON.stringify(payload)});return json(res,200,out||{ok:true});}
  return json(res,405,{ok:false,error:'method_not_allowed'});
 }catch(e){console.error('manufacturing-movements',e);return json(res,500,{ok:false,error:'server_error',message:e.message});}
}
