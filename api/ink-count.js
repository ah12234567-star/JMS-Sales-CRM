import {json,readBody,requireRole,supabase,verifyToken} from './auth-utils.js';

async function countSummary(year){
  const groups=new Map();
  for(let offset=0;;offset+=500){
    const rows=await supabase('jms_ink_count_entries?select=id,item_id,shelf,gross_g,tare_g&count_year=eq.'+year+'&order=created_at,id&limit=500&offset='+offset);
    for(const row of rows){
      let group=groups.get(row.item_id);
      if(!group){
        group={item:row.item_id,shelves:new Set(),count:0,net:0,ids:[]};
        groups.set(row.item_id,group);
      }
      group.shelves.add(row.shelf);
      group.count++;
      group.ids.push(row.id);
      group.net+=row.gross_g-row.tare_g;
    }
    if(rows.length<500)break;
  }
  return Array.from(groups.values(),group=>({...group,shelves:[...group.shelves]}));
}

export default async function handler(req,res){
  const ticket=(req.headers.cookie||'').match(/(?:^|;\s*)jms_ink=([^;]+)/)?.[1];
  const auth=requireRole(req,['admin']) || verifyToken(ticket,43200000,'ink-count:');
  if(!auth) return json(res,401,{error:'login'});
  try {
    const users=await supabase('jms_users?select=data->role,data->status&id=eq.'+encodeURIComponent(auth.id));
    if(users[0]?.role!==auth.role || users[0]?.status!=='active') return json(res,403,{error:'forbidden'});
    const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Riyadh'}).format(new Date()));
    const query=new URL(req.url,'https://jms.local').searchParams;
    if(req.method==='GET' && !query.has('item')){
      const items=await supabase('jms_ink_count_items?select=id,label&order=label');
      const result={year,items};
      if(auth.role==='admin')result.summary=await countSummary(year);
      return json(res,200,result);
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
    if(b.action){
      if(auth.role!=='admin')return json(res,403,{error:'forbidden'});
      if(b.year!==year)return json(res,400,{error:'year'});
      if(b.action==='remove'){
        if(!Array.isArray(b.ids)||!b.ids.length||!b.ids.every(id=>typeof id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)))return json(res,400,{error:'ids'});
        const removed=await supabase('rpc/jms_remove_counted_ink',{method:'POST',body:JSON.stringify({p_year:year,p_ids:b.ids})});
        return json(res,200,{removed});
      }
      if(b.action!=='edit')return json(res,400,{error:'action'});
    }
    if(!/^[a-f0-9-]{36}$/i.test(b.id)||!Number.isSafeInteger(b.item)||typeof b.shelf!=='string'||!b.shelf.trim()||b.shelf.length>40||!Number.isInteger(b.grams)||b.grams<1750||b.grams>1000000||b.year!==year) return json(res,400,{error:'entry'});
    if(b.action==='edit'){
      if(!Number.isInteger(b.oldGrams)||typeof b.oldShelf!=='string')return json(res,400,{error:'previous'});
      const params=new URLSearchParams({id:'eq.'+b.id,item_id:'eq.'+b.item,count_year:'eq.'+year,gross_g:'eq.'+b.oldGrams,shelf:'eq.'+b.oldShelf,select:'id'});
      const updated=await supabase('jms_ink_count_entries?'+params,{method:'PATCH',body:JSON.stringify({shelf:b.shelf.trim(),gross_g:b.grams})});
      return json(res,updated.length?200:409,{ok:!!updated.length});
    }
    await supabase('jms_ink_count_entries?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({id:b.id,item_id:b.item,shelf:b.shelf.trim(),gross_g:b.grams,operator_id:auth.id,count_year:year})});
    return json(res,200,{ok:true});
  }catch(error){console.error('ink-count',error.message);return json(res,500,{error:'save_failed'});}
}
