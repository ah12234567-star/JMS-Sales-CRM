(function(){
  'use strict';
  const CONFIG=[
    ['quotesTotal','all','كل العروض'],
    ['quotesPending','pending','بانتظار الاعتماد'],
    ['quotesApproved','approved','العروض المعتمدة'],
    ['quotesRejected','rejected','العروض المرفوضة']
  ];
  function openQuotes(status,card){
    const nav=document.querySelector('.nav[data-page="quotes"]');
    if(nav&&!document.getElementById('quotes')?.classList.contains('active'))nav.click();
    const filter=document.getElementById('quoteStatusFilter');
    if(filter){
      const option=Array.from(filter.options).find(function(item){return item.value===status});
      filter.value=option?status:'all';
      filter.dispatchEvent(new Event('change',{bubbles:true}));
    }
    if(typeof window.renderQuotes==='function')window.renderQuotes();
    document.querySelectorAll('#quotes .jms-quote-stat-filter').forEach(function(item){item.classList.remove('active')});
    card.classList.add('active');
    document.getElementById('quotesList')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function bind(){
    CONFIG.forEach(function(config){
      const count=document.getElementById(config[0]);const card=count?.closest('.stat');if(!card)return;
      card.classList.add('jms-quote-stat-filter');card.dataset.quoteFilter=config[1];
      card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','تصفية القائمة: '+config[2]);
      if(card.dataset.jmsQuoteFilterBound==='1')return;
      card.dataset.jmsQuoteFilterBound='1';
      card.addEventListener('click',function(){openQuotes(config[1],card)});
      card.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();openQuotes(config[1],card)}});
    });
  }
  function style(){
    if(document.getElementById('jmsQuoteStatsFilterStyle'))return;
    const element=document.createElement('style');element.id='jmsQuoteStatsFilterStyle';
    element.textContent='#quotes .jms-quote-stat-filter{cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}#quotes .jms-quote-stat-filter:active{transform:scale(.98)}#quotes .jms-quote-stat-filter.active{border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.14),0 14px 30px rgba(15,23,42,.1)!important}#quotes .jms-quote-stat-filter:focus-visible{outline:3px solid rgba(37,99,235,.35);outline-offset:3px}';
    document.head.appendChild(element);
  }
  function boot(){style();bind();setTimeout(bind,900)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.JMS_QUOTE_STATS_FILTER='2026-08-14-v1';
})();