import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {randomUUID} from 'node:crypto';
const source=fs.readFileSync(new URL('../ready-goods-notice.js',import.meta.url),'utf8');
function harness(){
  const {window}=parseHTML('<html><head></head><body><aside class="sidebar"><nav></nav></aside><main class="main"></main></body></html>');
  const db={customers:[{id:'customer',name:'Ready customer'}],readyGoodsNotices:[]},alerts=[];
  window.scrollTo=()=>{};
  delete window.JMSReadyGoods;
  window.currentUser={id:'admin',role:'admin',name:'Admin'};
  const context=vm.createContext({window,document:window.document,db,crypto:{randomUUID},CSS:{escape:s=>s},localStorage:{getItem:()=>null},save(){},alert:message=>alerts.push(message),setTimeout(){},console});
  const load=()=>vm.runInContext(source,context);
  load();window.JMSReadyGoods.ensure();
  return {window,db,alerts,load,document:window.document};
}
function fill(h,key,value,emit=true){
 const input=h.document.querySelector(`[data-rgn-field="${key}"]`);input.value=String(value);
 if(emit)input.dispatchEvent(new h.window.Event('input',{bubbles:true}));return input;
}
test('ready goods saves actual typed quantities, VAT and prior payment without blur',()=>{
 const h=harness(),api=h.window.JMSReadyGoods;api.selectCustomer('customer');
 const input=fill(h,'qty',894);fill(h,'unit_price',10);fill(h,'description','Printed LD');fill(h,'size','37 × 45');
 h.document.getElementById('rgnPaid').value='7000';
 const f=api.recalc();assert.equal(f.total,10281);assert.equal(f.remaining,3281);
 assert.equal(h.document.querySelector('[data-rgn-field="qty"]'),input,'typing must preserve focus/keyboard node');
 const n=api.save();assert.equal(n.items[0].qty,894);assert.equal(n.items[0].description,'Printed LD');
 assert.equal(n.subtotal,8940);assert.equal(n.vat_amount,1341);assert.equal(n.paid,7000);assert.equal(n.remaining,3281);
 assert.equal(h.db.readyGoodsNotices.length,1);
});
test('duplicate shell loads keep one API, draft, navigation and save path',()=>{
 const h=harness(),api=h.window.JMSReadyGoods;api.selectCustomer('customer');fill(h,'qty',894);fill(h,'unit_price',10);
 const wrapped=api.save;h.load();assert.equal(h.window.JMSReadyGoods,api);assert.equal(api.save,wrapped);
 assert.equal(h.document.querySelectorAll('#readyGoodsNoticeNav').length,1);
 api.open();assert.equal(h.document.querySelector('[data-rgn-field="qty"]').value,'894');
 assert.equal(api.save().total,10281);
});
test('save flushes uncommitted inputs and adding/removing rows retains typed values',()=>{
 const h=harness(),api=h.window.JMSReadyGoods;api.selectCustomer('customer');
 fill(h,'qty',894,false);fill(h,'unit_price',10,false);api.addItem();
 assert.equal(h.document.querySelector('[data-rgn-field="qty"]').value,'894');
 api.removeItem(h.document.querySelectorAll('[data-rgn-item]')[1].dataset.rgnItem);
 fill(h,'qty',895,false);assert.equal(api.save().subtotal,8950);
});
test('paid above total is rejected and computed totals are excluded from static translation',()=>{
 const h=harness(),api=h.window.JMSReadyGoods;api.selectCustomer('customer');fill(h,'qty',894);fill(h,'unit_price',10);
 h.document.getElementById('rgnPaid').value='20000';api.save();assert.equal(h.db.readyGoodsNotices.length,0);
 assert.match(h.alerts[0],/المبلغ المدفوع/);
 for(const id of ['rgnSubtotal','rgnVat','rgnTotal','rgnRemaining'])assert.equal(h.document.getElementById(id).hasAttribute('data-i18n'),false);
});
