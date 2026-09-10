/* JMS Ready Goods PDF — Server-side production renderer v15 */
(function(){
'use strict';
const token=()=>sessionStorage.getItem('jms_auth_token')||'';
const dbRef=()=>{try{return db}catch(_){return window.db||{}}};
function notice(id){return(dbRef().readyGoodsNotices||[]).find(x=>String(x.id)===String(id))}
function officialLogo(){
  let logo=window.JMS_COMPANY_DOCUMENT_LOGO||'';
  if(!logo){try{logo=localStorage.getItem('jms_official_quote_logo_v1')||''}catch(_){}}
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(logo)?logo:'';
}
async function requestPdf(id){
  const t=token();if(!t)throw new Error('auth_required');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
  let r;try{r=await fetch('/api/ready-goods-pdf-v15',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({id,logoData:officialLogo()}),cache:'no-store',signal:controller.signal});}finally{clearTimeout(timeout)}
  if(!r.ok){let msg='pdf_generation_failed';try{const x=await r.json();msg=x.message||x.error||msg}catch(_){try{msg=await r.text()}catch(__){}}throw new Error(msg)}
  const type=(r.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('application/pdf'))throw new Error('invalid_pdf_response');
  return r.blob();
}
// Session-only cache, keyed by current record, branding and signed-in session.
const files=new Map();
function pdfBlob(id){
  const key=JSON.stringify([token(),notice(id),officialLogo()]);
  const old=files.get(key);
  if(old&&Date.now()-old.time<30000)return old.promise;
  const entry={time:Date.now(),promise:requestPdf(id)};
  files.set(key,entry);
  entry.promise.catch(()=>{if(files.get(key)===entry)files.delete(key)});
  while(files.size>4)files.delete(files.keys().next().value);
  return entry.promise;
}
let activeDialog=null;
function download(file){
  const u=URL.createObjectURL(file),a=document.createElement('a');
  a.href=u;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),60000);
}
async function prepare(id,wantsShare){
  const n=notice(id);if(!n)return alert('تعذر العثور على الإشعار');
  if(activeDialog){activeDialog.focus();return}
  const box=document.createElement('dialog');
  box.dir='rtl';
  box.style.cssText='border:0;border-radius:18px;padding:24px;width:min(88vw,380px);font-family:inherit;text-align:center';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='جاري تجهيز ملف PDF…';
  const action=document.createElement('button');action.textContent=wantsShare?'مشاركة الملف':'تنزيل PDF';action.disabled=true;
  action.style.cssText='padding:14px 22px;border:0;border-radius:12px;background:#143ded;color:white;font:inherit;width:100%';
  const close=document.createElement('button');close.textContent='إغلاق';close.style.cssText='margin-top:14px;padding:10px;font:inherit';
  close.onclick=()=>box.close();
  box.append(status,action,close);document.body.appendChild(box);activeDialog=box;
  box.addEventListener('close',()=>{if(activeDialog===box)activeDialog=null;box.remove()});
  box.showModal();
  try{
    const b=await pdfBlob(id);
    if(!box.open)return;
    const file=new File([b],`${n.number||'ready-goods'}.pdf`,{type:'application/pdf'});
    status.textContent='الملف جاهز';
    action.disabled=false;
    action.onclick=async()=>{
      action.disabled=true;
      try{
        if(wantsShare&&navigator.share&&navigator.canShare?.({files:[file]})){
          await navigator.share({title:'إشعار بضاعة جاهزة',files:[file]});
        }else download(file);
        box.close();
      }catch(e){
        if(e.name!=='AbortError')status.textContent='تعذرت المشاركة. حاول مرة أخرى أو نزّل الملف.';
        action.disabled=false;
      }
    };
    if(!wantsShare){download(file);box.close()}
  }catch(e){
    if(!box.open)return;
    status.textContent=e.name==='AbortError'?'استغرق التجهيز وقتًا طويلًا. حاول مرة أخرى.':'تعذر تجهيز الملف. حاول مرة أخرى.';
    action.textContent='إعادة المحاولة';action.disabled=false;
    action.onclick=()=>{box.close();prepare(id,wantsShare)};
  }
}
function exportPdf(id){return prepare(id,false)}
function share(id){return prepare(id,true)}
function install(){if(!window.JMSReadyGoods){setTimeout(install,150);return}window.JMSReadyGoods.exportPdf=exportPdf;window.JMSReadyGoods.share=share;window.JMSReadyGoods.__pdfFix='20260910-server-pdf-fast-share'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,250));else setTimeout(install,250);
})();
