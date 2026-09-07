import crypto from 'node:crypto';
import { json, pbkdf2, readBody, supabase, upsertUser } from './auth-utils.js';

function normalizePhone(value){
  const digits = String(value || '').replace(/\D/g, '');
  if(!digits) return '';
  if(digits.startsWith('966')) return digits;
  return '966' + digits.replace(/^0/, '');
}

async function findUser(email, phone){
  if(email){
    const rows = await supabase('jms_users?email=eq.' + encodeURIComponent(email) + '&limit=1');
    if(rows?.[0]) return rows[0];
  }
  if(phone){
    const rows = await supabase('jms_users?phone=eq.' + encodeURIComponent(phone) + '&limit=1');
    if(rows?.[0]) return rows[0];
  }
  return null;
}

async function whatsappSend(phoneNumberId, token, body){
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method:'POST',
    headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const result = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result?.error?.message || 'whatsapp_send_failed');
  return result;
}

async function sendWhatsappCode(phone, code){
  const token = String(process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const template = String(process.env.META_WHATSAPP_RESET_TEMPLATE || '').trim();
  const language = String(process.env.META_WHATSAPP_RESET_LANGUAGE || 'ar').trim();
  if(!token || !phoneNumberId || !template) throw new Error('whatsapp_reset_not_configured');
  await whatsappSend(phoneNumberId,token,{
    messaging_product:'whatsapp',to:phone,type:'template',
    template:{
      name:template,
      language:{code:language},
      components:[{type:'body',parameters:[{type:'text',text:code}]}]
    }
  });
}

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  try{
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const requestedPhone = normalizePhone(body.phone);
    if(!email && !requestedPhone) return json(res,400,{ok:false,error:'missing_account'});
    const row = await findUser(email, requestedPhone);
    const generic = {ok:true,message:'إذا كانت البيانات مسجلة، سيصل رمز الاستعادة على رقم واتساب المرتبط بالحساب'};
    if(!row || row.data?.status === 'disabled') return json(res,200,generic);
    const phone = normalizePhone(row.phone);
    if(!phone) return json(res,200,generic);
    const now = Date.now();
    if(Number(row.data?.reset_next_allowed_at || 0) > now){
      return json(res,429,{ok:false,error:'too_many_requests',message:'انتظر دقيقة ثم أعد المحاولة'});
    }
    const code = String(crypto.randomInt(100000,1000000));
    const salt = crypto.randomBytes(16).toString('hex');
    const data = {...(row.data || {}),reset_code_salt:salt,reset_code_hash:pbkdf2(code,salt),reset_expires_at:now+(10*60*1000),reset_next_allowed_at:now+60000,reset_attempts:0};
    await upsertUser({...row,data,updated_at:new Date().toISOString()});
    try{
      await sendWhatsappCode(phone,code);
    }catch(sendError){
      delete data.reset_code_salt; delete data.reset_code_hash; delete data.reset_expires_at; delete data.reset_attempts;
      await upsertUser({...row,data,updated_at:new Date().toISOString()});
      throw sendError;
    }
    return json(res,200,generic);
  }catch(e){
    console.error('auth-reset-request failed:',e);
    return json(res,500,{ok:false,error:'send_failed',message:'تعذر إرسال رمز واتساب. تحقق من إعدادات واتساب في Vercel'});
  }
}
