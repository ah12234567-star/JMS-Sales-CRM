import { json, readBody, authFromRequest, supabase } from './auth-utils.js';

const READ_ROLES=['admin','sales','production','production_manager','mfg_operator'];
const WRITE_ROLES=['admin','production','production_manager'];
const makeId=()=>`lot-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const n=v=>Number(v||0);

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});

  if(req.method==='GET'){
    if(!READ_ROLES.includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});
    try{
      const rows=await supabase('jms_inventory_lots?select=*&order=material_code.asc,updated_at.desc&limit=500');
      const lots=(rows||[]).map(x=>{
        const physical=n(x.qty_kg), reserved=Math.max(0,n(x.reserved_kg));
        return {...x,physical_qty_kg:physical,reserved_kg:reserved,available_qty_kg:Math.max(0,physical-reserved)};
      });
      const physicalKg=lots.reduce((s,x)=>s+n(x.physical_qty_kg),0);
      const reservedKg=lots.reduce((s,x)=>s+n(x.reserved_kg),0);
      const availableKg=lots.reduce((s,x)=>s+n(x.available_qty_kg),0);
      const materialMap=new Map();
      for(const x of lots){
        const code=String(x.material_code||'').trim(); if(!code) continue;
        const m=materialMap.get(code)||{material_code:code,material_name:x.material_name||code,physical_kg:0,reserved_kg:0,available_kg:0,lots:0};
        m.physical_kg+=n(x.physical_qty_kg);m.reserved_kg+=n(x.reserved_kg);m.available_kg+=n(x.available_qty_kg);m.lots+=1;materialMap.set(code,m);
      }
      return json(res,200,{ok:true,lots,materials:[...materialMap.values()],summary:{lots:lots.length,materials:materialMap.size,physical_kg:physicalKg,reserved_kg:reservedKg,available_kg:availableKg}});
    }catch(e){
      console.error('manufacturing-inventory GET failed',e);
      return json(res,500,{ok:false,error:'server_error',message:e.message});
    }
  }

  if(req.method==='POST'){
    if(!WRITE_ROLES.includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});
    try{
      const b=await readBody(req);
      const materialCode=String(b.material_code||'').trim().toUpperCase();
      const materialName=String(b.material_name||materialCode).trim();
      const lotNo=String(b.lot_no||'').trim();
      const warehouse=String(b.warehouse||'RAW').trim().toUpperCase();
      const qty=n(b.qty_kg);
      if(!materialCode) return json(res,400,{ok:false,error:'missing_material_code'});
      if(!lotNo) return json(res,400,{ok:false,error:'missing_lot_no'});
      if(!(qty>0)) return json(res,400,{ok:false,error:'invalid_qty_kg'});

      const existing=await supabase('jms_inventory_lots?material_code=eq.'+encodeURIComponent(materialCode)+'&lot_no=eq.'+encodeURIComponent(lotNo)+'&warehouse=eq.'+encodeURIComponent(warehouse)+'&select=*&limit=1');
      let row;
      if(existing?.[0]){
        const current=existing[0];
        const updated=await supabase('jms_inventory_lots?id=eq.'+encodeURIComponent(current.id),{
          method:'PATCH',
          body:JSON.stringify({qty_kg:n(current.qty_kg)+qty,material_name:materialName,updated_at:new Date().toISOString()})
        });
        row=updated?.[0]||null;
      }else{
        const created=await supabase('jms_inventory_lots',{
          method:'POST',
          body:JSON.stringify([{id:String(b.id||makeId()),material_code:materialCode,material_name:materialName,lot_no:lotNo,warehouse,qty_kg:qty,reserved_kg:0,attributes:{received_by:auth.id,source:String(b.source||'manual')}}])
        });
        row=created?.[0]||null;
      }
      return json(res,200,{ok:true,lot:row});
    }catch(e){
      console.error('manufacturing-inventory POST failed',e);
      return json(res,500,{ok:false,error:'server_error',message:e.message});
    }
  }

  return json(res,405,{ok:false,error:'method_not_allowed'});
}
