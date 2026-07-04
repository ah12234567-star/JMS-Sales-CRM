import { json } from './auth-utils.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  return json(res, 400, {ok:false,error:'reset_not_configured', message:'استعادة كلمة المرور غير مفعلة بعد'});
}
