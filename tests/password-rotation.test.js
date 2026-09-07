import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {rotatePasswords} from '../scripts/rotate-user-passwords.mjs';

test('recovery credentials survive a partial rotation and match the saved hash', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jms-rotation-'));
  const output = path.join(dir, 'credentials.json');
  let updates = 0;
  try {
    const request = async (url, options) => {
      if (!options.method) return {ok:true, json:async () => [{id:'1',email:'one@example.test',data:{}},{id:'2',email:'two@example.test',data:{}}]};
      const saved = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(saved.credentials.length, 2);
      assert.equal(fs.statSync(output).mode & 0o777, 0o600);
      const data = JSON.parse(options.body).data;
      assert.equal(data.password_hash, crypto.pbkdf2Sync(saved.credentials[updates].password, data.password_salt, 120000, 32, 'sha256').toString('hex'));
      if (++updates === 2) throw new Error('network lost');
      return {ok:true,json:async () => [{id:'1'}]};
    };
    await assert.rejects(rotatePasswords({url:'https://example.test',key:'test',output,request}), /1 updates confirmed/);
    assert.equal(JSON.parse(fs.readFileSync(output)).credentials.length, 2);
    let writes = 0;
    await assert.rejects(rotatePasswords({url:'https://example.test',key:'test',output,request:async (url, options) => {
      if (options.method) writes++;
      return {ok:true,json:async () => [{id:'1',email:'one@example.test'}]};
    }}), /EEXIST/);
    assert.equal(writes, 0);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
