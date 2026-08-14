import { json, pbkdf2, makeSalt, readBody, getUserByEmail, upsertUser } from './auth-utils.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  try{
    const body = await readBody(req);
    const row = await getUserByEmail(body.email);
    if(!row) return json(res, 404, {ok:false,error:'not_found'});
    const data = row.data || {};
    if(pbkdf2(body.oldPassword, data.password_salt) !== data.password_hash){
      return json(res, 401, {ok:false,error:'wrong_password'});
    }
    const salt = makeSalt();
    data.password_salt = salt;
    data.password_hash = pbkdf2(body.newPassword, salt);
    await upsertUser({ ...row, data, updated_at: new Date().toISOString() });
    return json(res, 200, {ok:true, message:'تم تغيير كلمة المرور'});
  }catch(e){
    console.error('auth-change-password failed:', e);
    return json(res, 500, {ok:false,error:'server_error',message:e.message});
  }
}
