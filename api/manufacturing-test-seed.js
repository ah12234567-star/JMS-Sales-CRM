import { json, authFromRequest, supabase } from './auth-utils.js';
const TEST_ID='mfg-test-20260817-001';
const TEST_NO='MO-TEST-001';
export default async function handler(req,res){
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  if(auth.role!=='admin') return json(res,403,{ok:false,error:'admin_only'});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const existing=await supabase('jms_mfg_orders?id=eq.'+encodeURIComponent(TEST_ID)+'&select=*&limit=1');
    if(existing?.[0]){
      await supabase('jms_mfg_operations?manufacturing_order_id=eq.'+encodeURIComponent(TEST_ID)+'&work_center=eq.mixing',{method:'PATCH',body:JSON.stringify({status:'ready',updated_at:new Date().toISOString()})});
      return json(res,200,{ok:true,created:false,order:existing[0],message:'test_order_ready'});
    }
    const productSpec={customer_name:'عميل اختبار الإنتاج',product:'أكياس بلاستيك',material:'HDPE',color:'شفاف',width_cm:32,length_cm:40,micron:60,cylinder:'-',printing:'بدون طباعة',notes:'أمر تجريبي لاختبار الخلطة والفلم'};
    const result=await supabase('rpc/jms_mfg_create_order',{method:'POST',body:JSON.stringify({p_id:TEST_ID,p_order_no:TEST_NO,p_source_order_id:'TEST-SALES-001',p_source_quote_id:null,p_customer_id:'TEST-CUSTOMER-001',p_rep_id:null,p_planned_qty_kg:100,p_planned_qty_pcs:0,p_product_spec:productSpec,p_created_by:auth.id})});
    const rows=await supabase('jms_mfg_orders?id=eq.'+encodeURIComponent(TEST_ID)+'&select=*&limit=1');
    return json(res,201,{ok:true,created:true,result,order:rows?.[0]||null});
  }catch(e){console.error('manufacturing-test-seed failed',e);return json(res,500,{ok:false,error:'server_error',message:e.message});}
}
