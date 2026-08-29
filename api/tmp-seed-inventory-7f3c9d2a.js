import { json, supabase } from './auth-utils.js';

const ROWS = [
  {id:'opening-20260829-fillar',material_code:'FILLAR',material_name:'110018 – FILLAR فلر',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:37399.0001,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'110018'}},
  {id:'opening-20260829-118wj',material_code:'118WJ',material_name:'1101 – DLLDLL · 118WJ',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:4632,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1101'}},
  {id:'opening-20260829-218wj',material_code:'218WJ',material_name:'1101 – DLLDLL · 218WJ',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:6106.5,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1101'}},
  {id:'opening-20260829-118nj',material_code:'118NJ',material_name:'1101 – DLLDLL · 118NJ',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:3391,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1101'}},
  {id:'opening-20260829-119zj',material_code:'119ZJ',material_name:'1101 – DLLDLL · 119ZJ',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:0,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1101'}},
  {id:'opening-20260829-hp0722-hp0823',material_code:'HP0722NN / HP0823NN',material_name:'1102 – DLDL · HP0722NN / HP0823NN',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:0,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1102'}},
  {id:'opening-20260829-hp0322-hp0323',material_code:'HP0322NN / HP0323NN',material_name:'1102 – DLDL · HP0322NN / HP0323NN',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:1000,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1102'}},
  {id:'opening-20260829-hp2022-hp2023',material_code:'HP2022JN / HP2023JN',material_name:'1102 – DLDL · HP2022JN / HP2023JN',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:3377,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1102'}},
  {id:'opening-20260829-hp4023-hp4024',material_code:'HP4023WN / HP4024WN',material_name:'1102 – DLDL · HP4023WN / HP4024WN',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:1525,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1102'}},
  {id:'opening-20260829-hp0321nn',material_code:'HP0321NN',material_name:'1102 – DLDL · HP0321NN',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:20,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'1102'}},
  {id:'opening-20260829-fj00952',material_code:'FJ00952',material_name:'11013 – DHDH · FJ00952',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:2391,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'11013'}},
  {id:'opening-20260829-fj1552',material_code:'FJ1552',material_name:'11013 – DHDH · fj1552',lot_no:'OPENING-20260829',warehouse:'RAW',qty_kg:1850.5,reserved_kg:0,attributes:{source:'opening_inventory_xls',source_item_code:'11013'}}
];

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const ids=ROWS.map(r=>r.id);
    const existing=await supabase('jms_inventory_lots?select=id&id=in.('+ids.map(encodeURIComponent).join(',')+')');
    const have=new Set((existing||[]).map(x=>x.id));
    const missing=ROWS.filter(r=>!have.has(r.id));
    if(missing.length) await supabase('jms_inventory_lots',{method:'POST',body:JSON.stringify(missing)});
    return json(res,200,{ok:true,created:missing.length,already_present:ROWS.length-missing.length,total_rows:ROWS.length,total_opening_kg:61692.0001});
  }catch(e){
    return json(res,500,{ok:false,error:'seed_failed',message:e.message});
  }
}
