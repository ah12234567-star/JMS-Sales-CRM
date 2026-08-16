/* Resolve Ready Goods Notice records saved inside the app DB when db is not exposed on window. */
(function(){
  'use strict';

  function findNotice(value,id,seen){
    if(value==null)return null;
    if(typeof value!=='object')return null;
    seen=seen||new WeakSet();
    if(seen.has(value))return null;
    seen.add(value);
    if(value.id===id && Array.isArray(value.items) && value.number)return value;
    if(Array.isArray(value)){
      for(const entry of value){const hit=findNotice(entry,id,seen);if(hit)return hit;}
      return null;
    }
    for(const key of Object.keys(value)){
      const hit=findNotice(value[key],id,seen);if(hit)return hit;
    }
    return null;
  }

  function lookupStorage(id){
    const stores=[window.localStorage,window.sessionStorage];
    for(const store of stores){
      if(!store)continue;
      for(let i=0;i<store.length;i++){
        const key=store.key(i);
        if(!key)continue;
        try{
          const raw=store.getItem(key);
          if(!raw || raw.indexOf(id)===-1)continue;
          const parsed=JSON.parse(raw);
          const notice=findNotice(parsed,id);
          if(notice)return notice;
        }catch(_){ }
      }
    }
    return null;
  }

  function exposeNotice(id){
    if(window.db?.readyGoodsNotices?.some?.(n=>n.id===id))return true;
    const notice=lookupStorage(id);
    if(!notice)return false;
    const existing=window.db && typeof window.db==='object' ? window.db : {};
    const list=Array.isArray(existing.readyGoodsNotices)?existing.readyGoodsNotices.slice():[];
    if(!list.some(n=>n.id===id))list.push(notice);
    existing.readyGoodsNotices=list;
    window.db=existing;
    return true;
  }

  function install(){
    const api=window.JMSReadyGoods;
    if(!api || !String(api.__pdfFix||'').startsWith('20260816-production-'))return setTimeout(install,200);
    if(api.__pdfStorageFix==='20260816-2')return;
    const exportPdf=api.exportPdf;
    const share=api.share;
    api.exportPdf=function(id){exposeNotice(id);return exportPdf.call(this,id);};
    api.share=function(id){exposeNotice(id);return share.call(this,id);};
    api.__pdfStorageFix='20260816-2';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,500));
  else setTimeout(install,500);
})();
