import { json, pbkdf2, makeSalt, readBody, supabase, upsertUser, requireAuth } from './auth-utils.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  if(!requireAuth(req,res,['admin'])) return;
  try{
    const body = await readBody(req);
    if(String(body.newPassword || '').length < 10) return json(res,400,{ok:false,error:'weak_password',message:'كلمة المرور يجب أن تكون 10 خانات على الأقل'});
    const rows = await supabase('jms_users?id=eq.' + encodeURIComponent(body.userId) + '&limit=1');
    const row = rows && rows[0];
    if(!row) return json(res, 404, {ok:false,error:'not_found'});
    const data = row.data || {};
    const salt = makeSalt();
    data.password_salt = salt;
    data.password_hash = pbkdf2(body.newPassword, salt);
    await upsertUser({ ...row, data, updated_at: new Date().toISOString() });
    return json(res, 200, {ok:true, message:'تم إعادة تعيين كلمة المرور'});
  }catch(e){
    console.error('auth-admin-reset-password failed:', e);
    return json(res, 500, {ok:false,error:'server_error',message:e.message});
  }
}
