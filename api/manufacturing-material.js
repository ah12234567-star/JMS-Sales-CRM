import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

const PRODUCTION_ROLES=['admin','sales','production','mfg_operator'];

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(!PRODUCTION_ROLES.includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});

  if(req.method==='GET'){
    try{
      const material=String(req.query?.material_code||'').trim();
      const operationId=String(req.query?.operation_id||'').trim();
      const path='jms_inventory_lots?select=*&qty_kg=gt.0&order=updated_at.desc'+(material?'&material_code=eq.'+encodeURIComponent(material):'');
      const lots=await supabase(path);
      let moves=[];
      if(operationId){
        moves=await supabase('jms_mfg_material_moves?select=*&operation_id=eq.'+encodeURIComponent(operationId)+'&movement_type=eq.consume&order=created_at.asc');
      }
      const totalConsumedKg=(moves||[]).reduce((sum,m)=>sum+Number(m.qty_kg||0),0);
      return json(res,200,{ok:true,lots:lots||[],moves:moves||[],total_consumed_kg:totalConsumedKg});
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
      const qty=Number(b.qty_kg||0);
      if(!(qty>0)) return json(res,400,{ok:false,error:'invalid_qty_kg'});
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
          p_attributes:b.attributes||{}
        })
      });
      return json(res,200,{ok:true,result,client_event_id:eventId,move_id:moveId});
    }catch(e){
      console.error('manufacturing-material POST failed',e);
      return json(res,500,{ok:false,error:'server_error',message:e.message});
    }
  }

  return json(res,405,{ok:false,error:'method_not_allowed'});
}
