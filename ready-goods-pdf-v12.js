/* JMS Ready Goods PDF — Server-side production renderer v14 */
(function(){
'use strict';
const token=()=>sessionStorage.getItem('jms_auth_token')||'';
const dbRef=()=>{try{return db}catch(_){return window.db||{}}};
function notice(id){return(dbRef().readyGoodsNotices||[]).find(x=>String(x.id)===String(id))}
async function pdfBlob(id){
  const t=token();if(!t)throw new Error('auth_required');
  const r=await fetch('/api/ready-goods-pdf',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({id}),cache:'no-store'});
  if(!r.ok){let msg='pdf_generation_failed';try{const x=await r.json();msg=x.message||x.error||msg}catch(_){try{msg=await r.text()}catch(__){}}throw new Error(msg)}
  return r.blob();
}
async function exportPdf(id){
  const n=notice(id);if(!n)return alert('تعذر العثور على الإشعار');
  try{
    const b=await pdfBlob(id),u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=`${n.number||'ready-goods'}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);
  }catch(e){console.error('ready goods PDF failed',e);alert('تعذر إنشاء ملف PDF — '+(e.message||'خطأ غير معروف'))}
}
async function share(id){
  const n=notice(id);if(!n)return alert('تعذر العثور على الإشعار');
  try{
    const b=await pdfBlob(id),file=new File([b],`${n.number||'ready-goods'}.pdf`,{type:'application/pdf'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'إشعار بضاعة جاهزة',files:[file]});return}
    const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);
  }catch(e){console.error('ready goods share failed',e);alert('تعذر تجهيز ملف المشاركة — '+(e.message||'خطأ غير معروف'))}
}
function install(){if(!window.JMSReadyGoods){setTimeout(install,150);return}window.JMSReadyGoods.exportPdf=exportPdf;window.JMSReadyGoods.share=share;window.JMSReadyGoods.__pdfFix='20260818-server-pdf-v14'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,250));else setTimeout(install,250);
})();
