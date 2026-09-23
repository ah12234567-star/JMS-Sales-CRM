import test from 'node:test';
import assert from 'node:assert/strict';
import {executePlan,fallbackPlan} from '../lib/ai-engine.js';

const now=new Date('2026-09-23T08:00:00Z');
const admin={id:'manager',role:'admin'};
const rows={
 reps:[{id:'r1',name:'عثمان أحمد'},{id:'r2',name:'وسام علي'}],customers:[],orders:[],
 visits:[{id:'v1',rep_id:'r1',customer_id:'c1',date:'2026-09-23'}],
 quotes:[{id:'q1',rep_id:'r1',customer_id:'c1',date:'2026-09-23'}],
 collections:[{id:'p1',rep_id:'r1',customer_id:'c1',date:'2026-09-23',amount:'1,250.50'}],
 fieldRounds:[
  {id:'f1',rep_id:'r1',date:'2026-09-23',status:'submitted',entries:[{name:'بخاري',outcome:'entered'},{name:'مضبيكم',outcome:'passed'}]},
  {id:'draft',rep_id:'r1',date:'2026-09-23',status:'draft',entries:[{name:'غير معتمد',outcome:'entered'}]}
 ]
};

test('rep activity combines verified CRM activity and submitted field rounds',()=>{
 const result=executePlan({action:'rep_activity',rep:'عثمان'},rows,admin,now);
 assert.match(result.answer,/زيارات العملاء: 1/);assert.match(result.answer,/الجولات المعتمدة: 1/);
 assert.match(result.answer,/المنشآت: 2/);assert.equal(result.metrics.activity[0].collected,1250.5);
 assert.equal(result.metrics.activity[0].places,2);assert.equal(result.metrics.inactive,0);
});

test('manager sees missing registration as a review flag, not proof of no work',()=>{
 const result=executePlan({action:'rep_activity'},rows,admin,now);
 assert.equal(result.metrics.representatives,2);assert.equal(result.metrics.inactive,1);
 assert.match(result.answer,/هذا لا يثبت عدم العمل/);assert.match(result.answer,/وسام علي/);
});

test('rep activity is scoped and Arabic fallback recognizes summary questions',()=>{
 const scoped=executePlan({action:'rep_activity'},rows,{id:'r1',role:'rep'},now);
 assert.equal(scoped.metrics.representatives,1);assert.ok(!scoped.answer.includes('وسام'));
 assert.equal(executePlan({action:'rep_activity',rep:'وسام'},rows,{id:'r1',role:'rep'},now).mode,'clarification');
 for(const question of ['ملخص نشاط المناديب اليوم','وش سوى عثمان اليوم','تقرير المندوب'])assert.equal(fallbackPlan(question,{},rows,'2026-09-23').action,'rep_activity');
});
