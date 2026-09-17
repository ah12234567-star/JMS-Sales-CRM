import test from 'node:test';
import assert from 'node:assert/strict';
import {executePlan, fallbackPlan} from '../lib/ai-engine.js';
const now=new Date('2026-09-17T09:00:00Z');
const admin={id:'manager',role:'admin'};
function data(){return {reps:[{id:'r',name:'عثمان أحمد'},{id:'s',name:'وسام علي'}],customers:[{id:'a',name:'مستحق',rep_id:'r',debt_balance:1000,due_amount:700},{id:'b',name:'عرض',rep_id:'r',debt_balance:9000},{id:'c',name:'قديم',rep_id:'r',debt_balance:0},{id:'d',name:'خاص وسام',rep_id:'s',debt_balance:50000,due_amount:50000}],quotes:[{id:'q',customer_id:'b',rep_id:'r',status:'sent'}],visits:[{id:'v',customer_id:'c',rep_id:'r',date:'2026-08-01'}]};}
test('daily priorities rank verified due before quotes and stale visits, deduplicate customers',()=>{
 const d=data(),before=JSON.stringify(d),r=executePlan({action:'daily_plan',rep:'عثمان'},d,admin,now);
 assert.deepEqual(r.sources.map(x=>x.id),['a','b','c']);assert.equal(r.metrics.count,3);assert.equal(r.metrics.unknownDue,1);assert.match(r.answer,/47 يوم/);assert.equal(JSON.stringify(d),before);
});
test('daily plan cannot expose another representative or override scope',()=>{
 const r=executePlan({action:'daily_plan'},data(),{id:'r',role:'rep'},now);assert.ok(!r.answer.includes('خاص وسام'));assert.equal(r.metrics.count,3);
 assert.equal(executePlan({action:'daily_plan',rep:'وسام'},data(),{id:'r',role:'rep'},now).mode,'clarification');
});
test('recent visits and cancelled quotes do not create a follow-up priority',()=>{
 const d=data();d.customers=d.customers.filter(c=>c.id==='c');d.visits[0].date='2026-09-16';d.quotes=[{id:'x',customer_id:'c',status:'cancelled'}];
 assert.equal(executePlan({action:'daily_plan'},d,admin,now).metrics.count,0);
});
test('unknown dates do not falsely claim first visit or a stale last visit',()=>{
 const d=data();d.customers=d.customers.filter(c=>c.id==='c');d.visits.push({id:'bad',customer_id:'c',rep_id:'r',date:'invalid'});
 const r=executePlan({action:'daily_plan'},d,admin,now);assert.equal(r.metrics.count,0);assert.equal(r.metrics.unknownVisitDates,1);
});
test('limit keeps full count and historical plan asks for clarification',()=>{
 const r=executePlan({action:'daily_plan',limit:1},data(),admin,now);assert.equal(r.sources.length,1);assert.equal(r.metrics.count,4);
 assert.equal(executePlan({action:'daily_plan',from:'2026-08-01'},data(),admin,now).mode,'clarification');
});
test('Arabic daily plan phrases work without the language model',()=>{
 for(const question of ['خطة يومي','مين أتابع اليوم؟','مين أزور اليوم','رتب يومي'])assert.equal(fallbackPlan(question,{},data(),'2026-09-17').action,'daily_plan');
 assert.equal(fallbackPlan('خطة اليوم عثمان',{},data(),'2026-09-17').rep,'عثمان أحمد');
});
