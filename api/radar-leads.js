import { json, readBody, authFromRequest } from './auth-utils.js';
import { listRadarLeads, listGlobalCustomers, reserveRadarLead, sameLead, updateRadarLead } from './radar-lead-store.js';

export default async function handler(req, res){
  const auth = authFromRequest(req);
  if(!auth) return json(res, 401, {ok:false, error:'unauthorized'});
  try{
    if(req.method === 'GET'){
      const leads = await listRadarLeads();
      const visible = auth.role === 'rep'
        ? leads.filter(lead => String(lead.assigned_rep_id || '') === String(auth.id))
        : leads;
      return json(res, 200, {ok:true, leads:visible});
    }
    if(req.method === 'POST'){
      const body = await readBody(req);
      if(body?.action === 'update'){
        const result = await updateRadarLead(body.id, body.changes || {}, auth);
        return json(res, result.status || (result.ok ? 200 : 400), result);
      }
      if(body?.action === 'reserve'){
        const customers = await listGlobalCustomers();
        if(customers.some(customer => sameLead(customer, body.lead || {}))){
          return json(res, 409, {ok:false, error:'already_a_customer', message:'هذا النشاط موجود مسبقًا ضمن العملاء.'});
        }
        const result = await reserveRadarLead(body.lead || {}, auth, body.assigned_rep_id || '');
        if(!result.created){
          return json(res, 409, {ok:false, error:'lead_already_reserved', message:'هذه الفرصة محجوزة مسبقًا لمندوب آخر.'});
        }
        return json(res, 201, {ok:true, lead:result.lead});
      }
      return json(res, 400, {ok:false, error:'invalid_action'});
    }
    return json(res, 405, {ok:false, error:'method_not_allowed'});
  }catch(error){
    console.error('radar-leads failed', error);
    return json(res, 500, {ok:false, error:'server_error'});
  }
}

