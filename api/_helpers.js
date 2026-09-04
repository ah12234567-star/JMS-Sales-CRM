export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}
export function allowMethods(req, res, methods = ["POST"]) {
  if (req.method === "OPTIONS") { sendJson(res, 200, { ok: true }); return false; }
  if (!methods.includes(req.method)) { sendJson(res, 405, { ok: false, error: "Method not allowed" }); return false; }
  return true;
}
export async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
export function compactCrmData(data = {}) {
  return {
    customers: (data.customers || []).slice(0, 300).map(c => ({id:c.id,name:c.name,phone:c.phone||c.mobile,city:c.city,district:c.district,location:c.location,rep_id:c.rep_id,debt_balance:Number(c.debt_balance||0),credit_limit:Number(c.credit_limit||0),category:c.category,status:c.status,notes:c.notes})),
    reps: (data.reps || []).slice(0, 100).map(r => ({id:r.id,name:r.name,email:r.email,role:r.role,status:r.status})),
    visits: (data.visits || []).slice(0, 700).map(v => ({id:v.id,customer_id:v.customer_id,rep_id:v.rep_id,date:v.date||v.created_at,checkin_at:v.checkin_at,checkout_at:v.checkout_at,result:v.result,notes:v.notes})),
    quotes: (data.quotes || []).slice(0, 700).map(q => ({id:q.id,quote_no:q.quote_no||q.number,customer_id:q.customer_id,rep_id:q.rep_id,date:q.date||q.created_at,status:q.status,total:Number(q.total||q.grand_total||q.total_amount||0),product:q.product,material:q.material,thickness:q.thickness,quantity:Number(q.quantity||q.total_kg||0),price_kg:Number(q.price_kg||0)})),
    orders: (data.orders || []).slice(0, 700).map(o => ({id:o.id,customer_id:o.customer_id,rep_id:o.rep_id,date:o.date||o.created_at,status:o.status,total:Number(o.total||o.amount_value||o.total_amount||0),product:o.product,material:o.material,quantity:Number(o.quantity||o.total_kg||0),price_kg:Number(o.price_kg||0)})),
    collections: (data.collections || []).slice(0, 700).map(c => ({id:c.id,customer_id:c.customer_id,rep_id:c.rep_id,amount:Number(c.amount||0),date:c.date||c.created_at,method:c.method,notes:c.notes}))
  };
}
