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
async function pdfBlob(id){
  const t=token();if(!t)throw new Error('auth_required');
  const r=await fetch('/api/ready-goods-pdf-v15',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({id,logoData:officialLogo()}),cache:'no-store'});
  if(!r.ok){let msg='pdf_generation_failed';try{const x=await r.json();msg=x.message||x.error||msg}catch(_){try{msg=await r.text()}catch(__){}}throw new Error(msg)}
  const type=(r.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('application/pdf'))throw new Error('invalid_pdf_response');
  return r.blob();
}
async function exportPdf(id){
  const n=notice(id);if(!n)return alert('تعذر العثور على الإشعار');
  try{
    const b=await pdfBlob(id),u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=`${n.number||'ready-goods'}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);
  }catch(e){console.error('ready goods PDF failed',e);alert('تعذر إنشاء ملف PDF — '+(e.message||'خطأ غير معروف'))}
}
async function share(id){
  const n=notice(id);if(!n)return alert('تعذر العثور على الإشعار');
  try{
    const b=await pdfBlob(id),file=new File([b],`${n.number||'ready-goods'}.pdf`,{type:'application/pdf'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'إشعار بضاعة جاهزة',files:[file]});return}
    const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);
  }catch(e){console.error('ready goods share failed',e);alert('تعذر تجهيز ملف المشاركة — '+(e.message||'خطأ غير معروف'))}
}
function install(){if(!window.JMSReadyGoods){setTimeout(install,150);return}window.JMSReadyGoods.exportPdf=exportPdf;window.JMSReadyGoods.share=share;window.JMSReadyGoods.__pdfFix='20260819-server-pdf-v15'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,250));else setTimeout(install,250);
})();
