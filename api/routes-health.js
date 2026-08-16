import { json, supabase } from './auth-utils.js';

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  const tables=['jms_routes','jms_rep_targets','jms_smart_visits'];
  const result={};
  for(const table of tables){
    try{
      const rows=await supabase(`${table}?select=id&limit=1`,{method:'GET'});
      result[table]={available:true,count:Array.isArray(rows)?rows.length:0};
    }catch(error){
      result[table]={available:false,error:String(error?.message||error)};
    }
  }
  return json(res,200,{ok:true,tables:result});
}
