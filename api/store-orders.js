import crypto from 'node:crypto';
import { json, readBody, authFromRequest, supabase } from './auth-utils.js';
import { catalogInternal } from './store-catalog.js';
import { storePrivate } from './customer-auth-utils.js';

function clean(value,max=200){return String(value??'').trim().slice(0,max)}
function normalizePhone(value){
  let phone=clean(value,30).replace(/\D/g,'');
  if(phone.startsWith('00966'))phone=phone.slice(2);
  if(phone.startsWith('05')&&phone.length===10)phone='966'+phone.slice(1);
  if(phone.startsWith('5')&&phone.length===9)phone='966'+phone;
  return phone;
}
function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,24)}
function tierPrice(product,quantity){
  let price=Number(product.price||0);
  for(const tier of [...(product.tiers||[])].sort((a,b)=>Number(a.min_qty)-Number(b.min_qty))){
    if(quantity>=Number(tier.min_qty||0))price=Number(tier.price||price);
  }
  return price;
}

async function findOrCreateCustomer(input,phone){
  const rows=await supabase('jms_customers?select=id,data,updated_at&order=updated_at.desc');
  const existing=(rows||[]).map(row=>({...row.data,id:row.data?.id||row.id})).find(customer=>normalizePhone(customer.phone||customer.mobile)===phone);
  if(existing){
    const now=new Date().toISOString(),updated={...existing,name:clean(input.name,120)||existing.name||'',phone,email:clean(input.email,160)||existing.email||'',city:clean(input.city,80)||existing.city||'جدة',district:clean(input.district,120)||existing.district||'',location:clean(input.address,300)||existing.location||existing.address||'',updated_at:now};
    await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:existing.id,data:updated,updated_at:now}])});
    return updated;
  }
  const now=new Date().toISOString();
  const id=`store-customer-${hash(phone)}`;
  const customer={id,name:clean(input.name,120),phone,email:clean(input.email,160),city:clean(input.city,80)||'جدة',district:clean(input.district,120),location:clean(input.address,300),category:'عميل متجر إلكتروني',status:'active',rep_id:'',debt_balance:0,credit_limit:0,notes:'تم إنشاؤه تلقائيًا من متجر العملاء',created_at:now,updated_at:now};
  await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id,data:customer,updated_at:now}])});
  return customer;
}

export default async function handler(req,res){
  try{
    if(req.method==='POST'){
      const auth=authFromRequest(req);
      if(storePrivate()&&!['admin','customer'].includes(auth?.role))return json(res,403,{ok:false,error:'store_private'});
      if(!storePrivate()&&!['admin','customer'].includes(auth?.role))return json(res,401,{ok:false,error:'customer_login_required'});
      const body=await readBody(req);
      if(clean(body.website,50)) return json(res,400,{ok:false,error:'invalid_request'});
      const customerInput=body.customer||{};
      const name=clean(customerInput.name,120);
      const phone=normalizePhone(auth?.role==='customer'?auth.phone:customerInput.phone);
      if(name.length<2||phone.length<9) return json(res,400,{ok:false,error:'customer_details_required',message:'اكتب الاسم ورقم الجوال بشكل صحيح.'});
      const requested=Array.isArray(body.items)?body.items.slice(0,40):[];
      if(!requested.length)return json(res,400,{ok:false,error:'empty_cart',message:'السلة فارغة.'});
      const catalog=await catalogInternal();
      const byId=new Map(catalog.map(item=>[`variant-${item.sku}`,item]));
      const items=[];
      for(const row of requested){
        const product=byId.get(clean(row.variant_id,100));
        const quantity=Math.round(Number(row.quantity||0)*1000)/1000;
        if(!product||!product.visible||!product.available||quantity<=0) return json(res,409,{ok:false,error:'product_unavailable',message:'أحد الأصناف لم يعد متوفرًا.'});
        if(quantity>Number(product.stock)) return json(res,409,{ok:false,error:'insufficient_stock',message:`الكمية المتوفرة من ${product.product_name} هي ${product.stock} ${product.unit}.`});
        const unitPrice=tierPrice(product,quantity);
        items.push({sku:product.sku,product_name:product.product_name,attributes:product.attributes,unit:product.unit,quantity,unit_price:unitPrice,total:Math.round(unitPrice*quantity*100)/100});
      }
      const customer=await findOrCreateCustomer({...customerInput,name},phone);
      const now=new Date().toISOString();
      const id=`store-order-${crypto.randomUUID()}`;
      const total=Math.round(items.reduce((sum,item)=>sum+item.total,0)*100)/100;
      const order={
        id,date:now.slice(0,10),created_at:now,updated_at:now,status:'طلب متجر جديد',source:'customer_store',
        customer_id:customer.id,rep_id:customer.rep_id||'',customer_name:customer.name,customer_phone:phone,
        city:clean(customerInput.city,80)||'جدة',district:clean(customerInput.district,120),address:clean(customerInput.address,300),
        product:items.map(item=>`${item.product_name} (${item.quantity} ${item.unit})`).join('، '),
        items,amount:`${total} ريال`,amount_value:total,total,
        notes:clean(customerInput.notes,500)||'طلب وارد من متجر العملاء'
      };
      await supabase('jms_orders?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id,data:order,updated_at:now}])});
      return json(res,201,{ok:true,order_id:id,order_no:id.slice(-8).toUpperCase(),total,status:order.status});
    }
    if(req.method==='GET'){
      const auth=authFromRequest(req);
      if(!auth||!['admin','sales'].includes(auth.role))return json(res,403,{ok:false,error:'forbidden'});
      const rows=await supabase('jms_orders?select=id,data,updated_at&order=updated_at.desc');
      const orders=(rows||[]).map(row=>({...row.data,id:row.data?.id||row.id})).filter(order=>order.source==='customer_store');
      return json(res,200,{ok:true,orders});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(error){
    console.error('store-orders failed',error);
    return json(res,500,{ok:false,error:'server_error'});
  }
}
