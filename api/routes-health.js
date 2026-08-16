import { json, supabase } from './auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const rows=await supabase('jms_routes?select=id&limit=1',{method:'GET'});
    return json(res,200,{ok:true,table:'jms_routes',available:true,count:Array.isArray(rows)?rows.length:0});
  }catch(error){
    return json(res,500,{ok:false,table:'jms_routes',available:false,error:String(error?.message||error)});
  }
}
