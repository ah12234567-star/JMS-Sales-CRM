
import { sendJson, allowMethods, readBody } from "./_helpers.js";
export default async function handler(req, res) {
  if (req.method === "GET") return sendJson(res, 200, { ok: true, route: "/api/web-search", message: "JMS web search backend is running. Use POST." });
  if (!allowMethods(req, res, ["POST"])) return;
  try {
    const { query } = await readBody(req);
    if (!query) return sendJson(res, 400, { ok: false, error: "query is required" });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return sendJson(res, 200, { ok: false, error: "OPENAI_API_KEY is not configured" });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", tools: [{ type: "web_search_preview" }], input: `ابحث في الويب وأجب بالعربية بشكل عملي ومختصر. السؤال: ${query}` })
    });
    const result = await response.json();
    if (!response.ok) return sendJson(res, 500, { ok: false, error: result.error?.message || "Web search error", details: result });
    return sendJson(res, 200, { ok: true, answer: result.output_text || "لم يصل رد واضح." });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || String(err) });
  }
}
