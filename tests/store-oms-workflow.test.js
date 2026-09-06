import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTransition,inventoryEffect,assertOrderItems} from '../api/store-oms-workflow.js';

test('allows normal sequential workflow',()=>{
  const steps=[['new','approved'],['approved','picking'],['picking','ready'],['ready','loaded'],['loaded','out_for_delivery'],['out_for_delivery','delivered']];
  for(const [from,to] of steps) assert.equal(validateTransition({from,to,role:'sales'}).ok,true);
});

test('rejects status skipping',()=>{
  assert.deepEqual(validateTransition({from:'new',to:'delivered',role:'admin'}),{ok:false,code:'invalid_transition'});
});

test('requires cancellation reason',()=>{
  assert.deepEqual(validateTransition({from:'new',to:'cancelled',role:'sales',cancelReason:''}),{ok:false,code:'cancel_reason_required'});
});

test('non admin cannot cancel after ready',()=>{
  assert.deepEqual(validateTransition({from:'loaded',to:'cancelled',role:'sales',cancelReason:'خطأ في الطلب'}),{ok:false,code:'admin_required_after_ready'});
  assert.equal(validateTransition({from:'loaded',to:'cancelled',role:'admin',cancelReason:'اعتماد إداري للإلغاء'}).ok,true);
});

test('inventory reservation consumption and release rules',()=>{
  assert.deepEqual(inventoryEffect({from:'new',to:'approved'}),{reserve:true,consume:false,release:false});
  assert.deepEqual(inventoryEffect({from:'ready',to:'loaded',inventoryReserved:true}),{reserve:false,consume:true,release:false});
  assert.deepEqual(inventoryEffect({from:'picking',to:'cancelled',inventoryReserved:true}),{reserve:false,consume:false,release:true});
});

test('rejects empty or malformed orders',()=>{
  assert.equal(assertOrderItems([]).ok,false);
  assert.equal(assertOrderItems([{sku:'A',product_name:'صنف',quantity:0,unit_price:5}]).ok,false);
  assert.equal(assertOrderItems([{sku:'A',product_name:'صنف',quantity:2,unit_price:5}]).ok,true);
});
