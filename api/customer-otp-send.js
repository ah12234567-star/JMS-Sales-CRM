import crypto from 'node:crypto';
import { json, readBody } from './auth-utils.js';
import { clean, normalizePhone, validSaudiMobile, otpHash, getOtpRecord, saveOtpRecord, storePrivate, setupAdmin } from './customer-auth-utils.js';

async function sendMetaWhatsAppOtp(phone,code){
  const accessToken=clean(process.env.META_WHATSAPP_ACCESS_TOKEN,1000);
  const phoneNumberId=clean(process.env.META_WHATSAPP_PHONE_NUMBER_ID,100);
  const templateName=clean(process.env.META_WHATSAPP_OTP_TEMPLATE,120);
  const language=clean(process.env.META_WHATSAPP_OTP_LANGUAGE,20)||'ar';

  if(!accessToken||!phoneNumberId||!templateName){
    const error=new Error('meta_otp_template_not_configured');
    error.code='meta_otp_template_not_configured';
    throw error;
  }

  const payload={
    messaging_product:'whatsapp',
    recipient_type:'individual',
    to:phone,
    type:'template',
    template:{
      name:templateName,
      language:{code:language},
      components:[
        {
          type:'body',
          parameters:[{type:'text',text:code}]
        },
        {
          type:'button',
          sub_type:'url',
          index:'0',
          parameters:[{type:'text',text:code}]
        }
      ]
    }
  };

  const response=await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`,{
    method:'POST',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result?.messages?.[0]?.id){
    console.error('Meta WhatsApp OTP send failed',response.status,result?.error?.code||'',result?.error?.message||'');
    const error=new Error('meta_otp_send_failed');
    error.code='meta_otp_send_failed';
    throw error;
  }
  return {messageId:result.messages[0].id};
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    if(storePrivate()&&!setupAdmin(req))return json(res,403,{ok:false,error:'store_private'});
    const body=await readBody(req),phone=normalizePhone(body.phone);
    if(!validSaudiMobile(phone))return json(res,400,{ok:false,error:'invalid_phone',message:'اكتب رقم جوال سعودي صحيح.'});

    const now=Date.now(),previous=await getOtpRecord(phone);
    if(previous&&now-Number(previous.last_sent_at||0)<60000){
      return json(res,429,{ok:false,error:'wait_before_retry',retry_after:60-Math.floor((now-Number(previous.last_sent_at||0))/1000)});
    }
    const windowStart=previous&&now-Number(previous.window_start||0)<3600000?Number(previous.window_start):now;
    const sendCount=windowStart===Number(previous?.window_start)?Number(previous.send_count||0):0;
    if(sendCount>=5)return json(res,429,{ok:false,error:'rate_limited',message:'تم تجاوز عدد المحاولات. حاول بعد ساعة.'});

    const code=String(crypto.randomInt(100000,1000000));
    const nonce=crypto.randomBytes(12).toString('hex');

    let delivery;
    try{
      delivery=await sendMetaWhatsAppOtp(phone,code);
    }catch(error){
      console.error('OTP provider failed',error.message);
      if(error.code==='meta_otp_template_not_configured'){
        return json(res,503,{ok:false,error:'otp_template_not_configured',message:'خدمة رمز التحقق غير مهيأة حالياً.'});
      }
      return json(res,502,{ok:false,error:'otp_send_failed',message:'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى.'});
    }

    await saveOtpRecord(phone,{
      nonce,
      code_hash:otpHash(phone,code,nonce),
      expires_at:now+300000,
      last_sent_at:now,
      window_start:windowStart,
      send_count:sendCount+1,
      verify_attempts:0,
      verified:false
    });

    return json(res,200,{
      ok:true,
      provider:'whatsapp',
      message_id:delivery.messageId,
      phone_hint:`05*****${phone.slice(-3)}`,
      expires_in:300,
      resend_after:60
    });
  }catch(error){
    console.error('customer-otp-send failed',error);
    return json(res,500,{ok:false,error:'server_error'});
  }
}
