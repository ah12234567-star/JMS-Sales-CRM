import crypto from 'node:crypto';
import { json, readBody } from './auth-utils.js';
import { clean, normalizePhone, validSaudiMobile, otpHash, getOtpRecord, saveOtpRecord, storePrivate, setupAdmin } from './customer-auth-utils.js';

async function sendMetaWhatsAppOtp(phone,code){
  // Reuse the WhatsApp Cloud credentials already configured for JMS password
  // recovery, while keeping support for the newer customer-OTP variable names.
  const accessToken=clean(process.env.META_WHATSAPP_ACCESS_TOKEN||process.env.WHATSAPP_ACCESS_TOKEN||process.env.WHATSAPP_TOKEN,1000);
  const phoneNumberId=clean(process.env.META_WHATSAPP_PHONE_NUMBER_ID||process.env.WHATSAPP_PHONE_NUMBER_ID||'1252021734662917',100);
  const templateName=clean(process.env.META_WHATSAPP_OTP_TEMPLATE||process.env.WHATSAPP_OTP_TEMPLATE||process.env.WHATSAPP_RESET_TEMPLATE,120);
  if(!accessToken||!phoneNumberId)return false;
  const language=clean(process.env.META_WHATSAPP_OTP_LANGUAGE||process.env.WHATSAPP_OTP_LANGUAGE||process.env.WHATSAPP_RESET_LANGUAGE,20)||'ar';

  const send=async payload=>{
    const response=await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`,{
      method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    if(!response.ok){
      const result=await response.json().catch(()=>({}));
      console.error('Meta WhatsApp OTP send failed',response.status,result?.error?.code||'',result?.error?.message||'');
      throw new Error('meta_otp_send_failed');
    }
  };

  if(templateName){
    await send({messaging_product:'whatsapp',recipient_type:'individual',to:phone,type:'template',template:{name:templateName,language:{code:language},components:[{type:'body',parameters:[{type:'text',text:code}]}]}});
    return true;
  }

  // The existing JMS connection uses Meta's test number. Open its permitted
  // test conversation first, then send the short-lived verification code.
  await send({messaging_product:'whatsapp',to:phone,type:'template',template:{name:'hello_world',language:{code:'en_US'}}});
  await send({messaging_product:'whatsapp',to:phone,type:'text',text:{preview_url:false,body:`رمز التحقق لمتجر شركة جدة النموذجية هو: ${code}\nصالح لمدة 5 دقائق. لا تشارك الرمز مع أي شخص.`}});
  return true;
}

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
    const code=String(crypto.randomInt(100000,1000000)),nonce=crypto.randomBytes(12).toString('hex');
    let provider='whatsapp';
    try{
      const sentByMeta=await sendMetaWhatsAppOtp(phone,code);
      if(!sentByMeta){
        const apiKey=clean(process.env.TAQNYAT_API_KEY,500),sender=clean(process.env.TAQNYAT_SENDER,20);
        if(!apiKey||!sender)return json(res,503,{ok:false,error:'otp_provider_not_configured',message:'يلزم إكمال ربط رقم واتساب الشركة لإرسال رمز التحقق.'});
        const response=await fetch('https://api.taqnyat.sa/v1/messages',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({recipients:[phone],body:`رمز التحقق لمتجر شركة جدة النموذجية هو: ${code}\nصالح لمدة 5 دقائق.`,sender})});
        if(!response.ok)throw new Error('taqnyat_otp_send_failed');provider='sms';
      }
    }catch(error){console.error('OTP provider failed',error.message);return json(res,502,{ok:false,error:'otp_send_failed',message:'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى.'})}
    await saveOtpRecord(phone,{nonce,code_hash:otpHash(phone,code,nonce),expires_at:now+300000,last_sent_at:now,window_start:windowStart,send_count:sendCount+1,verify_attempts:0,verified:false});
    return json(res,200,{ok:true,provider,phone_hint:`05*****${phone.slice(-3)}`,expires_in:300,resend_after:60});
  }catch(error){console.error('customer-otp-send failed',error);return json(res,500,{ok:false,error:'server_error'})}
}
