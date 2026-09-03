import crypto from 'node:crypto';
import { authFromRequest, supabase } from './auth-utils.js';

export function clean(value,max=200){return String(value??'').trim().slice(0,max)}
export function normalizePhone(value){
  let phone=clean(value,30).replace(/\D/g,'');
  if(phone.startsWith('00966'))phone=phone.slice(2);
  if(phone.startsWith('05')&&phone.length===10)phone='966'+phone.slice(1);
  if(phone.startsWith('5')&&phone.length===9)phone='966'+phone;
  return phone;
}
export function validSaudiMobile(phone){return /^9665\d{8}$/.test(normalizePhone(phone))}
export function shortHash(value){return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,24)}
export function otpRecordId(phone){return `customer-otp-${shortHash(normalizePhone(phone))}`}
function authSecret(){const secret=String(process.env.AUTH_SECRET||'').trim();if(secret.length<32)throw new Error('missing_or_weak_auth_secret');return secret}
export function otpHash(phone,code,nonce){return crypto.createHmac('sha256',authSecret()).update(`${normalizePhone(phone)}:${code}:${nonce}`).digest('hex')}
export function safeEqual(a,b){const left=Buffer.from(String(a)),right=Buffer.from(String(b));return left.length===right.length&&crypto.timingSafeEqual(left,right)}
export function storePrivate(){return String(process.env.STORE_PRIVATE||'true').toLowerCase()!=='false'}
export function customerAuth(req){const auth=authFromRequest(req);return auth?.role==='customer'&&validSaudiMobile(auth.phone)?auth:null}
export function setupAdmin(req){const auth=authFromRequest(req);return auth?.role==='admin'?auth:null}

export async function getOtpRecord(phone){
  const id=otpRecordId(phone),rows=await supabase(`jms_routes?id=eq.${encodeURIComponent(id)}&select=id,data,updated_at&limit=1`);
  return rows?.[0]?.data||null;
}
export async function saveOtpRecord(phone,data){
  const id=otpRecordId(phone),now=new Date().toISOString(),record={id,record_type:'customer_otp',phone:normalizePhone(phone),...data,updated_at:now};
  await supabase('jms_routes?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id,data:record,updated_at:now}])});
  return record;
}
export async function customerRowByPhone(phone){
  const normalized=normalizePhone(phone),rows=await supabase('jms_customers?select=id,data,updated_at&order=updated_at.desc');
  return (rows||[]).find(row=>normalizePhone(row.data?.phone||row.data?.mobile)===normalized)||null;
}
export function safeCustomer(row,phone){
  const data=row?.data||{};
  return {id:row?.id||data.id||`store-customer-${shortHash(phone)}`,name:clean(data.name,120),phone:normalizePhone(phone),email:clean(data.email,160),city:clean(data.city,80)||'جدة',district:clean(data.district,120),address:clean(data.location||data.address,300)};
}
