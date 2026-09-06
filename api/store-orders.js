import crypto from 'node:crypto';
import { json, readBody, authFromRequest, supabase } from './auth-utils.js';
import { catalogInternal } from './store-catalog.js';
import { storePrivate } from './customer-auth-utils.js';

const STATUS={
  NEW:'new',APPROVED:'approved',PICKING:'picking',READY:'ready',LOADED:'loaded',OUT:'out_for_delivery',DELIVERED:'delivered',CANCELLED:'cancelled'
};
const LABELS={
  new:'طلب متجر جديد',approved:'معتمد',picking:'تحت التجهيز',ready:'جاهز للتحميل',loaded:'تم التحميل',out_for_delivery:'خرج للتسليم',delivered:'تم التسليم',cancelled:'ملغي'
};
const NEXT={
  new:['approved','cancelled'],approved:['picking','cancelled'],picking:['ready','cancelled'],ready:['loaded','cancelled'],loaded:['out_for_delivery'],out_for_delivery:['delivered'],delivered:[],cancelled:[]
};
function clean(value,max=200){return String(value??'').trim().slice(0,max)}
function normalizePhone(value){let phone=clean(value,30).replace(/\D/g,'');if(phone.startsWith('00966'))phone=phone.slice(2);if(phone.startsWith('05')&&phone.length===10)phone='966'+phone.slice(1);if(phone.startsWith('5')&&phone.length===9)phone='966'+phone;return phone}
function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,24)}
function tierPrice(product,quantity){let price=Number(product.price||0);for(const tier of [...(product.tiers||[])].sort((a,b)=>Number(a.min_qty)-Number(b.min_qty))){if(quantity>=Number(tier.min_qty||0))price=Number(tier.price||price)}return price}
function actor(auth){return clean(auth?.name||auth?.email||auth?.user_name||auth?.role||'system',120)}
function normalizeStatus(order){
  if(order.workflow_status&&LABELS[order.workflow_status])return order.workflow_status;
  const raw=clean(order.status,80);
  return Object.entries(LABELS).find(([,label])=>label===raw)?.[0]||STATUS.NEW;
}
async function getOrder(id){
  const rows=await supabase(`jms_orders?id=eq.${encodeURIComponent(id)}&select=id,data,updated_at`);
  const row=Array.isArray(rows)?rows[0]:null;
  return row?{...row.data,id:row.data?.id||row.id}:null;
}
async function saveOrder(order){
  const now=new Date().toISOString();order.updated_at=now;
  await supabase('jms_orders?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:order.id,data:order,updated_at:now}])});
}
function event(status,auth,note=''){return {status,label:LABELS[status]||status,at:new Date().toISOString(),by:actor(auth),role:auth?.role||'',note:clean(note,300)}}
async function findOrCreateCustomer(input,phone){
  const rows=await supabase('jms_customers?select=id,data,updated_at&order=updated_at.desc');
  const existing=(rows||[]).map(row=>({...row.data,id:row.data?.id||row.id})).find(customer=>normalizePhone(customer.phone||customer.mobile)===phone);
  if(existing){const now=new Date().toISOString(),updated={...existing,name:clean(input.name,120)||existing.name||'',phone,email:clean(input.email,160)||existing.email||'',city:clean(input.city,80)||existing.city||'جدة',district:clean(input.district,120)||existing.district||'',location:clean(input.address,300)||existing.location||existing.address||'',updated_at:now};await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:existing.id,data:updated,updated_at:now}])});return updated}
  const now=new Date().toISOString(),id=`store-customer-${hash(phone)}`;const customer={id,name:clean(input.name,120),phone,email:clean(input.email,160),city:clean(input.city,80)||'جدة',district:clean(input.district,120),location:clean(input.address,300),category:'عميل متجر إلكتروني',status:'active',rep_id:'',debt_balance:0,credit_limit:0,notes:'تم إنشاؤه تلقائيًا من متجر العملاء',created_at:now,updated_at:now};await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id,data:customer,updated_at:now}])});return customer;
}
async function buildItems(requested){
  const catalog=await catalogInternal(),byId=new Map(catalog.map(item=>[`variant-${item.sku}`,item])),items=[];
  for(const row of requested.slice(0,60)){
    const product=byId.get(clean(row.variant_id||`variant-${row.sku}`,120)),quantity=Math.round(Number(row.quantity||0)*1000)/1000;
    if(!product||!product.visible||!product.available||quantity<=0)throw Object.assign(new Error('أحد الأصناف لم يعد متوفرًا.'),{statusCode:409,code:'product_unavailable'});
    if(quantity>Number(product.stock))throw Object.assign(new Error(`الكمية المتوفرة من ${product.product_name} هي ${product.stock} ${product.unit}.`),{statusCode:409,code:'insufficient_stock'});
    const unitPrice=tierPrice(product,quantity);items.push({sku:product.sku,product_name:product.product_name,attributes:product.attributes,unit:product.unit,quantity,unit_price:unitPrice,total:Math.round(unitPrice*quantity*100)/100});
  }
  return items;
}

export default async function handler(req,res){
  try{
    if(req.method==='GET'){
      const auth=authFromRequest(req);if(!auth||!['admin','sales'].includes(auth.role))return json(res,403,{ok:false,error:'forbidden'});
      const rows=await supabase('jms_orders?select=id,data,updated_at&order=updated_at.desc');
      const orders=(rows||[]).map(row=>({...row.data,id:row.data?.id||row.id})).filter(order=>order.source==='customer_store').map(order=>{const workflow_status=normalizeStatus(order);return {...order,workflow_status,status:LABELS[workflow_status],allowed_next:NEXT[workflow_status]||[]}});
      return json(res,200,{ok:true,orders,status_labels:LABELS});
    }
    if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
    const auth=authFromRequest(req),body=await readBody(req),action=clean(body.action,40);

    if(action){
      if(!auth||!['admin','sales'].includes(auth.role))return json(res,403,{ok:false,error:'forbidden'});
      const order=await getOrder(clean(body.order_id,120));if(!order||order.source!=='customer_store')return json(res,404,{ok:false,error:'order_not_found',message:'الطلب غير موجود.'});
      const current=normalizeStatus(order);
      if(action==='transition'){
        const target=clean(body.status,40);if(!LABELS[target])return json(res,400,{ok:false,error:'invalid_status'});
        if(!(NEXT[current]||[]).includes(target))return json(res,409,{ok:false,error:'invalid_transition',message:`لا يمكن نقل الطلب من ${LABELS[current]} إلى ${LABELS[target]}.`});
        if(target==='cancelled'&&clean(body.note,300).length<3)return json(res,400,{ok:false,error:'cancel_reason_required',message:'اكتب سبب إلغاء الطلب.'});
        order.workflow_status=target;order.status=LABELS[target];order.status_history=[...(Array.isArray(order.status_history)?order.status_history:[]),event(target,auth,body.note)];
        if(target==='approved')order.approved_at=new Date().toISOString();if(target==='ready')order.ready_at=new Date().toISOString();if(target==='loaded')order.loaded_at=new Date().toISOString();if(target==='delivered')order.delivered_at=new Date().toISOString();if(target==='cancelled'){order.cancelled_at=new Date().toISOString();order.cancel_reason=clean(body.note,300)}
        await saveOrder(order);return json(res,200,{ok:true,order:{...order,allowed_next:NEXT[target]||[]}});
      }
      if(action==='update_details'){
        if(current!=='new')return json(res,409,{ok:false,error:'order_locked',message:'لا يمكن تعديل الطلب بعد اعتماده.'});
        const requested=Array.isArray(body.items)?body.items:[];if(!requested.length)return json(res,400,{ok:false,error:'empty_cart',message:'لا يمكن حفظ طلب بدون أصناف.'});
        const items=await buildItems(requested),total=Math.round(items.reduce((s,i)=>s+i.total,0)*100)/100;
        order.items=items;order.product=items.map(i=>`${i.product_name} (${i.quantity} ${i.unit})`).join('، ');order.total=total;order.amount_value=total;order.amount=`${total} ريال`;order.notes=clean(body.notes,500)||order.notes;order.status_history=[...(order.status_history||[]),{status:'edited',label:'تم تعديل الطلب',at:new Date().toISOString(),by:actor(auth),role:auth.role,note:'تعديل قبل الاعتماد'}];await saveOrder(order);return json(res,200,{ok:true,order});
      }
      return json(res,400,{ok:false,error:'unknown_action'});
    }

    if(storePrivate()&&!['admin','customer'].includes(auth?.role))return json(res,403,{ok:false,error:'store_private'});
    if(!storePrivate()&&!['admin','customer'].includes(auth?.role))return json(res,401,{ok:false,error:'customer_login_required'});
    if(clean(body.website,50))return json(res,400,{ok:false,error:'invalid_request'});
    const customerInput=body.customer||{},name=clean(customerInput.name,120),phone=normalizePhone(auth?.role==='customer'?auth.phone:customerInput.phone);
    if(name.length<2||phone.length<9)return json(res,400,{ok:false,error:'customer_details_required',message:'اكتب الاسم ورقم الجوال بشكل صحيح.'});
    const requested=Array.isArray(body.items)?body.items:[];if(!requested.length)return json(res,400,{ok:false,error:'empty_cart',message:'السلة فارغة.'});
    const items=await buildItems(requested),customer=await findOrCreateCustomer({...customerInput,name},phone),now=new Date().toISOString(),id=`store-order-${crypto.randomUUID()}`,orderNo=`SO-${now.slice(2,10).replace(/-/g,'')}-${id.slice(-6).toUpperCase()}`,total=Math.round(items.reduce((sum,item)=>sum+item.total,0)*100)/100;
    const order={id,order_no:orderNo,date:now.slice(0,10),created_at:now,updated_at:now,workflow_status:'new',status:LABELS.new,source:'customer_store',customer_id:customer.id,rep_id:customer.rep_id||'',customer_name:customer.name,customer_phone:phone,city:clean(customerInput.city,80)||'جدة',district:clean(customerInput.district,120),address:clean(customerInput.address,300),product:items.map(item=>`${item.product_name} (${item.quantity} ${item.unit})`).join('، '),items,amount:`${total} ريال`,amount_value:total,total,notes:clean(customerInput.notes,500)||'طلب وارد من متجر العملاء',status_history:[event('new',{role:'customer',name:customer.name},'تم إنشاء الطلب من المتجر')]};
    await saveOrder(order);return json(res,201,{ok:true,order_id:id,order_no:orderNo,total,status:order.status});
  }catch(error){console.error('store-orders failed',error);return json(res,error.statusCode||500,{ok:false,error:error.code||'server_error',message:error.message||'تعذر تنفيذ العملية.'})}
}
