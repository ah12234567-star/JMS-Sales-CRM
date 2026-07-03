
import { sendJson, allowMethods, readBody } from "./_helpers.js";
function normalizeSaudiPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  return "966" + digits.replace(/^0/, "");
}
export default async function handler(req, res) {
  if (req.method === "GET") return sendJson(res, 200, { ok: true, route: "/api/whatsapp-send", message: "JMS WhatsApp backend is running. Use POST." });
  if (!allowMethods(req, res, ["POST"])) return;
  try {
    const { phone, message, previewOnly = false } = await readBody(req);
    const to = normalizeSaudiPhone(phone);
    if (!to) return sendJson(res, 400, { ok: false, error: "phone is required" });
    if (!message) return sendJson(res, 400, { ok: false, error: "message is required" });
    if (previewOnly) return sendJson(res, 200, { ok: true, previewOnly: true, to, url: `https://wa.me/${to}?text=${encodeURIComponent(message)}` });
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) return sendJson(res, 200, { ok: false, mode: "fallback_link", error: "WhatsApp Cloud API variables are not configured", url: `https://wa.me/${to}?text=${encodeURIComponent(message)}` });
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body: message } })
    });
    const result = await response.json();
    if (!response.ok) return sendJson(res, 500, { ok: false, mode: "whatsapp_error", error: result.error?.message || "WhatsApp API error", details: result, url: `https://wa.me/${to}?text=${encodeURIComponent(message)}` });
    return sendJson(res, 200, { ok: true, to, result });
  } catch (err) {
    return sendJson(res, 500, { ok: false, mode: "server_error", error: err.message || String(err) });
  }
}
