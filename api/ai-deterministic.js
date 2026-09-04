const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function parseCrmAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value ?? "").trim();
  if (!text) return 0;
  text = text
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/[٬,\s]/g, "")
    .replace(/[^0-9.()\-]/g, "")
    .replace(/\.(?!\d)/g, "");
  const negative = /^\(.*\)$/.test(text);
  const parsed = Number(text.replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

export function normalizeArabic(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function requestedLimit(question, fallback = 10) {
  const normalizedDigits = String(question ?? "")
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)));
  const match = normalizedDigits.match(/\b(\d{1,3})\b/);
  return Math.min(50, Math.max(1, Number(match?.[1] || fallback)));
}

function money(value) {
  return parseCrmAmount(value).toLocaleString("ar-SA", { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function findRequestedRep(question, reps) {
  const query = normalizeArabic(question);
  return (reps || []).find(rep => {
    const name = normalizeArabic(rep?.name);
    return name.length >= 2 && query.includes(name);
  });
}

function debtDirection(query) {
  if (/(اقل|اصغر|ادني|الاقل|الاصغر|منخفض)/.test(query)) return "asc";
  if (/(اعلي|اكبر|اضخم|الاكثر|ترتيب|اولويه|متصدر)/.test(query)) return "desc";
  return "desc";
}

export function deterministicAiAnswer(question, crmData = {}) {
  const query = normalizeArabic(question);
  const hasDebtNoun = /(دين|ديون|مديون|مديونيه|رصيد|ارصده|مستحق)/.test(query);
  const hasRankingSignal = /(اعلي|اكبر|اضخم|الاكثر|اقل|اصغر|ادني|الاقل|الاصغر|منخفض|ترتيب|اولويه|متصدر)/.test(query);
  const isDebtQuestion = hasDebtNoun || (/تحصيل/.test(query) && hasRankingSignal);
  if (!isDebtQuestion) return null;
  if (/(رساله|واتساب|صياغه|اكتب|ارسل|تذكير)/.test(query)) return null;

  const reps = Array.isArray(crmData.reps) ? crmData.reps : [];
  const requestedRep = findRequestedRep(question, reps);
  const repById = new Map(reps.map(rep => [String(rep.id), rep]));
  let customers = Array.isArray(crmData.customers) ? crmData.customers.slice() : [];
  if (requestedRep) customers = customers.filter(customer => String(customer.rep_id) === String(requestedRep.id));

  const debtors = customers
    .map(customer => ({ ...customer, debt: parseCrmAmount(customer.debt_balance) }))
    .filter(customer => customer.debt > 0);
  const total = debtors.reduce((sum, customer) => sum + customer.debt, 0);

  if (/(اجمالي|مجموع|كم.*(دين|ديون|مديون|رصيد)|قيمة.*(دين|ديون|مديون))/.test(query) && !/(اعلي|اكبر|اقل|اصغر|ترتيب)/.test(query)) {
    const scope = requestedRep ? ` لعملاء ${escapeHtml(requestedRep.name)}` : "";
    return {
      intent: "debt_total",
      answer: `إجمالي المديونية${scope}: ${money(total)} ر.س\nعدد العملاء الذين عليهم مديونية: ${debtors.length}`,
      meta: { total, count: debtors.length, repId: requestedRep?.id || null }
    };
  }

  const direction = debtDirection(query);
  const limit = requestedLimit(question, 10);
  debtors.sort((a, b) => {
    const amountOrder = direction === "asc" ? a.debt - b.debt : b.debt - a.debt;
    return amountOrder || String(a.name || "").localeCompare(String(b.name || ""), "ar");
  });
  const rows = debtors.slice(0, limit);
  const label = direction === "asc" ? "أقل المديونيات" : "أعلى المديونيات";
  const scope = requestedRep ? ` لعملاء ${escapeHtml(requestedRep.name)}` : "";
  const lines = rows.map((customer, index) => {
    const rep = repById.get(String(customer.rep_id));
    return `${index + 1}. ${escapeHtml(customer.name || "عميل بدون اسم")} — ${money(customer.debt)} ر.س${rep?.name ? ` — ${escapeHtml(rep.name)}` : ""}`;
  });
  return {
    intent: "debt_ranking",
    answer: rows.length
      ? `${label}${scope} (ترتيب ${direction === "asc" ? "تصاعدي" : "تنازلي"}):\n${lines.join("\n")}\n\nإجمالي المديونية في النطاق: ${money(total)} ر.س`
      : `لا توجد مديونيات موجبة مسجلة${scope}.`,
    meta: {
      direction,
      limit,
      total,
      count: debtors.length,
      customerIds: rows.map(customer => customer.id),
      repId: requestedRep?.id || null
    }
  };
}
