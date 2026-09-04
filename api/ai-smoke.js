export default async function handler(req,res){
  if(req.method!=="GET"){res.statusCode=405;return res.end(JSON.stringify({ok:false,error:"method_not_allowed"}));}
  res.setHeader("Content-Type","application/json; charset=utf-8");
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey){res.statusCode=500;return res.end(JSON.stringify({ok:false,stage:"missing_key"}));}
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",input:"أجب بكلمة جاهز فقط"})
    });
    const result=await response.json();
    if(!response.ok){res.statusCode=500;return res.end(JSON.stringify({ok:false,stage:"openai",status:response.status,error:result?.error?.message||"OpenAI API error"}));}
    res.statusCode=200;return res.end(JSON.stringify({ok:true,stage:"complete",answer:result.output_text||"ok"}));
  }catch(error){res.statusCode=500;return res.end(JSON.stringify({ok:false,stage:"exception",error:error?.message||String(error)}));}
}
