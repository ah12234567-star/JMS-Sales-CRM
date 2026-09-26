import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../field-rounds.js',import.meta.url),'utf8');
function harness(speechSupported=false){
 const elements=new Map(),saved=new Map(),calls=[];let offline=false;
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,checked:false,disabled:false,textContent:'',innerHTML:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},classList:{toggle(){}},addEventListener(){},scrollIntoView(){}});return elements.get(id);};
 const document={getElementById:el};
 let speech;
 const window=speechSupported?{webkitSpeechRecognition:class{constructor(){speech=this;}start(){this.onstart?.();}stop(){this.onend?.();}}}:{};
 const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 const record={id:'field-round-test',status:'draft',rep_id:'a',rep_name:'المندوب',date:'2026-09-15',area:'السامر',source_text:'زرت مطعم',entries:[{name:'<img src=x onerror=alert(1)>',area:'السامر',outcome:'entered',notes:'',follow_up_date:''}]};
 const fetch=async(url,opts)=>{
  const body=opts.body?JSON.parse(opts.body):null;calls.push(body);
  if(offline&&body?.action==='submit')throw new Error('انقطع الاتصال');
  if(body?.action==='submit')record.status='submitted';
  return {ok:true,json:async()=>body?{ok:true,record:structuredClone(record)}:{ok:true,user:{id:'a',role:'rep',name:'المندوب'},records:record.status==='submitted'?[structuredClone(record)]:[],hasMore:false}};
 };
 new Function('document','window','localStorage','sessionStorage','fetch','history','location','confirm',script)(document,window,localStorage,{getItem:()=> 'test-session'},fetch,{replaceState(){}},{search:'',pathname:'/field-rounds.html'},()=>true);
 return {el,calls,saved,get speech(){return speech;},setOffline:v=>offline=v};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('round UI: review before submit, safe HTML, retain draft after failure, retry success',async()=>{
 const h=harness();await tick();h.el('date').value='2026-09-15';h.el('area').value='السامر';h.el('source').value='زرت مطعم';
 await h.el('prepare').onclick();
 assert.equal(h.el('compose').hidden,true);assert.equal(h.el('review').hidden,false);
 assert.match(h.el('entries').innerHTML,/&lt;img/);assert.doesNotMatch(h.el('entries').innerHTML,/<img/);
 await h.el('submit').onclick();assert.equal(h.calls.filter(x=>x?.action==='submit').length,0);
 h.el('confirmed').checked=true;h.setOffline(true);await h.el('submit').onclick();
 assert.match(h.el('message').textContent,/انقطع/);assert.equal(h.el('reviewActions').hidden,false);assert.ok(h.saved.get('jms-field-round-draft:a'));
 h.setOffline(false);await h.el('submit').onclick();assert.equal(h.el('reviewActions').hidden,true);assert.match(h.el('message').textContent,/تم الحفظ/);assert.match(h.el('reports').innerHTML,/معتمد من المندوب/);
});

test('round UI: Arabic dictation appends a reviewable transcript and saves the draft',async()=>{
 const h=harness(true);await tick();h.el('source').value='مقدمة الجولة';h.el('voiceInput').onclick();
 assert.equal(h.speech.lang,'ar-SA');assert.equal(h.speech.continuous,true);assert.equal(h.el('voiceInput').getAttribute('aria-pressed'),'true');
 h.speech.onresult({results:[Object.assign([{transcript:'زرت بخاري الأمانة وتابعت الخميس'}],{isFinal:true})]});
 assert.equal(h.el('source').value,'مقدمة الجولة زرت بخاري الأمانة وتابعت الخميس');assert.ok(h.saved.get('jms-field-round-draft:a'));
 h.el('voiceInput').onclick();assert.equal(h.el('voiceInput').getAttribute('aria-pressed'),'false');assert.match(h.el('message').textContent,/انتهى الإملاء/);
});

test('round UI: hides dictation when the browser has no speech recognition',async()=>{
 const h=harness(false);await tick();assert.equal(h.el('voiceInput').hidden,true);assert.equal(typeof h.el('prepare').onclick,'function');
});
