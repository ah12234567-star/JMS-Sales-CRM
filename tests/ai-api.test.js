import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler from '../api/ai.js';
import { sign } from '../api/auth-utils.js';
async function request(body,auth){
 const req=Readable.from([JSON.stringify(body)]);req.method='POST';req.headers=auth?{authorization:'Bearer '+sign(auth)}:{};
 const res={setHeader(){},end(value){this.result=JSON.parse(value);}};
 await handler(req,res);return res;
}
test('unauthenticated AI request is rejected',async()=>{
 const res=await request({question:'ديون العملاء'},null);assert.equal(res.statusCode,401);
});
test('API ignores forged browser data and reads scoped cloud records',async()=>{
 const keys=['AUTH_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]])),fetchBefore=globalThis.fetch;
 try{
  process.env.AUTH_SECRET='test-only-ai-signature-secret-32-characters';process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';delete process.env.OPENAI_API_KEY;
  globalThis.fetch=async url=>{
   const table=new URL(url).pathname.split('/').pop();
   const rows=table==='jms_users'?[{id:'osman',email:'test@example.invalid',data:{name:'عثمان أحمد',role:'rep'}}]:table==='jms_customers'?[{id:'real',data:{name:'عميل حقيقي',rep_id:'osman',debt_balance:1000}},{id:'other',data:{name:'غير مرتبط',debt_balance:9000}}]:[];
   return {ok:true,text:async()=>JSON.stringify(rows)};
  };
  const res=await request({question:'ديون عملائي',data:{customers:[{id:'forged',rep_id:'osman',debt_balance:999999}]}},{id:'osman',role:'rep'});
  assert.equal(res.statusCode,200);assert.equal(res.result.metrics.total,1000);assert.equal(res.result.metrics.count,1);assert.ok(res.result.notice);assert.ok(!res.result.answer.includes('غير مرتبط'));
 }finally{globalThis.fetch=fetchBefore;for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
