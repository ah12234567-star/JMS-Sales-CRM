import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {salesView,mergeSalesEdit} from '../lib/quote-privacy.js';
import costs from '../api/quote-costs.js';
import {sign} from '../api/auth-utils.js';

test('sales view preserves selling price and strips private values from every item',()=>{
 const item={product:'film',price_kg:8,total_kg:100,width:50,length:60,thickness:50,material:'HDPE',pieces:'manager count',margin:10};
 const old={...item,items:[item]},sale=salesView(old);
 assert.equal(sale.price_kg,8);assert.equal(sale.items[0].pieces,undefined);
 assert.equal(sale.items[0].margin,undefined);assert.equal(old.items[0].margin,10);
 const saved=mergeSalesEdit({...sale,margin:90},old);
 assert.equal(saved.margin,10);assert.equal(saved.items[0].pieces,'manager count');
 const fresh=mergeSalesEdit({...sale.items[0],pieces:'untrusted'});
 assert.equal(fresh.piece_weight,'14.25 جرام');assert.notEqual(fresh.pieces,'untrusted');
});
test('pricing endpoint denies a signed representative before reading costs',async()=>{
 process.env.AUTH_SECRET=randomUUID()+randomUUID();
 const res={setHeader(){},end(s){this.result=JSON.parse(s);}};
 await costs({method:'GET',headers:{authorization:'Bearer '+sign({id:'demo',role:'rep'})}},res);
 assert.equal(res.statusCode,403);assert.deepEqual(res.result,{error:'forbidden'});
});
test('representative saves a 100 kg quote at 8/kg without private inputs',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const funcs=app.slice(app.indexOf('function quoteAdmin()'),app.indexOf('function prepareQuotePrivacy'));
 const start=app.indexOf('(function()',app.indexOf('/* FORCE FIX: Quote edit'));
 const block=app.slice(start,app.indexOf('})();',start)+5);
 const {document}=parseHTML('<html><body><div id="modal"><div id="modalBody"></div></div></body></html>');
 const db={customers:[{id:'c',name:'Customer',rep_id:'r'}],reps:[{id:'r',name:'Representative'}],quotes:[]};
 const ctx={document,db,currentUser:{id:'r',role:'rep'},modal:document.querySelector('#modal'),modalBody:document.querySelector('#modalBody'),crypto:{randomUUID},setTimeout(){},save(){},closeModal(){},renderAll(){},alert(){},allowedCustomers:()=>db.customers};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(funcs+block,ctx);ctx.jmsCalcQuote=ctx.salesQuoteTotal;
 ctx.forceQuoteForm(null);
 for(const id of ['mqPiece','mqPieces','mqDensity'])assert.equal(document.getElementById(id),null);
 for(const [id,value] of Object.entries({mqCustomer:'c',mqProduct:'film',mqRep:'r',mqMaterial:'HDPE',mqWidth:'50',mqLength:'60',mqThickness:'50',mqKg:'100',mqPriceKg:'8'}))Object.defineProperty(document.getElementById(id),'value',{value,writable:true,configurable:true});
 ctx.forceSaveQuote();assert.equal(db.quotes.length,1);assert.equal(db.quotes[0].total_amount,'800.00');assert.equal(db.quotes[0].status,'pending');
 ctx.currentUser.role='admin';ctx.forceQuoteForm(null);assert.ok(document.getElementById('mqPiece'));assert.ok(document.getElementById('mqPieces'));
});
test('current administrator reads the configured rates; a downgraded account cannot',async()=>{
 const old=global.fetch;process.env.AUTH_SECRET=randomUUID()+randomUUID();process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-value';
 let role='admin';global.fetch=async url=>new Response(JSON.stringify(String(url).includes('jms_users')?[{data:{role,status:'active'}}]:[{rates:{HDPE:3.7}}]),{status:200});
 try{
  const req={method:'GET',headers:{authorization:'Bearer '+sign({id:'a',role:'admin'})}};
  const res={setHeader(){},end(s){this.data=JSON.parse(s);}};
  await costs(req,res);assert.equal(res.statusCode,200);assert.deepEqual(res.data.rates,{HDPE:3.7});
  role='rep';await costs(req,res);assert.equal(res.statusCode,403);
 }finally{global.fetch=old;}
});

test('quotation assistant mounts only for administrators and disappears on session downgrade',()=>{
 const {window}=parseHTML('<html><head></head><body><div class="form-grid"><select id="mqProduct"><option>film</option></select></div></body></html>');
 const queue=[],events={};
 const ctx={document:window.document,currentUser:{id:'r',role:'rep'},setTimeout:fn=>queue.push(fn),addEventListener:(name,fn)=>events[name]=fn,openQuoteForm(){},Event:window.Event};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(new URL('../quote-smart-assistant.js',import.meta.url),'utf8'),ctx);
 while(queue.length)queue.shift()();
 assert.equal(window.document.getElementById('jmsQuoteSmartAssistant'),null);
 ctx.currentUser={id:'a',role:'admin'};ctx.openQuoteForm();while(queue.length)queue.shift()();
 assert.ok(window.document.getElementById('jmsQuoteSmartAssistant'));
 ctx.currentUser={id:'r',role:'rep'};events['jms:session-refreshed']();
 assert.equal(window.document.getElementById('jmsQuoteSmartAssistant'),null);
 ctx.openQuoteForm();while(queue.length)queue.shift()();
 assert.equal(window.document.getElementById('jmsQuoteSmartAssistant'),null);
});
