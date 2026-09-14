import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('../jms-conversational-ai.js',import.meta.url),'utf8');
function harness(respond){
 class Element{constructor(){this.children=[];this.style={};this.value='';this.textContent='';this.scrollHeight=10;}appendChild(n){this.children.push(n);return n;}remove(){this.removed=true;}}
 const elements={jmsAiBody:new Element(),jmsAiInput:new Element(),repAiBody:new Element(),repAiInput:new Element()};
 const document={readyState:'complete',createElement:()=>new Element(),getElementById:id=>elements[id]||null,querySelectorAll:()=>[],addEventListener(){}};
 const window={currentUser:{id:'admin',role:'admin'}};
 let token='session-one';const sessionStorage={getItem:()=>token};
 const calls=[];const fetch=async(url,opts)=>{calls.push({url,...opts,payload:JSON.parse(opts.body)});return {ok:true,json:async()=>respond(calls.length)};};
 new Function('window','document','sessionStorage','fetch','AbortController','setTimeout','clearTimeout',script)(window,document,sessionStorage,fetch,AbortController,setTimeout,clearTimeout);
 return {window,elements,calls,setToken:t=>{token=t;}};
}
test('chat sends authorization and preserves filters without uploading browser CRM data',async()=>{
 const h=harness(()=>({ok:true,answer:'نتيجة',context:{action:'debts',rep:'عثمان',dueOnly:true}}));
 await h.window.askJmsAI('ديون عثمان');await h.window.askJmsAI('المستحق منها');
 assert.equal(h.calls[0].headers.Authorization,'Bearer session-one');assert.equal(h.calls[0].payload.data,undefined);
 assert.equal(h.calls[1].payload.context.rep,'عثمان');assert.equal(h.calls[1].payload.conversation.length,2);
});
test('changing login session clears previous conversation',async()=>{
 const h=harness(()=>({ok:true,answer:'نتيجة',context:{action:'debts',rep:'عثمان'}}));
 await h.window.askJmsAI('ديون عثمان');h.setToken('session-two');await h.window.askJmsAI('ديون العملاء');
 assert.equal(h.calls[1].payload.conversation.length,0);assert.equal(h.calls[1].payload.context.rep,undefined);
});
test('both assistant screens use the same authenticated endpoint',async()=>{
 const h=harness(()=>({ok:true,answer:'نتيجة'}));
 await h.window.jmsRepAiAsk('ديون عملائي');assert.equal(h.calls[0].url,'/api/ai');assert.equal(h.elements.repAiBody.children.length,2);
});
test('user and model HTML are displayed as text',async()=>{
 const text='<img src=x onerror=alert(1)>',h=harness(()=>({ok:true,answer:text}));
 await h.window.askJmsAI(text);assert.equal(h.elements.jmsAiBody.children[0].textContent,text);assert.equal(h.elements.jmsAiBody.children[1].textContent,text);assert.equal(h.elements.jmsAiBody.children[1].innerHTML,undefined);
});
test('unavailable backend does not silently run the old local answer',async()=>{
 const h=harness(()=>({ok:false,answer:'تعذر قراءة البيانات'}));
 await h.window.askJmsAI('ديون عثمان');assert.equal(h.elements.jmsAiBody.children[1].textContent,'تعذر قراءة البيانات');
});
