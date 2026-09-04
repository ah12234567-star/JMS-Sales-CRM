export default async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  try{
    const origin=`https://${req.headers.host}`;
    const response=await fetch(origin+"/api/ai",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({question:"ابي مجموع ديون كل مندوب لوحده",data:{reps:[{id:"r1",name:"وسام"},{id:"r2",name:"ياسر"}],customers:[{id:"c1",name:"عميل 1",rep_id:"r1",debt_balance:1000},{id:"c2",name:"عميل 2",rep_id:"r1",debt_balance:500},{id:"c3",name:"عميل 3",rep_id:"r2",debt_balance:2000}],visits:[],quotes:[],orders:[],collections:[]}})
    });
    const text=await response.text();
    res.statusCode=response.status;
    return res.end(JSON.stringify({ok:response.ok,status:response.status,body:text}));
  }catch(error){res.statusCode=500;return res.end(JSON.stringify({ok:false,error:error?.message||String(error)}));}
}
