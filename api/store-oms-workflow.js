export const STORE_OMS_STATUSES = Object.freeze(['new','approved','picking','ready','loaded','out_for_delivery','delivered','cancelled']);

export const STORE_OMS_LABELS = Object.freeze({
  new:'جديد',approved:'معتمد',picking:'تحت التجهيز',ready:'جاهز للتحميل',loaded:'تم التحميل',out_for_delivery:'خرج للتسليم',delivered:'تم التسليم',cancelled:'ملغى'
});

const NORMAL_NEXT = Object.freeze({
  new:'approved',approved:'picking',picking:'ready',ready:'loaded',loaded:'out_for_delivery',out_for_delivery:'delivered'
});

export function validateTransition({from,to,role,cancelReason}){
  if(!STORE_OMS_STATUSES.includes(from)||!STORE_OMS_STATUSES.includes(to)) return {ok:false,code:'invalid_status'};
  if(from==='delivered'||from==='cancelled') return {ok:false,code:'terminal_status'};
  if(to==='cancelled'){
    if(String(cancelReason||'').trim().length<3) return {ok:false,code:'cancel_reason_required'};
    const afterReady=['loaded','out_for_delivery'].includes(from);
    if(afterReady&&role!=='admin') return {ok:false,code:'admin_required_after_ready'};
    return {ok:true};
  }
  if(NORMAL_NEXT[from]!==to) return {ok:false,code:'invalid_transition'};
  return {ok:true};
}

export function inventoryEffect({from,to,inventoryReserved=false,inventoryConsumed=false}){
  if(to==='approved'&&!inventoryReserved) return {reserve:true,consume:false,release:false};
  if(to==='loaded'&&inventoryReserved&&!inventoryConsumed) return {reserve:false,consume:true,release:false};
  if(to==='cancelled'&&inventoryReserved&&!inventoryConsumed) return {reserve:false,consume:false,release:true};
  return {reserve:false,consume:false,release:false};
}

export function assertOrderItems(items){
  if(!Array.isArray(items)||items.length===0) return {ok:false,code:'empty_order'};
  for(const item of items){
    if(!String(item?.sku||'').trim()||!String(item?.product_name||'').trim()) return {ok:false,code:'invalid_item'};
    if(!(Number(item?.quantity)>0)) return {ok:false,code:'invalid_quantity'};
    if(!(Number(item?.unit_price)>=0)) return {ok:false,code:'invalid_price'};
  }
  return {ok:true};
}
