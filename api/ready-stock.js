import { json, authFromRequest, supabase } from './auth-utils.js';

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(!['admin','sales','rep'].includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    let ordersPath='jms_mfg_orders?select=id,order_no,source_order_id,customer_id,rep_id,status,product_spec,produced_qty_kg,produced_qty_pcs,progress_percent&status=eq.completed&order=updated_at.desc';
    if(auth.role==='rep') ordersPath+='&rep_id=eq.'+encodeURIComponent(auth.id);
    const orders=await supabase(ordersPath);
    const ids=(orders||[]).map(x=>x.id);
    if(!ids.length) return json(res,200,{ok:true,items:[]});
    const filter=ids.map(id=>'"'+String(id).replace(/"/g,'')+'"').join(',');
    const stock=await supabase('jms_ready_stock?select=*&status=in.(available,reserved)&manufacturing_order_id=in.('+encodeURIComponent(filter)+')&order=updated_at.desc');
    const orderMap=new Map((orders||[]).map(o=>[o.id,o]));
    const items=(stock||[]).map(s=>({...s,manufacturing_order:orderMap.get(s.manufacturing_order_id)||null}));
    return json(res,200,{ok:true,items});
  }catch(e){console.error('ready-stock failed',e);return json(res,500,{ok:false,error:'server_error',message:e.message});}
}
