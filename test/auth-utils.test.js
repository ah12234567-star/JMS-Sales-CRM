import test from 'node:test';
import assert from 'node:assert/strict';
import {sign,verify,pbkdf2,makeSalt} from '../api/auth-utils.js';

process.env.AUTH_SECRET='test-secret-with-enough-entropy-for-jms';

test('password hashing is salted and deterministic for the same salt',()=>{
  const salt=makeSalt();
  assert.equal(pbkdf2('StrongPassword!42',salt),pbkdf2('StrongPassword!42',salt));
  assert.notEqual(pbkdf2('StrongPassword!42',salt),pbkdf2('wrong',salt));
});

test('signed sessions verify and reject tampering',()=>{
  const token=sign({id:'u-admin',email:'admin@example.com',role:'admin'});
  assert.equal(verify(token)?.role,'admin');
  assert.equal(verify(token+'x'),null);
  assert.equal(verify('invalid.token'),null);
});
