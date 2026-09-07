import crypto from 'node:crypto';
import fs from 'node:fs';

const users = JSON.parse(process.env.JMS_ROTATION_USERS || '[]');
if (!Array.isArray(users) || !users.length) throw new Error('JMS_ROTATION_USERS is required');

const now = new Date().toISOString();
const credentials = [];
const statements = ['begin;'];
for (const user of users) {
  if (!user?.id || !user?.email) throw new Error('Each account requires id and email');
  const password = crypto.randomBytes(24).toString('base64url') + '!9aA';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  credentials.push({name:user.name || '', email:user.email, password});
  const q = value => String(value).replaceAll("'", "''");
  statements.push(`update public.jms_users set data = jsonb_set(jsonb_set(jsonb_set(data, '{password_salt}', to_jsonb('${q(salt)}'::text)), '{password_hash}', to_jsonb('${q(hash)}'::text)), '{password_rotated_at}', to_jsonb('${q(now)}'::text)), updated_at = '${q(now)}'::timestamptz where id = '${q(user.id)}';`);
}
statements.push(`do $$ begin if (select count(*) from public.jms_users where data->>'password_rotated_at' = '${now}') <> ${users.length} then raise exception 'rotation_count_mismatch'; end if; end $$;`);
statements.push('commit;');
const stamp = Date.now();
const credentialsPath = `jms-password-rotation-${stamp}.json`;
const sqlPath = `/tmp/jms-password-rotation-${stamp}.sql`;
fs.writeFileSync(credentialsPath, JSON.stringify({createdAt:now, credentials}, null, 2), {mode:0o600, flag:'wx'});
fs.writeFileSync(sqlPath, statements.join('\n'), {mode:0o600, flag:'wx'});
console.log(JSON.stringify({credentialsPath,sqlPath,count:users.length}));
