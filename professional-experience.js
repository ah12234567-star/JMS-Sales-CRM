(function(){
  'use strict';
  const VERSION='2026-08-13-professional-experience-1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getDb=()=>{try{return db||{}}catch(_){return window.db||{}}};
  const visible=()=>!document.getElementById('appView')?.classList.contains('hidden');
  function go(page){document.querySelector(`.nav[data-page="${page}"]`)?.click();}

  function toast(message){
    let host=document.getElementById('jmsProToasts');
    if(!host){host=document.createElement('div');host.id='jmsProToasts';document.body.appendChild(host);}
    const item=document.createElement('div');item.className='jms-pro-toast';item.innerHTML=`<i>✓</i><div><b>تم بنجاح</b><span>${esc(message.replace(/^تم\s*/,'')||message)}</span></div>`;host.appendChild(item);
    requestAnimationFrame(()=>item.classList.add('show'));setTimeout(()=>{item.classList.remove('show');setTimeout(()=>item.remove(),250)},3200);
  }
  const nativeAlert=window.alert.bind(window);
  window.alert=function(message){const text=String(message||'');if(/^(تم|تمت|نجح)/.test(text)){toast(text);return;}return nativeAlert(text);};

  function openSearch(){
    let layer=document.getElementById('jmsCommand');
    if(!layer){
      layer=document.createElement('div');layer.id='jmsCommand';layer.className='jms-command hidden';
      layer.innerHTML=`<div class="jms-command-card"><div class="jms-command-head"><div><b>البحث الشامل</b><span>عميل، عرض سعر، رقم عرض أو جوال</span></div><button type="button" aria-label="إغلاق">×</button></div><div class="jms-command-input"><span>⌕</span><input inputmode="search" autocomplete="off" placeholder="ابدأ الكتابة..."></div><div class="jms-command-results"></div><div class="jms-command-foot"><span>JMS Smart Search</span><small>ESC للإغلاق</small></div></div>`;
      document.body.appendChild(layer);layer.querySelector('.jms-command-head button').onclick=closeSearch;layer.addEventListener('click',e=>{if(e.target===layer)closeSearch();});layer.querySelector('input').addEventListener('input',renderSearch);
    }
    layer.classList.remove('hidden');setTimeout(()=>layer.querySelector('input').focus(),30);renderSearch({target:layer.querySelector('input')});
  }
  function closeSearch(){document.getElementById('jmsCommand')?.classList.add('hidden');}
  function renderSearch(event){
    const query=String(event?.target?.value||'').trim().toLowerCase(),data=getDb();let rows=[];
    (data.customers||[]).forEach(c=>{const text=[c.name,c.phone,c.city,c.district].join(' ').toLowerCase();if(!query||text.includes(query))rows.push({type:'عميل',title:c.name||'عميل',meta:[c.phone,c.city].filter(Boolean).join(' · '),action:`openCustomer360('${c.id}')`});});
    (data.quotes||[]).forEach(q=>{const customer=(data.customers||[]).find(c=>c.id===q.customer_id);const text=[q.quote_no,customer?.name,q.product].join(' ').toLowerCase();if(query&&text.includes(query))rows.push({type:'عرض سعر',title:q.quote_no||'عرض سعر',meta:[customer?.name,q.product].filter(Boolean).join(' · '),action:`viewQuote('${q.id}')`});});
    const box=document.querySelector('#jmsCommand .jms-command-results');if(!box)return;
    rows=rows.slice(0,10);box.innerHTML=rows.map(r=>`<button type="button" onclick="${r.action};document.getElementById('jmsCommand').classList.add('hidden')"><i>${r.type==='عميل'?'ع':'س'}</i><div><b>${esc(r.title)}</b><span>${esc(r.meta||r.type)}</span></div><em>${r.type}</em></button>`).join('')||`<div class="jms-command-empty">${query?'لا توجد نتائج مطابقة':'اكتب اسم العميل أو رقم العرض للبحث فورًا'}</div>`;
  }

  function toggleActions(){document.getElementById('jmsQuickMenu')?.classList.toggle('open');}
  function installShell(){
    if(document.getElementById('jmsProShell'))return;
    const shell=document.createElement('div');shell.id='jmsProShell';shell.innerHTML=`<button id="jmsGlobalSearch" type="button" aria-label="البحث الشامل">⌕</button><div id="jmsQuickMenu" class="jms-quick-menu"><div><button type="button" onclick="openCustomerForm?.()"><i>＋</i><span>عميل جديد</span></button><button type="button" onclick="openQuoteForm?.()"><i>▤</i><span>عرض سعر</span></button><button type="button" onclick="openVisitForm?.()"><i>◷</i><span>تسجيل زيارة</span></button><button type="button" onclick="openOrderForm?.()"><i>▣</i><span>طلب تصنيع</span></button></div><button id="jmsQuickToggle" type="button" aria-label="الإجراءات السريعة">＋</button></div><div id="jmsConnection" class="jms-connection"><i></i><span></span></div>`;
    document.body.appendChild(shell);document.getElementById('jmsGlobalSearch').onclick=openSearch;document.getElementById('jmsQuickToggle').onclick=toggleActions;updateConnection();
  }
  function updateConnection(){const el=document.getElementById('jmsConnection');if(!el)return;const online=navigator.onLine;el.classList.toggle('offline',!online);el.querySelector('span').textContent=online?'متصل وآمن':'وضع بدون اتصال';el.classList.add('visible');clearTimeout(updateConnection.timer);updateConnection.timer=setTimeout(()=>el.classList.remove('visible'),online?2200:10000);}

  function improveModal(){
    const modal=document.getElementById('modal'),body=document.getElementById('modalBody'),card=modal?.querySelector('.modal-card');if(!modal||!body||!card||modal.classList.contains('hidden'))return;
    document.getElementById('jmsQuickMenu')?.classList.remove('open');
    if(body.querySelector('.quote-print-shell,.jms-send-language')||body.querySelector('.jms-form-jump'))return;
    setTimeout(()=>{if(card.scrollHeight<=card.clientHeight+120)return;const primary=[...body.querySelectorAll('button.primary')].filter(b=>b.offsetParent!==null).pop();if(!primary)return;const jump=document.createElement('button');jump.type='button';jump.className='jms-form-jump';jump.textContent='↓ متابعة للحفظ';jump.onclick=()=>primary.scrollIntoView({behavior:'smooth',block:'center'});body.appendChild(jump);},80);
  }

  const style=document.createElement('style');style.textContent=`
    #jmsProShell{position:relative;z-index:80}#jmsGlobalSearch{position:fixed;left:24px;top:22px;width:46px;height:46px;border:1px solid rgba(255,255,255,.16);border-radius:15px;background:#1e293b;color:#fff;font-size:27px;box-shadow:0 12px 30px rgba(15,23,42,.2);cursor:pointer}.jms-quick-menu{position:fixed;left:24px;bottom:24px;display:grid;justify-items:start;gap:10px}.jms-quick-menu>button{width:56px;height:56px;border:0;border-radius:19px;background:linear-gradient(135deg,#e11d48,#991b1b);color:#fff;font-size:30px;box-shadow:0 16px 34px rgba(159,18,57,.34);transition:.2s}.jms-quick-menu.open>button{transform:rotate(45deg)}.jms-quick-menu>div{display:grid;gap:8px;opacity:0;transform:translateY(12px);pointer-events:none;transition:.2s}.jms-quick-menu.open>div{opacity:1;transform:none;pointer-events:auto}.jms-quick-menu>div button{display:flex;align-items:center;gap:9px;min-width:145px;border:1px solid #e2e8f0;border-radius:13px;padding:9px 12px;background:#fff;color:#0f172a;box-shadow:0 10px 24px rgba(15,23,42,.13);font-weight:900}.jms-quick-menu>div i{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#111827;color:#fff;font-style:normal}.jms-connection{position:fixed;top:24px;left:82px;display:flex;align-items:center;gap:7px;border:1px solid #bbf7d0;border-radius:999px;padding:8px 11px;background:#f0fdf4;color:#166534;font-size:11px;font-weight:900;opacity:0;transform:translateY(-6px);pointer-events:none;transition:.2s}.jms-connection.visible{opacity:1;transform:none}.jms-connection.offline{border-color:#fed7aa;background:#fff7ed;color:#9a3412}.jms-connection i{width:7px;height:7px;border-radius:50%;background:#22c55e}.jms-connection.offline i{background:#f97316}
    .jms-command{position:fixed;inset:0;z-index:1000;display:grid;place-items:start center;padding:10vh 18px;background:rgba(15,23,42,.58);backdrop-filter:blur(8px)}.jms-command-card{width:min(650px,100%);overflow:hidden;border:1px solid rgba(255,255,255,.6);border-radius:24px;background:#fff;box-shadow:0 35px 90px rgba(15,23,42,.32)}.jms-command-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px 12px}.jms-command-head b,.jms-command-head span{display:block}.jms-command-head b{font-size:18px}.jms-command-head span{margin-top:3px;color:#64748b;font-size:11px}.jms-command-head button{width:34px;height:34px;border:0;border-radius:11px;background:#f1f5f9;font-size:22px}.jms-command-input{display:flex;align-items:center;gap:10px;margin:0 18px 12px;padding:0 14px;border:2px solid #cbd5e1;border-radius:15px}.jms-command-input:focus-within{border-color:#be123c;box-shadow:0 0 0 4px rgba(190,18,60,.08)}.jms-command-input span{font-size:25px;color:#64748b}.jms-command-input input{width:100%;border:0;outline:0;padding:14px 0;background:transparent;font-size:16px}.jms-command-results{display:grid;max-height:48vh;overflow:auto;padding:4px 10px 12px}.jms-command-results button{display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:10px;border:0;border-radius:14px;padding:10px;background:#fff;text-align:right}.jms-command-results button:hover{background:#f8fafc}.jms-command-results i{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:#111827;color:#fff;font-style:normal;font-weight:900}.jms-command-results b,.jms-command-results span{display:block}.jms-command-results span{margin-top:3px;color:#64748b;font-size:11px}.jms-command-results em{border-radius:999px;padding:5px 8px;background:#f1f5f9;color:#475569;font-size:9px;font-style:normal}.jms-command-empty{padding:35px;text-align:center;color:#64748b}.jms-command-foot{display:flex;justify-content:space-between;padding:10px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:10px}
    #jmsProToasts{position:fixed;top:22px;right:22px;z-index:1200;display:grid;gap:9px}.jms-pro-toast{display:flex;align-items:center;gap:11px;min-width:270px;max-width:390px;padding:13px;border:1px solid #bbf7d0;border-radius:16px;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.18);opacity:0;transform:translateX(20px);transition:.24s}.jms-pro-toast.show{opacity:1;transform:none}.jms-pro-toast i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#dcfce7;color:#15803d;font-style:normal;font-weight:1000}.jms-pro-toast b,.jms-pro-toast span{display:block}.jms-pro-toast span{margin-top:2px;color:#64748b;font-size:11px}.jms-form-jump{position:sticky;bottom:12px;z-index:4;display:block;margin:18px auto 0;border:0;border-radius:999px;padding:11px 18px;background:#111827;color:#fff;box-shadow:0 10px 25px rgba(15,23,42,.25);font-weight:900}
    @media(max-width:850px){#jmsGlobalSearch{top:auto;left:18px;bottom:86px;width:48px;height:48px}.jms-quick-menu{left:18px;bottom:18px}.jms-quick-menu>button{width:54px;height:54px}.jms-connection{top:calc(env(safe-area-inset-top) + 12px);left:50%;transform:translate(-50%,-6px)}.jms-connection.visible{transform:translate(-50%,0)}.jms-command{padding:8vh 12px}.jms-command-card{border-radius:20px}#jmsProToasts{top:calc(env(safe-area-inset-top) + 12px);right:12px;left:12px}.jms-pro-toast{min-width:0;max-width:none;width:100%}}
  `;document.head.appendChild(style);
  installShell();window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}if(e.key==='Escape')closeSearch();});
  new MutationObserver(()=>{document.getElementById('jmsProShell')?.classList.toggle('hidden',!visible());improveModal();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
  document.getElementById('jmsProShell')?.classList.toggle('hidden',!visible());
  window.JMS_PROFESSIONAL_EXPERIENCE_VERSION=VERSION;
})();
