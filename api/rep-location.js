import crypto from 'node:crypto';
import { json, readBody, supabase, upsertUser } from './auth-utils.js';

function verifyToken(req){
  const raw=String(req.headers.authorization||'');
  const token=raw.startsWith('Bearer ')?raw.slice(7):'';
  if(!token)return null;
  const [body,sig]=token.split('.');
  if(!body||!sig)return null;
  const secret=process.env.AUTH_SECRET||'jms-dev-secret';
  const expected=crypto.createHmac('sha256',secret).update(body).digest('base64url');
  try{
    if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
    return JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  }catch(_){return null;}
}

async function getUserById(id){
  const safe=encodeURIComponent(String(id||''));
  const rows=await supabase('jms_users?id=eq.'+safe+'&limit=1');
  return rows?.[0]||null;
}

function cleanText(value,max=180){return String(value||'').trim().slice(0,max)}

export default async function handler(req,res){
  const auth=verifyToken(req);
  if(!auth?.id)return json(res,401,{ok:false,error:'unauthorized'});
  try{
    if(req.method==='POST'){
      if(auth.role!=='rep')return json(res,403,{ok:false,error:'rep_only'});
      const body=await readBody(req);
      const row=await getUserById(auth.id);
      if(!row?.data)return json(res,404,{ok:false,error:'user_not_found'});
      const now=new Date().toISOString();
      let data={...row.data};

      if(body.kind==='state'){
        const allowed=['available','en_route','arrived','in_visit'];
        const status=cleanText(body.status,30);
        if(!allowed.includes(status))return json(res,400,{ok:false,error:'invalid_state'});
        const previous=data.work_state||{};
        if(status==='available'){
          data.work_state={status:'available',updated_at:now,last_customer_id:previous.customer_id||'',last_customer_name:previous.customer_name||'',last_completed_at:body.completed?now:(previous.last_completed_at||null)};
        }else{
          const customer_id=cleanText(body.customer_id,120);
          const customer_name=cleanText(body.customer_name,180);
          if(!customer_id||!customer_name)return json(res,400,{ok:false,error:'customer_required'});
          data.work_state={status,customer_id,customer_name,started_at:previous.customer_id===customer_id&&previous.started_at?previous.started_at:now,updated_at:now};
        }
        await upsertUser({id:row.id,email:row.email,phone:row.phone||'',data,updated_at:now});
        return json(res,200,{ok:true,work_state:data.work_state,updated_at:now});
      }

      const lat=Number(body.lat),lng=Number(body.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng))return json(res,400,{ok:false,error:'invalid_coordinates'});
      data.last_location={
        lat,lng,
        accuracy:Number(body.accuracy)||0,
        speed:Number.isFinite(Number(body.speed))?Number(body.speed):null,
        heading:Number.isFinite(Number(body.heading))?Number(body.heading):null,
        updated_at:now,
        source:'browser_gps'
      };
      await upsertUser({id:row.id,email:row.email,phone:row.phone||'',data,updated_at:now});
      return json(res,200,{ok:true,updated_at:now});
    }

    if(req.method==='GET'){
      if(auth.role==='rep'){
        const row=await getUserById(auth.id);
        if(!row?.data)return json(res,404,{ok:false,error:'user_not_found'});
        return json(res,200,{ok:true,rep:{id:row.id,name:row.data?.name||row.email||row.id,location:row.data?.last_location||null,work_state:row.data?.work_state||{status:'available'}}});
      }
      if(!['admin','sales'].includes(auth.role))return json(res,403,{ok:false,error:'manager_only'});
      const rows=await supabase('jms_users?select=id,email,phone,data,updated_at');
      const reps=(rows||[]).filter(r=>r?.data?.role==='rep').map(r=>({
        id:r.id,
        name:r.data?.name||r.email||r.id,
        email:r.email||'',
        status:r.data?.status||'active',
        location:r.data?.last_location||null,
        work_state:r.data?.work_state||{status:'available'}
      }));
      return json(res,200,{ok:true,reps});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(e){
    console.error('rep-location failed',e);
    return json(res,500,{ok:false,error:'server_error',message:e.message});
  }
}
