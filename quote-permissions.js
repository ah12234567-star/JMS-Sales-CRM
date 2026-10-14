(function(){
  'use strict';
  const deniedMessage='لا تملك صلاحية إنشاء عرض سعر';
  let lastPermissionRefresh=0;
  let permissionRefreshPromise=null;

  function current(){
    try{return typeof currentUser!=='undefined'&&currentUser?currentUser:window.currentUser||null}
    catch(_){return window.currentUser||null}
  }
  function permitted(user){
    if(!user)return false;
    if(['admin','sales'].includes(user.role))return true;
    const permissions=user.permissions||{};
    return permissions.create_quotes===true||permissions.manage_quotes===true;
  }
  function setCurrent(user){
    window.currentUser=user;
    try{currentUser=user}catch(_){}
    try{sessionStorage.setItem('jms_current_user',JSON.stringify(user))}catch(_){}
    try{
      const store=typeof db!=='undefined'?db:window.db;
      if(store?.users){
        const index=store.users.findIndex(item=>item.id===user.id);
        if(index>=0)store.users[index]={...store.users[index],...user,permissions:{...(store.users[index].permissions||{}),...(user.permissions||{})}};
        else store.users.push(user);
      }
    }catch(_){}
  }
  async function canCreate(){
    let user=current();
    if(!user)return false;
    if(['admin','sales'].includes(user.role))return true;

    const token=sessionStorage.getItem('jms_auth_token');
    if(token&&(Date.now()-lastPermissionRefresh>30000)){
      if(!permissionRefreshPromise){
        permissionRefreshPromise=(async()=>{
          try{
            const request=window.jmsPostJson||(typeof jmsPostJson==='function'?jmsPostJson:null);
            if(!request)return false;
            const result=await request('/api/auth-session',{});
            const fresh=result?.user;
            if(!fresh||fresh.id!==user.id)return false;
            user={...user,...fresh,permissions:fresh.permissions||{}};
            setCurrent(user);
            lastPermissionRefresh=Date.now();
            return permitted(user);
          }catch(error){
            console.warn('Unable to refresh quote permissions:',error);
            lastPermissionRefresh=Date.now();
            return false;
          }finally{permissionRefreshPromise=null}
        })();
      }
      if(!await permissionRefreshPromise)return false;
    }
    return permitted(current());
  }
  window.jmsCanCreateQuote=canCreate;

  async function updateCreateButtons(){
    const allowed=await canCreate();
    document.querySelectorAll('.jms-quote-create-nav,#quotes .page-head button').forEach(button=>{
      const text=String(button.textContent||'').trim();
      const isCreate=button.classList.contains('jms-quote-create-nav')||/إنشاء عرض سعر|إنشاء عرض السعر|Create Quotation/i.test(text);
      if(!isCreate)return;
      button.style.display=allowed?'':'none';
      button.disabled=!allowed;
      button.setAttribute('aria-hidden',allowed?'false':'true');
    });
  }
  function guard(name){
    const original=window[name];
    if(typeof original!=='function'||original.jmsQuotePermissionGuard)return;
    const wrapped=async function(){
      if(!await canCreate()){alert(deniedMessage);return}
      return original.apply(this,arguments);
    };
    wrapped.jmsQuotePermissionGuard=true;
    window[name]=wrapped;
  }

  guard('openQuoteForm');
  guard('saveQuote');
  guard('createQuoteFromVisit');

  const oldRender=window.renderAll;
  if(typeof oldRender==='function'){
    window.renderAll=function(){
      const result=oldRender.apply(this,arguments);
      setTimeout(updateCreateButtons,0);
      return result;
    };
  }
  const oldShow=window.showApp;
  if(typeof oldShow==='function'){
    window.showApp=function(){
      const result=oldShow.apply(this,arguments);
      setTimeout(updateCreateButtons,0);
      return result;
    };
  }
  new MutationObserver(()=>{updateCreateButtons()}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',updateCreateButtons);
  window.addEventListener('pageshow',updateCreateButtons);
  setTimeout(updateCreateButtons,0);
})();