import { json, pbkdf2, getUserByEmail, sign } from './auth-utils.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, error:'method_not_allowed' });
  try{
    const chunks=[]; for await (const c of req) chunks.push(c);
    let body={}; try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{body={}}
    const email=String(body.email||'').trim().toLowerCase();
    const password=String(body.password||'');
    const requestedRole=String(body.role||'').trim();
    if(!email||!password) return json(res,400,{ok:false,error:'missing_credentials'});

    const row=await getUserByEmail(email);
    if(!row||!row.data) return json(res,401,{ok:false,error:'invalid_login'});

    const data=row.data||{};
    if(data.status&&data.status!=='active') return json(res,403,{ok:false,error:'user_disabled'});
    const hash=data.password_hash||'', salt=data.password_salt||'';
    if(!hash||!salt||pbkdf2(password,salt)!==hash) return json(res,401,{ok:false,error:'invalid_login'});
    if(requestedRole&&data.role&&requestedRole!==data.role) return json(res,403,{ok:false,error:'wrong_role'});

    const user={id:row.id,name:data.name||'مستخدم',email:row.email,phone:row.phone||'',role:data.role||'rep',status:data.status||'active',permissions:data.permissions||{}};
    return json(res,200,{ok:true,user,token:sign({id:user.id,email:user.email,role:user.role})});
  }catch(e){
    console.error('auth-login failed:',e);
    return json(res,500,{ok:false,error:'server_error',message:e.message});
  }
}
