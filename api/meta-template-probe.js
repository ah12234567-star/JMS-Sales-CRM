export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    const token=String(process.env.META_WHATSAPP_ACCESS_TOKEN||process.env.WHATSAPP_ACCESS_TOKEN||process.env.WHATSAPP_TOKEN||'').trim();
    const phoneId=String(process.env.META_WHATSAPP_PHONE_NUMBER_ID||process.env.WHATSAPP_PHONE_NUMBER_ID||'1252021734662917').trim();
    if(!token||!phoneId)return res.status(503).json({ok:false,error:'meta_credentials_missing'});
    const graph=async url=>{
      const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(`graph_${r.status}_${d?.error?.code||''}_${d?.error?.message||'failed'}`);
      return d;
    };
    const phone=await graph(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneId)}?fields=id,display_phone_number,verified_name,whatsapp_business_account`);
    const wabaId=phone?.whatsapp_business_account?.id||phone?.whatsapp_business_account;
    if(!wabaId)return res.status(502).json({ok:false,error:'waba_id_not_found',phone:{id:phone?.id,display_phone_number:phone?.display_phone_number,verified_name:phone?.verified_name}});
    const data=await graph(`https://graph.facebook.com/v23.0/${encodeURIComponent(wabaId)}/message_templates?fields=id,name,status,category,language,components&limit=100`);
    const templates=(data?.data||[]).map(t=>({id:t.id,name:t.name,status:t.status,category:t.category,language:t.language,components:(t.components||[]).map(c=>({type:c.type,sub_type:c.sub_type,format:c.format,buttons:c.buttons}))}));
    return res.status(200).json({ok:true,phone:{id:phone?.id,display_phone_number:phone?.display_phone_number,verified_name:phone?.verified_name},waba_id:String(wabaId),templates});
  }catch(error){
    console.error('meta-template-probe failed',error.message);
    return res.status(502).json({ok:false,error:'meta_probe_failed',message:error.message});
  }
}
