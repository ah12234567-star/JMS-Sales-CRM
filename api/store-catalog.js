import { json, readBody, authFromRequest, supabase } from './auth-utils.js';
import { STORE_CATALOG_SEED } from './store-catalog-seed.js';

const RECORD_TYPE = 'store_product';
const MANAGER_ROLES = new Set(['admin','sales']);

function clean(value){return String(value ?? '').trim()}
function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
function recordId(sku){return `store-product-${clean(sku).replace(/[^a-zA-Z0-9_-]/g,'-')}`}
function manager(auth){return Boolean(auth&&MANAGER_ROLES.has(auth.role))}

function imageFor(category){
  return ({
    'أدوات المائدة':'tableware.webp','الكاسات والمشروبات':'cups.webp',
    'الورق والأكياس':'paper-bags.webp','السلامة والنظافة':'safety.webp',
    'الأكياس':'trash-bags.webp','الصحون':'plates.webp','علب الطعام':'containers.webp',
    'التغليف':'wrapping.webp','السفر والمفارش':'picnic.webp','مواد النظافة':'cleaning.webp',
    'المناديل':'tissues.webp','أصناف أخرى':'general.webp',
  }[category]||'general.webp').replace(/^/,'/assets/store/categories/');
}

function normalizeTiers(tiers){
  const cleaned=(Array.isArray(tiers)?tiers:[])
    .map(tier=>({min_qty:finite(tier?.min_qty),price:finite(tier?.price)}))
    .filter(tier=>tier.min_qty>1&&tier.price>0)
    .sort((a,b)=>a.min_qty-b.min_qty);
  return cleaned.filter((tier,index)=>index===0||tier.min_qty!==cleaned[index-1].min_qty).slice(0,8);
}

async function overrides(){
  const rows=await supabase('jms_routes?select=id,data,updated_at&order=updated_at.desc');
  return (rows||[])
    .map(row=>row.data||{})
    .filter(item=>item.record_type===RECORD_TYPE||String(item.id||'').startsWith('store-product-'));
}

export async function catalogInternal(){
  const bySku=new Map((await overrides()).map(item=>[String(item.sku),item]));
  return STORE_CATALOG_SEED.map(seed=>{
    const override=bySku.get(String(seed.sku))||{};
    const price=Math.max(0,finite(override.price,seed.price));
    const stock=finite(override.stock,seed.stock);
    const visible=Object.hasOwn(override,'visible')?Boolean(override.visible):Boolean(seed.visible);
    return {...seed,...override,sku:seed.sku,original_name:seed.original_name,price,stock,visible,available:stock>0&&price>0,tiers:normalizeTiers(override.tiers||seed.tiers)};
  });
}

function publicVariant(item){
  return {
    id:`variant-${item.sku}`,
    attributes:item.attributes||{},
    unit:item.unit,
    price:item.price,
    available:item.available,
    stock:item.stock,
    tiers:item.tiers||[],
  };
}

function publicCatalog(items){
  const groups=new Map();
  for(const item of items){
    if(!item.visible) continue;
    const key=`${item.category}|${item.product_name}`;
    if(!groups.has(key)) groups.set(key,{id:`product-${groups.size+1}`,name:item.product_name,category:item.category,image:imageFor(item.category),variants:[]});
    groups.get(key).variants.push(publicVariant(item));
  }
  return [...groups.values()].map(group=>{
    group.variants.sort((a,b)=>Number(b.available)-Number(a.available)||a.price-b.price);
    const availablePrices=group.variants.filter(item=>item.available).map(item=>item.price);
    return {...group,available:group.variants.some(item=>item.available),from_price:availablePrices.length?Math.min(...availablePrices):0};
  });
}

export default async function handler(req,res){
  try{
    if(req.method==='GET'){
      const auth=authFromRequest(req);
      const items=await catalogInternal();
      if(req.query?.admin==='1'){
        if(!manager(auth)) return json(res,403,{ok:false,error:'forbidden'});
        return json(res,200,{ok:true,items});
      }
      res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
      return json(res,200,{ok:true,categories:[...new Set(items.filter(item=>item.visible).map(item=>item.category))],products:publicCatalog(items),updated_at:new Date().toISOString()});
    }
    if(req.method==='POST'){
      const auth=authFromRequest(req);
      if(!manager(auth)) return json(res,403,{ok:false,error:'forbidden'});
      const body=await readBody(req);
      if(body?.action!=='update') return json(res,400,{ok:false,error:'invalid_action'});
      const seed=STORE_CATALOG_SEED.find(item=>String(item.sku)===String(body.sku));
      if(!seed) return json(res,404,{ok:false,error:'product_not_found'});
      const price=Math.max(0,finite(body.price,seed.price));
      const stock=finite(body.stock,seed.stock);
      const now=new Date().toISOString();
      const data={
        id:recordId(seed.sku),record_type:RECORD_TYPE,sku:seed.sku,
        price,stock,visible:Boolean(body.visible),tiers:normalizeTiers(body.tiers),
        updated_at:now,updated_by:String(auth.id)
      };
      await supabase('jms_routes?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:data.id,data,updated_at:now}])});
      return json(res,200,{ok:true,item:{...seed,...data,available:stock>0&&price>0}});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(error){
    console.error('store-catalog failed',error);
    return json(res,500,{ok:false,error:'server_error'});
  }
}
