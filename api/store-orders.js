import crypto from 'node:crypto';
import { json, readBody, authFromRequest, supabase } from './auth-utils.js';
import { catalogInternal } from './store-catalog.js';
import { storePrivate } from './customer-auth-utils.js';
import { STORE_OMS_LABELS, validateTransition, assertOrderItems } from './store-oms-workflow.js';

const MANAGER_ROLES = new Set(['admin','sales']);
const OPS_STATUSES = new Set(['approved','picking','ready']);
const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const round3=n=>Math.round(Number(n||0)*1000)/1000;
const round2=n=>Math.round(Number(n||0)*100)/100;

function normalizePhone(value){let phone=clean(value,30).replace(/\D/g,'');if(phone.startsWith('00966'))phone=phone.slice(2);if(phone.startsWith('05')&&phone.length===10)phone='966'+phone.slice(1);if(phone.startsWith('5')&&phone.length===9)phone='966'+phone;return phone}
function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,24)}
function actor(auth){return {id:clean(auth?.id,120),name:clean(auth?.name||auth?.email||auth?.user_name||auth?.role||'system',120),role:clean(auth?.role,40)}}
function tierPrice(product,quantity){let price=Number(product.price||0);for(const tier of [...(product.tiers||[])].sort((a,b)=>Number(a.min_qty)-Number(b.min_qty))){if(quantity>=Number(tier.min_qty||0))price=Number(tier.price||price)}return price}
function orderNo(){const d=new Date();const stamp=`${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;return `SO-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`}

async function findOrCreateCustomer(input,phone){
  const rows=await supabase('jms_customers?select=id,data,updated_at&order=updated_at.desc');
  const existing=(rows||[]).map(r=>({...r.data,id:r.data?.id||r.id})).find(c=>normalizePhone(c.phone||c.mobile)===phone);
  if(existing){const t=now(),data={...existing,name:clean(input.name,120)||existing.name||'',phone,email:clean(input.email,160)||existing.email||'',city:clean(input.city,80)||existing.city||'جدة',district:clean(input.district,120)||existing.district||'',location:clean(input.address,300)||existing.location||existing.address||'',updated_at:t};await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:existing.id,data,updated_at:t}])});return data}
  const t=now(),id=`store-customer-${hash(phone)}`,data={id,name:clean(input.name,120),phone,email:clean(input.email,160),city:clean(input.city,80)||'جدة',district:clean(input.district,120),location:clean(input.address,300),category:'عميل متجر إلكتروني',status:'active',rep_id:'',debt_balance:0,credit_limit:0,notes:'تم إنشاؤه تلقائيًا من متجر العملاء',created_at:t,updated_at:t};
  await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id,data,updated_at:t}])});return data;
}

async function buildItems(requested){
  const catalog=await catalogInternal(),byId=new Map(catalog.map(p=>[`variant-${p.sku}`,p])),items=[];
  for(const row of (Array.isArray(requested)?requested:[]).slice(0,60)){
    const product=byId.get(clean(row.variant_id||`variant-${row.sku}`,120)),quantity=round3(row.quantity);
    if(!product||!product.visible||quantity<=0)throw Object.assign(new Error('أحد الأصناف غير صالح للطلب.'),{statusCode:409,code:'product_unavailable'});
    const unitPrice=tierPrice(product,quantity);
    items.push({sku:String(product.sku),product_name:product.product_name,attributes:product.attributes||{},unit:product.unit||'',quantity,unit_price:unitPrice,line_total:round2(unitPrice*quantity)});
  }
  const valid=assertOrderItems(items);if(!valid.ok)throw Object.assign(new Error('لا يمكن إنشاء طلب بدون أصناف صحيحة.'),{statusCode:400,code:valid.code});
  return items;
}

async function readOrder(id){
  const orders=await supabase(`store_orders?id=eq.${encodeURIComponent(id)}&limit=1`),order=orders?.[0];if(!order)return null;
  const [items,history]=await Promise.all([
    supabase(`store_order_items?order_id=eq.${encodeURIComponent(id)}&order=created_at.asc`),
    supabase(`store_order_history?order_id=eq.${encodeURIComponent(id)}&order=created_at.asc`)
  ]);
  return {...order,workflow_status:order.status,status_label:STORE_OMS_LABELS[order.status]||order.status,items:items||[],status_history:(history||[]).map(h=>({from_status:h.from_status,status:h.to_status,label:STORE_OMS_LABELS[h.to_status]||h.to_status,at:h.created_at,by:h.actor_name,role:h.actor_role,note:h.note||''}))};
}

async function writeHistory(orderId,from,to,auth,note=''){
  const a=actor(auth);await supabase('store_order_history',{method:'POST',body:JSON.stringify([{order_id:orderId,from_status:from||null,to_status:to,actor_id:a.id||null,actor_name:a.name,actor_role:a.role,note:clean(note,300)||null,created_at:now()}])});
}

async function ensureInventoryRows(items){
  const skus=[...new Set(items.map(i=>String(i.sku)))];if(!skus.length)return new Map();
  const existing=await supabase(`store_inventory?sku=in.(${skus.map(s=>`"${s.replaceAll('"','')}"`).join(',')})`),map=new Map((existing||[]).map(r=>[String(r.sku),r]));
  const missing=skus.filter(s=>!map.has(s));
  if(missing.length){const catalog=await catalogInternal(),cat=new Map(catalog.map(p=>[String(p.sku),p])),rows=missing.map(s=>({sku:s,total_stock:round3(cat.get(s)?.stock||0),reserved_stock:0,updated_at:now()}));if(rows.length)await supabase('store_inventory?on_conflict=sku',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)});for(const r of rows)map.set(String(r.sku),r)}
  return map;
}

async function mutateInventory(items,effect){
  const map=await ensureInventoryRows(items),updates=[];
  for(const item of items){const inv=map.get(String(item.sku));if(!inv)throw Object.assign(new Error(`لا يوجد مخزون للصنف ${item.sku}.`),{statusCode:409,code:'inventory_missing'});const qty=round3(item.quantity),total=round3(inv.total_stock),reserved=round3(inv.reserved_stock),available=round3(total-reserved);let nextTotal=total,nextReserved=reserved;
    if(effect==='reserve'){if(qty>available)throw Object.assign(new Error(`المخزون المتاح للصنف ${item.product_name} هو ${available} ${item.unit||''}.`),{statusCode:409,code:'insufficient_available_stock'});nextReserved=round3(reserved+qty)}
    if(effect==='release'){nextReserved=round3(reserved-qty);if(nextReserved<0)throw Object.assign(new Error('رصيد الحجز غير متطابق.'),{statusCode:409,code:'reservation_mismatch'})}
    if(effect==='consume'){nextReserved=round3(reserved-qty);nextTotal=round3(total-qty);if(nextReserved<0||nextTotal<0)throw Object.assign(new Error('رصيد المخزون غير متطابق عند التحميل.'),{statusCode:409,code:'inventory_mismatch'})}
    if(effect==='restore'){nextTotal=round3(total+qty)}
    updates.push({sku:String(item.sku),total_stock:nextTotal,reserved_stock:nextReserved,updated_at:now()});
  }
  if(updates.length)await supabase('store_inventory?on_conflict=sku',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(updates)});
  return updates.map(r=>({...r,available_stock:round3(r.total_stock-r.reserved_stock)}));
}

function allowedNext(status,role){const normal={new:['approved','cancelled'],approved:['picking','cancelled'],picking:['ready','cancelled'],ready:['loaded','cancelled'],loaded:['out_for_delivery'],out_for_delivery:['delivered']};const list=[...(normal[status]||[])];if(role==='admin'&&['loaded','out_for_delivery'].includes(status))list.push('cancelled');return list}

export default async function handler(req,res){
  try{
    if(req.method==='GET'){
      const auth=authFromRequest(req);if(!auth||!MANAGER_ROLES.has(auth.role))return json(res,403,{ok:false,error:'forbidden'});
      const where=req.query?.warehouse==='1'?`&status=in.(${[...OPS_STATUSES].join(',')})`:'';
      const rows=await supabase(`store_orders?select=*&order=created_at.desc${where}`),orders=[];
      for(const row of rows||[]){const o=await readOrder(row.id);orders.push({...o,allowed_next:allowedNext(o.workflow_status,auth.role)})}
      return json(res,200,{ok:true,orders,status_labels:STORE_OMS_LABELS});
    }
    if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
    const auth=authFromRequest(req),body=await readBody(req),action=clean(body.action,40);
    if(action){
      if(!auth||!MANAGER_ROLES.has(auth.role))return json(res,403,{ok:false,error:'forbidden'});
      const order=await readOrder(clean(body.order_id,80));if(!order)return json(res,404,{ok:false,error:'order_not_found'});
      if(action!=='transition')return json(res,400,{ok:false,error:'unknown_action'});
      const target=clean(body.status,40),check=validateTransition({from:order.workflow_status,to:target,role:auth.role,cancelReason:body.note});
      if(!check.ok){const status=check.code==='admin_required_after_ready'?403:(check.code==='cancel_reason_required'?400:409);return json(res,status,{ok:false,error:check.code,message:check.code==='admin_required_after_ready'?'إلغاء الطلب بعد التحميل يتطلب صلاحية مدير النظام.':'انتقال حالة غير مسموح.'})}
      let inventory=null;
      if(target==='approved')inventory=await mutateInventory(order.items,'reserve');
      if(target==='loaded')inventory=await mutateInventory(order.items,'consume');
      if(target==='cancelled'&&['approved','picking','ready'].includes(order.workflow_status))inventory=await mutateInventory(order.items,'release');
      if(target==='cancelled'&&['loaded','out_for_delivery'].includes(order.workflow_status))inventory=await mutateInventory(order.items,'restore');
      const patch={status:target,updated_at:now()};if(target==='approved')patch.approved_at=now();if(target==='ready')patch.ready_at=now();if(target==='loaded'){patch.loaded_at=now();patch.inventory_consumed=true;patch.inventory_reserved=false}else if(target==='approved')patch.inventory_reserved=true;else if(target==='cancelled'){patch.cancelled_at=now();patch.cancel_reason=clean(body.note,300);patch.inventory_reserved=false}
      await supabase(`store_orders?id=eq.${encodeURIComponent(order.id)}`,{method:'PATCH',body:JSON.stringify(patch)});await writeHistory(order.id,order.workflow_status,target,auth,body.note);
      const updated=await readOrder(order.id);return json(res,200,{ok:true,order:{...updated,allowed_next:allowedNext(target,auth.role)},inventory});
    }

    if(storePrivate()&&!['admin','customer'].includes(auth?.role))return json(res,403,{ok:false,error:'store_private'});if(!storePrivate()&&!['admin','customer'].includes(auth?.role))return json(res,401,{ok:false,error:'customer_login_required'});if(clean(body.website,50))return json(res,400,{ok:false,error:'invalid_request'});
    const customerInput=body.customer||{},name=clean(customerInput.name,120),phone=normalizePhone(auth?.role==='customer'?auth.phone:customerInput.phone);if(name.length<2||phone.length<9)return json(res,400,{ok:false,error:'customer_details_required'});
    const items=await buildItems(body.items),customer=await findOrCreateCustomer({...customerInput,name},phone),id=crypto.randomUUID(),number=orderNo(),t=now(),total=round2(items.reduce((s,i)=>s+i.line_total,0));
    await supabase('store_orders',{method:'POST',body:JSON.stringify([{id,order_no:number,customer_id:customer.id,customer_name:customer.name,customer_phone:phone,city:clean(customerInput.city,80)||'جدة',district:clean(customerInput.district,120),address:clean(customerInput.address,300),notes:clean(customerInput.notes,500)||null,status:'new',subtotal:total,total,created_at:t,updated_at:t}])});
    await supabase('store_order_items',{method:'POST',body:JSON.stringify(items.map(i=>({order_id:id,...i,created_at:t})))});await writeHistory(id,null,'new',{id:customer.id,name:customer.name,role:'customer'},'تم إنشاء الطلب من المتجر');
    return json(res,201,{ok:true,order_id:id,order_no:number,total,status:STORE_OMS_LABELS.new});
  }catch(error){console.error('store-orders failed',error);return json(res,error.statusCode||500,{ok:false,error:error.code||'server_error',message:error.message||'تعذر تنفيذ العملية.'})}
}
