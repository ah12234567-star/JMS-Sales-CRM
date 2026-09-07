import crypto from 'node:crypto';
import fs from 'node:fs';

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const headers = {apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json'};
const response = await fetch(`${url}/rest/v1/jms_users?select=id,email,data` ,{headers});
if (!response.ok) throw new Error(`Unable to load users: ${response.status}`);
const users = await response.json();
const result = [];

for (const user of users) {
  const password = crypto.randomBytes(18).toString('base64url') + '!9aA';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  const data = {...(user.data || {}), password_salt:salt, password_hash:hash, password_rotated_at:new Date().toISOString()};
  const update = await fetch(`${url}/rest/v1/jms_users?id=eq.${encodeURIComponent(user.id)}`, {
    method:'PATCH', headers:{...headers, Prefer:'return=minimal'}, body:JSON.stringify({data,updated_at:new Date().toISOString()})
  });
  if (!update.ok) throw new Error(`Unable to rotate ${user.email}: ${update.status}`);
  result.push({email:user.email,password});
}

const output = `jms-password-rotation-${Date.now()}.json`;
fs.writeFileSync(output, JSON.stringify(result, null, 2), {mode:0o600, flag:'wx'});
console.log(`Rotated ${result.length} users. Temporary credentials: ${output}`);
