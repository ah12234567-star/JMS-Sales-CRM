import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import handler from '../api/auth-language.js';
import session from '../api/auth-session.js';
import login from '../api/auth-login.js';
import {sign,pbkdf2} from '../api/auth-utils.js';

async function request(fn, body, auth) {
  const req=Readable.from([Buffer.from(JSON.stringify(body))]); req.method='POST';req.headers=auth?{authorization:'Bearer '+sign(auth)}:{};
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.result=JSON.parse(text);}};
  await fn(req,res);return res;
}
test('language preference is authenticated, validated, scoped and independent of credentials', async () => {
  const keys=['AUTH_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]])), oldFetch=globalThis.fetch;
  try {
    process.env.AUTH_SECRET='localization-tests-secret-at-least-32-characters';
    process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
    const row={id:'shafiq',email:'shafiq@example.test',language:'en',data:{name:'شفيق عباس',role:'rep',status:'active',permissions:{create_quotes:true},password_salt:'salt',password_hash:pbkdf2('test-password','salt')}};
    const writes=[];
    globalThis.fetch=async (url,options={})=>{
      assert.equal(new URL(url).searchParams.get('id') || 'eq.shafiq','eq.shafiq');
      if(options.method==='PATCH'){writes.push(JSON.parse(options.body));row.language=writes.at(-1).language;}
      return {ok:true,text:async()=>JSON.stringify([row])};
    };
    assert.equal((await request(handler,{language:'en'},null)).statusCode,401);
    assert.equal((await request(handler,{language:'fr'},{id:'shafiq',role:'rep'})).statusCode,400);
    const response=await request(handler,{language:'ar',id:'someone-else',permissions:{manage_users:true},password:'forged'},{id:'shafiq',role:'rep'});
    assert.equal(response.statusCode,200);assert.deepEqual(writes,[{language:'ar'}]);
    assert.match(response.headers['Cache-Control'],/no-store/);
    assert.equal(row.data.permissions.create_quotes,true);
    assert.equal(row.data.password_hash,pbkdf2('test-password','salt'));
    row.language='en';
    const fresh=await request(session,{}, {id:'shafiq',role:'rep'});
    assert.equal(fresh.result.user.language,'en');assert.equal(fresh.result.user.permissions.create_quotes,true);
    assert.equal(fresh.result.user.password_hash,undefined);
    const signedIn=await request(login,{email:row.email,password:'test-password'});
    assert.equal(signedIn.result.user.language,'en');
    row.data.status='disabled';
    assert.equal((await request(handler,{language:'ar'},{id:'shafiq',role:'rep'})).statusCode,403);
    assert.equal(writes.length,1);
  } finally { globalThis.fetch=oldFetch;for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];} }
});
