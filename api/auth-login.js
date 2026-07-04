import { json, pbkdf2, getUserByEmail, upsertUser, sign } from './auth-utils.js';

async function createInitialAdmin(){
  const email = String(process.env.INIT_ADMIN_EMAIL || 'admin@jms.local').trim().toLowerCase();
  const password = process.env.INIT_ADMIN_PASSWORD || 'Jms2026Admin';
  const phone = process.env.INIT_ADMIN_PHONE || '966500000000';
  const salt = 'jms-admin-phase1-salt-2026';
  const data = {
    name: 'مدير النظام',
    role: 'admin',
    status: 'active',
    password_salt: salt,
    password_hash: pbkdf2(password, salt)
  };
  await upsertUser({ id: 'u-admin', email, phone, data, updated_at: new Date().toISOString() });
}

export default async function handler(req, res){
  if(req.method !== 'POST'){
    return json(res, 405, { ok:false, error:'method_not_allowed', message:'Use POST only' });
  }

  try{
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { body = {}; }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const requestedRole = String(body.role || '').trim();

    if(!email || !password){
      return json(res, 400, { ok:false, error:'missing_credentials' });
    }

    let row = await getUserByEmail(email);
    const initEmail = String(process.env.INIT_ADMIN_EMAIL || 'admin@jms.local').trim().toLowerCase();

    if(!row && email === initEmail){
      await createInitialAdmin();
      row = await getUserByEmail(email);
    }

    if(!row || !row.data){
      return json(res, 401, { ok:false, error:'invalid_login' });
    }

    const data = row.data || {};
    if(data.status && data.status !== 'active'){
      return json(res, 403, { ok:false, error:'user_disabled' });
    }

    const hash = data.password_hash || '';
    const salt = data.password_salt || '';
    if(!hash || pbkdf2(password, salt) !== hash){
      return json(res, 401, { ok:false, error:'invalid_login' });
    }

    if(requestedRole && data.role && requestedRole !== data.role){
      return json(res, 403, { ok:false, error:'wrong_role' });
    }

    const user = {
      id: row.id,
      name: data.name || 'مدير النظام',
      email: row.email,
      phone: row.phone || '',
      role: data.role || 'admin',
      status: data.status || 'active'
    };

    return json(res, 200, {
      ok: true,
      user,
      token: sign({ id:user.id, email:user.email, role:user.role })
    });
  }catch(e){
    console.error('auth-login failed:', e);
    return json(res, 500, { ok:false, error:'server_error', message:e.message });
  }
}
