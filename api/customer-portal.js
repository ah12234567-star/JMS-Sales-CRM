import { json, readBody, supabase } from './auth-utils.js';
import { clean, normalizePhone, customerAuth, customerRowByPhone, safeCustomer } from './customer-auth-utils.js';

function safeOrder(row){const order=row?.data||{};return {id:order.id||row.id,order_no:String(order.id||row.id).slice(-8).toUpperCase(),date:order.date||String(order.created_at||'').slice(0,10),status:clean(order.status,80),total:Number(order.total||order.amount_value||0),items:Array.isArray(order.items)?order.items.map(item=>({sku:clean(item.sku,100),product_name:clean(item.product_name,160),attributes:item.attributes||{},unit:clean(item.unit,40),quantity:Number(item.quantity||0),unit_price:Number(item.unit_price||0),total:Number(item.total||0)})):[]}}

export default async function handler(req,res){
  const auth=customerAuth(req);if(!auth)return json(res,401,{ok:false,error:'unauthorized'});
  try{
    const phone=normalizePhone(auth.phone),row=await customerRowByPhone(phone);
    if(!row)return json(res,404,{ok:false,error:'customer_not_found'});
    if(req.method==='GET'){
      const customer=safeCustomer(row,phone),rows=await supabase('jms_orders?select=id,data,updated_at&order=updated_at.desc');
      const orders=(rows||[]).filter(item=>normalizePhone(item.data?.customer_phone)===phone||String(item.data?.customer_id||'')===String(customer.id)).map(safeOrder);
      return json(res,200,{ok:true,customer,orders});
    }
    if(req.method==='POST'){
      const body=await readBody(req);if(body.action!=='update_profile')return json(res,400,{ok:false,error:'invalid_action'});
      const now=new Date().toISOString(),current=row.data||{},data={...current,id:row.id,name:clean(body.name,120),phone,email:clean(body.email,160),city:clean(body.city,80)||'جدة',district:clean(body.district,120),location:clean(body.address,300),updated_at:now};
      await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:row.id,data,updated_at:now}])});
      return json(res,200,{ok:true,customer:safeCustomer({id:row.id,data},phone)});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(error){console.error('customer-portal failed',error);return json(res,500,{ok:false,error:'server_error'})}
}
