(function(){
'use strict';
const VERSION='2026-09-04-offline-sync-ai-overlay-fix';
const STORE_KEY='jms_factory_crm_pro_v4';
const DB_NAME='jms_crm_offline';
const DB_VERSION=1;
const SNAPSHOTS='snapshots';
const META='meta';
let lastSeen='';
let syncTimer=0;
let originalPush=null;
let wrappedPush=null;

function openDB(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)) return reject(new Error('indexeddb_unavailable'));
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(SNAPSHOTS))db.createObjectStore(SNAPSHOTS,{keyPath:'id'});
   if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('indexeddb_open_failed'));
 });
}

async function put(store,value){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,'readwrite');
  tx.objectStore(store).put(value);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onerror=()=>{const e=tx.error;db.close();reject(e)};
 });
}
async function get(store,key){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,'readonly');
  const req=tx.objectStore(store).get(key);
  req.onsuccess=()=>{const v=req.result;db.close();resolve(v)};
  req.onerror=()=>{const e=req.error;db.close();reject(e)};
 });
}

function localSnapshot(){
 try{return localStorage.getItem(STORE_KEY)||''}catch(_){return ''}
}
function hash(value){
 let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16);
}
async function backup(reason){
 const raw=localSnapshot();if(!raw)return;
 const signature=hash(raw);
 if(signature===lastSeen&&reason!=='beforeunload')return;
 lastSeen=signature;
 try{
  await put(SNAPSHOTS,{id:'latest',raw,signature,updated_at:new Date().toISOString(),reason});
  await put(META,{key:'pending_sync',value:true,updated_at:new Date().toISOString()});
  updateBadge();
 }catch(error){console.warn('JMS offline backup failed',error)}
}
async function markSynced(){
 try{await put(META,{key:'pending_sync',value:false,updated_at:new Date().toISOString()});updateBadge()}catch(_){}
}
async function hasPending(){
 try{return Boolean((await get(META,'pending_sync'))?.value)}catch(_){return false}
}

function updateBadge(){
 let badge=document.getElementById('jmsOfflineBadge');
 if(!badge){
  badge=document.createElement('div');badge.id='jmsOfflineBadge';document.body.appendChild(badge);
 }
 const online=navigator.onLine;
 hasPending().then(pending=>{
  badge.className=online?(pending?'pending':'online'):'offline';
  badge.textContent=!online?'بدون إنترنت · محفوظ محلياً':pending?'متصل · جاري المزامنة':'متصل · تمت المزامنة';
 });
}

function installStyle(){
 if(document.getElementById('jmsOfflineStyle'))return;
 const style=document.createElement('style');style.id='jmsOfflineStyle';
 style.textContent=`
 #jmsOfflineBadge{position:fixed;z-index:70;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));padding:7px 10px;border-radius:999px;font-size:11px;font-weight:900;box-shadow:0 8px 24px #0002;pointer-events:none!important;transition:.2s}
 #jmsOfflineBadge.online{background:#dcfce7;color:#166534}
 #jmsOfflineBadge.pending{background:#fef3c7;color:#92400e}
 #jmsOfflineBadge.offline{background:#fee2e2;color:#991b1b}
 .jms-connection{pointer-events:none!important}
 #jmsAI .jms-ai-chat{position:relative;padding-bottom:calc(120px + env(safe-area-inset-bottom))}
 #jmsAI .jms-ai-input{position:sticky;bottom:calc(88px + env(safe-area-inset-bottom));z-index:100500!important;background:#fff;padding:10px 12px;border-radius:18px;box-shadow:0 -8px 24px rgba(15,23,42,.08)}
 #jmsAI .jms-ai-input input{position:relative;z-index:100501!important}
 #jmsAI .jms-ai-input button{position:relative;z-index:100502!important;pointer-events:auto!important;touch-action:manipulation}
 @media(max-width:620px){
   #jmsOfflineBadge{left:8px;bottom:calc(152px + env(safe-area-inset-bottom));font-size:10px}
   #jmsAI .jms-ai-chat{padding-bottom:calc(145px + env(safe-area-inset-bottom))}
   #jmsAI .jms-ai-input{bottom:calc(96px + env(safe-area-inset-bottom));margin-bottom:8px}
 }
 `;
 document.head.appendChild(style);
}

async function restoreIfNeeded(){
 const local=localSnapshot();if(local){lastSeen=hash(local);return}
 try{
  const snap=await get(SNAPSHOTS,'latest');
  if(snap?.raw){localStorage.setItem(STORE_KEY,snap.raw);lastSeen=snap.signature||hash(snap.raw);location.reload()}
 }catch(error){console.warn('JMS offline restore failed',error)}
}

function hookPush(){
 const current=window.pushCloudData;
 if(typeof current!=='function'||current===wrappedPush)return;
 originalPush=current;
 wrappedPush=async function(){
  await backup('cloud_push');
  if(!navigator.onLine){updateBadge();return {ok:false,offline:true,queued:true}}
  try{
   const result=await originalPush.apply(this,arguments);
   await markSynced();
   return result;
  }catch(error){
   await backup('sync_failed');updateBadge();throw error;
  }
 };
 window.pushCloudData=wrappedPush;
}

async function syncNow(){
 clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{
  hookPush();
  if(!navigator.onLine)return updateBadge();
  const pending=await hasPending();
  if(!pending)return updateBadge();
  if(typeof window.pushCloudData==='function'){
   try{await window.pushCloudData()}catch(error){console.warn('JMS auto sync failed',error)}
  }
  updateBadge();
 },500);
}

function watchLocalChanges(){
 setInterval(()=>{
  const raw=localSnapshot();if(!raw)return;
  const signature=hash(raw);
  if(signature!==lastSeen)backup('local_change');
  hookPush();
 },1000);
}

async function boot(){
 installStyle();
 await restoreIfNeeded();
 await backup('startup');
 hookPush();watchLocalChanges();updateBadge();
 window.addEventListener('online',()=>{updateBadge();syncNow()});
 window.addEventListener('offline',()=>{backup('went_offline');updateBadge()});
 window.addEventListener('beforeunload',()=>{backup('beforeunload')});
 if(navigator.onLine)syncNow();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.jmsOfflineSync={version:VERSION,backup,syncNow,status:async()=>({online:navigator.onLine,pending:await hasPending()})};
})();
