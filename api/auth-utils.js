import crypto from 'node:crypto';

export function json(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function pbkdf2(password, salt){
  return crypto.pbkdf2Sync(String(password || ''), String(salt || ''), 120000, 32, 'sha256').toString('hex');
}

export function makeSalt(){
  return crypto.randomBytes(16).toString('hex');
}

export async function readBody(req){
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}

export async function supabase(path, opts = {}){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error('missing_supabase_env');

  const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/' + path, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = text; }

  if(!response.ok) throw new Error('supabase_' + response.status + ': ' + text);
  return data;
}

export async function getUserByEmail(email){
  const safeEmail = encodeURIComponent(String(email || '').trim().toLowerCase());
  const rows = await supabase('jms_users?email=eq.' + safeEmail + '&limit=1');
  return rows && rows[0] ? rows[0] : null;
}

export async function upsertUser(user){
  return supabase('jms_users?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([user])
  });
}

export function sign(payload){
  const secret = process.env.AUTH_SECRET || 'jms-dev-secret';
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}
