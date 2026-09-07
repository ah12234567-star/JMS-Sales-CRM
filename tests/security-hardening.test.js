import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('password reset requires the approved Arabic Meta template variables',()=>{
  const source=read('api/auth-reset-request.js');
  assert.match(source,/META_WHATSAPP_RESET_TEMPLATE/);
  assert.match(source,/META_WHATSAPP_PHONE_NUMBER_ID/);
  assert.doesNotMatch(source,/hello_world/);
  assert.doesNotMatch(source,/1252021734662917/);
});

test('public quote routes use the server-side Supabase helper only',()=>{
  for(const path of ['api/public-quote.js','api/quote-signature.js']){
    const source=read(path);
    assert.match(source,/from '\.\/auth-utils\.js'/);
    assert.doesNotMatch(source,/SUPABASE_ANON_KEY|sb_publishable_|\.supabase\.co/);
  }
});

test('production RLS migration revokes direct browser table access',()=>{
  const source=read('supabase/migrations/20260907_security_lockdown.sql');
  assert.match(source,/revoke all on table public\.%I from anon, authenticated/);
  assert.match(source,/drop policy if exists/);
  assert.match(source,/jms_quotes/);
  assert.match(source,/jms_users/);
});

test('main pages self-host runtime libraries',()=>{
  const index=read('index.html');
  assert.match(index,/\/vendor\/supabase\.js/);
  assert.match(index,/\/vendor\/xlsx\.full\.min\.js/);
  assert.match(index,/\/vendor\/html2pdf\.bundle\.min\.js/);
  assert.doesNotMatch(index,/cdn\.jsdelivr\.net|fonts\.googleapis\.com/);
});

test('WhatsApp webhook fails closed and contains no fallback credential',()=>{
  const source=read('api/whatsapp-webhook.js');
  assert.match(source,/META_WHATSAPP_APP_SECRET/);
  assert.match(source,/META_WHATSAPP_VERIFY_TOKEN_HASH/);
  assert.doesNotMatch(source,/Temporary Cloud API test-number mode/);
  assert.doesNotMatch(source,/23fa184ac49c5f11/);
});

test('WhatsApp send routes require signed user roles and canonical env names',()=>{
  const direct=read('api/whatsapp-send.js');
  const campaign=read('api/whatsapp-campaign-send.js');
  assert.match(direct,/requireRole\(req, \["admin", "sales", "rep"\]\)/);
  assert.match(campaign,/requireRole\(req, \['admin','sales'\]\)/);
  for(const source of [direct,campaign]){
    assert.match(source,/META_WHATSAPP_ACCESS_TOKEN/);
    assert.match(source,/META_WHATSAPP_PHONE_NUMBER_ID/);
  }
});

test('billable AI routes require an authenticated user',()=>{
  for(const path of ['api/ai.js','api/web-search.js']){
    const source=read(path);
    assert.match(source,/requireRole\(req/);
    assert.match(source,/unauthorized/);
  }
  assert.match(read('app.js'),/jmsPostJson\('\/api\/ai'/);
});

test('customer OTP uses only canonical Meta environment variables',()=>{
  const source=read('api/customer-otp-send.js');
  assert.match(source,/META_WHATSAPP_ACCESS_TOKEN/);
  assert.match(source,/META_WHATSAPP_PHONE_NUMBER_ID/);
  assert.doesNotMatch(source,/process\.env\.WHATSAPP_(?:TOKEN|ACCESS_TOKEN|PHONE_NUMBER_ID)/);
});

test('new deployment invalidates legacy sessions and limits tokens to 12 hours',()=>{
  const source=read('api/auth-utils.js');
  assert.match(source,/sv:\s*2/);
  assert.match(source,/payload\.sv\s*!==\s*2/);
  assert.match(source,/12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
});

test('store customer login never prefills a stale saved phone',()=>{
  const source=read('store.js');
  assert.doesNotMatch(source,/openCustomerLogin\(loadCustomer\(\)\.phone\|\|''\)/);
  assert.match(source,/openCustomerLogin\(''\)/);
  assert.match(source,/removeItem\(CUSTOMER_KEY\)/);
});
