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

    const phone=await graph(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneId)}?fields=id,display_phone_number,verified_name`);
    const debug=await graph(`https://graph.facebook.com/v23.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`);
    const granular=debug?.data?.granular_scopes||[];
    const candidateIds=[...new Set(granular
      .filter(s=>String(s?.scope||'').includes('whatsapp_business'))
      .flatMap(s=>Array.isArray(s?.target_ids)?s.target_ids:[])
      .map(String)
      .filter(Boolean))];

    const matches=[];
    for(const id of candidateIds){
      try{
        const data=await graph(`https://graph.facebook.com/v23.0/${encodeURIComponent(id)}/message_templates?fields=id,name,status,category,language,components&limit=100`);
        if(Array.isArray(data?.data)){
          matches.push({
            waba_id:id,
            templates:data.data.map(t=>({
              id:t.id,
              name:t.name,
              status:t.status,
              category:t.category,
              language:t.language,
              components:(t.components||[]).map(c=>({type:c.type,sub_type:c.sub_type,format:c.format,buttons:c.buttons}))
            }))
          });
        }
      }catch(_){/* candidate may be a phone number or other target */}
    }

    return res.status(200).json({
      ok:true,
      phone:{id:phone?.id,display_phone_number:phone?.display_phone_number,verified_name:phone?.verified_name},
      candidate_ids:candidateIds,
      accounts:matches
    });
  }catch(error){
    console.error('meta-template-probe failed',error.message);
    return res.status(502).json({ok:false,error:'meta_probe_failed',message:error.message});
  }
}
