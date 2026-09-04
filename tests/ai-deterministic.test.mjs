import test from "node:test";
import assert from "node:assert/strict";
import { deterministicAiAnswer, parseCrmAmount } from "../api/ai-deterministic.js";

const crm = {
  reps: [
    { id: "r1", name: "أسامة" },
    { id: "r2", name: "عثمان" }
  ],
  customers: [
    { id: "c1", name: "عميل ألف", rep_id: "r1", debt_balance: "١٬٢٥٠" },
    { id: "c2", name: "عميل باء", rep_id: "r2", debt_balance: 90 },
    { id: "c3", name: "عميل جيم", rep_id: "r1", debt_balance: "5,500.50" },
    { id: "c4", name: "بدون دين", rep_id: "r1", debt_balance: 0 }
  ]
};

test("parses CRM amounts with Arabic and western separators", () => {
  assert.equal(parseCrmAmount("١٬٢٥٠"), 1250);
  assert.equal(parseCrmAmount("5,500.50 ر.س"), 5500.5);
});

test("أعلى الديون is always sorted descending", () => {
  const result = deterministicAiAnswer("أعطني أعلى الديون", crm);
  assert.equal(result.meta.direction, "desc");
  assert.deepEqual(result.meta.customerIds, ["c3", "c1", "c2"]);
  assert.match(result.answer, /ترتيب تنازلي/);
});

test("أقل الديون is sorted ascending", () => {
  const result = deterministicAiAnswer("اعرض أقل الديون", crm);
  assert.equal(result.meta.direction, "asc");
  assert.deepEqual(result.meta.customerIds, ["c2", "c1", "c3"]);
});

test("ranking can be scoped to a named representative", () => {
  const result = deterministicAiAnswer("أعلى ديون عملاء أسامة", crm);
  assert.deepEqual(result.meta.customerIds, ["c3", "c1"]);
  assert.equal(result.meta.repId, "r1");
});

test("debt totals are calculated, not generated", () => {
  const result = deterministicAiAnswer("كم إجمالي الديون؟", crm);
  assert.equal(result.intent, "debt_total");
  assert.equal(result.meta.total, 6840.5);
  assert.equal(result.meta.count, 3);
});

test("unrelated questions continue to the language model", () => {
  assert.equal(deterministicAiAnswer("حلل أداء المبيعات", crm), null);
  assert.equal(deterministicAiAnswer("اكتب رسالة تحصيل واتساب", crm), null);
  assert.equal(deterministicAiAnswer("كم حصلنا اليوم؟", crm), null);
});
