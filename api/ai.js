
import { sendJson, allowMethods, readBody, compactCrmData } from "./_helpers.js";
export default async function handler(req, res) {
  if (req.method === "GET") return sendJson(res, 200, { ok: true, route: "/api/ai", message: "JMS AI backend is running. Use POST." });
  if (!allowMethods(req, res, ["POST"])) return;
  try {
    const { question, data, allowWeb = false } = await readBody(req);
    if (!question || typeof question !== "string") return sendJson(res, 400, { ok: false, error: "question is required" });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return sendJson(res, 200, { ok: false, mode: "missing_key", answer: "لم يتم ضبط OPENAI_API_KEY في Vercel. أضف المفتاح ثم أعد نشر المشروع." });
    const crmData = compactCrmData(data || {});
    const tools = allowWeb ? [{ type: "web_search_preview" }] : [];
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        tools,
        input: [
          { role: "system", content: "أنت JMS AI داخل نظام CRM/ERP لمصنع منتجات بلاستيكية. أجب بالعربية فقط. حلل بيانات CRM ولا تخترع أرقامًا. عند البحث الخارجي اذكر أن النتيجة من بحث خارجي وتحتاج تحقق من المورد." },
          { role: "user", content: JSON.stringify({ question, crm_data: crmData }) }
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
