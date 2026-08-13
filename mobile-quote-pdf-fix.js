(function () {
  'use strict';

  const VERSION = '2026-08-13-mobile-quote-pdf-3';

  function quotePrintCss() {
    return `
      @page{size:A4 portrait;margin:0}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      html,body{margin:0!important;padding:0!important;width:210mm!important;height:297mm!important;background:#fff!important;color:#111827!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif!important;direction:rtl!important;overflow:hidden!important}
      .quote-a4{width:210mm!important;height:297mm!important;min-height:297mm!important;max-height:297mm!important;margin:0!important;padding:9mm 10mm 7mm!important;background:#fff!important;color:#111827!important;box-shadow:none!important;border:0!important;border-radius:0!important;overflow:hidden!important;page-break-after:avoid!important;break-after:avoid!important}
      .quote-a4-head{display:grid!important;grid-template-columns:32mm 1fr 43mm!important;gap:7mm!important;align-items:center!important;border-bottom:2px solid #111827!important;padding-bottom:5mm!important}
      .quote-a4-logo{display:block!important;width:30mm!important;height:22mm!important;object-fit:contain!important;background:#fff!important}
      .quote-a4-company h1{font-size:16pt!important;line-height:1.2!important;margin:0!important;color:#111827!important}.quote-a4-company p{font-size:7.5pt!important;color:#64748b!important;margin:1.5mm 0!important}
      .quote-a4-title{text-align:left!important}.quote-a4-title h2{font-size:22pt!important;color:#b91c1c!important;margin:0 0 2mm!important}.quote-a4-title p{font-size:7.5pt!important;font-weight:800!important;color:#334155!important;margin:1mm 0!important}
      .quote-a4-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:5mm!important;margin-top:5mm!important}.quote-a4-card{border:1px solid #dbe2ea!important;background:#f8fafc!important;border-radius:3mm!important;padding:3.5mm!important;break-inside:avoid!important}.quote-a4-card h3{font-size:10pt!important;margin:0 0 2mm!important}.quote-a4-card p{font-size:7.7pt!important;line-height:1.65!important;margin:0!important;color:#334155!important}
      .quote-a4-table{width:100%!important;border-collapse:collapse!important;margin-top:5mm!important;table-layout:fixed!important;direction:rtl!important;break-inside:avoid!important}.quote-a4-table th{background:#111827!important;color:#fff!important;border:1px solid #111827!important;padding:2.3mm .6mm!important;font-size:6.2pt!important;text-align:center!important;line-height:1.3!important}.quote-a4-table td{border:1px solid #cbd5e1!important;padding:2.3mm .6mm!important;font-size:6.4pt!important;text-align:center!important;word-break:break-word!important;line-height:1.35!important}
      .quote-a4-summary{display:grid!important;grid-template-columns:1fr 63mm!important;gap:5mm!important;margin-top:5mm!important;break-inside:avoid!important}.quote-a4-terms{border:1px solid #e2e8f0!important;border-radius:3mm!important;padding:3.5mm!important}.quote-a4-terms h3{font-size:10pt!important;margin:0 0 2mm!important}.quote-a4-terms ul{margin:0!important;padding-right:5mm!important;line-height:1.55!important;font-size:7pt!important;color:#334155!important}.quote-a4-total{border:1px solid #e2e8f0!important;border-radius:3mm!important;overflow:hidden!important}.quote-a4-total-row{display:flex!important;justify-content:space-between!important;gap:5px!important;padding:3mm!important;border-bottom:1px solid #e2e8f0!important;background:#f8fafc!important;font-size:7.5pt!important}.quote-a4-total-row.final{background:#111827!important;color:#fff!important;font-size:9.5pt!important;font-weight:900!important}
      .quote-a4-approval{display:grid!important;grid-template-columns:1fr 1fr!important;gap:5mm!important;margin-top:6mm!important;break-inside:avoid!important}.quote-a4-sign{min-height:22mm!important;border:1px solid #cbd5e1!important;border-radius:3mm!important;padding:3mm!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;text-align:right!important}.quote-a4-sign b{font-size:8pt!important}.quote-a4-line{border-top:1px solid #94a3b8!important;padding-top:2mm!important;font-size:6.5pt!important;color:#64748b!important}
      .quote-a4-footer{margin-top:5mm!important;border-top:1px solid #e2e8f0!important;padding-top:3mm!important;display:flex!important;justify-content:space-between!important;gap:8px!important;font-size:6.5pt!important;color:#64748b!important;break-inside:avoid!important}
      button,.quote-toolbar,.modal-close{display:none!important}
    `;
  }

  function simplifyApprovals(root) {
    const approvals = root?.querySelector('.quote-a4-approval');
    if (!approvals || approvals.dataset.compact === '1') return;
    approvals.dataset.compact = '1';
    approvals.innerHTML = `
      <div class="quote-a4-sign"><b>اعتماد العميل</b><div class="quote-a4-line">الاسم: ____________________ &nbsp; التوقيع: ______________ &nbsp; التاريخ: __________</div></div>
      <div class="quote-a4-sign"><b>اعتماد الشركة</b><div class="quote-a4-line">اسم المسؤول: ______________ &nbsp; التوقيع والختم: ____________ &nbsp; التاريخ: __________</div></div>`;
  }

  function openQuotePrintPage() {
    const source = document.querySelector('.quote-print-shell .quote-a4, #modalBody .quote-a4');
    if (!source) {
      alert('افتح عرض السعر أولاً ثم اضغط حفظ PDF.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('تعذر فتح صفحة الحفظ. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.');
      return;
    }

    const printable = source.cloneNode(true);
    simplifyApprovals(printable);
    const title = printable.querySelector('.quote-a4-title p')?.textContent?.trim() || 'عرض سعر JMS';
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/[<>]/g, '')}</title><style>${quotePrintCss()}</style></head><body>${printable.outerHTML}<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print()},450)});<\/script></body></html>`);
    printWindow.document.close();
  }

  function install() {
    const screenStyle = document.createElement('style');
    screenStyle.textContent = '.quote-a4-approval[data-compact="1"]{grid-template-columns:1fr 1fr!important;gap:7mm!important}.quote-a4-approval[data-compact="1"] .quote-a4-sign{min-height:28mm!important;text-align:right!important}@media(max-width:700px){.quote-a4-approval[data-compact="1"]{grid-template-columns:1fr!important;gap:12px!important}}';
    document.head.appendChild(screenStyle);
    window.downloadQuotePDF = openQuotePrintPage;
    document.addEventListener('click', event => {
      const button = event.target.closest('.quote-toolbar .pdf');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openQuotePrintPage();
    }, true);

    function refreshQuoteUi() {
      document.querySelectorAll('#modalBody .quote-a4').forEach(simplifyApprovals);
      document.querySelectorAll('.quote-toolbar .pdf').forEach(button => {
        const label = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'حفظ ومشاركة PDF' : 'حفظ PDF / طباعة';
        if (button.textContent !== label) button.textContent = label;
        button.title = 'إنشاء عرض سعر من صفحة واحدة جاهز للإرسال';
      });
    }
    refreshQuoteUi();
    // A slow timer is deliberate: it avoids a MutationObserver feedback loop on iOS
    // while still updating a quote shortly after its modal opens.
    window.setInterval(refreshQuoteUi, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.JMS_MOBILE_QUOTE_PDF_VERSION = VERSION;
})();
