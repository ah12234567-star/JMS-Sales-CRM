import crypto from 'node:crypto';
import { json, pbkdf2, supabase, upsertUser } from './auth-utils.js';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const token=String(req.query?.token||'');
    if(token.length<48) return json(res,404,{ok:false,error:'not_found'});
    const recordId='ops-wa-smoke-'+hash(token);
    const record=(await supabase('jms_routes?id=eq.'+encodeURIComponent(recordId)+'&select=id,data&limit=1'))?.[0];
    const job=record?.data||{};
    if(!record||job.used||Number(job.expires_at||0)<Date.now()) return json(res,404,{ok:false,error:'not_found'});
    const user=(await supabase('jms_users?id=eq.'+encodeURIComponent(job.user_id)+'&select=id,email,phone,data&limit=1'))?.[0];
    if(!user||user.phone!==job.phone) throw new Error('smoke_target_mismatch');
    const accessToken=String(process.env.META_WHATSAPP_ACCESS_TOKEN||'').trim();
    const phoneNumberId=String(process.env.META_WHATSAPP_PHONE_NUMBER_ID||'').trim();
    const template=String(process.env.META_WHATSAPP_RESET_TEMPLATE||'').trim();
    const language=String(process.env.META_WHATSAPP_RESET_LANGUAGE||'ar').trim();
    if(!accessToken||!phoneNumberId||!template) throw new Error('whatsapp_reset_not_configured');
    const code=String(crypto.randomInt(100000,1000000)),salt=crypto.randomBytes(16).toString('hex'),now=Date.now();
    const data={...(user.data||{}),reset_code_salt:salt,reset_code_hash:pbkdf2(code,salt),reset_expires_at:now+600000,reset_next_allowed_at:now+60000,reset_attempts:0};
    await upsertUser({...user,data,updated_at:new Date().toISOString()});
    const response=await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:user.phone,type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:[{type:'text',text:code}]}]}})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result?.error?.message||'whatsapp_send_failed');
    await supabase('jms_routes?id=eq.'+encodeURIComponent(recordId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({data:{...job,used:true,used_at:new Date().toISOString()}})});
    return json(res,200,{ok:true,providerAccepted:true,messageId:Boolean(result?.messages?.[0]?.id)});
  }catch(error){
    console.error('ops WhatsApp smoke failed:',error.message);
    return json(res,500,{ok:false,error:'smoke_failed'});
  }
}
