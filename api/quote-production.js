import crypto from 'node:crypto';

const SUPABASE_URL=process.env.SUPABASE_URL||'https://jvwjwakkimnveveglxwa.supabase.co';
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY||'sb_publishable_jN3PnVaj7uarVnJRvBmx-g_zIKhl1UP';
const headers=(extra={})=>({apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',...extra});
function safeEqual(left,right){const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&a.length>=32&&crypto.timingSafeEqual(a,b)}
async function one(table,id){const r=await fetch(SUPABASE_URL+'/rest/v1/'+table+'?id=eq.'+encodeURIComponent(id)+'&select=id,data&limit=1',{headers:headers()});if(!r.ok)throw new Error('lookup_failed');return (await r.json())?.[0]}

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
   const order={id:orderId,date:now.slice(0,10),customer_id:q.customer_id,rep_id:q.rep_id,product:q.product,material:q.material,color:q.color,print:q.print,width:q.width,length:q.length,size_unit:q.size_unit,thickness:q.thickness,thickness_unit:q.thickness_unit,total_kg:q.total_kg,piece_weight:q.piece_weight,pieces:q.pieces,amount:String(q.total_amount||0)+' ريال',amount_value:Number(q.total_amount||0),status:'قيد الإنتاج',manager_approval_required:false,customer_approval_auto_routed:true,sent_to_production_at:now,source:'customer_approved_quote',source_quote_id:q.id,source_quote_no:q.quote_no,customer_signer_name:q.customer_signer_name,customer_approved_at:q.customer_approved_at,notes:'تم الإنشاء تلقائياً من عرض السعر المعتمد '+(q.quote_no||'')};
   const create=await fetch(SUPABASE_URL+'/rest/v1/jms_orders',{method:'POST',headers:headers({Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({id:orderId,data:order,updated_at:now})});
   if(!create.ok){console.error('production order create failed',create.status,await create.text());return res.status(503).json({error:'order_create_failed'})}
  }else if(currentOrder.source==='customer_approved_quote'&&(currentOrder.manager_approval_required||currentOrder.status==='بانتظار اعتماد المدير')){
   const routed={...currentOrder,status:'قيد الإنتاج',manager_approval_required:false,customer_approval_auto_routed:true,sent_to_production_at:currentOrder.sent_to_production_at||now};
   const updateOrder=await fetch(SUPABASE_URL+'/rest/v1/jms_orders?id=eq.'+encodeURIComponent(orderId),{method:'PATCH',headers:headers({Prefer:'return=minimal'}),body:JSON.stringify({data:routed,updated_at:now})});
   if(!updateOrder.ok)return res.status(503).json({error:'order_status_update_failed'});
  }
  if(!q.converted_to_order||q.production_order_id!==orderId){
   const next={...q,converted_to_order:true,converted_at:q.converted_at||now,production_order_id:orderId,production_status:'قيد الإنتاج'};
   const update=await fetch(SUPABASE_URL+'/rest/v1/jms_quotes?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:headers({Prefer:'return=minimal'}),body:JSON.stringify({data:next,updated_at:now})});
   if(!update.ok)return res.status(503).json({error:'quote_update_failed'});
  }
  return res.status(200).json({ok:true,orderId,created:!existing,status:'قيد الإنتاج'});
 }catch(error){console.error('quote production conversion failed',error);return res.status(500).json({error:'internal_error'})}
}
