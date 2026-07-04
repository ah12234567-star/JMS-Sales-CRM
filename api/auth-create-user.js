import { json, pbkdf2, makeSalt, readBody, upsertUser } from './auth-utils.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  try{
    const body = await readBody(req);
    if(!body.email || !body.password) return json(res, 400, {ok:false,error:'missing_email_or_password'});
    const salt = makeSalt();
    const data = {
      name: body.name || body.email,
      role: body.role || 'rep',
      status: body.status || 'active',
      password_salt: salt,
      password_hash: pbkdf2(body.password, salt)
    };
    await upsertUser({
      id: body.id || ('u-' + Date.now()),
      email: String(body.email || '').trim().toLowerCase(),
      phone: body.phone || '',
      data,
      updated_at: new Date().toISOString()
    });
    return json(res, 200, {ok:true, message:'تم إنشاء المستخدم'});
  }catch(e){
    console.error('auth-create-user failed:', e);
    return json(res, 500, {ok:false,error:'server_error',message:e.message});
  }
}
