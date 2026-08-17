import { json, supabase } from './auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  const stamp=Date.now().toString(36);
  const sourceOrderId='e2e-batch-order-'+stamp;
  const mfgId='e2e-batch-mfg-'+stamp;
  const customerId='e2e-batch-customer';
  const actor='e2e-batch-system';
  const created={source:false,mfg:false};
  try{
    const now=new Date().toISOString();
    await supabase('jms_orders?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:sourceOrderId,data:{id:sourceOrderId,customer_id:customerId,rep_id:'e2e-rep',product:'أكياس بلاستيك',material:'LD',total_kg:10,pieces:500,status:'batch_verify',created_at:now},updated_at:now}])});
    created.source=true;
    await supabase('rpc/jms_mfg_create_order',{method:'POST',body:JSON.stringify({p_id:mfgId,p_order_no:'MO-BATCH-'+stamp.toUpperCase(),p_source_order_id:sourceOrderId,p_source_quote_id:null,p_customer_id:customerId,p_rep_id:'e2e-rep',p_planned_qty_kg:10,p_planned_qty_pcs:500,p_product_spec:{material:'LD'},p_created_by:actor})});
    created.mfg=true;
    const ops=[
      {seq:10,name:'mixing',kg:10,pcs:0,batch:'MIX-'+stamp,waste:0,type:'raw_material'},
      {seq:20,name:'extrusion',kg:9.8,pcs:0,batch:'FILM-'+stamp,waste:0.2,type:'film'},
      {seq:30,name:'printing',kg:9.7,pcs:0,batch:'PRINT-'+stamp,waste:0.1,type:'ink'},
      {seq:40,name:'cutting',kg:9.5,pcs:475,batch:'FG-'+stamp,waste:0.2,type:'cutting'}
    ];
    const results=[];
    for(let i=0;i<ops.length;i++){
      const op=ops[i];
      const r=await supabase('rpc/jms_mfg_complete_operation',{method:'POST',body:JSON.stringify({p_operation_id:mfgId+'-op-'+op.seq,p_actual:{e2e:true,stage:op.name},p_output_kg:op.kg,p_output_pcs:op.pcs,p_waste_kg:op.waste,p_waste_type:op.type,p_batch_no:op.batch,p_client_event_id:'evt-'+stamp+'-'+op.seq,p_actor_id:actor})});
      results.push({seq:op.seq,name:op.name,result:r});
    }
    const rows=await supabase('jms_mfg_operations?manufacturing_order_id=eq.'+encodeURIComponent(mfgId)+'&select=seq,work_center,status,batch_id&order=seq.asc');
    const stock=await supabase('jms_ready_stock?manufacturing_order_id=eq.'+encodeURIComponent(mfgId)+'&select=id,batch_id,qty_kg,qty_pcs,status&limit=5');
    const ok=Array.isArray(rows)&&rows.length===4&&rows.every(x=>x.status==='completed'&&x.batch_id)&&Array.isArray(stock)&&stock.length===1&&stock[0].batch_id===rows[3].batch_id;
    return json(res,ok?200:500,{ok,results,operations:rows,ready_stock:stock});
  }catch(e){ return json(res,500,{ok:false,error:e.message}); }
  finally{
    try{ if(created.mfg) await supabase('jms_mfg_orders?id=eq.'+encodeURIComponent(mfgId),{method:'DELETE'}); }catch(_){ }
    try{ if(created.source) await supabase('jms_orders?id=eq.'+encodeURIComponent(sourceOrderId),{method:'DELETE'}); }catch(_){ }
  }
}
