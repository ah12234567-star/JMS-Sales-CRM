import { json, readBody, sign, supabase } from './auth-utils.js';
import { clean, normalizePhone, validSaudiMobile, shortHash, otpHash, safeEqual, getOtpRecord, saveOtpRecord, customerRowByPhone, safeCustomer, storePrivate, setupAdmin } from './customer-auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    if(storePrivate()&&!setupAdmin(req))return json(res,403,{ok:false,error:'store_private'});
    const body=await readBody(req),phone=normalizePhone(body.phone),code=clean(body.code,10);
    if(!validSaudiMobile(phone)||!/^\d{6}$/.test(code))return json(res,400,{ok:false,error:'invalid_code',message:'اكتب رمز التحقق المكوّن من 6 أرقام.'});
    const record=await getOtpRecord(phone),now=Date.now();
    if(!record||record.verified||Number(record.expires_at||0)<now)return json(res,410,{ok:false,error:'code_expired',message:'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.'});
    const attempts=Number(record.verify_attempts||0);
    if(attempts>=5)return json(res,429,{ok:false,error:'too_many_attempts',message:'تم تجاوز عدد المحاولات. اطلب رمزًا جديدًا.'});
    if(!safeEqual(record.code_hash,otpHash(phone,code,record.nonce))){await saveOtpRecord(phone,{...record,verify_attempts:attempts+1});return json(res,401,{ok:false,error:'wrong_code',message:'رمز التحقق غير صحيح.'})}
    let row=await customerRowByPhone(phone);
    if(!row){
      const id=`store-customer-${shortHash(phone)}`,nowIso=new Date().toISOString(),data={id,name:'',phone,city:'جدة',district:'',location:'',category:'عميل متجر إلكتروني',status:'active',rep_id:'',debt_balance:0,credit_limit:0,notes:'تم إنشاء الحساب عبر التحقق من الجوال',created_at:nowIso,updated_at:nowIso};
      await supabase('jms_customers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id,data,updated_at:nowIso}])});row={id,data};
    }
    const customer=safeCustomer(row,phone);
    await saveOtpRecord(phone,{...record,verified:true,code_hash:'',verified_at:now});
    const token=sign({id:customer.id,role:'customer',phone});
    return json(res,200,{ok:true,customer,token});
  }catch(error){console.error('customer-otp-verify failed',error);return json(res,500,{ok:false,error:'server_error'})}
}
