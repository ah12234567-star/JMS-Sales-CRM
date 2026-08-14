import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvwjwakkimnveveglxwa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_jN3PnVaj7uarVnJRvBmx-g_zIKhl1UP';

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length >= 32 && crypto.timingSafeEqual(a, b);
}

function publicQuote(data) {
  return {
    id: data.id,
    quote_no: data.quote_no,
    date: data.date,
    valid_until: data.valid_until,
    status: data.status,
    customer_name: data.customer_name || '',
    product: data.product,
    material: data.material,
    color: data.color,
    print: data.print,
    width: data.width,
    length: data.length,
    size_unit: data.size_unit,
    thickness: data.thickness,
    thickness_unit: data.thickness_unit,
    total_kg: data.total_kg,
    price_kg: data.price_kg,
    total_amount: data.total_amount,
    piece_weight: data.piece_weight,
    pieces: data.pieces,
    payment_terms: data.payment_terms,
    delivery_terms: data.delivery_terms,
    notes: data.notes
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({error:'method_not_allowed'});
  const id = String(req.query.id || '').trim();
  const token = String(req.query.token || '').trim();
  if (!id || !token || id.length > 160 || token.length > 160) return res.status(400).json({error:'invalid_request'});
  try {
    const url = SUPABASE_URL + '/rest/v1/jms_quotes?id=eq.' + encodeURIComponent(id) + '&select=id,data&limit=1';
    const response = await fetch(url, {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
    if (!response.ok) return res.status(503).json({error:'quote_service_unavailable'});
    const rows = await response.json();
    const row = rows && rows[0];
    if (!row || !safeEqual(row.data && row.data.public_token, token)) return res.status(404).json({error:'quote_not_found'});
    return res.status(200).json({quote:publicQuote({...row.data,id:row.data.id||row.id})});
  } catch (error) {
    console.error('public quote lookup failed', error);
    return res.status(500).json({error:'internal_error'});
  }
}
