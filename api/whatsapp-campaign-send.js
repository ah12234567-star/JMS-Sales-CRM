import { sendJson, allowMethods, readBody } from './_helpers.js';

function normalizePhone(phone){
  const digits = String(phone || '').replace(/\D/g, '');
  if(!digits) return '';
  if(digits.startsWith('966')) return digits;
  return '966' + digits.replace(/^0/, '');
}

function waLink(to, message){
  return `https://wa.me/${to}?text=${encodeURIComponent(message || '')}`;
}

async function sendWhatsAppText({to, message, token, phoneNumberId}){
  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: message }
    })
  });
  const result = await response.json().catch(()=>({}));
  if(!response.ok){
    return { ok:false, mode:'whatsapp_error', error: result?.error?.message || 'WhatsApp API error', details: result, url: waLink(to, message) };
  }
  return { ok:true, mode:'whatsapp_cloud', to, result };
}

export default async function handler(req, res){
  if(req.method === 'GET') return sendJson(res, 200, {ok:true, route:'/api/whatsapp-campaign-send', message:'Use POST with messages[]'});
  if(!allowMethods(req, res, ['POST'])) return;
  try{
    const body = await readBody(req);
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages = rawMessages.slice(0, 50).map(m => ({
      customer_id: m.customer_id || '',
      name: m.name || '',
      phone: normalizePhone(m.phone),
      message: String(m.message || '').slice(0, 3500)
    })).filter(m => m.phone && m.message);

    if(!messages.length) return sendJson(res, 400, {ok:false, error:'no_valid_messages'});

    const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if(body.previewOnly || !token || !phoneNumberId){
      return sendJson(res, 200, {
        ok: !!body.previewOnly,
        mode: 'fallback_link',
        error: (!token || !phoneNumberId) ? 'WhatsApp Cloud API variables are not configured' : undefined,
        results: messages.map(m => ({ ok:false, mode:'fallback_link', customer_id:m.customer_id, name:m.name, to:m.phone, url:waLink(m.phone, m.message) }))
      });
    }

    const results = [];
    for(const m of messages){
      try{
        const r = await sendWhatsAppText({to:m.phone, message:m.message, token, phoneNumberId});
        results.push({ customer_id:m.customer_id, name:m.name, to:m.phone, ...r });
      }catch(e){
        results.push({ ok:false, mode:'server_error', customer_id:m.customer_id, name:m.name, to:m.phone, error:e.message || String(e), url:waLink(m.phone, m.message) });
      }
    }
    const okCount = results.filter(r=>r.ok).length;
    return sendJson(res, 200, {ok: okCount === results.length, mode:'whatsapp_cloud', sent:okCount, total:results.length, results});
  }catch(err){
    return sendJson(res, 500, {ok:false, mode:'server_error', error: err.message || String(err)});
  }
}
