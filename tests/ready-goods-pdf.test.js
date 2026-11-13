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
  const state=await page.evaluate(()=>({images:[...document.images].map(i=>i.naturalWidth),overflow:[...document.querySelectorAll('header,td,.summary,.due')].some(e=>e.scrollWidth>e.clientWidth+2)}));
  assert.ok(state.images.every(n=>n>0));assert.equal(state.overflow,false);
  if(process.env.JMS_PDF_OUTPUT)await page.pdf({path:process.env.JMS_PDF_OUTPUT,format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:0,bottom:0,left:0,right:0}});
 }finally{await browser.close();}
});
