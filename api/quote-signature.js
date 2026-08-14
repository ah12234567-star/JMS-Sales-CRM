import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvwjwakkimnveveglxwa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_jN3PnVaj7uarVnJRvBmx-g_zIKhl1UP';

function safeEqual(left, right) {
  const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));
  return a.length===b.length&&a.length>=32&&crypto.timingSafeEqual(a,b);
}
function headers(extra={}) {return {apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',...extra}}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  try{
    const {id,token,name,signature}=req.body||{};
    if(!id||!token||!name||!signature)return res.status(400).json({error:'missing_fields'});
    if(String(id).length>160||String(token).length>160||String(name).trim().length<2||String(name).length>100)return res.status(400).json({error:'invalid_fields'});
    if(typeof signature!=='string'||!signature.startsWith('data:image/png;base64,')||signature.length>220000)return res.status(413).json({error:'invalid_signature'});
    const lookup=SUPABASE_URL+'/rest/v1/jms_quotes?id=eq.'+encodeURIComponent(String(id))+'&select=id,data&limit=1';
    const found=await fetch(lookup,{headers:headers()});
    if(!found.ok)return res.status(503).json({error:'quote_service_unavailable'});
    const row=(await found.json())?.[0];
    if(!row||!safeEqual(row.data?.public_token,token))return res.status(404).json({error:'quote_not_found'});
    if(row.data.status==='customer_approved')return res.status(200).json({ok:true,alreadyApproved:true,approvedAt:row.data.customer_approved_at});
    const approvedAt=new Date().toISOString();
    const next={...row.data,status:'customer_approved',customer_signer_name:String(name).trim(),customer_signature:signature,customer_approved_at:approvedAt,customer_approval_source:'public_quote_link'};
    const update=await fetch(SUPABASE_URL+'/rest/v1/jms_quotes?id=eq.'+encodeURIComponent(String(id)),{method:'PATCH',headers:headers({Prefer:'return=minimal'}),body:JSON.stringify({data:next,updated_at:approvedAt})});
    if(!update.ok){console.error('signature update failed',update.status,await update.text());return res.status(503).json({error:'save_failed'})}
    return res.status(200).json({ok:true,approvedAt});
  }catch(error){console.error('quote signature failed',error);return res.status(500).json({error:'internal_error'})}
}
