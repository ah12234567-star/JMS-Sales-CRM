import { json, makeSalt, pbkdf2, readBody, supabase, upsertUser } from './auth-utils.js';

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

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const phone = normalizePhone(body.phone);
    const code = String(body.code || '').replace(/\D/g,'');
    const newPassword = String(body.newPassword || '');
    if((!email && !phone) || code.length !== 6 || newPassword.length < 8){
      return json(res,400,{ok:false,error:'invalid_input',message:'أدخل الرمز وكلمة مرور من 8 خانات على الأقل'});
    }
    const row = await findUser(email,phone);
    const data = row?.data || {};
    if(!row || !data.reset_code_hash || Number(data.reset_expires_at || 0) < Date.now()){
      return json(res,400,{ok:false,error:'invalid_or_expired_code',message:'رمز غير صحيح أو منتهي الصلاحية'});
    }
    const attempts = Number(data.reset_attempts || 0);
    if(attempts >= 5) return json(res,429,{ok:false,error:'too_many_attempts',message:'انتهت المحاولات، اطلب رمزًا جديدًا'});
    if(pbkdf2(code,data.reset_code_salt || '') !== data.reset_code_hash){
      data.reset_attempts = attempts + 1;
      await upsertUser({...row,data,updated_at:new Date().toISOString()});
      return json(res,400,{ok:false,error:'invalid_or_expired_code',message:'رمز غير صحيح أو منتهي الصلاحية'});
    }
    const passwordSalt = makeSalt();
    data.password_salt = passwordSalt;
    data.password_hash = pbkdf2(newPassword,passwordSalt);
    delete data.reset_code_salt; delete data.reset_code_hash; delete data.reset_expires_at; delete data.reset_next_allowed_at; delete data.reset_attempts;
    await upsertUser({...row,data,updated_at:new Date().toISOString()});
    return json(res,200,{ok:true,message:'تم تغيير كلمة المرور، تقدر تسجل الدخول الآن'});
  }catch(e){
    console.error('auth-reset-confirm failed:',e);
    return json(res,500,{ok:false,error:'server_error',message:'تعذر تغيير كلمة المرور'});
  }
}
