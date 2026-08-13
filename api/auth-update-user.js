import { json, readBody, supabase, upsertUser } from './auth-utils.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  try{
    const body = await readBody(req);
    const id = String(body.id || '').trim();
    if(!id) return json(res, 400, {ok:false,error:'missing_user_id'});
    const rows = await supabase('jms_users?id=eq.' + encodeURIComponent(id) + '&limit=1');
    const row = rows && rows[0];
    if(!row) return json(res, 404, {ok:false,error:'not_found'});
    const data = {
      ...(row.data || {}),
      name: body.name || row.data?.name || row.email,
      role: body.role || row.data?.role || 'rep',
      status: body.status || row.data?.status || 'active',
      permissions: body.permissions || row.data?.permissions || {}
    };
    await upsertUser({...row,email:String(body.email||row.email).trim().toLowerCase(),phone:body.phone??row.phone,data,updated_at:new Date().toISOString()});
    return json(res, 200, {ok:true,message:'تم تحديث المستخدم والصلاحيات'});
  }catch(e){
    console.error('auth-update-user failed:',e);
    return json(res,500,{ok:false,error:'server_error',message:e.message});
  }
}
