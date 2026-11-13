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

test('quotation AI rejects representatives and sales users before provider or data access',async()=>{
 const before=process.env.AUTH_SECRET,oldFetch=globalThis.fetch;
 process.env.AUTH_SECRET='test-only-quote-ai-secret-32-characters';
 let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('must not fetch');};
 try{
  for(const role of ['rep','sales']){
   const res=await request({question:'50x60 HD 100 kg',task:'quote_parse'},{id:'u',role});
   assert.equal(res.statusCode,403);assert.equal(res.result.error,'forbidden');
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=oldFetch;if(before===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=before;}
});

test('quotation AI checks current administrator role, including downgraded tokens',async()=>{
 const keys=['AUTH_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 process.env.AUTH_SECRET='test-only-quote-ai-secret-32-characters';process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.OPENAI_API_KEY='test';
 let account={role:'admin',status:'active'},providerCalls=0;
 globalThis.fetch=async url=>{
  if(String(url).includes('jms_users'))return {ok:true,text:async()=>JSON.stringify([{data:account}])};
  providerCalls++;return {ok:true,json:async()=>({output_text:'{"quantity_kg":100}'})};
 };
 try{
  const body={question:'100 kg',task:'quote_parse'},auth={id:'a',role:'admin'};
  assert.equal((await request(body,auth)).statusCode,200);assert.equal(providerCalls,1);
  for(const data of [{role:'rep',status:'active'},{role:'admin',status:'disabled'}]){
   account=data;assert.equal((await request(body,auth)).statusCode,403);
  }
  assert.equal(providerCalls,1);
 }finally{globalThis.fetch=oldFetch;for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
