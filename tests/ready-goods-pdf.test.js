import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
const raw=await fs.readFile(new URL('../api/ready-goods-pdf-v15.js',import.meta.url),'utf8');
const source=raw.split('export default async function handler')[0].replace(/^import .*;$/gm,'');
const context=vm.createContext({fs,path,process,console});vm.runInContext(source,context);
const n={number:'RGN-2026-0051',date:'13/11/2026',rep_name:'AHMED',customer_name:'مؤسسة الرواد المتحدة للوجبات السريعة',items:[{type:'أكياس بلاستيك',description:'أكياس بلاستيك LD مطبوعة – رمز المادة 1238',size:'37 × 45 سم (9934)',qty:894,unit:'كجم',unit_price:10,line_subtotal:8940}],subtotal:8940,vat_amount:1341,total:10281,paid:7000,remaining:3281};
const logo=await vm.runInContext('defaultLogo()',context),font=await vm.runInContext('fontCss()',context);
context.n=n;context.logo=logo;context.font=font;
const html=vm.runInContext('documentHtml(n,{},[],logo,font)',context);
test('PDF uses original quotation logo, excludes empty bank and contact placeholders',async()=>{
 const app=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.equal(logo,app.match(/const JMS_LOGO_DATA = "([^"]+)"/)[1]);
 assert.doesNotMatch(html,/بيانات التحويل البنكي غير مهيأة|<small>الجوال<\/small>/);
 assert.match(raw,/const logo=repoLogo\|\|safeDataImage/);assert.match(raw,/i\.decode\(\)/);
});
test('official logo decodes and ready-goods document renders without overflow',async()=>{
 const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});
 try{
  const page=await browser.newPage();await page.setContent(html,{waitUntil:'load'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  await vm.runInContext('fitPrintDocument',context)(page);
  const state=await page.evaluate(()=>({moneyRight:[...document.querySelectorAll('.summary .number')].map(e=>e.getBoundingClientRect().right),images:[...document.images].map(i=>i.naturalWidth),overflow:[...document.querySelectorAll('header,td,.summary,.due')].some(e=>e.scrollWidth>e.clientWidth+2)}));
  assert.ok(Math.max(...state.moneyRight)-Math.min(...state.moneyRight)<1,'financial values share a right edge');assert.ok(state.images.every(n=>n>0));assert.equal(state.overflow,false);
  if(process.env.JMS_PDF_OUTPUT)await page.pdf({path:process.env.JMS_PDF_OUTPUT,format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:0,bottom:0,left:0,right:0}});
 }finally{await browser.close();}
});

test('empty columns collapse, mixed packaging stays, and zero values are real data',()=>{
 context.testNotice={...n,items:[{...n.items[0],description:'-',size:'—',unit:''},{...n.items[0],description:'',size:null,unit:null,unit_price:0}]};
 const blank=vm.runInContext("documentHtml(testNotice,{},['-','—'],logo,font)",context);
 for(const key of ['description','size','unit','packaging'])assert.doesNotMatch(blank,new RegExp('data-column="'+key+'"'));
 assert.match(blank,/data-column="price"/);assert.match(blank,/>0\.00</);
 const mixed=vm.runInContext("documentHtml(testNotice,{},['—','24 كرتون'],logo,font)",context);
 assert.match(mixed,/data-column="packaging"/);assert.match(mixed,/24 كرتون/);
 const widths=[...blank.matchAll(/<col style="width:([0-9.]+)%">/g)].map(x=>Number(x[1]));
 assert.ok(Math.abs(widths.reduce((a,b)=>a+b,0)-100)<.01);
 assert.match(blank,/8,940\.00/);assert.match(blank,/لتنسيق استلام البضاعة/);assert.doesNotMatch(blank,/للتنسيق استلام/);
});
test('long multi-item notices paginate without clipping text or financial columns',async()=>{
 context.longNotice={...n,items:Array.from({length:14},(_,i)=>({...n.items[0],description:'وصف تفصيلي لأكياس بلاستيك مطبوعة '.repeat(3),qty:i+1}))};
 const longHtml=vm.runInContext("documentHtml(longNotice,{},[],logo,font)",context);
 const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});
 try{const page=await browser.newPage();await page.setContent(longHtml,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
 const overflow=await page.evaluate(()=>[...document.querySelectorAll('td,th')].some(e=>e.scrollWidth>e.clientWidth+2));assert.equal(overflow,false);
 assert.equal(await page.$$eval('tbody tr',rows=>rows.length),14);
 }finally{await browser.close();}
});
test('footer follows RTL contact order and row padding decreases with item count',async()=>{
 const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});
 try{
  const page=await browser.newPage(),padding=[];
  for(const count of [1,4,10,18]){
   context.densityNotice={...n,items:Array.from({length:count},()=>({...n.items[0]}))};
   const markup=vm.runInContext('documentHtml(densityNotice,{},[],logo,font)',context);
   await page.setContent(markup,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
   const state=await page.evaluate(()=>({padding:parseFloat(getComputedStyle(document.querySelector('td')).paddingTop),keys:[...document.querySelectorAll('footer>[data-contact]')].map(e=>e.dataset.contact),positions:[...document.querySelectorAll('footer>[data-contact]')].map(e=>e.getBoundingClientRect().right),overflow:[...document.querySelectorAll('td,footer>span')].some(e=>e.scrollWidth>e.clientWidth+2)}));
   assert.deepEqual(state.keys,['phone','email','location','city','district']);assert.equal(state.overflow,false);
   assert.ok(state.positions.every((v,i)=>i===0||v<state.positions[i-1]),'footer reads phone then email then location right to left');padding.push(state.padding);
   if(count===10&&process.env.JMS_PDF_COMPACT_OUTPUT){await vm.runInContext('fitPrintDocument',context)(page);await page.pdf({path:process.env.JMS_PDF_COMPACT_OUTPUT,format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:0,bottom:0,left:0,right:0}});}
  }
  assert.ok(padding.every((v,i)=>i===0||v<padding[i-1]));
 }finally{await browser.close();}
});
