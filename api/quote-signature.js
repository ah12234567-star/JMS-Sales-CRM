import crypto from 'node:crypto';
import { supabase } from './auth-utils.js';

function safeEqual(left, right) {
  const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));
  return a.length===b.length&&a.length>=32&&crypto.timingSafeEqual(a,b);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  try{
    const {id,token,name,signature}=req.body||{};
    if(!id||!token||!name||!signature)return res.status(400).json({error:'missing_fields'});
    if(String(id).length>160||String(token).length>160||String(name).trim().length<2||String(name).length>100)return res.status(400).json({error:'invalid_fields'});
    if(typeof signature!=='string'||!signature.startsWith('data:image/png;base64,')||signature.length>220000)return res.status(413).json({error:'invalid_signature'});
    const row=(await supabase('jms_quotes?id=eq.'+encodeURIComponent(String(id))+'&select=id,data&limit=1'))?.[0];
    if(!row||!safeEqual(row.data?.public_token,token))return res.status(404).json({error:'quote_not_found'});
    if(row.data.status==='customer_approved')return res.status(200).json({ok:true,alreadyApproved:true,approvedAt:row.data.customer_approved_at});
    const approvedAt=new Date().toISOString();
    const next={...row.data,status:'customer_approved',customer_signer_name:String(name).trim(),customer_signature:signature,customer_approved_at:approvedAt,customer_approval_source:'public_quote_link',manager_review_status:'pending',production_status:'بانتظار مراجعة الإدارة',converted_to_order:false,production_order_id:null};
    await supabase('jms_quotes?id=eq.'+encodeURIComponent(String(id)),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({data:next,updated_at:approvedAt})});
    return res.status(200).json({ok:true,approvedAt});
  }catch(error){console.error('quote signature failed',error);return res.status(500).json({error:'internal_error'})}
}
