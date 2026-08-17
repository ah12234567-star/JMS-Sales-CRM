import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

const PRODUCTION_ROLES=['admin','sales','production','mfg_operator'];
function canOperate(auth){ return PRODUCTION_ROLES.includes(auth?.role); }
function autoBatchNo(op){
  const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  const prefix=op?.work_center==='mixing'?'MIX':String(op?.work_center||'BATCH').toUpperCase();
  return `${prefix}-${op?.manufacturing_order_id||'MO'}-${stamp}`;
}

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
      const rows=await supabase('jms_mfg_operations?id=eq.'+encodeURIComponent(operationId)+'&select=*&limit=1');
      const op=rows?.[0];
      if(!op) return json(res,404,{ok:false,error:'operation_not_found'});
      const actual=body.actual&&typeof body.actual==='object'?body.actual:{};
      const clientEventId=String(body.client_event_id||'').trim()||`evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const batchNo=String(body.batch_no||'').trim()||autoBatchNo(op);
      const rpcBody={
        p_operation_id:operationId,
        p_actual:actual,
        p_output_kg:Number(body.output_kg||0),
        p_output_pcs:Number(body.output_pcs||0),
        p_waste_kg:Number(body.waste_kg||0),
        p_waste_type:String(body.waste_type||'other'),
        p_batch_no:batchNo,
        p_client_event_id:clientEventId,
        p_actor_id:auth.id
      };
      const result=await supabase('rpc/jms_mfg_complete_operation',{method:'POST',body:JSON.stringify(rpcBody)});
      const batchId=result?.batch_id||null;
      if(op.work_center==='mixing' && batchId){
        const nextRows=await supabase('jms_mfg_operations?manufacturing_order_id=eq.'+encodeURIComponent(op.manufacturing_order_id)+'&seq=gt.'+encodeURIComponent(op.seq)+'&order=seq.asc&limit=1&select=id,batch_id');
        const nextOp=nextRows?.[0];
        if(nextOp?.id){
          await supabase('jms_mfg_operations?id=eq.'+encodeURIComponent(nextOp.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({batch_id:batchId,updated_at:new Date().toISOString()})});
        }
      }
      return json(res,200,{ok:true,result,batch_no:batchNo,batch_id:batchId,client_event_id:clientEventId});
    }

    if(action==='cancel'){
      const now=new Date().toISOString();
      await supabase('jms_mfg_operations?id=eq.'+encodeURIComponent(operationId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'cancelled',updated_at:now,actual:{cancel_reason:String(body.reason||'')}})});
      return json(res,200,{ok:true,status:'cancelled',operation_id:operationId});
    }

    return json(res,400,{ok:false,error:'unsupported_action'});
  }catch(e){
    console.error('manufacturing-operation failed',e);
    return json(res,500,{ok:false,error:'server_error',message:e.message});
  }
}
