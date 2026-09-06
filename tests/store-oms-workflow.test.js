import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTransition,inventoryEffect,assertOrderItems} from '../api/store-oms-workflow.js';

function makeInventory(total=100){return {total_stock:total,reserved_stock:0,get available_stock(){return this.total_stock-this.reserved_stock}}}
function applyInventory(inv,qty,effect){
  if(effect.reserve){if(qty>inv.available_stock)return {ok:false,code:'insufficient_available_stock'};inv.reserved_stock+=qty}
  if(effect.release){inv.reserved_stock-=qty}
  if(effect.consume){inv.reserved_stock-=qty;inv.total_stock-=qty}
  return {ok:true};
}

test('NEW: valid order is accepted and empty order is rejected',()=>{
  const valid=[{sku:'SKU-1',product_name:'كرتون أكواب',quantity:10,unit_price:20}];
  assert.equal(assertOrderItems(valid).ok,true);
  assert.deepEqual(assertOrderItems([]),{ok:false,code:'empty_order'});
});

test('APPROVED: reservation reduces available but not total stock',()=>{
  const inv=makeInventory(100),effect=inventoryEffect({from:'new',to:'approved'});
  assert.equal(validateTransition({from:'new',to:'approved',role:'sales'}).ok,true);
  assert.equal(applyInventory(inv,30,effect).ok,true);
  assert.equal(inv.total_stock,100);
  assert.equal(inv.reserved_stock,30);
  assert.equal(inv.available_stock,70);
});

test('APPROVED edge: order exceeding available stock is rejected',()=>{
  const inv=makeInventory(20),effect=inventoryEffect({from:'new',to:'approved'});
  assert.deepEqual(applyInventory(inv,25,effect),{ok:false,code:'insufficient_available_stock'});
  assert.equal(inv.total_stock,20);assert.equal(inv.reserved_stock,0);
});

test('warehouse flow is strictly sequential',()=>{
  assert.equal(validateTransition({from:'approved',to:'picking',role:'sales'}).ok,true);
  assert.equal(validateTransition({from:'picking',to:'ready',role:'sales'}).ok,true);
  assert.deepEqual(validateTransition({from:'approved',to:'ready',role:'admin'}),{ok:false,code:'invalid_transition'});
  assert.deepEqual(validateTransition({from:'new',to:'delivered',role:'admin'}),{ok:false,code:'invalid_transition'});
});

test('DISPATCHED/loaded: reservation is released and total stock is consumed',()=>{
  const inv=makeInventory(100);
  applyInventory(inv,30,inventoryEffect({from:'new',to:'approved'}));
  const effect=inventoryEffect({from:'ready',to:'loaded',inventoryReserved:true});
  assert.equal(applyInventory(inv,30,effect).ok,true);
  assert.equal(inv.total_stock,70);
  assert.equal(inv.reserved_stock,0);
  assert.equal(inv.available_stock,70);
});

test('cancel before loading requires reason and releases reservation',()=>{
  const inv=makeInventory(100);applyInventory(inv,25,inventoryEffect({from:'new',to:'approved'}));
  assert.deepEqual(validateTransition({from:'approved',to:'cancelled',role:'sales',cancelReason:''}),{ok:false,code:'cancel_reason_required'});
  assert.equal(validateTransition({from:'approved',to:'cancelled',role:'sales',cancelReason:'العميل ألغى الطلب'}).ok,true);
  applyInventory(inv,25,inventoryEffect({from:'approved',to:'cancelled',inventoryReserved:true}));
  assert.equal(inv.total_stock,100);assert.equal(inv.reserved_stock,0);assert.equal(inv.available_stock,100);
});

test('cancel after loading is forbidden to normal user and allowed to admin',()=>{
  assert.deepEqual(validateTransition({from:'loaded',to:'cancelled',role:'sales',cancelReason:'إرجاع'}),{ok:false,code:'admin_required_after_ready'});
  assert.equal(validateTransition({from:'loaded',to:'cancelled',role:'admin',cancelReason:'إلغاء إداري بعد التحميل'}).ok,true);
});

test('full normal flow produces seven audit stages including NEW',()=>{
  const stages=['new'],history=[{from:null,to:'new'}];
  const steps=[['new','approved'],['approved','picking'],['picking','ready'],['ready','loaded'],['loaded','out_for_delivery'],['out_for_delivery','delivered']];
  for(const [from,to] of steps){assert.equal(validateTransition({from,to,role:'sales'}).ok,true);history.push({from,to});stages.push(to)}
  assert.deepEqual(stages,['new','approved','picking','ready','loaded','out_for_delivery','delivered']);
  assert.equal(history.length,7);
});

test('terminal statuses cannot transition further',()=>{
  assert.deepEqual(validateTransition({from:'delivered',to:'cancelled',role:'admin',cancelReason:'x'}),{ok:false,code:'terminal_status'});
  assert.deepEqual(validateTransition({from:'cancelled',to:'approved',role:'admin'}),{ok:false,code:'terminal_status'});
});
