import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

const PRODUCTION_ROLES=['admin','sales','production','mfg_operator'];
const n=v=>Number(v||0);

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(!PRODUCTION_ROLES.includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});

  if(req.method==='GET'){
    try{
      const material=String(req.query?.material_code||'').trim();
      const operationId=String(req.query?.operation_id||'').trim();
      const path='jms_inventory_lots?select=*&qty_kg=gt.0&order=updated_at.desc'+(material?'&material_code=eq.'+encodeURIComponent(material):'');
      const rawLots=await supabase(path);
      const lots=(rawLots||[]).map(x=>{
        const physical=n(x.qty_kg), reserved=Math.max(0,n(x.reserved_kg)), available=Math.max(0,physical-reserved);
        return {...x,physical_qty_kg:physical,reserved_kg:reserved,available_qty_kg:available,qty_kg:available};
      }).filter(x=>n(x.available_qty_kg)>0);
      let moves=[];
      if(operationId){
        moves=await supabase('jms_mfg_material_moves?select=*&operation_id=eq.'+encodeURIComponent(operationId)+'&movement_type=eq.consume&order=created_at.asc');
      }
      const totalConsumedKg=(moves||[]).reduce((sum,m)=>sum+n(m.qty_kg),0);
      const totalPhysicalKg=(rawLots||[]).reduce((sum,l)=>sum+n(l.qty_kg),0);
      const totalReservedKg=(rawLots||[]).reduce((sum,l)=>sum+Math.max(0,n(l.reserved_kg)),0);
      const totalAvailableKg=lots.reduce((sum,l)=>sum+n(l.available_qty_kg),0);
      return json(res,200,{ok:true,lots,moves:moves||[],total_consumed_kg:totalConsumedKg,inventory_summary:{physical_kg:totalPhysicalKg,reserved_kg:totalReservedKg,available_kg:totalAvailableKg}});
    }catch(e){
      console.error('manufacturing-material GET failed',e);
      return json(res,500,{ok:false,error:'server_error',message:e.message});
    }
  }

  if(req.method==='POST'){
    try{
      const b=await readBody(req);
      const required=['manufacturing_order_id','operation_id','inventory_lot_id','material_code'];
      for(const k of required) if(!String(b[k]||'').trim()) return json(res,400,{ok:false,error:'missing_'+k});
      const qty=n(b.qty_kg);
      if(!(qty>0)) return json(res,400,{ok:false,error:'invalid_qty_kg'});

      const lotRows=await supabase('jms_inventory_lots?id=eq.'+encodeURIComponent(String(b.inventory_lot_id))+'&select=*&limit=1');
      const lot=lotRows?.[0];
      if(!lot) return json(res,404,{ok:false,error:'inventory_lot_not_found'});
      const available=Math.max(0,n(lot.qty_kg)-Math.max(0,n(lot.reserved_kg)));
      if(qty>available+0.0001) return json(res,409,{ok:false,error:'insufficient_available_stock',message:`المتاح الفعلي ${available.toFixed(3)} كجم فقط بعد خصم المحجوز`});

      const eventId=String(b.client_event_id||`mat-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
      const moveId=String(b.move_id||`move-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
      const result=await supabase('rpc/jms_mfg_consume_material',{
        method:'POST',
        body:JSON.stringify({
          p_move_id:moveId,
          p_manufacturing_order_id:String(b.manufacturing_order_id),
          p_operation_id:String(b.operation_id),
          p_inventory_lot_id:String(b.inventory_lot_id),
          p_material_code:String(b.material_code),
          p_qty_kg:qty,
          p_client_event_id:eventId,
          p_actor_id:auth.id,
          p_attributes:{...(b.attributes||{}),available_before_kg:available,reserved_before_kg:n(lot.reserved_kg),physical_before_kg:n(lot.qty_kg)}
        })
      });
      return json(res,200,{ok:true,result,client_event_id:eventId,move_id:moveId,available_before_kg:available});
    }catch(e){
      console.error('manufacturing-material POST failed',e);
      return json(res,500,{ok:false,error:'server_error',message:e.message});
    }
  }

  return json(res,405,{ok:false,error:'method_not_allowed'});
}
