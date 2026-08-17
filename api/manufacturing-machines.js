import { json, authFromRequest, readBody, supabase } from './auth-utils.js';
export default async function handler(req,res){
  const auth=authFromRequest(req); if(!auth) return json(res,401,{ok:false,error:'unauthorized'});
  try{
    if(req.method==='GET'){
      const center=String(req.query?.work_center||'').trim(); const active=String(req.query?.active||'').trim();
      let path='jms_mfg_machines?select=*&order=work_center.asc,sort_order.asc,display_name.asc';
      if(center) path+='&work_center=eq.'+encodeURIComponent(center);
      if(active==='true'||active==='false') path+='&active=eq.'+active;
      const machines=await supabase(path); return json(res,200,{ok:true,machines:machines||[]});
    }
    if(!['admin'].includes(auth.role)) return json(res,403,{ok:false,error:'forbidden'});
    if(req.method==='POST'){
      const b=await readBody(req); const id=String(b.id||'machine-'+Date.now());
      const row={id,work_center:b.work_center,machine_no:b.machine_no??null,code:String(b.code||id).toUpperCase(),display_name:String(b.display_name||'').trim(),capabilities:b.capabilities||{},active:b.active!==false,sort_order:Number(b.sort_order||0),updated_at:new Date().toISOString()};
      if(!['extrusion','printing','cutting'].includes(row.work_center)||!row.display_name) return json(res,400,{ok:false,error:'invalid_machine'});
      const out=await supabase('jms_mfg_machines?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([row])}); return json(res,200,{ok:true,machine:out?.[0]||row});
    }
    if(req.method==='PATCH'){
      const b=await readBody(req); const id=String(b.id||''); if(!id) return json(res,400,{ok:false,error:'id_required'});
      const patch={updated_at:new Date().toISOString()}; for(const k of ['display_name','machine_no','capabilities','active','sort_order']) if(k in b) patch[k]=b[k];
      const out=await supabase('jms_mfg_machines?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(patch)}); return json(res,200,{ok:true,machine:out?.[0]||null});
    }
    return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(e){console.error('manufacturing-machines',e); return json(res,500,{ok:false,error:'server_error',message:e.message});}
}
