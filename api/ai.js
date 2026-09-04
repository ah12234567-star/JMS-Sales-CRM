import { sendJson, allowMethods, readBody, compactCrmData } from "./_helpers.js";

const JMS_AI_SYSTEM = `
أنت JMS AI، مساعد ذكي داخل CRM/ERP لمصنع منتجات بلاستيكية.
هدفك فهم كلام المستخدم الطبيعي باللهجة العربية، وليس انتظار أوامر أو أزرار محفوظة.

قواعد الفهم:
- افهم العربية الفصحى واللهجات الخليجية/السعودية والكتابة المختصرة.
- تحمّل الأخطاء الإملائية البسيطة وتبديل الهمزات والتاء/الهاء والياء/الألف المقصورة والمسافات.
- استنتج المقصود من السياق. أمثلة: "ديون وسام الأعلى"، "مين أعلى عميل عند وسام"، "وش أكثر مديونية لوسام" كلها طلب ترتيب/استخراج أعلى مديونيات عملاء المندوب وسام.
- طابق أسماء العملاء والمندوبين تقريبياً مع الأسماء الموجودة في بيانات CRM، ولا تخترع اسماً غير موجود.
- إذا وُجد أكثر من تطابق محتمل للاسم، اذكر الاحتمالات باختصار واطلب تحديد المقصود فقط عند الضرورة.
- افهم المرادفات: دين/ديون/مديونية/رصيد مستحق، تحصيل/سداد/دفعة، مندوب/موظف مبيعات، عرض/عرض سعر، زيارة/متابعة.

قواعد البيانات والحساب:
- بيانات CRM المرسلة لك هي المصدر الأساسي للحقيقة.
- لا تخترع أرقاماً أو سجلات. إذا لم توجد بيانات كافية قل ذلك بوضوح.
- عند سؤال "الأعلى/الأكثر/الأكبر" رتّب القيم رقمياً تنازلياً، وعند "الأقل" تصاعدياً.
- اربط العميل بمندوبه باستخدام المعرفات والحقول المتاحة، وليس تشابه الاسم فقط.
- احسب الإجماليات والنسب من القيم الموجودة فقط، واذكر العملة ريال إذا كان الحقل مبلغاً مالياً ولم توجد عملة أخرى.
- في أسئلة "آخر" استخدم أحدث تاريخ صالح في السجلات ذات العلاقة.
- لا تعرض للمندوب بيانات عملاء مندوب آخر إذا كانت البيانات/السياق يحدد صلاحية مندوب.

أسلوب الرد:
- أجب بالعربية مباشرة وباختصار مفيد.
- ابدأ بالنتيجة، ثم التفاصيل اللازمة.
- لا تقل للمستخدم إنه يحتاج صياغة أمر محدد؛ افهم سؤاله الطبيعي قدر الإمكان.
- إذا كان السؤال يحتمل تفسيراً واحداً معقولاً، نفّذه ولا تكثر أسئلة التوضيح.
- عند البحث الخارجي اذكر بوضوح أن المعلومة من بحث خارجي وتحتاج تحققاً من المورد.
`;

export default async function handler(req, res) {
  if (req.method === "GET") return sendJson(res, 200, { ok: true, route: "/api/ai", message: "JMS AI backend is running. Use POST." });
  if (!allowMethods(req, res, ["POST"])) return;
  try {
    const { question, data, allowWeb = false, conversation = [] } = await readBody(req);
    if (!question || typeof question !== "string") return sendJson(res, 400, { ok: false, error: "question is required" });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return sendJson(res, 200, { ok: false, mode: "missing_key", answer: "لم يتم ضبط OPENAI_API_KEY في Vercel. أضف المفتاح ثم أعد نشر المشروع." });

    const crmData = compactCrmData(data || {});
    const tools = allowWeb ? [{ type: "web_search_preview" }] : [];
    const recentConversation = Array.isArray(conversation)
      ? conversation.slice(-8).filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string")
      : [];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        tools,
        input: [
          { role: "system", content: JMS_AI_SYSTEM },
          ...recentConversation,
          { role: "user", content: JSON.stringify({ question: question.trim(), crm_data: crmData }) }
        ]
      })
    });

    const result = await response.json();
    if (!response.ok) return sendJson(res, 500, { ok: false, mode: "openai_error", error: result.error?.message || "OpenAI API error", details: result });
    const answer = result.output_text || (result.output || []).map(item => (item.content || []).map(c => c.text || "").join("\n")).join("\n") || "لم يصل رد واضح من الذكاء الاصطناعي.";
    return sendJson(res, 200, { ok: true, mode: allowWeb ? "openai_web_search" : "openai", answer });
  } catch (err) {
    return sendJson(res, 500, { ok: false, mode: "server_error", error: err.message || String(err) });
  }
}
