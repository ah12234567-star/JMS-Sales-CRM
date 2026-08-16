import { json, pbkdf2, getUserByEmail, upsertUser, sign } from './auth-utils.js';

const OTHMAN_BOOTSTRAP = {
  id: 'rep-othman',
  name: 'عثمان',
  email: 'othman@jms.local',
  salt: '3daa9b059d3801c90b3dab8a147dd7aa',
  hash: '528b27ba0024c3e39b8b724839edda94504c4863ed5ee55a4b82371a3ada6813'
};

async function createOthmanOnFirstLogin(email, password){
  if(email !== OTHMAN_BOOTSTRAP.email) return null;
  if(pbkdf2(password, OTHMAN_BOOTSTRAP.salt) !== OTHMAN_BOOTSTRAP.hash) return null;
  const data = {
    name: OTHMAN_BOOTSTRAP.name,
    role: 'rep',
    status: 'active',
    permissions: {
      create_customers: true, edit_customers: true, reassign_customers: false,
      delete_customers: false, view_all_customers: false, view_reports: false,
      use_ai: true, manage_quotes: true, manage_orders: true,
      manage_users: false, manage_permissions: false, manage_ink: false
    },
    password_salt: OTHMAN_BOOTSTRAP.salt,
    password_hash: OTHMAN_BOOTSTRAP.hash
  };
  await upsertUser({
    id: OTHMAN_BOOTSTRAP.id,
    email: OTHMAN_BOOTSTRAP.email,
    phone: '', data, updated_at: new Date().toISOString()
  });
  return await getUserByEmail(email);
}

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, error:'method_not_allowed' });
  try{
    const chunks=[]; for await (const c of req) chunks.push(c);
    let body={}; try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{body={}}
    const email=String(body.email||'').trim().toLowerCase();
    const password=String(body.password||'');
    const requestedRole=String(body.role||'').trim();
    if(!email||!password) return json(res,400,{ok:false,error:'missing_credentials'});

    // No admin bootstrap/default-password path is allowed in production.
    let row=await getUserByEmail(email);
    if(!row) row=await createOthmanOnFirstLogin(email,password);
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
