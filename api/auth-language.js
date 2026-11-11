import {json, authFromRequest, readBody, supabase} from './auth-utils.js';

// Account preferences never accept a browser-supplied user ID, role or permissions.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  const auth = authFromRequest(req);
  if (!auth) return json(res, 401, {ok:false,error:'unauthorized'});
  try {
    const {language} = await readBody(req);
    if (!['ar','en'].includes(language)) return json(res, 400, {ok:false,error:'invalid_language'});
    const filter = 'id=eq.' + encodeURIComponent(auth.id);
    const rows = await supabase('jms_users?' + filter + '&select=id,data&limit=1');
    if (!rows?.[0]) return json(res, 401, {ok:false,error:'user_not_found'});
    if (rows[0].data?.status && rows[0].data.status !== 'active') return json(res, 403, {ok:false,error:'user_disabled'});
    // PATCH only this column: concurrent permission/password changes cannot be overwritten.
    const updated = await supabase('jms_users?' + filter + '&select=id,language', {
      method:'PATCH', body:JSON.stringify({language})
    });
    if (!updated?.[0] || updated[0].id !== auth.id) return json(res, 409, {ok:false,error:'user_changed'});
    return json(res, 200, {ok:true,language:updated[0].language});
  } catch (error) {
    console.error('auth-language failed:', error);
    return json(res, 500, {ok:false,error:'server_error'});
  }
}
