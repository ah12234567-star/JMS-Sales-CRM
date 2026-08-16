import { json, readBody, requireRole, supabase } from './auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error:'method_not_allowed'});
  const auth=requireRole(req,['admin','sales']);
  if(!auth) return json(res,403,{ok:false,error:'forbidden'});
  try{
    const body=await readBody(req);
    const id=String(body.id||'').trim(), action=String(body.action||'').trim();
    if(!id||!['approve','reject'].includes(action)) return json(res,400,{ok:false,error:'invalid_request'});
    const rows=await supabase('jms_quotes?id=eq.'+encodeURIComponent(id)+'&limit=1');
    const row=rows&&rows[0]; if(!row) return json(res,404,{ok:false,error:'not_found'});
    const now=new Date().toISOString(), q=row.data||{};
    if(action==='approve'){
      q.status='approved'; q.approved_by=auth.id; q.approved_at=now; delete q.reject_reason;
    }else{
      const reason=String(body.reason||'').trim(); if(!reason) return json(res,400,{ok:false,error:'missing_reason'});
      q.status='rejected'; q.reject_reason=reason; q.rejected_by=auth.id; q.rejected_at=now;
    }
    await supabase('jms_quotes?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({data:q,updated_at:now})});
    return json(res,200,{ok:true,quote:q});
  }catch(e){console.error('quote-status failed',e);return json(res,500,{ok:false,error:'server_error'})}
}
