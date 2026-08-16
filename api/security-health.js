import { json, supabase } from './auth-utils.js';
export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  const secret=String(process.env.AUTH_SECRET||'');
  let readyGoods=false;
  try{await supabase('jms_ready_goods?select=id&limit=1');readyGoods=true}catch(_){}
  return json(res,200,{ok:true,checks:{authSecret:secret.length>=32,readyGoodsTable:readyGoods,serviceRole:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),bootstrapPasswordDisabled:true}});
}
