import test from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../lib/ai-data.js';
test('cloud reader continues beyond 1000 records',async()=>{
 const calls=[],rows=Array.from({length:1250},(_,id)=>({id:String(id)}));
 const result=await readAll('jms_customers','id','',async path=>{calls.push(path);const offset=Number(path.match(/offset=(\d+)/)[1]);return rows.slice(offset,offset+500);});
 assert.equal(result.length,1250);assert.equal(calls.length,3);assert.ok(calls[2].includes('offset=1000'));
});
test('cloud read failure never returns partial totals',async()=>{
 let calls=0;await assert.rejects(()=>readAll('jms_customers','id','',async()=>{if(calls++===0)return Array.from({length:500},(_,id)=>({id}));throw new Error('network_failure');}),/network_failure/);
});
test('invalid cloud payload is rejected',async()=>{
 await assert.rejects(()=>readAll('jms_customers','id','',async()=>({error:'bad response'})),/invalid_crm_response/);
});
test('query guard fails explicitly instead of silently truncating',async()=>{
 await assert.rejects(()=>readAll('jms_customers','id','',async()=>Array.from({length:500},(_,id)=>({id}))),/crm_query_too_large/);
});
