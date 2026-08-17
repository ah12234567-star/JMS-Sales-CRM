import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

function canManage(auth){ return ['admin','sales'].includes(auth?.role); }
function canRead(auth){ return ['admin','sales','rep'].includes(auth?.role); }
const nowIso=()=>new Date().toISOString();
const makeId=()=>`mfg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const makeNo=()=>`MO-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(req.method==='GET'){
    if(!canRead(auth)) return json(res,403,{ok:false,error:'forbidden'});
    try{
      let path='jms_mfg_orders?select=*&order=updated_at.desc&limit=200';
      if(auth.role==='rep') path+='&rep_id=eq.'+encodeURIComponent(auth.id);
      const orders=await supabase(path);
      const ids=(orders||[]).map(x=>x.id);
      let operations=[];
      if(ids.length){
        const filter=ids.map(id=>'"'+String(id).replace(/"/g,'')+'"').join(',');
        operations=await supabase('jms_mfg_operations?select=*&manufacturing_order_id=in.('+encodeURIComponent(filter)+')&order=seq.asc');
      }
      return json(res,200,{ok:true,orders:orders||[],operations:operations||[]});
    }catch(e){console.error('manufacturing-orders GET failed',e);return json(res,500,{ok:false,error:'server_error',message:e.message});}
  }
  if(req.method==='POST'){
    if(!canManage(auth)) return json(res,403,{ok:false,error:'forbidden'});
    try{
      const body=await readBody(req);
      const sourceOrderId=String(body.source_order_id||'').trim();
      if(!sourceOrderId) return json(res,400,{ok:false,error:'missing_source_order_id'});
      const existing=await supabase('jms_mfg_orders?source_order_id=eq.'+encodeURIComponent(sourceOrderId)+'&select=*&limit=1');
      if(existing?.[0]) return json(res,200,{ok:true,created:false,order:existing[0]});

      const sourceRows=await supabase('jms_orders?id=eq.'+encodeURIComponent(sourceOrderId)+'&select=id,data&limit=1');
      const source=sourceRows?.[0]?.data;
      if(!source) return json(res,404,{ok:false,error:'sales_order_not_found'});

      const id=String(body.id||makeId());
      const orderNo=String(body.order_no||makeNo());
      const productSpec={
        product:source.product||'',material:source.material||'',color:source.color||'',print:source.print||'',
        width:source.width??null,length:source.length??null,size_unit:source.size_unit||'cm',
        thickness:source.thickness??null,thickness_unit:source.thickness_unit||'micron',
        piece_weight:source.piece_weight??null,pieces:source.pieces??null,total_kg:source.total_kg??null,
        notes:source.notes||''
      };
      const rpcBody={
        p_id:id,p_order_no:orderNo,p_source_order_id:sourceOrderId,p_source_quote_id:source.source_quote_id||null,
        p_customer_id:String(source.customer_id||''),p_rep_id:String(source.rep_id||''),
        p_planned_qty_kg:Number(source.total_kg||0),p_planned_qty_pcs:Number(source.pieces||0),
        p_product_spec:productSpec,p_created_by:auth.id
      };
      const result=await supabase('rpc/jms_mfg_create_order',{method:'POST',body:JSON.stringify(rpcBody)});
      const rows=await supabase('jms_mfg_orders?id=eq.'+encodeURIComponent(id)+'&select=*&limit=1');
      return json(res,201,{ok:true,created:true,result,order:rows?.[0]||null});
    }catch(e){console.error('manufacturing-orders POST failed',e);return json(res,500,{ok:false,error:'server_error',message:e.message});}
  }
  return json(res,405,{ok:false,error:'method_not_allowed'});
}
