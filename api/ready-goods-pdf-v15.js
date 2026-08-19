import fs from 'node:fs/promises';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { authFromRequest, supabase } from './auth-utils.js';

const SETTINGS_ID='__company_settings__';
const VAT=.15;
const num=v=>Math.max(0,Number(v)||0);
const r2=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
const fmt=v=>r2(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
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
async function defaultLogo(){return fileData([path.join(process.cwd(),'logo.png')],'image/png')}

function bankHtml(b){
  if(!(b.bank_name||b.account_name||b.account_number||b.iban))return '<div class="empty">بيانات التحويل البنكي غير مهيأة</div>';
  return `<div class="bankbar">
    <div class="bankhero"><strong>بيانات التحويل البنكي</strong><span>${esc(b.bank_name||'')}</span></div>
    <div class="bankcell beneficiary"><small>اسم المستفيد</small><b>${esc(b.account_name||'شركة جدة النموذجية للصناعة')}</b></div>
    <div class="bankcell"><small>رقم الحساب</small><b dir="ltr">${esc(b.account_number||'—')}</b></div>
    <div class="bankcell iban"><small>IBAN</small><b dir="ltr">${esc(b.iban||'—')}</b></div>
  </div>`;
}

function documentHtml(n,settings,packs,logo,font){
  const company=settings?.company||{};const bank=settings?.bank||{};const f=finance(n);
  const rows=(n.items||[]).map((it,i)=>`<tr><td>${i+1}</td><td><b>${esc(it.type||'-')}</b></td><td>${esc(it.description||'-')}</td><td>${esc(it.size||'-')}</td><td>${fmt(it.qty)}</td><td>${esc(it.unit||'')}</td><td class="pack">${esc(packs[i]||'—')}</td><td>${fmt(it.unit_price)}</td><td><b>${fmt(it.line_subtotal??it.line_total)}</b></td></tr>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${font}@page{size:A4 portrait;margin:0}html,body{margin:0;width:210mm;height:297mm;background:#fff}*{box-sizing:border-box}body{font-family:JMSArabic,Arial,sans-serif;color:#182033;-webkit-print-color-adjust:exact;print-color-adjust:exact}.doc{position:relative;width:210mm;height:297mm;padding:9mm 10mm 7mm;overflow:hidden}.top{position:absolute;top:0;left:0;right:0;height:1.6mm;background:linear-gradient(90deg,#172033 0 76%,#8f1d3f 76%)}header{display:flex;justify-content:space-between;align-items:center;gap:5mm;padding-bottom:3.5mm;border-bottom:.25mm solid #e5e7eb}.brand{display:flex;align-items:center;gap:3mm}.brand img{width:24mm;height:18mm;object-fit:contain}.brand h1{margin:0;font-size:5mm;color:#172033}.brand p{margin:1mm 0 0;font:2mm Arial,sans-serif;color:#667085}.meta{text-align:left;min-width:55mm}.meta em{font:700 1.7mm Arial,sans-serif;letter-spacing:.25mm;color:#8f1d3f}.meta h2{margin:.8mm 0 1mm;font-size:5mm}.meta b{display:block;font:700 3mm Arial,sans-serif}.meta small{display:block;margin-top:.8mm;font-size:2mm;color:#667085}.customer{display:grid;grid-template-columns:1.55fr .8fr;gap:2.5mm;margin-top:3mm}.customer>div{padding:2.5mm 3mm;border:.25mm solid #e5e7eb;border-radius:2.2mm;background:#f8fafc}.customer small{display:block;margin-bottom:.7mm;color:#667085;font-size:1.9mm}.customer b{font-size:3mm}table{width:100%;margin-top:3mm;border-collapse:collapse;table-layout:fixed;border:.25mm solid #e5e7eb}th{padding:1.8mm .5mm;background:#243247;color:#fff;font-size:1.75mm}td{padding:1.7mm .6mm;text-align:center;font-size:1.95mm;border-top:.25mm solid #e5e7eb;border-left:.25mm solid #e5e7eb;overflow-wrap:anywhere}.pack{font-weight:700;color:#8f1d3f}th:nth-child(1){width:4%}th:nth-child(2){width:11%}th:nth-child(3){width:15%}th:nth-child(4){width:10%}th:nth-child(5){width:8%}th:nth-child(6){width:7%}th:nth-child(7){width:12%}th:nth-child(8){width:15%}th:nth-child(9){width:18%}.money{display:grid;grid-template-columns:1.35fr .8fr;gap:3mm;margin-top:3mm}.summary{border:.25mm solid #e5e7eb;border-radius:2.4mm;overflow:hidden}.summary div{display:flex;justify-content:space-between;padding:1.7mm 2.5mm;border-bottom:.25mm solid #e5e7eb;font-size:2.2mm}.summary div:last-child{border-bottom:0}.summary span{color:#667085}.due{padding:3mm 4mm;border-radius:2.8mm;background:#172033;color:#fff}.due span{font-size:2mm}.due strong{display:block;margin-top:1.5mm;font-size:6mm;line-height:1}.due small{display:block;margin-top:1mm;font-size:2mm}.bank{margin-top:3mm;border:.25mm solid #dfe3ea;border-radius:2.8mm;overflow:hidden;background:#fff}.bankbar{display:grid;grid-template-columns:1.05fr 1.55fr 1.25fr 1.65fr;direction:rtl;min-height:18mm}.bankhero{background:#172033;color:#fff;padding:3mm 3.5mm;display:flex;flex-direction:column;justify-content:center}.bankhero strong{font-size:3mm;line-height:1.2}.bankhero span{margin-top:1mm;font-size:2mm;color:#cbd5e1}.bankcell{padding:3mm 3.2mm;display:flex;flex-direction:column;justify-content:center;border-left:.25mm solid #e5e7eb;background:#fbfcfe;min-width:0}.bankcell small{display:block;margin-bottom:1mm;color:#7b8494;font-size:1.8mm}.bankcell b{font-size:2.3mm;color:#182033;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bankcell.iban b{font:700 2.35mm Arial,sans-serif;letter-spacing:.05mm}.bankcell:not(.beneficiary) b{font-family:Arial,sans-serif}.empty{padding:3mm;text-align:center;color:#667085;font-size:2mm}.note{margin-top:3mm;padding-top:2mm;border-top:.25mm solid #e5e7eb;color:#667085;font-size:2mm;line-height:1.55}.note b{color:#475467}footer{display:flex;direction:ltr;justify-content:center;align-items:center;gap:4mm;margin-top:3mm;padding-top:2mm;border-top:.25mm solid #e5e7eb;font:700 2mm Arial,sans-serif}footer i{width:.25mm;height:3mm;background:#8f1d3f}</style></head><body><main class="doc"><div class="top"></div><header><div class="brand">${logo?`<img src="${logo}" alt="">`:''}<div><h1>${esc(company.name||'شركة جدة النموذجية للصناعة')}</h1><p>Jeddah Model Industrial Co. Ltd</p></div></div><div class="meta"><em>READY GOODS NOTICE</em><h2>إشعار بضاعة جاهزة</h2><b>${esc(n.number||'')}</b><small>${esc(n.date||'')} · ${esc(n.rep_name||'')}</small></div></header><section class="customer"><div><small>العميل</small><b>${esc(n.customer_name||'-')}</b></div><div><small>الجوال</small><b dir="ltr">${esc(n.customer_phone||'-')}</b></div></section><table><thead><tr><th>#</th><th>الصنف</th><th>الوصف</th><th>المقاس</th><th>الكمية</th><th>الوحدة</th><th>التعبئة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><section class="money"><div class="summary"><div><span>الإجمالي قبل الضريبة</span><b>${fmt(f.sub)} ريال</b></div><div><span>ضريبة القيمة المضافة 15%</span><b>${fmt(f.vat)} ريال</b></div><div><span>الإجمالي شامل الضريبة</span><b>${fmt(f.total)} ريال</b></div><div><span>المدفوع سابقًا</span><b>${fmt(n.paid)} ريال</b></div></div><aside class="due"><span>المبلغ المتبقي</span><strong>${fmt(n.remaining)}</strong><small>ريال سعودي</small></aside></section><section class="bank">${bankHtml(bank)}</section><section class="note">يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة.<br><b>هذا المستند إشعار بضاعة جاهزة صادر إلكترونيًا وليس فاتورة ضريبية.</b></section><footer><span>jeddahmodelfactory@gmail.com</span><i></i><span>0559922174</span></footer></main></body></html>`;
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
    const [packs,font,repoLogo]=await Promise.all([resolvePackaging(n),fontCss(),defaultLogo()]);const logo=safeDataImage(body.logoData)||repoLogo;
    const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:chromium.headless,defaultViewport:{width:794,height:1123}});
    try{const page=await browser.newPage();await page.setContent(documentHtml(n,settings,packs,logo,font),{waitUntil:'domcontentloaded'});await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))) });const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});res.statusCode=200;res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${String(n.number||'ready-goods').replace(/[^A-Za-z0-9_-]/g,'_')}.pdf"`);res.setHeader('Cache-Control','no-store');return res.end(Buffer.from(pdf))}finally{await browser.close()}
  }catch(e){console.error('ready-goods-pdf-v15 failed:',e);res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:'pdf_generation_failed',message:e?.message||String(e)}))}
}