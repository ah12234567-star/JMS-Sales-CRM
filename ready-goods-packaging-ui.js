/* JMS Ready Goods — packaging / package count field */
(function(){
  'use strict';
  const values=new Map();
  const STYLE_ID='jms-rgn-packaging-style';

  function css(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      #readyGoodsNotice .rgn-item-grid{grid-template-columns:1.1fr 1fr .9fr .7fr .7fr .9fr 1fr auto!important}
      #readyGoodsNotice .rgn-packaging input{font-weight:800;background:#fffdf7;border-color:#f1d7a8}
      #readyGoodsNotice .rgn-packaging small{display:block;margin-top:4px;color:#8a5a12;font-size:10px;line-height:1.35}
      @media(max-width:920px){#readyGoodsNotice .rgn-item-grid{grid-template-columns:1fr 1fr!important}}
      @media(max-width:520px){#readyGoodsNotice .rgn-item-grid{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(s);
  }

  function itemId(card){
    const el=card.querySelector('[onchange*="JMSReadyGoods.patch"],[oninput*="JMSReadyGoods.patch"]');
    const txt=el?.getAttribute('onchange')||el?.getAttribute('oninput')||'';
    const m=txt.match(/patch\('([^']+)'/);
    return m?.[1]||'';
  }

  function decorate(){
    css();
    const root=document.getElementById('rgnItems');
    if(!root || !window.JMSReadyGoods?.patch) return;
    root.querySelectorAll('.rgn-item').forEach(card=>{
      const id=itemId(card);
      if(!id || card.querySelector('.rgn-packaging')) return;
      const grid=card.querySelector('.rgn-item-grid');
      if(!grid) return;

      const field=document.createElement('div');
      field.className='rgn-field rgn-packaging';
      field.innerHTML=`<span>التعبئة / عدد العبوات</span><input type="text" inputmode="text" autocomplete="off" placeholder="مثال: 24 كرتون / 15 شدة"><small>تظهر كما هي في عمود التعبئة داخل PDF</small>`;
      const input=field.querySelector('input');
      input.value=values.get(id)||'';
      input.addEventListener('input',()=>{
        const v=input.value.trimStart();
        values.set(id,v);
        window.JMSReadyGoods.patch(id,'packaging_label',v,input);
      });

      const priceField=[...grid.querySelectorAll('.rgn-field')].find(x=>x.textContent.includes('سعر الوحدة قبل الضريبة'));
      if(priceField) grid.insertBefore(field,priceField);
      else grid.insertBefore(field,grid.lastElementChild);
    });
  }

  const observer=new MutationObserver(()=>queueMicrotask(decorate));
  function boot(){
    decorate();
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(decorate,1200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
