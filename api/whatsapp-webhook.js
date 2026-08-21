import crypto from 'node:crypto';

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function verifyMetaSignature(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // Temporary Cloud API test-number mode. No privileged action is performed
    // unless a server-side access token is also configured.
    return req.body?.object === 'whatsapp_business_account'
      && Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  }

  const signature = String(req.headers['x-hub-signature-256'] || '');
  if (!signature.startsWith('sha256=')) return false;

  const rawBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body || {});
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function incomingMessages(body) {
  const result = [];
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const message of value?.messages || []) {
        if (phoneNumberId && message?.from && message?.id) {
          result.push({ phoneNumberId, message });
        }
      }
    }
  }
  return result;
}

async function sendText({ phoneNumberId, to, text }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('missing_whatsapp_access_token');

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: text,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`whatsapp_send_failed_${response.status}: ${detail.slice(0, 500)}`);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = String(req.query?.['hub.mode'] || '');
    const token = String(req.query?.['hub.verify_token'] || '');
    const challenge = String(req.query?.['hub.challenge'] || '');
    const expectedHash = process.env.WHATSAPP_VERIFY_TOKEN_HASH || '23fa184ac49c5f11b9880a7cb345a27fd3fc661fd407b44a0f9100595e5d686e';
    const receivedHash = crypto.createHash('sha256').update(token).digest('hex');

    if (mode === 'subscribe' && token && receivedHash === expectedHash) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(challenge);
    }
    return sendJson(res, 403, { ok: false, error: 'verification_failed' });
  }

  if (req.method === 'POST') {
    if (!verifyMetaSignature(req)) {
      return sendJson(res, 401, { ok: false, error: 'invalid_signature' });
    }

    const messages = incomingMessages(req.body);
    for (const item of messages.slice(0, 3)) {
      try {
        await sendText({
          phoneNumberId: item.phoneNumberId,
          to: item.message.from,
          text: 'أهلًا بك في شركة جدة النموذجي للصناعة 👋\nتم استلام رسالتك بنجاح. هذا رد تجريبي من نظام JMS.',
        });
      } catch (error) {
        console.error('WhatsApp reply failed', {
          messageId: item.message.id,
          error: error?.message || String(error),
        });
      }
    }

    console.info('WhatsApp webhook processed', { messages: messages.length });
    return sendJson(res, 200, { ok: true, messages: messages.length });
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}
