import { json } from './auth-utils.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
  return json(res, 200, {ok:true, message:'ميزة رمز الاستعادة تحتاج إعداد WhatsApp/SMS لاحقًا'});
}
