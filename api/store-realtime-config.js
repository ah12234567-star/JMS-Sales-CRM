import { json, authFromRequest } from './auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{ok:false,error:'method_not_allowed'});
  const auth=authFromRequest(req);
  if(!auth||!['admin','sales'].includes(auth.role))return json(res,403,{ok:false,error:'forbidden'});
  const url=String(process.env.SUPABASE_URL||'').trim();
  const key=String(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'').trim();
  if(!url||!key)return json(res,200,{ok:true,realtime:false});
  return json(res,200,{ok:true,realtime:true,url,key,channel:'store_order_realtime'});
}
