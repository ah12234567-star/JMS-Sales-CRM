import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness(user){
 const calls=[],listeners={};
 const window={currentUser:user,openQuoteForm:()=>calls.push('opened'),saveQuote:()=>calls.push('saved'),addEventListener(){}};
 const document={querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,documentElement:{},addEventListener:(type,fn)=>{listeners[type]=fn;}};
 vm.runInNewContext(fs.readFileSync(new URL('../ink-permissions.js',import.meta.url),'utf8'),{window,document,setTimeout(){},MutationObserver:class{observe(){}},alert:message=>calls.push(message)});
 return {window,calls,listeners};
}
test('create-only representative can open/save a quotation without management privileges',()=>{
 const h=harness({id:'rep',role:'rep',permissions:{create_quotes:true,manage_quotes:false}});
 assert.equal(h.window.jmsCanCreateQuote(),true);assert.equal(h.window.jmsCanManageQuotes(),false);
 h.window.openQuoteForm();h.window.saveQuote();assert.deepEqual(h.calls,['opened','saved']);
});
test('representative without create/manage remains blocked; management access still works',()=>{
 const h=harness({id:'rep',role:'rep',permissions:{create_quotes:false,manage_quotes:false}});
 assert.equal(h.window.jmsCanCreateQuote(),false);h.window.openQuoteForm();assert.ok(!h.calls.includes('opened'));
 h.window.currentUser.permissions.manage_quotes=true;h.window.openQuoteForm();assert.equal(h.calls.at(-1),'opened');
 h.window.currentUser.permissions={};h.window.openQuoteForm();assert.notEqual(h.calls.at(-1),'opened');
});
