import crypto from 'node:crypto';
import { supabase } from './auth-utils.js';

function safeEqual(left,right){const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&a.length>=32&&crypto.timingSafeEqual(a,b)}
async function one(table,id){const rows=await supabase(table+'?id=eq.'+encodeURIComponent(id)+'&select=id,data&limit=1');return rows?.[0]||null}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 try{
  const id=String(req.body?.id||''),token=String(req.body?.token||'');
  if(!id||!token||id.length>160||token.length>160)return res.status(400).json({error:'invalid_request'});
  const row=await one('jms_quotes',id),q=row?.data;
  if(!row||!safeEqual(q?.public_token,token))return res.status(404).json({error:'quote_not_found'});
  if(q.status!=='customer_approved')return res.status(409).json({error:'quote_not_approved'});
  const orderId='quote-'+id,now=new Date().toISOString();
  const existing=await one('jms_orders',orderId);
  const currentOrder=existing?.data||{};
  if(!existing){
   const order={id:orderId,date:now.slice(0,10),customer_id:q.customer_id,rep_id:q.rep_id,product:q.product,material:q.material,color:q.color,print:q.print,width:q.width,length:q.length,size_unit:q.size_unit,thickness:q.thickness,thickness_unit:q.thickness_unit,total_kg:q.total_kg,piece_weight:q.piece_weight,pieces:q.pieces,amount:String(q.total_amount||0)+' ريال',amount_value:Number(q.total_amount||0),status:'بانتظار اعتماد المدير',manager_approval_required:true,source:'customer_approved_quote',source_quote_id:q.id,source_quote_no:q.quote_no,customer_signer_name:q.customer_signer_name,customer_approved_at:q.customer_approved_at,notes:'تم الإنشاء تلقائياً من عرض السعر المعتمد '+(q.quote_no||'')};
   await supabase('jms_orders?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:orderId,data:order,updated_at:now}])});
  }else if(!currentOrder.manager_approved_at&&currentOrder.status!=='بانتظار اعتماد المدير'){
   const pending={...currentOrder,status:'بانتظار اعتماد المدير',manager_approval_required:true};
   await supabase('jms_orders?id=eq.'+encodeURIComponent(orderId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({data:pending,updated_at:now})});
  }
  if(!q.converted_to_order||q.production_order_id!==orderId){
   const next={...q,converted_to_order:true,converted_at:q.converted_at||now,production_order_id:orderId,production_status:'بانتظار اعتماد المدير'};
   await supabase('jms_quotes?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({data:next,updated_at:now})});
  }
  return res.status(200).json({ok:true,orderId,created:!existing});
 }catch(error){console.error('quote production conversion failed',error);return res.status(500).json({error:'internal_error'})}
}
