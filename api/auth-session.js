import { json, authFromRequest, supabase } from './auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error:'method_not_allowed'});
  const auth=authFromRequest(req);
  if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  try{
    const rows=await supabase('jms_users?id=eq.'+encodeURIComponent(auth.id)+'&limit=1');
    const row=rows&&rows[0];
    if(!row) return json(res,401,{ok:false,error:'user_not_found'});
    const data=row.data||{};
    if(data.status&&data.status!=='active') return json(res,403,{ok:false,error:'user_disabled'});
    return json(res,200,{ok:true,user:{
      id:row.id,name:data.name||'مستخدم',email:row.email,phone:row.phone||'',
      role:data.role||auth.role,status:data.status||'active',permissions:data.permissions||{}
    }});
  }catch(error){
    console.error('auth-session failed:',error);
    return json(res,500,{ok:false,error:'server_error'});
  }
}
