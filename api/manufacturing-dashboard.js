import { json, authFromRequest, supabase } from './auth-utils.js';

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(!['admin','sales','rep'].includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    let orderPath='jms_mfg_orders?select=*&order=updated_at.desc&limit=200';
    if(auth.role==='rep') orderPath+='&rep_id=eq.'+encodeURIComponent(auth.id);
    const orders=await supabase(orderPath);
    const ids=(orders||[]).map(x=>x.id);
    let operations=[],stock=[];
    if(ids.length){
      const filter=ids.map(id=>'"'+String(id).replace(/"/g,'')+'"').join(',');
      operations=await supabase('jms_mfg_operations?select=*&manufacturing_order_id=in.('+encodeURIComponent(filter)+')&order=manufacturing_order_id.asc,seq.asc');
      stock=await supabase('jms_ready_stock?select=*&manufacturing_order_id=in.('+encodeURIComponent(filter)+')&order=updated_at.desc');
    }
    const byOrder=new Map();
    for(const o of orders||[]) byOrder.set(o.id,{...o,operations:[],ready_stock:[]});
    for(const op of operations||[]) byOrder.get(op.manufacturing_order_id)?.operations.push(op);
    for(const s of stock||[]) byOrder.get(s.manufacturing_order_id)?.ready_stock.push(s);
    const list=[...byOrder.values()];
    const summary={
      total:list.length,
      planned:list.filter(x=>x.status==='planned'||x.status==='released').length,
      in_progress:list.filter(x=>x.status==='in_progress').length,
      completed:list.filter(x=>x.status==='completed').length,
      on_hold:list.filter(x=>x.status==='on_hold').length,
      avg_progress:list.length?Math.round(list.reduce((a,x)=>a+Number(x.progress_percent||0),0)/list.length):0,
      ready_stock_kg:(stock||[]).filter(x=>x.status==='available').reduce((a,x)=>a+Number(x.qty_kg||0),0),
      ready_stock_pcs:(stock||[]).filter(x=>x.status==='available').reduce((a,x)=>a+Number(x.qty_pcs||0),0)
    };
    return json(res,200,{ok:true,summary,orders:list});
  }catch(e){console.error('manufacturing-dashboard failed',e);return json(res,500,{ok:false,error:'server_error',message:e.message});}
}
