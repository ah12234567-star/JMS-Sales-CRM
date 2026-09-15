import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import handler from '../api/field-rounds.js';
import routesHandler from '../api/routes-sync.js';
import {sign} from '../api/auth-utils.js';
import {validateEntries,normalizeDraft,visibleRound,validDate} from '../lib/field-rounds.js';

test('strict rows, unknown visit type, no invented dates or client IDs',()=>{
 assert.equal(validDate('2026-02-30'),false);
 assert.throws(()=>validateEntries([]));assert.throws(()=>validateEntries([{name:'أ',outcome:'fake'}]));
 const row=validateEntries([{name:'بخاري',outcome:'entered',customer_id:'injected',checkout_at:'fake',follow_up_date:''}])[0];
 assert.equal(row.customer_id,undefined);assert.equal(row.checkout_at,undefined);
 const draft=normalizeDraft({entries:[{name:'مضبيكم',outcome:'fake',follow_up_date:'Thursday'}]},'السامر');
 assert.equal(draft.entries[0].outcome,'unspecified');assert.equal(draft.entries[0].follow_up_date,'');
 assert.equal(visibleRound({record_type:'field_round',rep_id:'a',status:'draft'},{id:'boss',role:'admin'}),false);
});

export function mockCloud(){
 const store=new Map();let modelCalls=0,mode='ok';
 const fetchMock=async (url,opts={})=>{
  if(String(url).includes('api.openai.com')){
   modelCalls++;if(mode==='offline')throw new Error('offline');
   return {ok:true,json:async()=>({output_text:JSON.stringify({entries:[{name:'بخاري الأمانة',area:'السامر',outcome:'entered',notes:'لا يحتاج الآن',follow_up_date:''},{name:'مضبيكم',area:'السامر',outcome:'entered',notes:'متابعة الخميس',follow_up_date:'2026-09-17'},{name:'مطعم آخر',area:'السامر',outcome:'passed',notes:'مرور دون دخول',follow_up_date:''}],clarification:''}),usage:{input_tokens:100,output_tokens:200}})};
  }
  const u=new URL(url),q=u.searchParams,table=u.pathname.split('/').pop();let result=[];
  if(table==='jms_users'){const id=(q.get('id')||'eq.a').slice(3);result=[{id,data:{name:id==='boss'?'المدير':id,role:id==='boss'?'admin':'rep',status:'active'}}];}
  else if(table==='jms_routes'){
   const matches=r=>{
    for(const [key,value] of q){
     if(key==='id'&&r.id!==value.slice(3))return false;
     if(key==='data->>rep_id'&&r.data.rep_id!==value.slice(3))return false;
     if(key==='data->>status'&&r.data.status!==value.slice(3))return false;
     if(key==='data->>record_type'&&r.data.record_type!==value.slice(3))return false;
     if(key==='data->>date'&&r.data.date!==value.slice(3))return false;
     if(key==='data->generation->>status'&&r.data.generation.status!==value.slice(3))return false;
     if(key==='or'&&r.data.rep_id!=='boss'&&r.data.status!=='submitted')return false;
    }return true;
   };
   if(opts.method==='POST'){
    for(const row of JSON.parse(opts.body)){
     if(opts.headers.Prefer.includes('ignore-duplicates')&&store.has(row.id))continue;
     store.set(row.id,structuredClone(row));result.push(row);
    }
   }else if(opts.method==='PATCH'){
    for(const row of store.values())if(matches(row)){Object.assign(row,JSON.parse(opts.body));result.push(structuredClone(row));}
   }else result=[...store.values()].filter(matches).slice(Number(q.get('offset'))||0,(Number(q.get('offset'))||0)+(Number(q.get('limit'))||100));
  }else throw new Error('Unexpected table mutation/read: '+table);
  return {ok:true,text:async()=>JSON.stringify(result)};
 };
 return {store,fetchMock,get calls(){return modelCalls;},set mode(v){mode=v;}};
}
async function call(auth,method='GET',body={},url='/api/field-rounds',fn=handler){
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method=method;req.url=url;req.headers=auth?{authorization:'Bearer '+sign(auth)}:{};
 const res={setHeader(){},end(v){this.body=JSON.parse(v);}};await fn(req,res);return res;
}
test('field round API: prepare, edit, submit, owner isolation, retry and legacy separation',async()=>{
 const keys=['AUTH_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const oldFetch=globalThis.fetch;
 const mock=mockCloud();
 try{
  process.env.AUTH_SECRET='field-rounds-test-only-secret-32-long';process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fake-test';process.env.OPENAI_API_KEY='fake-test';globalThis.fetch=mock.fetchMock;
  const a={id:'a',role:'rep'},b={id:'b',role:'rep'},boss={id:'boss',role:'admin'};
  assert.equal((await call(null)).statusCode,401);
  assert.equal((await call({id:'warehouse',role:'warehouse'})).statusCode,401);
  const input={action:'prepare',text:'زرت بخاري الأمانة ومضبيكم، ومررت أمام مطعم آخر',area:'السامر',date:'2026-09-15',rep_id:'b'};
  const prepared=await call(a,'POST',input);assert.equal(prepared.statusCode,200);
  const r=prepared.body.record;assert.equal(r.rep_id,'a');assert.equal(r.entries.length,3);assert.equal(r.status,'draft');assert.equal(r.generation,undefined);
  assert.equal(mock.store.size,1);assert.equal(mock.calls,1);
  assert.equal((await call(a,'POST',input)).body.record.id,r.id);assert.equal(mock.calls,1);
  assert.equal((await call(b,'GET',{},'?id='+r.id)).statusCode,404);
  assert.equal((await call(boss,'GET',{},'?id='+r.id)).statusCode,404);
  assert.equal((await call(b,'POST',{action:'submit',id:r.id,entries:r.entries,confirmed:true})).statusCode,404);
  assert.equal((await call(a,'POST',{action:'submit',id:r.id,entries:r.entries})).statusCode,400);
  r.entries[0].notes='مراجعة وتصحيح المندوب';
  const saved=await call(a,'POST',{action:'submit',id:r.id,entries:r.entries,confirmed:true});assert.equal(saved.body.record.status,'submitted');assert.equal(saved.body.record.entries[0].notes,r.entries[0].notes);
  assert.equal((await call(boss,'GET',{},'?id='+r.id)).statusCode,200);
  assert.equal((await call(b)).body.records.length,0);assert.equal((await call(boss)).body.records.length,1);
  await call(a,'POST',{action:'submit',id:r.id,entries:[],confirmed:true});assert.equal(mock.store.size,1);
  const legacy=await call(a,'GET',{},'/api/routes-sync',routesHandler);assert.equal(legacy.body.items.length,0);
  const forged=await call(a,'POST',{items:[{id:r.id,rep_id:'a',record_type:'normal',items:[]}]},'/api/routes-sync',routesHandler);assert.equal(forged.body.count,0);
  mock.mode='offline';const fail=await call(a,'POST',{...input,text:'جولة ثانية'});assert.equal(fail.body.record.entries.length,0);assert.match(fail.body.record.clarification,/يدوي/);
  assert.equal(fail.body.record.source_text,'جولة ثانية');
 }finally{globalThis.fetch=oldFetch;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
