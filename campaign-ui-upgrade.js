(function () {
  'use strict';

  const VERSION = '2026-08-campaign-ui-v1';
  let scheduled = false;

  function injectStyles() {
    if (document.getElementById('jmsCampaignUiUpgradeStyle')) return;
    const style = document.createElement('style');
    style.id = 'jmsCampaignUiUpgradeStyle';
    style.textContent = `
      #whatsappCampaigns.jms-campaign-pro{max-width:1500px;margin-inline:auto;padding-bottom:40px}
      #whatsappCampaigns .page-head{background:linear-gradient(125deg,#172033,#263857 62%,#0f766e);color:#fff;border:0;border-radius:24px;padding:24px 26px;box-shadow:0 18px 45px rgba(15,23,42,.16);margin-bottom:16px}
      #whatsappCampaigns .page-head h1,#whatsappCampaigns .page-head p{color:#fff}
      #whatsappCampaigns .page-head p{opacity:.78;max-width:720px;margin-top:6px}
      #whatsappCampaigns .page-head .head-actions button{min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.1);color:#fff}
      #whatsappCampaigns .page-head .head-actions .primary{background:#fff;color:#172033}
      .jms-campaign-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 16px}
      .jms-campaign-step{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e4e9f1;border-radius:16px;padding:13px 15px;color:#667085;box-shadow:0 5px 18px rgba(15,23,42,.04)}
      .jms-campaign-step b{display:block;color:#1d2939;font-size:14px}.jms-campaign-step span:last-child{font-size:12px}
      .jms-step-no{display:grid;place-items:center;min-width:34px;height:34px;border-radius:11px;background:#eef2ff;color:#3730a3;font-weight:900}
      #whatsappCampaigns>.panel:first-of-type{border:1px solid #e4e9f1;border-radius:22px;padding:22px;background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.07)}
      .jms-campaign-builder-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:15px;border-bottom:1px solid #edf0f5}
      .jms-campaign-builder-title b{font-size:18px;color:#182230}.jms-campaign-builder-title span{font-size:12px;color:#667085}
      #whatsappCampaigns .jms-campaign-toolbar{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      #whatsappCampaigns .jms-campaign-toolbar label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:#344054}
      #whatsappCampaigns .jms-campaign-toolbar select,#whatsappCampaigns .jms-campaign-toolbar input,#whatsappCampaigns #wcPrompt{min-height:46px;border:1px solid #d9e0ea;border-radius:12px;background:#f9fafb;padding:10px 12px;transition:.18s}
      #whatsappCampaigns .jms-campaign-toolbar select:focus,#whatsappCampaigns .jms-campaign-toolbar input:focus,#whatsappCampaigns #wcPrompt:focus{outline:0;border-color:#6478e5;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.11)}
      #whatsappCampaigns #wcPrompt{width:100%;resize:vertical;line-height:1.7;margin-top:7px}
      #whatsappCampaigns .jms-campaign-note{border:0;border-radius:13px;background:#fff7ed;color:#9a3412;padding:12px 14px}
      .jms-whatsapp-state{display:flex;align-items:flex-start;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:13px;padding:12px 14px;margin-top:12px;color:#475569;font-size:13px}
      .jms-whatsapp-state i{width:9px;height:9px;margin-top:5px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 4px #fef3c7}
      #whatsappCampaigns .jms-campaign-actions{padding-top:14px;border-top:1px solid #edf0f5}
      #whatsappCampaigns .jms-campaign-actions button{min-height:42px;padding:10px 16px;border-radius:11px;font-weight:800;box-shadow:none}
      #whatsappCampaigns .jms-campaign-grid{grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
      #whatsappCampaigns .jms-campaign-card{position:relative;overflow:hidden;min-height:105px;display:flex;flex-direction:column;justify-content:center;border:0;border-radius:18px;padding:17px 20px;box-shadow:0 9px 28px rgba(15,23,42,.07)}
      #whatsappCampaigns .jms-campaign-card:after{content:'';position:absolute;inset-inline-start:0;top:0;width:5px;height:100%;background:#6478e5}
      #whatsappCampaigns .jms-campaign-card:nth-child(2):after{background:#16a34a}#whatsappCampaigns .jms-campaign-card:nth-child(3):after{background:#ef4444}#whatsappCampaigns .jms-campaign-card:nth-child(4):after{background:#f59e0b}
      #whatsappCampaigns .jms-campaign-card b{font-size:30px;line-height:1;color:#101828}#whatsappCampaigns .jms-campaign-card span{margin-top:9px;color:#667085;font-weight:700}
      #whatsappCampaigns #wcPreview{overflow:hidden;border:1px solid #e4e9f1;border-radius:22px;padding:0;background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.06)}
      #whatsappCampaigns #wcPreview>.panel-head{padding:19px 20px 14px;margin:0;border-bottom:1px solid #edf0f5}
      .jms-preview-tools{display:flex;gap:10px;padding:13px 20px;background:#f8fafc;border-bottom:1px solid #edf0f5}
      .jms-preview-tools input,.jms-preview-tools select{min-height:40px;border:1px solid #d9e0ea;border-radius:10px;background:#fff;padding:8px 12px}
      .jms-preview-tools input{flex:1;min-width:180px}.jms-preview-count{align-self:center;color:#667085;font-size:12px;white-space:nowrap}
      .jms-campaign-table-wrap{width:100%;overflow:auto;padding:4px 14px 15px}
      #whatsappCampaigns .jms-campaign-table{min-width:1040px;border-collapse:separate;border-spacing:0 9px;margin:0}
      #whatsappCampaigns .jms-campaign-table th{padding:7px 10px;color:#667085;font-weight:800;background:transparent}
      #whatsappCampaigns .jms-campaign-table td{padding:12px 10px;border-color:#e7eaf0;background:#fff}
      #whatsappCampaigns .jms-campaign-table tr:hover td{background:#fafbff}
      #whatsappCampaigns .jms-message-preview{max-width:330px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;line-height:1.65}
      #whatsappCampaigns .jms-row-actions{display:flex;flex-wrap:wrap;gap:6px;min-width:145px}
      #whatsappCampaigns .jms-row-actions button{border:1px solid #d8dee8;background:#fff;color:#344054;border-radius:9px;padding:7px 9px;margin:0;font-size:11px;cursor:pointer}
      #whatsappCampaigns .jms-row-actions .jms-link-btn{border-color:#16a34a;background:#16a34a;color:#fff}
      #whatsappCampaigns #wcLog{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #whatsappCampaigns #wcLog h3{grid-column:1/-1;margin:8px 0 0;color:#1d2939}
      #whatsappCampaigns .jms-campaign-log-row{border-radius:13px;padding:12px 14px;background:#fafbfc}
      @media(max-width:980px){#whatsappCampaigns .jms-campaign-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}#whatsappCampaigns .jms-campaign-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:720px){#whatsappCampaigns .page-head{border-radius:18px;padding:19px}.jms-campaign-steps{grid-template-columns:1fr}.jms-campaign-step span:last-child{display:none}#whatsappCampaigns .jms-campaign-toolbar{grid-template-columns:1fr}#whatsappCampaigns .jms-campaign-grid{grid-template-columns:repeat(2,1fr)}.jms-preview-tools{flex-wrap:wrap}.jms-preview-tools input{flex-basis:100%}#whatsappCampaigns #wcLog{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function addLabels(table) {
    if (!table) return;
    const labels = Array.from(table.querySelectorAll('tr:first-child th')).map(x => x.textContent.trim());
    Array.from(table.querySelectorAll('tr')).slice(1).forEach(row => {
      row.querySelectorAll('td').forEach((cell, index) => cell.dataset.label = labels[index] || '');
      const status = row.querySelector('.jms-campaign-badge');
      row.dataset.status = status?.classList.contains('ok') ? 'ready' : 'blocked';
      const last = row.querySelector('td:last-child');
      if (last && !last.querySelector('.jms-row-actions')) {
        const wrap = document.createElement('div');
        wrap.className = 'jms-row-actions';
        while (last.firstChild) {
          if (last.firstChild.nodeName === 'BR') last.firstChild.remove();
          else wrap.appendChild(last.firstChild);
        }
        last.appendChild(wrap);
      }
    });
  }

  function filterRows() {
    const preview = document.getElementById('wcPreview');
    if (!preview) return;
    const term = (document.getElementById('wcPreviewSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('wcPreviewStatus')?.value || 'all';
    let visible = 0;
    preview.querySelectorAll('.jms-campaign-table tr[data-status]').forEach(row => {
      const show = (!term || row.textContent.toLowerCase().includes(term)) && (status === 'all' || row.dataset.status === status);
      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    const count = document.getElementById('wcPreviewVisible');
    const label = visible + ' عميل ظاهر';
    if (count && count.textContent !== label) count.textContent = label;
  }

  function enhancePreview() {
    const preview = document.getElementById('wcPreview');
    if (!preview) return;
    const table = preview.querySelector('.jms-campaign-table');
    if (!table) return;
    if (!preview.querySelector('.jms-preview-tools')) {
      const tools = document.createElement('div');
      tools.className = 'jms-preview-tools';
      tools.innerHTML = '<input id="wcPreviewSearch" type="search" placeholder="ابحث باسم العميل أو الجوال أو المندوب"><select id="wcPreviewStatus"><option value="all">كل الحالات</option><option value="ready">جاهز للإرسال</option><option value="blocked">مستبعد</option></select><span class="jms-preview-count" id="wcPreviewVisible"></span>';
      preview.querySelector('.panel-head')?.insertAdjacentElement('afterend', tools);
      tools.querySelector('input')?.addEventListener('input', filterRows);
      tools.querySelector('select')?.addEventListener('change', filterRows);
    }
    if (!table.parentElement.classList.contains('jms-campaign-table-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'jms-campaign-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
    addLabels(table);
    filterRows();
  }

  function enhancePage() {
    const page = document.getElementById('whatsappCampaigns');
    if (!page) return;
    page.classList.add('jms-campaign-pro');
    const head = page.querySelector('.page-head');
    if (head && !page.querySelector('.jms-campaign-steps')) {
      head.insertAdjacentHTML('afterend', '<div class="jms-campaign-steps"><div class="jms-campaign-step"><span class="jms-step-no">1</span><div><b>حدد العملاء</b><span>الشريحة، المندوب والمدينة</span></div></div><div class="jms-campaign-step"><span class="jms-step-no">2</span><div><b>جهز الرسالة</b><span>اختر النوع والنبرة ثم راجع النص</span></div></div><div class="jms-campaign-step"><span class="jms-step-no">3</span><div><b>راجع وأرسل</b><span>اعتمد الجاهزين فقط وتابع السجل</span></div></div></div>');
    }
    const builder = page.querySelector(':scope > .panel');
    const toolbar = builder?.querySelector('.jms-campaign-toolbar');
    if (toolbar && !builder.querySelector('.jms-campaign-builder-title')) {
      toolbar.insertAdjacentHTML('beforebegin', '<div class="jms-campaign-builder-title"><b>إعداد الحملة</b><span>كل الإرسال تحت اعتماد المدير</span></div>');
    }
    const actions = builder?.querySelector('.jms-campaign-actions');
    if (actions && !builder.querySelector('.jms-whatsapp-state')) {
      actions.insertAdjacentHTML('afterend', '<div class="jms-whatsapp-state"><i></i><div><b>حالة الإرسال:</b> الإرسال التلقائي يحتاج ربط WhatsApp Cloud API. بدون الربط، يجهز النظام الرسائل وروابط واتساب للإرسال اليدوي.</div></div>');
    }
    enhancePreview();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; enhancePage(); }, 30);
  }

  function install() {
    injectStyles();
    ['jmsRenderWhatsappCampaigns', 'jmsGenerateWhatsappCampaign'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__campaignUiWrapped) return;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        scheduleEnhance();
        return result;
      };
      wrapped.__campaignUiWrapped = true;
      window[name] = wrapped;
    });
    scheduleEnhance();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.JMS_CAMPAIGN_UI_VERSION = VERSION;
})();
