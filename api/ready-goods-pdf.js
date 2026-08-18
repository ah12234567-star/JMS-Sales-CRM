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

function fin(n){
  const sub=n.subtotal!==undefined?num(n.subtotal):num(n.total)/(1+VAT);
  const vat=n.vat_amount!==undefined?num(n.vat_amount):r2(sub*VAT);
  const total=n.total!==undefined?num(n.total):r2(sub+vat);
  return {sub,vat,total};
}
function packFrom(o){
  if(!o)return '';
  const label=o.packaging_label||o.packaging||o.packing||o.package_label||o.packagingLabel;
  if(label)return String(label);
  const c=o.package_count??o.packages??o.cartons??o.bundles??o.packs_or_cartons??o.pack_count;
  if(c===undefined||c===null||String(c)==='')return '';
  const u=o.package_unit||o.packaging_unit||o.pack_unit||(o.cartons!=null?'كرتون':o.bundles!=null?'شدة':'عبوة');
  return `${c} ${u}`;
}
async function resolvePackaging(n){
  const result=(n.items||[]).map(it=>packFrom(it));
  if(result.every(Boolean))return result;
  if(!n.customer_id)return result.map(x=>x||'—');
  try{
    const stocks=await supabase(`jms_ready_stock?select=id,manufacturing_order_id,qty_kg,qty_pcs,attributes,updated_at&customer_id=eq.${encodeURIComponent(n.customer_id)}&status=in.(available,reserved,released)&order=updated_at.desc&limit=30`);
    for(let i=0;i<(n.items||[]).length;i++){
      if(result[i])continue;
      const it=n.items[i]||{};
      if(String(it.type||'').includes('كليشة')){result[i]='—';continue;}
      let stock=(stocks||[])[0];
      if((stocks||[]).length>1&&String(it.unit||'').includes('كجم')){
        stock=[...stocks].sort((a,b)=>Math.abs(num(a.qty_kg)-num(it.qty))-Math.abs(num(b.qty_kg)-num(it.qty)))[0];
      }
      let p=packFrom(stock?.attributes);
      if(!p&&stock?.manufacturing_order_id){
        const ops=await supabase(`jms_mfg_operations?select=id,actual&manufacturing_order_id=eq.${encodeURIComponent(stock.manufacturing_order_id)}&work_center=eq.cutting&order=seq.desc&limit=1`);
        const op=ops?.[0];
        p=packFrom(op?.actual);
        if(!p&&op?.id){
          const moves=await supabase(`jms_mfg_movements?select=packs_or_cartons,attributes&operation_id=eq.${encodeURIComponent(op.id)}&order=roll_no.asc`);
          const labels=(moves||[]).map(m=>packFrom(m.attributes)).filter(Boolean);
          if(labels.length)p=labels.join(' + ');
          else {
            const total=(moves||[]).reduce((s,m)=>s+num(m.packs_or_cartons),0);
            if(total>0)p=`${r2(total)} عبوة`;
          }
        }
      }
      result[i]=p||'—';
    }
  }catch(e){
    console.warn('ready-goods packaging resolution failed',e?.message||e);
  }
  return result.map(x=>x||'—');
}
async function logoData(){
  try{
    const b=await fs.readFile(path.join(process.cwd(),'logo.png'));
    return `data:image/png;base64,${b.toString('base64')}`;
  }catch(_){
    try{
      const b=await fs.readFile(path.join(process.cwd(),'assets','company-logo.svg'));
      return `data:image/svg+xml;base64,${b.toString('base64')}`;
    }catch(__){return ''}
  }
}
function bankBlock(b){
  if(!(b.bank_name||b.account_name||b.account_number||b.iban))return '<div class="empty">بيانات التحويل البنكي غير مهيأة مركزيًا</div>';
  return `<div class="bankgrid">${b.bank_name?`<div><small>البنك</small><b>${esc(b.bank_name)}</b></div>`:''}${b.account_name?`<div><small>اسم الحساب</small><b>${esc(b.account_name)}</b></div>`:''}${b.account_number?`<div><small>رقم الحساب</small><b dir="ltr">${esc(b.account_number)}</b></div>`:''}${b.iban?`<div class="iban"><small>IBAN</small><b dir="ltr">${esc(b.iban)}</b></div>`:''}</div>`;
}
function html(n,settings,packs,logo){
  const company=settings?.company||{};
  const bank=settings?.bank||{};
  const f=fin(n);
  const rows=(n.items||[]).map((it,i)=>`<tr><td>${i+1}</td><td><b>${esc(it.type||'-')}</b></td><td>${esc(it.description||'-')}</td><td>${esc(it.size||'-')}</td><td>${fmt(it.qty)}</td><td>${esc(it.unit||'')}</td><td class="pack">${esc(packs[i]||'—')}</td><td>${fmt(it.unit_price)}</td><td><b>${fmt(it.line_subtotal??it.line_total)}</b></td></tr>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  @page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;width:210mm;height:297mm;background:#fff}*{box-sizing:border-box}body{font-family:Arial,'Noto Sans Arabic',Tahoma,sans-serif;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}.doc{position:relative;width:210mm;height:297mm;padding:8mm 10mm 7mm;overflow:hidden;background:#fff}.top{position:absolute;top:0;left:0;right:0;height:1.6mm;background:linear-gradient(90deg,#172033 0 76%,#8f1d3f 76%)}header{display:flex;justify-content:space-between;align-items:center;gap:5mm;padding-bottom:3.5mm;border-bottom:.25mm solid #e5e7eb}.brand{display:flex;align-items:center;gap:3mm}.brand img{width:23mm;height:18mm;object-fit:contain}.brand h1{margin:0;color:#172033;font-size:5.3mm}.brand p{margin:1mm 0 0;color:#667085;font-size:2.1mm}.meta{text-align:left;min-width:52mm}.meta em{font-style:normal;font-size:1.7mm;letter-spacing:.25mm;color:#8f1d3f;font-weight:900}.meta h2{margin:.8mm 0 1mm;color:#172033;font-size:5mm}.meta b{display:block;font-size:3mm}.meta small{display:block;margin-top:.7mm;color:#667085;font-size:2mm}.customer{display:grid;grid-template-columns:1.55fr .8fr;gap:2.5mm;margin-top:3mm}.customer>div{padding:2.5mm 3mm;border:.25mm solid #e5e7eb;border-radius:2.2mm;background:#f8fafc}.customer small,.bankgrid small{display:block;margin-bottom:.7mm;color:#667085;font-size:1.9mm}.customer b{color:#172033;font-size:3mm}table{width:100%;margin-top:3mm;border-collapse:separate;border-spacing:0;border:.25mm solid #e5e7eb;border-radius:2.2mm;overflow:hidden;table-layout:fixed}th{padding:1.8mm .5mm;background:#243247;color:#fff;font-size:1.75mm}td{padding:1.7mm .7mm;text-align:center;font-size:1.95mm;border-top:.25mm solid #e5e7eb;border-left:.25mm solid #e5e7eb;overflow-wrap:anywhere}.pack{color:#8f1d3f;font-weight:900}th:nth-child(1){width:4%}th:nth-child(2){width:11%}th:nth-child(3){width:15%}th:nth-child(4){width:10%}th:nth-child(5){width:8%}th:nth-child(6){width:7%}th:nth-child(7){width:12%}th:nth-child(8){width:15%}th:nth-child(9){width:18%}.money{display:grid;grid-template-columns:1.35fr .8fr;gap:3mm;margin-top:3.2mm}.summary{border:.25mm solid #e5e7eb;border-radius:2.5mm;overflow:hidden}.summary div{display:flex;justify-content:space-between;padding:1.8mm 2.6mm;border-bottom:.25mm solid #e5e7eb;font-size:2.25mm}.summary div:last-child{border-bottom:0}.summary span{color:#667085}.summary b{color:#172033}.due{padding:3mm 4mm;border-radius:2.8mm;background:#172033;color:#fff}.due span{font-size:2mm}.due strong{display:block;margin-top:1.5mm;font-size:6.2mm;line-height:1}.due small{display:block;margin-top:1mm;font-size:2mm}.bank{margin-top:3.3mm;border:.25mm solid #e5e7eb;border-radius:2.6mm;overflow:hidden}.banktitle{display:flex;justify-content:space-between;align-items:center;padding:2mm 3mm;background:#f3f4f6;border-right:1.2mm solid #8f1d3f}.banktitle strong{font-size:2.6mm;color:#172033}.banktitle small{font-size:1.8mm;color:#667085}.bankgrid{display:grid;grid-template-columns:1fr 1.2fr 1fr}.bankgrid>div{padding:2mm 2.8mm;border-top:.25mm solid #e5e7eb;border-left:.25mm solid #e5e7eb}.bankgrid b{color:#172033;font-size:2.2mm}.bankgrid .iban{grid-column:1/-1}.bankgrid .iban b{font-size:2.5mm}.empty{padding:2.5mm;text-align:center;color:#667085;font-size:2mm}.note{margin-top:3mm;padding-top:2mm;border-top:.25mm solid #e5e7eb;color:#667085;font-size:2mm;line-height:1.55}.note b{color:#475467}footer{display:flex;direction:ltr;justify-content:center;align-items:center;gap:4mm;margin-top:3.5mm;padding-top:2mm;border-top:.25mm solid #e5e7eb;color:#172033;font-size:2mm;font-weight:800}footer i{width:.25mm;height:3mm;background:#8f1d3f}
  </style></head><body><main class="doc"><div class="top"></div><header><div class="brand">${logo?`<img src="${logo}" alt="شعار الشركة">`:''}<div><h1>${esc(company.name||'شركة جدة النموذجية للصناعة')}</h1><p>Jeddah Model Industrial Co. Ltd</p></div></div><div class="meta"><em>READY GOODS NOTICE</em><h2>إشعار بضاعة جاهزة</h2><b>${esc(n.number||'')}</b><small>${esc(n.date||'')} · ${esc(n.rep_name||'')}</small></div></header><section class="customer"><div><small>العميل</small><b>${esc(n.customer_name||'-')}</b></div><div><small>الجوال</small><b dir="ltr">${esc(n.customer_phone||'-')}</b></div></section><table><thead><tr><th>#</th><th>الصنف</th><th>الوصف</th><th>المقاس</th><th>الكمية</th><th>الوحدة</th><th>التعبئة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><section class="money"><div class="summary"><div><span>الإجمالي قبل الضريبة</span><b>${fmt(f.sub)} ريال</b></div><div><span>ضريبة القيمة المضافة 15%</span><b>${fmt(f.vat)} ريال</b></div><div><span>الإجمالي شامل الضريبة</span><b>${fmt(f.total)} ريال</b></div><div><span>المدفوع سابقًا</span><b>${fmt(n.paid)} ريال</b></div></div><aside class="due"><span>المبلغ المتبقي</span><strong>${fmt(n.remaining)}</strong><small>ريال سعودي</small></aside></section><section class="bank"><div class="banktitle"><strong>بيانات التحويل البنكي</strong><small>Bank Transfer Details</small></div>${bankBlock(bank)}</section><section class="note">يرجى تحويل المبلغ المتبقي وإرسال إشعار التحويل لتنسيق استلام البضاعة.<br><b>هذا المستند إشعار بضاعة جاهزة صادر إلكترونيًا وليس فاتورة ضريبية.</b></section><footer><span>jeddahmodelfactory@gmail.com</span><i></i><span>0559922174</span></footer></main></body></html>`;
}

export default async function handler(req,res){
  if(req.method!=='POST'){res.statusCode=405;return res.end('method_not_allowed')}
  const auth=authFromRequest(req);
  if(!auth){res.statusCode=401;return res.end('unauthorized')}
  try{
    let body='';for await(const c of req)body+=c;let parsed={};try{parsed=JSON.parse(body||'{}')}catch(_){}
    const id=String(parsed.id||'');if(!id){res.statusCode=400;return res.end('id_required')}
    const rows=await supabase(`jms_ready_goods?select=id,data,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`);
    const row=rows?.[0],n=row?.data;if(!n){res.statusCode=404;return res.end('notice_not_found')}
    if(auth.role==='rep'&&String(n.rep_id||'')!==String(auth.id)){res.statusCode=403;return res.end('forbidden')}
    const srows=await supabase(`jms_ready_goods?select=data&id=eq.${encodeURIComponent(SETTINGS_ID)}&limit=1`);
    const settings=srows?.[0]?.data?.settings||srows?.[0]?.data||{};
    const [packs,logo]=await Promise.all([resolvePackaging(n),logoData()]);
    const browser=await puppeteer.launch({args:chromium.args,defaultViewport:{width:794,height:1123,deviceScaleFactor:1},executablePath:await chromium.executablePath(),headless:chromium.headless});
    try{
      const page=await browser.newPage();
      await page.setContent(html(n,settings,packs,logo),{waitUntil:'domcontentloaded'});
      await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))) });
      const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
      res.statusCode=200;res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${String(n.number||'ready-goods').replace(/[^A-Za-z0-9_-]/g,'_')}.pdf"`);res.setHeader('Cache-Control','no-store');return res.end(Buffer.from(pdf));
    }finally{await browser.close()}
  }catch(e){console.error('ready-goods-pdf failed',e);res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:'pdf_generation_failed',message:e?.message||String(e)}))}
}
