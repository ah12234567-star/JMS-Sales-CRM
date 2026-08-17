import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

function canOperate(auth){ return ['admin','sales'].includes(auth?.role); }

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(!canOperate(auth)) return json(res,403,{ok:false,error:'forbidden'});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const body=await readBody(req);
    const operationId=String(body.operation_id||'').trim();
    const action=String(body.action||'complete').trim();
    if(!operationId) return json(res,400,{ok:false,error:'missing_operation_id'});

    if(action==='start'){
      const now=new Date().toISOString();
      const rows=await supabase('jms_mfg_operations?id=eq.'+encodeURIComponent(operationId)+'&select=*&limit=1');
      const op=rows?.[0];
      if(!op) return json(res,404,{ok:false,error:'operation_not_found'});
      if(!['ready','in_progress'].includes(op.status)) return json(res,409,{ok:false,error:'operation_not_ready',status:op.status});
      const next={status:'in_progress',started_at:op.started_at||now,operator_id:auth.id,machine_id:body.machine_id||op.machine_id||null,actual:{...(op.actual||{}),...(body.actual||{})},updated_at:now};
      await supabase('jms_mfg_operations?id=eq.'+encodeURIComponent(operationId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(next)});
      return json(res,200,{ok:true,status:'in_progress',operation_id:operationId});
    }

    if(action==='complete'){
      const actual=body.actual&&typeof body.actual==='object'?body.actual:{};
      const clientEventId=String(body.client_event_id||'').trim()||`evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const rpcBody={
        p_operation_id:operationId,
        p_actual:actual,
        p_output_kg:Number(body.output_kg||0),
        p_output_pcs:Number(body.output_pcs||0),
        p_waste_kg:Number(body.waste_kg||0),
        p_waste_type:String(body.waste_type||'other'),
        p_batch_no:String(body.batch_no||''),
        p_client_event_id:clientEventId,
        p_actor_id:auth.id
      };
      const result=await supabase('rpc/jms_mfg_complete_operation',{method:'POST',body:JSON.stringify(rpcBody)});
      return json(res,200,{ok:true,result,client_event_id:clientEventId});
    }

    if(action==='cancel'){
      const now=new Date().toISOString();
      await supabase('jms_mfg_operations?id=eq.'+encodeURIComponent(operationId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'cancelled',updated_at:now,actual:{cancel_reason:String(body.reason||'')}})});
      return json(res,200,{ok:true,status:'cancelled',operation_id:operationId});
    }

    return json(res,400,{ok:false,error:'unsupported_action'});
  }catch(e){console.error('manufacturing-operation failed',e);return json(res,500,{ok:false,error:'server_error',message:e.message});}
}
