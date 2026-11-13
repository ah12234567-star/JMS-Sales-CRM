import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const renderedPdfs=new Map();
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { authFromRequest, supabase } from './auth-utils.js';

const SETTINGS_ID='__company_settings__';
const VAT=.15;
const num=v=>Math.max(0,Number(v)||0);
const r2=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
const fmt=v=>r2(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeDataImage=v=>/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(v||''))?String(v):'';

function finance(n){const sub=n.subtotal!==undefined?num(n.subtotal):num(n.total)/(1+VAT);const vat=n.vat_amount!==undefined?num(n.vat_amount):r2(sub*VAT);const total=n.total!==undefined?num(n.total):r2(sub+vat);return{sub,vat,total}}
function packFrom(o){if(!o)return'';const label=o.packaging_label||o.packaging||o.packing||o.package_label||o.packagingLabel;if(label)return String(label);const c=o.package_count??o.packages??o.cartons??o.bundles??o.packs_or_cartons??o.pack_count??o.package_qty;if(c===undefined||c===null||String(c)==='')return'';const u=o.package_unit||o.packaging_unit||o.pack_unit||(o.cartons!=null?'كرتون':o.bundles!=null?'شدة':'عبوة');return `${c} ${u}`}

async function resolvePackaging(n){
  const out=(n.items||[]).map(it=>packFrom(it));
  if(out.every(Boolean))return out;
  try{
    const cid=n.customer_id||n.customerId||'';
    if(!cid)return out.map(x=>x||'—');
    const stocks=await supabase(`jms_ready_stock?select=id,manufacturing_order_id,qty_kg,qty_pcs,attributes,updated_at&customer_id=eq.${encodeURIComponent(cid)}&order=updated_at.desc&limit=40`);
    for(let i=0;i<out.length;i++){
      if(out[i])continue;
      const it=n.items?.[i]||{};
      if(String(it.type||'').includes('كليشة')){out[i]='—';continue}
      let stock=(stocks||[])[0];
      if((stocks||[]).length>1){const target=num(it.qty);stock=[...stocks].sort((a,b)=>Math.min(Math.abs(num(a.qty_kg)-target),Math.abs(num(a.qty_pcs)-target))-Math.min(Math.abs(num(b.qty_kg)-target),Math.abs(num(b.qty_pcs)-target)))[0]}
      let p=packFrom(stock?.attributes);
      if(!p&&stock?.manufacturing_order_id){
        const ops=await supabase(`jms_mfg_operations?select=id,actual&manufacturing_order_id=eq.${encodeURIComponent(stock.manufacturing_order_id)}&work_center=eq.cutting&order=seq.desc&limit=1`);
        const op=ops?.[0];p=packFrom(op?.actual);
        if(!p&&op?.id){const moves=await supabase(`jms_mfg_movements?select=packs_or_cartons,attributes&operation_id=eq.${encodeURIComponent(op.id)}`);const labels=(moves||[]).map(m=>packFrom(m.attributes)).filter(Boolean);if(labels.length)p=labels.join(' + ');else{const total=(moves||[]).reduce((s,m)=>s+num(m.packs_or_cartons),0);if(total>0)p=`${r2(total)} عبوة`}}
      }
      out[i]=p||'—';
    }
  }catch(e){console.warn('ready goods packaging lookup:',e?.message||e)}
  return out.map(x=>x||'—');
}

async function fileData(paths,mime){for(const p of paths){try{const b=await fs.readFile(p);return `data:${mime};base64,${b.toString('base64')}`}catch(_){}}return''}
async function fontCss(){
  const base=path.join(process.cwd(),'node_modules','@fontsource','noto-sans-arabic','files');
  const regular=await fileData([path.join(base,'noto-sans-arabic-arabic-400-normal.woff2')],'font/woff2');
  const bold=await fileData([path.join(base,'noto-sans-arabic-arabic-700-normal.woff2')],'font/woff2');
  if(!regular)console.warn('Arabic PDF font not found');
  return `${regular?`@font-face{font-family:JMSArabic;src:url('${regular}') format('woff2');font-style:normal;font-weight:400;font-display:block}`:''}${bold?`@font-face{font-family:JMSArabic;src:url('${bold}') format('woff2');font-style:normal;font-weight:700;font-display:block}`:''}`;
}
async function defaultLogo(){return fileData([path.join(process.cwd(),'assets','company-logo-official.jpg')],'image/jpeg')}

function bankHtml(b){
  if(!(b.bank_name||b.account_name||b.account_number||b.iban))return '';
  return `<div class="bankbar">
    <div class="bankhero"><strong>بيانات التحويل البنكي</strong><span>${esc(b.bank_name||'')}</span></div>
    <div class="bankcell beneficiary"><small>اسم المستفيد</small><b>${esc(b.account_name||'شركة جدة النموذجية للصناعة')}</b></div>
    <div class="bankcell"><small>رقم الحساب</small><b dir="ltr">${esc(b.account_number||'—')}</b></div>
    <div class="bankcell iban"><small>IBAN</small><b dir="ltr">${esc(b.iban||'—')}</b></div>
  </div>`;
}

function hasData(value){
  return value!==null&&value!==undefined&&!['','-','—','–'].includes(String(value).trim());
}
function latinDigits(value){return String(value??'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\u200e\u200f]/g,'')}
function money(value){return `<span class="currency"><bdi class="number" dir="ltr">${fmt(value)}</bdi><span>ريال</span></span>`}
function documentHtml(n,settings,packs,logo,font){
  const company=settings?.company||{},bank=settings?.bank||{},f=finance(n),items=n.items||[];
  const candidates=[
    {key:'index',label:'#',weight:4,value:(_,i)=>i+1},
    {key:'type',label:'الصنف',weight:13,value:it=>it.type},
    {key:'description',label:'الوصف',weight:24,value:it=>it.description},
    {key:'size',label:'المقاس',weight:15,value:it=>it.size},
    {key:'qty',label:'الكمية',weight:10,numeric:true,value:it=>hasData(it.qty)?fmt(it.qty):''},
    {key:'unit',label:'الوحدة',weight:8,value:it=>it.unit},
    {key:'packaging',label:'التعبئة',weight:12,value:(_,i)=>packs[i]},
    {key:'price',label:'سعر الوحدة',weight:13,numeric:true,value:it=>hasData(it.unit_price)?fmt(it.unit_price):''},
    {key:'total',label:'الإجمالي',weight:16,numeric:true,value:it=>hasData(it.line_subtotal??it.line_total)?fmt(it.line_subtotal??it.line_total):hasData(it.qty)&&hasData(it.unit_price)?fmt(num(it.qty)*num(it.unit_price)):''}
  ];
  const density=items.length>14?'dense':items.length>8?'compact':items.length>3?'balanced':'comfortable';
  const columns=candidates.filter(c=>items.some((it,i)=>hasData(c.value(it,i))));
  const weight=columns.reduce((sum,c)=>sum+c.weight,0);
  const rows=items.map((it,i)=>`<tr>${columns.map(c=>`<td data-column="${c.key}" class="${c.numeric?'numeric':''}">${hasData(c.value(it,i))?`<bdi dir="${c.numeric?'ltr':'auto'}">${esc(c.value(it,i))}</bdi>`:''}</td>`).join('')}</tr>`).join('');
  const bankSection=bankHtml(bank);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${font}
    @page{size:A4 portrait;margin:12mm}
    *{box-sizing:border-box}html,body{margin:0;background:#fff}body{width:186mm}
    body{font-family:JMSArabic,Arial,sans-serif;color:#182033;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .doc{--row-pad:7mm;--section-gap:7mm;--cell-font:10pt;min-height:273mm;display:flex;flex-direction:column;justify-content:space-between;gap:var(--section-gap);border-top:1.5mm solid #8f1d3f;padding-top:6mm}
    header{display:flex;justify-content:space-between;align-items:center;gap:6mm;padding-bottom:5mm;border-bottom:.3mm solid #dfe3ea;break-inside:avoid}
    .brand{display:flex;align-items:center;gap:4mm;min-width:0}.brand img{width:28mm;height:26mm;object-fit:contain;flex:none}
    .brand h1{font-size:14pt;line-height:1.7;margin:0}.brand p{font:8pt Arial,sans-serif;margin:2mm 0 0;color:#475569}
    .title{text-align:left;flex:none}.title em{font:700 7.5pt Arial,sans-serif;letter-spacing:.2mm;color:#8f1d3f}.title h2{font-size:17pt;line-height:1.6;margin:2mm 0 0}
    .references{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:3mm;break-inside:avoid}
    .references div{background:#f1f5f9;border-radius:2mm;border:.25mm solid #dfe3ea;padding:3mm 4mm}
    .references small,.customer small{display:block;font-size:9pt;color:#475569;margin-bottom:1.5mm}
    .references b{display:block;font:700 12pt Arial,sans-serif;direction:ltr;text-align:right;color:#182033}
    .customer{border-right:1.2mm solid #8f1d3f;padding:3mm 4mm;background:#f8fafc;break-inside:avoid}.customer b{font-size:13pt;line-height:1.8}.phone{font:10pt Arial,sans-serif;margin-top:2mm;direction:ltr;text-align:right}
    .items{break-inside:auto}.section-title{font-size:11pt;margin:0 0 3mm;color:#334155}
    table{width:100%;table-layout:fixed;border-collapse:collapse;direction:rtl}thead{display:table-header-group}tr{break-inside:avoid}
    th{padding:3mm 1.5mm;background:#243247;color:#fff;font-size:9pt;text-align:right;line-height:1.6}
    td{padding:var(--row-pad) 1.5mm;border:.25mm solid #dfe3ea;font-size:var(--cell-font);line-height:1.7;text-align:right;overflow-wrap:anywhere;vertical-align:middle}
    tbody tr:nth-child(even){background:#f8fafc}.numeric{text-align:right;font-family:Arial,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;overflow-wrap:normal}
    .doc[data-density="balanced"]{--row-pad:3.5mm;--section-gap:5mm}
    .doc[data-density="compact"]{--row-pad:1.5mm;--section-gap:3mm;--cell-font:9pt}
    .doc[data-density="dense"]{--row-pad:.8mm;--section-gap:2.5mm;--cell-font:8.5pt}
    .doc[data-density="compact"] .summary>div,.doc[data-density="dense"] .summary>div{padding:2.2mm 4mm}
    .doc[data-density="dense"] .brand img{height:22mm}
    .doc[data-density="compact"] header,.doc[data-density="dense"] header{padding-bottom:2mm}
    .doc[data-density="compact"] .brand img,.doc[data-density="dense"] .brand img{height:18mm;width:22mm}
    .doc[data-density="compact"] .brand h1,.doc[data-density="dense"] .brand h1{font-size:12pt}
    .doc[data-density="compact"] .title h2,.doc[data-density="dense"] .title h2{font-size:14pt}
    .doc[data-density="compact"] .references div,.doc[data-density="dense"] .references div{padding:1.5mm 3mm}
    .doc[data-density="compact"] .references small,.doc[data-density="dense"] .references small{font-size:8pt;margin-bottom:1mm}
    .doc[data-density="compact"] .references b,.doc[data-density="dense"] .references b{font-size:10pt}
    .doc[data-density="compact"] .customer,.doc[data-density="dense"] .customer{padding:2mm 3mm}
    .doc[data-density="compact"] .customer b,.doc[data-density="dense"] .customer b{font-size:11pt}
    .doc[data-density="compact"] td,.doc[data-density="dense"] td{line-height:1.4}
    .doc[data-density="compact"] .due,.doc[data-density="dense"] .due{padding:4mm;gap:2mm}
    .doc[data-density="compact"] .due .number,.doc[data-density="dense"] .due .number{font-size:22pt}
    .number{font-family:Arial,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
    .currency{display:inline-flex;direction:ltr;align-items:baseline;gap:2mm;white-space:nowrap}.currency .number{display:inline-block;min-width:24mm;text-align:right}.currency>span{direction:rtl;font-family:JMSArabic,Arial,sans-serif;font-size:9pt}
    .money{display:grid;grid-template-columns:1.5fr 1fr;gap:5mm;break-inside:avoid}
    .summary{border:.25mm solid #dfe3ea;border-radius:2mm;overflow:hidden}.summary>div{display:flex;justify-content:space-between;align-items:center;gap:3mm;padding:3.5mm 4mm;border-bottom:.25mm solid #e2e8f0;font-size:10pt}.summary>div:last-child{border-bottom:0}.summary .grand{background:#f1f5f9;font-weight:700}.summary .currency{min-width:31mm;justify-content:flex-start;font-size:12pt}
    .due{background:#172033;color:#fff;border-radius:3mm;padding:7mm 5mm;display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:4mm;text-align:right}.due>span{font-size:11pt}.due .number{font-size:27pt;font-weight:700;line-height:1.3}.due small{font-size:10pt}
    .closing{break-inside:avoid}.bank{margin-bottom:5mm;border:.25mm solid #dfe3ea;border-radius:2mm;overflow:hidden}.bankbar{display:flex;flex-wrap:wrap}.bankhero,.bankcell{padding:3mm;flex:1;min-width:35mm}.bankhero{background:#f1f5f9}.bankhero strong,.bankcell b{font-size:9pt}.bankhero span,.bankcell small{display:block;font-size:8pt;color:#475569;margin:1mm 0}.iban b{font:9pt Arial,sans-serif}
    .note{border-top:.25mm solid #dfe3ea;padding-top:4mm;font-size:9pt;line-height:1.9;color:#334155}.note p{margin:0 0 2mm}.note .legal{font-size:8pt;color:#475569}
    footer{display:grid;grid-template-columns:1fr 1.7fr 1.8fr;direction:rtl;align-items:center;gap:2mm;padding-top:4mm;border-top:.25mm solid #dfe3ea;font:8pt JMSArabic,Arial,sans-serif;color:#334155;break-inside:avoid}footer>span{display:flex;align-items:baseline;gap:1.5mm;min-width:0;white-space:nowrap}footer>span+span{border-right:.25mm solid #dfe3ea;padding-right:2mm}footer strong{font-size:8pt;color:#182033;flex:none}footer bdi[dir="ltr"]{font:8pt Arial,sans-serif}footer bdi[dir="rtl"]{font:8pt JMSArabic,Arial,sans-serif}
  </style></head><body><main class="doc" data-density="${density}">
    <header><div class="brand">${logo?`<img src="${logo}" alt="شعار الشركة">`:''}<div><h1>${esc(company.name||'شركة جدة النموذجية للصناعة')}</h1><p>Jeddah Model Industrial Co. Ltd</p></div></div><div class="title"><em>READY GOODS NOTICE</em><h2>إشعار بضاعة جاهزة</h2></div></header>
    <section class="references"><div><small>رقم الإشعار</small><b>${esc(n.number||'')}</b></div><div><small>التاريخ</small><b>${esc(latinDigits(n.date))}</b></div><div><small>المُصدر</small><b dir="auto">${esc(n.rep_name||'')}</b></div></section>
    <section class="customer"><small>العميل</small><b>${esc(n.customer_name||'')}</b>${n.customer_phone?`<div class="phone">${esc(n.customer_phone)}</div>`:''}</section>
    <section class="items"><h3 class="section-title">تفاصيل البضاعة الجاهزة</h3><table><colgroup>${columns.map(c=>`<col style="width:${(c.weight/weight*100).toFixed(3)}%">`).join('')}</colgroup><thead><tr>${columns.map(c=>`<th data-column="${c.key}" class="${c.numeric?'numeric':''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></section>
    <section class="money"><div class="summary"><div><span>الإجمالي قبل الضريبة</span>${money(f.sub)}</div><div><span>ضريبة القيمة المضافة 15%</span>${money(f.vat)}</div><div class="grand"><span>الإجمالي شامل الضريبة</span>${money(f.total)}</div><div><span>المدفوع سابقًا</span>${money(n.paid)}</div></div><aside class="due"><span>المبلغ المتبقي</span><bdi class="number" dir="ltr">${fmt(n.remaining)}</bdi><small>ريال سعودي</small></aside></section>
    <section class="closing">${bankSection?`<section class="bank">${bankSection}</section>`:''}<div class="note"><p>يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة.</p><p class="legal">هذا المستند إشعار بضاعة جاهزة صادر إلكترونيًا وليس فاتورة ضريبية.</p></div></section>
    <footer aria-label="تواصل الشركة"><span data-contact="phone"><strong>هاتف:</strong><bdi dir="ltr">0559922174</bdi></span><span data-contact="email"><strong>إيميل:</strong><bdi dir="ltr">jeddahmodelfactory@gmail.com</bdi></span><span data-contact="address"><strong>الموقع / العنوان:</strong><bdi dir="rtl">جدة، الصناعية الثانية</bdi></span></footer>
  </main></body></html>`;
}

async function fitPrintDocument(page){
  await page.evaluate(()=>{
    const doc=document.querySelector('.doc');
    if(!doc||doc.dataset.density==='comfortable')return;
    const target=263*96/25.4;
    if(doc.getBoundingClientRect().height<=target+2)return;
    doc.dataset.density='dense';
    doc.style.minHeight='0';
    let scale=1;
    for(let pass=0;pass<3;pass++){
      const height=doc.getBoundingClientRect().height;
      if(height<=target+1)break;
      scale=Math.max(.85,scale*target/height);
      document.body.style.zoom=String(scale);
      document.body.style.width=(186/scale)+'mm';
    }
    doc.style.minHeight=(263/scale)+'mm';
  });
}

export default async function handler(req,res){
  if(req.method!=='POST'){res.statusCode=405;return res.end('method_not_allowed')}
  const auth=authFromRequest(req);if(!auth){res.statusCode=401;return res.end('unauthorized')}
  try{
    let raw='';for await(const c of req)raw+=c;let body={};try{body=JSON.parse(raw||'{}')}catch(_){}
    const id=String(body.id||'');if(!id){res.statusCode=400;return res.end('id_required')}
    const rows=await supabase(`jms_ready_goods?select=id,data&id=eq.${encodeURIComponent(id)}&limit=1`);const n=rows?.[0]?.data;if(!n){res.statusCode=404;return res.end('notice_not_found')}
    if(auth.role==='rep'&&String(n.rep_id||'')!==String(auth.id)){res.statusCode=403;return res.end('forbidden')}
    const sr=await supabase(`jms_ready_goods?select=data&id=eq.${encodeURIComponent(SETTINGS_ID)}&limit=1`);const settings=sr?.[0]?.data?.settings||sr?.[0]?.data||{};
    const [packs,font,repoLogo]=await Promise.all([resolvePackaging(n),fontCss(),defaultLogo()]);const logo=repoLogo||safeDataImage(body.logoData);
    if(!logo)throw new Error('Company logo is unavailable');
    const html=documentHtml(n,settings,packs,logo,font);
    const cacheKey=createHash('sha256').update(html).digest('hex');
    const cached=renderedPdfs.get(cacheKey);
    if(cached && Date.now()-cached.time<60000){
      res.statusCode=200;res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition',`attachment; filename="${String(n.number||'ready-goods').replace(/[^A-Za-z0-9_-]/g,'_')}.pdf"`);
      res.setHeader('Cache-Control','no-store');return res.end(cached.pdf);
    }
    const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:chromium.headless,defaultViewport:{width:794,height:1123}});
    try{const page=await browser.newPage();await page.setContent(html,{waitUntil:'domcontentloaded'});await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode())) });await fitPrintDocument(page);const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});const buffer=Buffer.from(pdf);renderedPdfs.set(cacheKey,{time:Date.now(),pdf:buffer});while(renderedPdfs.size>4)renderedPdfs.delete(renderedPdfs.keys().next().value);res.statusCode=200;res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${String(n.number||'ready-goods').replace(/[^A-Za-z0-9_-]/g,'_')}.pdf"`);res.setHeader('Cache-Control','no-store');return res.end(Buffer.from(pdf))}finally{await browser.close()}
  }catch(e){console.error('ready-goods-pdf-v15 failed:',e);res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:'pdf_generation_failed',message:e?.message||String(e)}))}
}