const crypto = require('crypto');

function json(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function pbkdf2(password, salt){
  return crypto.pbkdf2Sync(String(password||''), String(salt||''), 120000, 32, 'sha256').toString('hex');
}

function sign(payload){
  const secret = process.env.AUTH_SECRET || 'jms-dev-secret';
  const body = Buffer.from(JSON.stringify({...payload, iat:Date.now()})).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body+'.'+sig;
}

async function supabase(path, opts={}){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error('missing_supabase_env');
  const res = await fetch(url.replace(/\/$/,'') + '/rest/v1/' + path, {
    ...opts,
    headers:{
      apikey:key,
      Authorization:'Bearer '+key,
      'Content-Type':'application/json',
      Prefer:'return=representation',
      ...(opts.headers||{})
    }
  });
  const text = await res.text();
  let data; try{ data = text ? JSON.parse(text) : null; } catch { data = text; }
  if(!res.ok) throw new Error('supabase_'+res.status+': '+text);
  return data;
}

async function getUser(email){
  const rows = await supabase('jms_users?email=eq.'+encodeURIComponent(String(email||'').toLowerCase())+'&limit=1');
  return rows && rows[0];
}

async function createInitialAdmin(){
  const email = String(process.env.INIT_ADMIN_EMAIL || 'admin@jms.local').toLowerCase();
  const password = process.env.INIT_ADMIN_PASSWORD || 'Jms2026Admin';
  const phone = process.env.INIT_ADMIN_PHONE || '966500000000';
  const salt = 'jms-admin-phase1-salt-2026';
  const data = {name:'مدير النظام', role:'admin', status:'active', password_salt:salt, password_hash:pbkdf2(password, salt)};
  const body = [{id:'u-admin', email, phone, data, updated_at:new Date().toISOString()}];
  await supabase('jms_users?on_conflict=id', {method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=representation'}, body:JSON.stringify(body)});
}

module.exports = async function handler(req,res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  try{
    const chunks=[]; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    const email = String(body.email||'').trim().toLowerCase();
    const password = String(body.password||'');
    const requestedRole = String(body.role||'');
    if(!email || !password) return json(res, 400, {ok:false,error:'missing_credentials'});

    let row = await getUser(email);
    if(!row && email === String(process.env.INIT_ADMIN_EMAIL || 'admin@jms.local').toLowerCase()){
      await createInitialAdmin();
      row = await getUser(email);
    }
    if(!row || !row.data) return json(res, 401, {ok:false,error:'invalid_login'});

    const u = row.data;
    if(u.status && u.status !== 'active') return json(res, 403, {ok:false,error:'user_disabled'});
    const salt = u.password_salt || '';
    const hash = u.password_hash || '';
    const ok = hash && pbkdf2(password, salt) === hash;
    if(!ok) return json(res, 401, {ok:false,error:'invalid_login'});
    if(requestedRole && u.role && requestedRole !== u.role) return json(res, 403, {ok:false,error:'wrong_role'});

    const user = {id: row.id, name:u.name||'مدير النظام', email:row.email, phone:row.phone||'', role:u.role||'admin', status:u.status||'active'};
    return json(res, 200, {ok:true,user,token:sign({id:user.id,email:user.email,role:user.role})});
  }catch(e){
    console.error('auth-login failed', e);
    return json(res, 500, {ok:false,error:'server_error',message:e.message});
  }
}
