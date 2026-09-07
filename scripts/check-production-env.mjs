const required = [
  'AUTH_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY',
  'META_WHATSAPP_ACCESS_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID',
  'META_WHATSAPP_APP_SECRET','META_WHATSAPP_VERIFY_TOKEN_HASH',
  'META_WHATSAPP_RESET_TEMPLATE','META_WHATSAPP_RESET_LANGUAGE',
  'META_WHATSAPP_OTP_TEMPLATE','META_WHATSAPP_OTP_LANGUAGE','ALLOWED_ORIGIN'
];
const missing = required.filter((key) => !String(process.env[key] || '').trim());
const weak = [];
if (String(process.env.AUTH_SECRET || '').length < 64) weak.push('AUTH_SECRET must contain at least 64 characters');
if (process.env.ALLOWED_ORIGIN === '*') weak.push('ALLOWED_ORIGIN must be the production origin, not *');
if (missing.length || weak.length) {
  if (missing.length) console.error('Missing:', missing.join(', '));
  for (const message of weak) console.error(message);
  process.exit(1);
}
console.log('Production environment validation passed.');
