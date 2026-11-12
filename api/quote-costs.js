import {requireRole, readBody, json, supabase} from './auth-utils.js';

const defaults={HDPE:4.60,LDPE:4.90,LLDPE:4.75,PP:4.80,MIX:4.75,calcium:1.20,production:0.65,printFace:0.22,waste:4,margin:18};
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  const auth=requireRole(req,['admin']);
  if(!auth)return json(res,403,{error:'forbidden'});
  try{
    const [account]=await supabase('jms_users?id=eq.'+encodeURIComponent(auth.id)+'&select=data');
    if(account?.data?.role!=='admin'||(account.data.status && account.data.status!=='active'))return json(res,403,{error:'forbidden'});
    if(req.method==='GET'){
      const [record]=await supabase('jms_private_quote_pricing?id=eq.pricing&select=rates');
      return json(res,200,{rates:record?.rates??defaults,configured:!!record});
    }
    if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
    const body=await readBody(req),rates={};
    for(const key of Object.keys(defaults)){
      const value=body?.rates?.[key];
      if(!Number.isFinite(value)||value<0||(key==='margin'&&value>=100))return json(res,400,{error:'invalid_rate'});
      rates[key]=value;
    }
    await supabase('jms_private_quote_pricing?on_conflict=id',{method:'POST',headers:{Prefer:body.initialize?'resolution=ignore-duplicates':'resolution=merge-duplicates'},body:JSON.stringify({id:'pricing',rates})});
    return json(res,200,{ok:true});
  }catch{return json(res,503,{error:'pricing_unavailable'});}
}
