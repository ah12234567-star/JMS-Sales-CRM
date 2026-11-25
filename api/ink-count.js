import {json,readBody,requireRole,supabase,verifyToken} from './auth-utils.js';

export default async function handler(req,res){
  const ticket=(req.headers.cookie||'').match(/(?:^|;\s*)jms_ink=([^;]+)/)?.[1];
  const auth=verifyToken(ticket,43200000,'ink-count:') || requireRole(req,['admin']);
  if(!auth) return json(res,401,{error:'login'});
  try {
    const users=await supabase('jms_users?select=data->role,data->status&id=eq.'+encodeURIComponent(auth.id));
    if(users[0]?.role!==auth.role || users[0]?.status!=='active') return json(res,403,{error:'forbidden'});
    const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Riyadh'}).format(new Date()));
    const query=new URL(req.url,'https://jms.local').searchParams;
    if(req.method==='GET' && !query.has('item')){
      return json(res,200,{year,items:await supabase('jms_ink_count_items?select=id,label&order=label')});
    }
    if(req.method==='GET'){
      const item=Number(query.get('item'));
      if(!Number.isSafeInteger(item)||item<1) return json(res,400,{error:'item'});
      const entries=[];
      for(let offset=0;;offset+=500){
        const rows=await supabase('jms_ink_count_entries?select=id,shelf,gross_g,tare_g&count_year=eq.'+year+'&item_id=eq.'+item+'&order=created_at,id&limit=500&offset='+offset);
        entries.push(...rows);
        if(rows.length<500) break;
      }
      return json(res,200,{entries});
    }
    if(req.method!=='POST') return json(res,405,{error:'method'});
    if(!String(req.headers['content-type']).startsWith('application/json')) return json(res,415,{error:'type'});
    const b=await readBody(req);
    if(b.logout){
      res.setHeader('Set-Cookie','jms_ink=; Path=/api/ink-count; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return json(res,200,{ok:true});
    }
    if(!/^[a-f0-9-]{36}$/i.test(b.id)||!Number.isSafeInteger(b.item)||typeof b.shelf!=='string'||!b.shelf.trim()||b.shelf.length>40||!Number.isInteger(b.grams)||b.grams<1750||b.grams>1000000||b.year!==year) return json(res,400,{error:'entry'});
    await supabase('jms_ink_count_entries?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({id:b.id,item_id:b.item,shelf:b.shelf.trim(),gross_g:b.grams,operator_id:auth.id,count_year:year})});
    return json(res,200,{ok:true});
  }catch(error){console.error('ink-count',error.message);return json(res,500,{error:'save_failed'});}
}
