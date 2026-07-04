const crypto = require('crypto');
function json(res, status, body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
function pbkdf2(password, salt){return crypto.pbkdf2Sync(String(password||''), String(salt||''), 120000, 32, 'sha256').toString('hex');}
function salt(){return crypto.randomBytes(16).toString('hex');}
async function readBody(req){const chunks=[];for await(const c of req)chunks.push(c);return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
async function supabase(path, opts={}){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('missing_supabase_env');const res=await fetch(url.replace(/\/$/,'')+'/rest/v1/'+path,{...opts,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation',...(opts.headers||{})}});const text=await res.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error('supabase_'+res.status+': '+text);return data;}
async function getUserByEmail(email){const rows=await supabase('jms_users?email=eq.'+encodeURIComponent(String(email||'').toLowerCase())+'&limit=1');return rows&&rows[0];}
async function upsertUser(user){return supabase('jms_users?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([user])});}
module.exports={json,pbkdf2,salt,readBody,supabase,getUserByEmail,upsertUser};
