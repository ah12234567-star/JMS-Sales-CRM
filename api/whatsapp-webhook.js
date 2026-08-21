import crypto from 'node:crypto';

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function verifyMetaSignature(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return process.env.NODE_ENV !== 'production';

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

    // Acknowledge immediately so Meta does not retry. Message processing and
    // AI replies will be added only after tokens and human-handoff rules are set.
    const entries = Array.isArray(req.body?.entry) ? req.body.entry.length : 0;
    console.info('WhatsApp webhook received', { entries });
    return sendJson(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}
