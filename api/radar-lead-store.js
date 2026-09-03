import crypto from 'node:crypto';
import { supabase } from './auth-utils.js';

const RADAR_RECORD_TYPE = 'radar_lead';

function clean(value){
  return String(value ?? '').trim();
}

function normalizeText(value){
  return clean(value)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/(^|\s)(شركة|شركه|مؤسسة|موسسه|مؤسسه)(?=\s|$)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value){
  let phone = clean(value).replace(/\D/g, '');
  if(phone.startsWith('00966')) phone = phone.slice(2);
  if(phone.startsWith('966')) return phone;
  if(phone.startsWith('05') && phone.length === 10) return '966' + phone.slice(1);
  if(phone.startsWith('5') && phone.length === 9) return '966' + phone;
  return phone;
}

function normalizeUrl(value){
  const raw = clean(value);
  if(!raw) return '';
  try{
    const url = new URL(raw);
    const placeId = url.searchParams.get('query_place_id') || url.searchParams.get('place_id') || url.searchParams.get('cid');
    if(placeId) return `${url.hostname.toLowerCase()}|${placeId.toLowerCase()}`;
    return `${url.hostname.toLowerCase()}${decodeURIComponent(url.pathname).replace(/\/$/, '').toLowerCase()}`;
  }catch(_){
    return normalizeText(raw);
  }
}

export function leadSignatures(lead){
  const signatures = [];
  const phone = normalizePhone(lead?.phone || lead?.mobile);
  const maps = normalizeUrl(lead?.maps_url || lead?.map_url);
  const name = normalizeText(lead?.name || lead?.title);
  const city = normalizeText(lead?.city);
  const area = normalizeText(lead?.area || lead?.district);
  if(phone) signatures.push(`phone:${phone}`);
  if(maps) signatures.push(`maps:${maps}`);
  if(name) signatures.push(`name:${name}|city:${city}|area:${area}`);
  return [...new Set(signatures)];
}

export function sameLead(a, b){
  const left = leadSignatures(a);
  const right = new Set(leadSignatures(b));
  const aName = normalizeText(a?.name || a?.title);
  const bName = normalizeText(b?.name || b?.title);
  const aCity = normalizeText(a?.city);
  const bCity = normalizeText(b?.city);
  const aArea = normalizeText(a?.area || a?.district);
  const bArea = normalizeText(b?.area || b?.district);
  const sameName = Boolean(aName && aName === bName);
  const differentExplicitBranch = sameName && aArea && bArea && aArea !== bArea;

  const sharedMap = left.some(key => key.startsWith('maps:') && right.has(key));
  if(sharedMap) return true;
  if(differentExplicitBranch) return false;

  const sharedPhone = left.some(key => key.startsWith('phone:') && right.has(key));
  if(sharedPhone) return true;
  if(!sameName) return false;
  if(aCity && bCity && aCity !== bCity) return false;
  return true;
}

function recordId(lead){
  const signatures = leadSignatures(lead);
  // Prefer branch identity so two simultaneous searches for the same business
  // converge on one database row even when one result omits the phone number.
  const key = signatures.find(item => item.startsWith('name:')) || signatures[0] || `name:${normalizeText(lead?.name)}|city:${normalizeText(lead?.city)}`;
  return `radar-lead-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
}

export async function listRadarLeads(){
  const rows = await supabase('jms_routes?select=id,data,updated_at&order=updated_at.desc');
  return (rows || [])
    .map(row => ({...row.data, id:row.data?.id || row.id, _cloud_updated_at:row.updated_at}))
    .filter(item => item.record_type === RADAR_RECORD_TYPE || String(item.id || '').startsWith('radar-lead-'));
}

export async function listGlobalCustomers(){
  const rows = await supabase('jms_customers?select=id,data,updated_at&order=updated_at.desc');
  return (rows || []).map(row => ({...row.data, id:row.data?.id || row.id, _cloud_updated_at:row.updated_at}));
}

export async function reserveRadarLead(rawLead, auth, requestedRepId = ''){
  const current = await listRadarLeads();
  const existing = current.find(item => sameLead(item, rawLead));
  if(existing) return {created:false, conflict:true, lead:existing};

  const now = new Date().toISOString();
  const assignedRepId = auth.role === 'rep' ? String(auth.id) : clean(requestedRepId);
  const id = recordId(rawLead);
  const lead = {
    ...rawLead,
    id,
    record_type:RADAR_RECORD_TYPE,
    assigned_rep_id:assignedRepId,
    owner_rep_id:assignedRepId,
    reserved_by:String(auth.id),
    reserved_at:now,
    created_at:rawLead?.created_at || now,
    updated_at:now,
    signatures:leadSignatures(rawLead)
  };
  const inserted = await supabase('jms_routes?on_conflict=id', {
    method:'POST',
    headers:{Prefer:'resolution=ignore-duplicates,return=representation'},
    body:JSON.stringify([{id, data:lead, updated_at:now}])
  });
  if(Array.isArray(inserted) && inserted.length) return {created:true, conflict:false, lead};

  const winner = (await listRadarLeads()).find(item => String(item.id) === id || sameLead(item, lead));
  return {created:false, conflict:true, lead:winner || lead};
}

export async function updateRadarLead(id, changes, auth){
  const current = (await listRadarLeads()).find(item => String(item.id) === String(id));
  if(!current) return {ok:false, status:404, error:'lead_not_found'};
  if(auth.role === 'rep' && String(current.assigned_rep_id || '') !== String(auth.id)){
    return {ok:false, status:403, error:'lead_owned_by_another_rep'};
  }
  const allowed = {};
  if(Object.hasOwn(changes || {}, 'status')) allowed.status = clean(changes.status);
  if(Object.hasOwn(changes || {}, 'converted_at')) allowed.converted_at = clean(changes.converted_at);
  if(auth.role !== 'rep' && Object.hasOwn(changes || {}, 'assigned_rep_id')){
    allowed.assigned_rep_id = clean(changes.assigned_rep_id);
    allowed.owner_rep_id = clean(changes.assigned_rep_id);
    allowed.reassigned_by = String(auth.id);
    allowed.reassigned_at = new Date().toISOString();
  }
  const updated = {...current, ...allowed, updated_at:new Date().toISOString()};
  await supabase('jms_routes?on_conflict=id', {
    method:'POST',
    headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify([{id:String(updated.id), data:updated, updated_at:updated.updated_at}])
  });
  return {ok:true, lead:updated};
}
