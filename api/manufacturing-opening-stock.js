import { json, authFromRequest, supabase } from './auth-utils.js';

const ALLOWED=['admin','production','production_manager'];
const LOT_NO='OPENING-2026-08-29';
const WAREHOUSE='RAW';
const rows=[
  {material_code:'FILLAR',material_name:'FILLAR فلر',qty_kg:37399.0001,classification:'110018 – FILLAR فلر'},
  {material_code:'118WJ',material_name:'LLDPE 118WJ',qty_kg:4632,classification:'1101 – DLLDLL'},
  {material_code:'218WJ',material_name:'LLDPE 218WJ',qty_kg:6106.5,classification:'1101 – DLLDLL'},
  {material_code:'118NJ',material_name:'LLDPE 118NJ',qty_kg:3391,classification:'1101 – DLLDLL'},
  {material_code:'119ZJ',material_name:'LLDPE 119ZJ',qty_kg:0,classification:'1101 – DLLDLL'},
  {material_code:'HP0722NN / HP0823NN',material_name:'LDPE HP0722NN / HP0823NN',qty_kg:0,classification:'1102 – DLDL'},
  {material_code:'HP0322NN / HP0323NN',material_name:'LDPE HP0322NN / HP0323NN',qty_kg:1000,classification:'1102 – DLDL'},
  {material_code:'HP2022JN / HP2023JN',material_name:'LDPE HP2022JN / HP2023JN',qty_kg:3377,classification:'1102 – DLDL'},
  {material_code:'HP4023WN / HP4024WN',material_name:'LDPE HP4023WN / HP4024WN',qty_kg:1525,classification:'1102 – DLDL'},
  {material_code:'HP0321NN',material_name:'LDPE HP0321NN',qty_kg:20,classification:'1102 – DLDL'},
  {material_code:'FJ00952',material_name:'HDPE FJ00952',qty_kg:2391,classification:'11013 – DHDH'},
  {material_code:'FJ1552',material_name:'HDPE FJ1552',qty_kg:1850.5,classification:'11013 – DHDH'}
];

export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(!ALLOWED.includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'method_not_allowed'});

  try{
    const applied=[];
    for(const item of rows){
      const code=String(item.material_code).trim().toUpperCase();
      const existing=await supabase('jms_inventory_lots?material_code=eq.'+encodeURIComponent(code)+'&lot_no=eq.'+encodeURIComponent(LOT_NO)+'&warehouse=eq.'+encodeURIComponent(WAREHOUSE)+'&select=*&limit=1');
      const payload={
        material_code:code,
        material_name:item.material_name,
        lot_no:LOT_NO,
        warehouse:WAREHOUSE,
        qty_kg:Number(item.qty_kg||0),
        reserved_kg:0,
        updated_at:new Date().toISOString(),
        attributes:{source:'material_classification_inventory_2026-08-29',classification:item.classification,opening_balance:true}
      };
      let row;
      if(existing?.[0]){
        const updated=await supabase('jms_inventory_lots?id=eq.'+encodeURIComponent(existing[0].id),{method:'PATCH',body:JSON.stringify(payload)});
        row=updated?.[0]||null;
      }else{
        const created=await supabase('jms_inventory_lots',{method:'POST',body:JSON.stringify([{id:'opening-'+code.replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase(),...payload}])});
        row=created?.[0]||null;
      }
      applied.push({material_code:code,qty_kg:item.qty_kg,id:row?.id||null});
    }
    return json(res,200,{ok:true,lot_no:LOT_NO,count:applied.length,materials:applied});
  }catch(e){
    console.error('manufacturing-opening-stock failed',e);
    return json(res,500,{ok:false,error:'server_error',message:e.message});
  }
}
