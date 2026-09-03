import crypto from 'node:crypto';
import { json, readBody } from './auth-utils.js';
import { clean, normalizePhone, validSaudiMobile, otpHash, getOtpRecord, saveOtpRecord, storePrivate, setupAdmin } from './customer-auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    if(storePrivate()&&!setupAdmin(req))return json(res,403,{ok:false,error:'store_private'});
    const body=await readBody(req),phone=normalizePhone(body.phone);
    if(!validSaudiMobile(phone))return json(res,400,{ok:false,error:'invalid_phone',message:'اكتب رقم جوال سعودي صحيح.'});
    const now=Date.now(),previous=await getOtpRecord(phone);
    if(previous&&now-Number(previous.last_sent_at||0)<60000)return json(res,429,{ok:false,error:'wait_before_retry',retry_after:60-Math.floor((now-Number(previous.last_sent_at||0))/1000)});
    const windowStart=previous&&now-Number(previous.window_start||0)<3600000?Number(previous.window_start):now;
    const sendCount=windowStart===Number(previous?.window_start)?Number(previous.send_count||0):0;
    if(sendCount>=5)return json(res,429,{ok:false,error:'rate_limited',message:'تم تجاوز عدد المحاولات. حاول بعد ساعة.'});
    const apiKey=clean(process.env.TAQNYAT_API_KEY,500),sender=clean(process.env.TAQNYAT_SENDER,20);
    if(!apiKey||!sender)return json(res,503,{ok:false,error:'otp_provider_not_configured',message:'خدمة رمز التحقق قيد التجهيز.'});
    const code=String(crypto.randomInt(100000,1000000)),nonce=crypto.randomBytes(12).toString('hex');
    const response=await fetch('https://api.taqnyat.sa/v1/messages',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({recipients:[phone],body:`رمز التحقق لمتجر شركة جدة النموذجية هو: ${code}\nصالح لمدة 5 دقائق.`,sender})});
    if(!response.ok){console.error('Taqnyat OTP send failed',response.status);return json(res,502,{ok:false,error:'otp_send_failed',message:'تعذر إرسال الرمز الآن. حاول مرة أخرى.'})}
    await saveOtpRecord(phone,{nonce,code_hash:otpHash(phone,code,nonce),expires_at:now+300000,last_sent_at:now,window_start:windowStart,send_count:sendCount+1,verify_attempts:0,verified:false});
    return json(res,200,{ok:true,phone_hint:`05*****${phone.slice(-3)}`,expires_in:300,resend_after:60});
  }catch(error){console.error('customer-otp-send failed',error);return json(res,500,{ok:false,error:'server_error'})}
}
