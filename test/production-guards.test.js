import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('production login contains no default admin password',async()=>{
  const source=await readFile(new URL('../api/auth-login.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Jms2026Admin/);
  assert.doesNotMatch(source,/OTHMAN_BOOTSTRAP/);
});

test('privileged user APIs require admin authentication',async()=>{
  for(const file of ['auth-create-user.js','auth-update-user.js','auth-admin-reset-password.js']){
    const source=await readFile(new URL('../api/'+file,import.meta.url),'utf8');
    assert.match(source,/requireAuth\(req,res,\['admin'\]\)/,file);
  }
});

test('cloud polling is throttled and uploads run in parallel',async()=>{
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.match(source,/120000/);
  assert.match(source,/Promise\.all\(Object\.keys\(tableMap\)\.map\(upsertList\)\)/);
});
