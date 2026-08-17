import { json, supabase } from './auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  const stamp=Date.now().toString(36);
  const sourceOrderId='e2e-order-'+stamp;
  const mfgId='e2e-mfg-'+stamp;
  const lotId='e2e-lot-'+stamp;
  const customerId='e2e-customer';
  const actor='e2e-system';
  const out={steps:[]};
  let createdSource=false, createdMfg=false, createdLot=false;
  try{
    const now=new Date().toISOString();
    const sourceData={
      id:sourceOrderId,
      customer_id:customerId,
      rep_id:'e2e-rep',
      product:'أكياس بلاستيك',
      material:'LD',
      color:'شفاف',
      width:32,
      length:40,
      thickness:100,
      total_kg:100,
      pieces:5000,
      status:'اختبار تصنيع E2E',
      created_at:now
    };
    await supabase('jms_orders?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:sourceOrderId,data:sourceData,updated_at:now}])});
    createdSource=true;
    out.steps.push({step:'sales_order',ok:true,id:sourceOrderId});

    const createMfg=await supabase('rpc/jms_mfg_create_order',{method:'POST',body:JSON.stringify({
      p_id:mfgId,
      p_order_no:'MO-E2E-'+stamp.toUpperCase(),
      p_source_order_id:sourceOrderId,
      p_source_quote_id:null,
      p_customer_id:customerId,
      p_rep_id:'e2e-rep',
      p_planned_qty_kg:100,
      p_planned_qty_pcs:5000,
      p_product_spec:{product_type:'أكياس بلاستيك',material:'LD',width_cm:32,length_cm:40,micron:100},
      p_created_by:actor
    })});
    createdMfg=true;
    out.steps.push({step:'manufacturing_order',ok:true,result:createMfg});

    await supabase('jms_inventory_lots?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:lotId,material_code:'LD-TEST',material_name:'LD Test Resin',lot_no:'LOT-'+stamp,warehouse:'RAW',qty_kg:150,reserved_kg:0,attributes:{e2e:true},updated_at:now}])});
    createdLot=true;
    out.steps.push({step:'inventory_lot',ok:true,qty_kg:150});

    const consume=await supabase('rpc/jms_mfg_consume_material',{method:'POST',body:JSON.stringify({
      p_move_id:'e2e-move-'+stamp,
      p_manufacturing_order_id:mfgId,
      p_operation_id:mfgId+'-op-10',
      p_inventory_lot_id:lotId,
      p_material_code:'LD-TEST',
      p_qty_kg:105,
      p_client_event_id:'e2e-consume-'+stamp,
      p_actor_id:actor,
      p_attributes:{e2e:true,blend:'LD 100%'}
    })});
    out.steps.push({step:'mixing_material_consumption',ok:true,result:consume});

    const ops=[
      {id:mfgId+'-op-10',name:'mixing',kg:103,pcs:0,waste:2,wasteType:'raw_material',batch:'MIX-'+stamp,actual:{blend:'LD 100%',batch_weight_kg:103}},
      {id:mfgId+'-op-20',name:'extrusion',kg:100,pcs:0,waste:3,wasteType:'film',batch:'FILM-'+stamp,actual:{machine_id:'EX-E2E',width_cm:32,micron:100,film_weight_kg:100}},
      {id:mfgId+'-op-30',name:'printing',kg:98,pcs:0,waste:2,wasteType:'ink',batch:'PRINT-'+stamp,actual:{colors:2,cylinders:['C1','C2'],printed_film_kg:98}},
      {id:mfgId+'-op-40',name:'cutting',kg:95,pcs:4750,waste:3,wasteType:'cutting',batch:'FG-'+stamp,actual:{finished_weight_kg:95,finished_pcs:4750}}
    ];
    for(let i=0;i<ops.length;i++){
      const op=ops[i];
      const r=await supabase('rpc/jms_mfg_complete_operation',{method:'POST',body:JSON.stringify({
        p_operation_id:op.id,
        p_actual:op.actual,
        p_output_kg:op.kg,
        p_output_pcs:op.pcs,
        p_waste_kg:op.waste,
        p_waste_type:op.wasteType,
        p_batch_no:op.batch,
        p_client_event_id:'e2e-op-'+(i+1)+'-'+stamp,
        p_actor_id:actor
      })});
      out.steps.push({step:op.name,ok:true,result:r});
    }

    const orderRows=await supabase('jms_mfg_orders?id=eq.'+encodeURIComponent(mfgId)+'&select=id,status,progress_percent,planned_qty_kg,produced_qty_kg,planned_qty_pcs,produced_qty_pcs&limit=1');
    const stockRows=await supabase('jms_ready_stock?manufacturing_order_id=eq.'+encodeURIComponent(mfgId)+'&select=id,status,qty_kg,qty_pcs,customer_id&limit=5');
    const opRows=await supabase('jms_mfg_operations?manufacturing_order_id=eq.'+encodeURIComponent(mfgId)+'&select=seq,work_center,status,batch_id,started_at,completed_at&order=seq.asc');
    out.verification={order:orderRows?.[0]||null,ready_stock:stockRows||[],operations:opRows||[]};
    out.ok=Boolean(out.verification.order?.status==='completed' && Number(out.verification.order?.progress_percent)===100 && out.verification.ready_stock?.[0]?.status==='available' && Number(out.verification.ready_stock?.[0]?.qty_kg)===95 && Number(out.verification.ready_stock?.[0]?.qty_pcs)===4750 && out.verification.operations?.every(x=>x.status==='completed'));
    return json(res,out.ok?200:500,out);
  }catch(e){
    out.ok=false; out.error=e.message; return json(res,500,out);
  }finally{
    try{ if(createdMfg) await supabase('jms_mfg_orders?id=eq.'+encodeURIComponent(mfgId),{method:'DELETE'}); }catch(_){}
    try{ if(createdLot) await supabase('jms_inventory_lots?id=eq.'+encodeURIComponent(lotId),{method:'DELETE'}); }catch(_){}
    try{ if(createdSource) await supabase('jms_orders?id=eq.'+encodeURIComponent(sourceOrderId),{method:'DELETE'}); }catch(_){}
  }
}
