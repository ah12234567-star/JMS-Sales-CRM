import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseHTML}=require(process.env.JMS_TEST_DOM_PATH || 'linkedom');
const ar=JSON.parse(fs.readFileSync(new URL('../locales/ar.json',import.meta.url)));
const en=JSON.parse(fs.readFileSync(new URL('../locales/en.json',import.meta.url)));
const key=text=>Object.keys(ar).find(k=>ar[k]===text);
const script=fs.readFileSync(new URL('../localization.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};}
function harness(){
 const {window}=parseHTML(`<html><body><aside class="sidebar"><nav></nav></aside><button id="create"><span data-i18n=${key('إنشاء عرض سعر')}>إنشاء عرض سعر</span></button><select id="product"><option data-i18n=${key('أكياس رول')}>أكياس رول</option></select><div id="customer">العملاء</div><input id="input" value="بيانات عربية" data-i18n-placeholder=${key('بحث')} placeholder="بحث"></body></html>`);
 // linkedom exposes only a getter, unlike a browser's HTMLSelectElement.
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return Array.from(this.options).find(x=>x.selected)?.value||this.options[0]?.value;},set(v){for(const o of this.options)o.selected=o.value===v;}});
 const state={fail:false,requests:[],alerts:[],sessionStorage:storage(),localStorage:storage()};
 state.sessionStorage.setItem('jms_auth_token','test');
 const context=vm.createContext({window,document:window.document,MutationObserver:window.MutationObserver,CustomEvent:window.CustomEvent,console:{warn(){}},sessionStorage:state.sessionStorage,localStorage:state.localStorage,fetch:async(url,options)=>{
  if(url.startsWith('/locales/'))return {ok:true,json:async()=>url.includes('/en.')?en:ar};
  state.requests.push(JSON.parse(options.body));return {ok:!state.fail,json:async()=>({ok:!state.fail,language:JSON.parse(options.body).language})};
 }});
 window.alert=message=>state.alerts.push(message);window.currentUser={id:'shafiq',language:'en',permissions:{create_quotes:true}};
 vm.runInContext(script,context);window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
 return {window,state,context};
}
test('catalog parity, English startup, safe values and reversible switching',async()=>{
 assert.deepEqual(Object.keys(en).sort(),Object.keys(ar).sort());
 const {window:w,state}=harness();await tick();
 assert.equal(w.document.documentElement.dir,'ltr');
 assert.equal(w.document.querySelector('#create').textContent,'Create quotation');
 assert.equal(w.document.querySelector('#product option').value,'أكياس رول');
 assert.equal(w.document.querySelector('#product option').textContent,'Bags on a roll');
 assert.equal(w.document.querySelector('#customer').textContent,'العملاء');
 assert.equal(w.document.querySelector('#input').value,'بيانات عربية');
 assert.equal(w.document.querySelector('#input').placeholder,'Search');
 await w.JMSI18n.setLanguage('ar');await tick();
 assert.equal(w.document.documentElement.dir,'rtl');assert.equal(w.document.querySelector('#create').textContent,'إنشاء عرض سعر');
 assert.deepEqual(state.requests,[{language:'ar'}]);assert.equal(w.currentUser.permissions.create_quotes,true);
 await w.JMSI18n.setLanguage('en');await tick();
 const added=w.document.createElement('span');added.setAttribute('data-i18n',key('حفظ'));added.textContent='حفظ';w.document.body.append(added);await tick();assert.equal(added.textContent,'Save');
 state.fail=true;await w.JMSI18n.setLanguage('ar');assert.equal(w.JMSI18n.language,'en');assert.equal(w.currentUser.language,'en');assert.equal(state.alerts.length,1);
 w.currentUser={id:'other'};await w.JMSI18n.refresh();assert.equal(w.JMSI18n.language,'ar');
});
test('main page keeps business attributes and static interface translations',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const {document}=parseHTML(html);
 for(const el of document.querySelectorAll('[data-i18n]'))assert.ok(en[el.getAttribute('data-i18n')]);
 assert.equal(document.querySelector('#material option').value,'HDPE');
 assert.equal(document.querySelector('[data-action="create-quote"]').getAttribute('onclick'),'openQuoteForm()');
});
test('all sign-in paths retain the server language preference',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const match of app.matchAll(/currentUser=\{[^\n]+/g))assert.match(match[0],/language:u.language/);
 const emergency=fs.readFileSync(new URL('../emergency-login.js',import.meta.url),'utf8');
 assert.match(emergency,/language:data.user.language/);assert.match(emergency,/permissions:data.user.permissions/);
});

test('dynamic quotation handles and item summaries switch labels without changing values',async()=>{
 const {window:w,context}=harness();await tick();
 w.document.body.insertAdjacentHTML('beforeend','<div class="form-grid"><select id="mqProduct"><option value="أكياس بلاستيك">أكياس بلاستيك</option></select><input id="mqThicknessUnit"></div>');
 w.openQuoteForm=()=>{};context.Event=w.Event;
 vm.runInContext(fs.readFileSync(new URL('../quote-product-specs.js',import.meta.url),'utf8'),context);
 w.openQuoteForm();await tick();
 const handle=w.document.querySelector('#mqHandleType');
 assert.deepEqual(Array.from(handle.options).slice(1).map(o=>o.value),['تيشرت','بنانا','شريط']);
 assert.deepEqual(Array.from(handle.options).slice(1).map(o=>o.textContent),['T-shirt','Die-cut handle','Loop handle']);
 handle.value='شريط';handle.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.querySelector('#mqHandleColorWrap').hidden,false);
 assert.equal(w.document.querySelector('#mqHandleColor').placeholder,'Example: red');
 await w.JMSI18n.setLanguage('ar');await tick();
 assert.equal(handle.value,'شريط');assert.equal(handle.options[3].textContent,'شريط');
 await w.JMSI18n.setLanguage('en');await tick();
 assert.equal(handle.value,'شريط');assert.equal(w.document.documentElement.dir,'ltr');
 for(const [id,value] of Object.entries({mqWidth:'50',mqLength:'60',mqThickness:'70',mqKg:'100',mqPriceKg:'8',mqSizeUnit:'cm'})){
  const input=w.document.createElement('input');input.id=id;input.value=value;w.document.body.append(input);
 }
 w.document.querySelector('#mqThicknessUnit').value='micron';
 w.jmsAddQuoteItem();await tick();
 const summary=w.document.querySelector('#jmsQuoteDraftItems');
 assert.match(summary.textContent,/Item 1: Plastic bags/);assert.match(summary.textContent,/100 kg/);
 await w.JMSI18n.setLanguage('ar');await tick();assert.match(summary.textContent,/الصنف 1: أكياس بلاستيك/);

});
