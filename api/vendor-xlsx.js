export default async function handler(req,res){
  if(req.method!=='GET'){res.statusCode=405;return res.end('method_not_allowed');}
  try{
    const r=await fetch('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    if(!r.ok)throw new Error('vendor_fetch_'+r.status);
    const body=await r.text();
    res.setHeader('Content-Type','application/javascript; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).send(body);
  }catch(e){console.error('vendor xlsx fetch failed',e);return res.status(503).send('/* XLSX vendor unavailable */');}
}
