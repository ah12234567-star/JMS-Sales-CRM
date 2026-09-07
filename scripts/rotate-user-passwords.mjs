import crypto from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

// Save every recovery credential durably before changing any account.
export async function rotatePasswords({url, key, output, request = fetch}) {
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const headers = {apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json'};
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/jms_users`;
  const response = await request(`${endpoint}?select=id,email,data`, {headers});
  if (!response.ok) throw new Error(`Unable to load users: ${response.status}`);
  const users = await response.json();
  if (!Array.isArray(users) || users.some(user => !user.id || !user.email)) throw new Error('Invalid user response');
  const credentials = users.map(user => ({id:user.id, email:user.email, password:crypto.randomBytes(24).toString('base64url') + '!9aA'}));
  const fd = fs.openSync(output, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify({createdAt:new Date().toISOString(), credentials}, null, 2));
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  let completed = 0;
  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(credentials[index].password, salt, 120000, 32, 'sha256').toString('hex');
    const rotatedAt = new Date().toISOString();
    const data = {...(user.data || {}), password_salt:salt, password_hash:hash, password_rotated_at:rotatedAt};
    let update;
    try {
      update = await request(`${endpoint}?id=eq.${encodeURIComponent(user.id)}`, {
        method:'PATCH', headers:{...headers, Prefer:'return=representation'}, body:JSON.stringify({data,updated_at:rotatedAt})
      });
      if (!update.ok) throw new Error(`HTTP ${update.status}`);
      const rows = await update.json();
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== user.id) throw new Error('Expected exactly one updated account');
    } catch {
      throw new Error(`Rotation stopped at account ${index + 1}; ${completed} updates confirmed. Preserve ${output}: the current account may also have changed. Recovery credentials for all accounts are saved there.`);
    }
    completed++;
  }
  return completed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = `jms-password-rotation-${Date.now()}.json`;
  const count = await rotatePasswords({url:process.env.SUPABASE_URL, key:process.env.SUPABASE_SERVICE_ROLE_KEY, output});
  console.log(`Rotated ${count} users. Private recovery credentials: ${output}. Rotate AUTH_SECRET separately to invalidate existing sessions.`);
}
