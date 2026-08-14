(function () {
  'use strict';

  const VERSION = '2026-08-13-mobile-quote-pdf-10';

  function quotePrintCss() {
    return `
      @page{size:Letter portrait;margin:0}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      html,body{margin:0!important;padding:0!important;width:216mm!important;height:auto!important;min-height:0!important;background:#fff!important;color:#111827!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif!important;direction:rtl!important;overflow:visible!important}
      .quote-a4{width:216mm!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:8mm 12mm 5mm!important;background:#fff!important;color:#111827!important;box-shadow:none!important;border:0!important;border-radius:0!important;overflow:visible!important;page-break-before:avoid!important;page-break-after:avoid!important;break-before:avoid!important;break-after:avoid!important}
      .quote-a4-head{display:grid!important;grid-template-columns:32mm 1fr 43mm!important;gap:7mm!important;align-items:center!important;border-bottom:2px solid #111827!important;padding-bottom:5mm!important}
      .quote-a4-logo{display:block!important;width:30mm!important;height:22mm!important;object-fit:contain!important;background:#fff!important}
      .quote-a4-company h1{font-size:16pt!important;line-height:1.2!important;margin:0!important;color:#111827!important}.quote-a4-company p{font-size:7.5pt!important;color:#64748b!important;margin:1.5mm 0!important}
      .quote-a4-title{text-align:left!important}.quote-a4-title h2{font-size:22pt!important;color:#b91c1c!important;margin:0 0 2mm!important}.quote-a4-title p{font-size:7.5pt!important;font-weight:800!important;color:#334155!important;margin:1mm 0!important}
      .quote-a4-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:5mm!important;margin-top:5mm!important}.quote-a4-card{border:1px solid #dbe2ea!important;background:#f8fafc!important;border-radius:3mm!important;padding:3.5mm!important;break-inside:avoid!important}.quote-a4-card h3{font-size:10pt!important;margin:0 0 2mm!important}.quote-a4-card p{font-size:7.7pt!important;line-height:1.65!important;margin:0!important;color:#334155!important}
      .quote-a4-table{width:100%!important;border-collapse:collapse!important;margin-top:5mm!important;table-layout:fixed!important;direction:rtl!important;break-inside:avoid!important}.quote-a4-table th{background:#111827!important;color:#fff!important;border:1px solid #111827!important;padding:2.3mm .6mm!important;font-size:6.2pt!important;text-align:center!important;line-height:1.3!important}.quote-a4-table td{border:1px solid #cbd5e1!important;padding:2.3mm .6mm!important;font-size:6.4pt!important;text-align:center!important;word-break:break-word!important;line-height:1.35!important}
      .quote-a4-table[hidden]{display:none!important}.jms-smart-specs{display:block!important;margin-top:5mm!important;border:1px solid #dbe4ef!important;border-radius:3mm!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.jms-smart-spec-title{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;background:linear-gradient(120deg,#111827,#7f1d1d)!important;color:#fff!important;padding:3mm 4mm!important}.jms-smart-spec-title>div{display:block!important}.jms-smart-spec-title b{display:block!important;color:#fff!important;font-size:10pt!important;line-height:1.3!important}.jms-smart-spec-title span{display:block!important;color:#e2e8f0!important;font-size:6.5pt!important;margin-top:1mm!important}.jms-smart-spec-title i{display:grid!important;place-items:center!important;min-width:7mm!important;width:7mm!important;height:7mm!important;border-radius:50%!important;background:rgba(255,255,255,.16)!important;color:#fff!important;font-size:6pt!important;font-style:normal!important}.jms-smart-spec-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;background:#fff!important}.jms-smart-spec-grid>div{display:block!important;min-height:13mm!important;padding:2.5mm 3mm!important;border-inline-end:1px solid #e2e8f0!important;border-bottom:1px solid #e2e8f0!important}.jms-smart-spec-grid span{display:block!important;color:#64748b!important;font-size:6.2pt!important;line-height:1.3!important}.jms-smart-spec-grid b{display:block!important;color:#0f172a!important;font-size:8pt!important;line-height:1.35!important;margin-top:1.2mm!important;word-break:break-word!important}
      .jms-spec-table-wrap{display:block!important;overflow:visible!important}.jms-smart-spec-table{width:100%!important;border-collapse:collapse!important;table-layout:auto!important;direction:inherit!important}.jms-smart-spec-table th{background:#111827!important;color:#fff!important;border:1px solid #111827!important;padding:2mm .7mm!important;font-size:5.6pt!important;line-height:1.25!important;text-align:center!important;white-space:nowrap!important}.jms-smart-spec-table td{background:#fff!important;color:#111827!important;border:1px solid #dbe4ef!important;padding:2mm .7mm!important;font-size:5.8pt!important;line-height:1.25!important;text-align:center!important;white-space:nowrap!important}.jms-smart-spec-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
      .quote-a4-summary{display:grid!important;grid-template-columns:1fr 63mm!important;gap:5mm!important;margin-top:5mm!important;break-inside:avoid!important}.quote-a4-terms{border:1px solid #e2e8f0!important;border-radius:3mm!important;padding:3.5mm!important}.quote-a4-terms h3{font-size:10pt!important;margin:0 0 2mm!important}.quote-a4-terms ul{margin:0!important;padding-right:5mm!important;line-height:1.55!important;font-size:7pt!important;color:#334155!important}.quote-a4-total{border:1px solid #e2e8f0!important;border-radius:3mm!important;overflow:hidden!important}.quote-a4-total-row{display:flex!important;justify-content:space-between!important;gap:5px!important;padding:3mm!important;border-bottom:1px solid #e2e8f0!important;background:#f8fafc!important;font-size:7.5pt!important}.quote-a4-total-row.final{background:#111827!important;color:#fff!important;font-size:9.5pt!important;font-weight:900!important}
      .jms-bank-details{display:grid!important;grid-template-columns:39mm 1fr!important;gap:0!important;margin-top:4mm!important;border:1px solid #dbe4ef!important;border-radius:3mm!important;overflow:hidden!important;background:#f8fafc!important;break-inside:avoid!important;page-break-inside:avoid!important}.jms-bank-heading{display:flex!important;flex-direction:column!important;justify-content:center!important;padding:2.5mm 3mm!important;background:#111827!important;color:#fff!important}.jms-bank-heading b{font-size:8pt!important;color:#fff!important}.jms-bank-heading span{font-size:6pt!important;color:#cbd5e1!important;margin-top:1mm!important}.jms-bank-fields{display:grid!important;grid-template-columns:1.2fr 1fr 1.2fr!important;gap:2mm!important;align-items:center!important;padding:2.5mm 3mm!important}.jms-bank-fields span{display:block!important;color:#64748b!important;font-size:5.8pt!important}.jms-bank-fields b{display:block!important;color:#0f172a!important;font-size:6.5pt!important;margin-top:.7mm!important;white-space:nowrap!important}.jms-bank-iban b{letter-spacing:.15px!important}
      .quote-a4-approval{display:grid!important;grid-template-columns:1fr 1fr!important;gap:5mm!important;margin-top:6mm!important;break-inside:avoid!important}.quote-a4-sign{min-height:22mm!important;border:1px solid #cbd5e1!important;border-radius:3mm!important;padding:3mm!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;text-align:right!important}.quote-a4-sign b{font-size:8pt!important}.quote-a4-line{border-top:1px solid #94a3b8!important;padding-top:2mm!important;font-size:6.5pt!important;color:#64748b!important}
      .quote-a4-footer{margin-top:5mm!important;border-top:1px solid #e2e8f0!important;padding-top:3mm!important;display:flex!important;justify-content:space-between!important;gap:8px!important;font-size:6.5pt!important;color:#64748b!important;break-inside:avoid!important}
      button,.quote-toolbar,.modal-close{display:none!important}
    `;
  }

  function simplifyApprovals(root) {
    const approvals = root?.querySelector('.quote-a4-approval');
    if (!approvals || approvals.dataset.compact === '1') return;
    approvals.dataset.compact = '1';
    const english = root?.dataset?.lang === 'en';
    approvals.innerHTML = english ? `
      <div class="quote-a4-sign"><b>Customer Approval</b><div class="quote-a4-line">Name: ____________________ &nbsp; Signature: ______________ &nbsp; Date: __________</div></div>
      <div class="quote-a4-sign"><b>Company Approval</b><div class="quote-a4-line">Authorized by: ____________ &nbsp; Signature & Stamp: ________ &nbsp; Date: __________</div></div>` : `
      <div class="quote-a4-sign"><b>اعتماد العميل</b><div class="quote-a4-line">الاسم: ____________________ &nbsp; التوقيع: ______________ &nbsp; التاريخ: __________</div></div>
      <div class="quote-a4-sign"><b>اعتماد الشركة</b><div class="quote-a4-line">اسم المسؤول: ______________ &nbsp; التوقيع والختم: ____________ &nbsp; التاريخ: __________</div></div>`;
  }

  function safeFilePart(value) {
    return String(value || 'عرض-سعر').replace(/[\\/:*?"<>|]+/g, '-').trim();
  }

  function waitForQuoteElement() {
    return new Promise(resolve => {
      let attempts = 0;
      const check = () => {
        const element = document.querySelector('.quote-print-shell .quote-a4, #modalBody .quote-a4');
        if (element || attempts++ > 15) return resolve(element || null);
        setTimeout(check, 80);
      };
      check();
    });
  }

  async function shareQuotePdf(qid) {
    const quote = (window.db?.quotes || (typeof db !== 'undefined' ? db.quotes : []) || []).find(item => item.id === qid);
    if (!quote) return alert('لم يتم العثور على عرض السعر.');
    if (!['approved','sent','accepted'].includes(quote.status)) return alert('اعتمد عرض السعر أولاً قبل إرساله للعميل.');
    if (typeof window.html2pdf !== 'function') return alert('جاري تحميل أداة PDF. انتظر لحظة ثم حاول مرة أخرى.');

    const existing = document.querySelector('.quote-print-shell .quote-a4, #modalBody .quote-a4');
    if (!existing && typeof window.viewQuote === 'function') window.viewQuote(qid);
    const source = existing || await waitForQuoteElement();
    if (!source) return alert('تعذر تجهيز عرض السعر. افتحه أولاً ثم حاول مرة أخرى.');

    const clone = source.cloneNode(true);
    simplifyApprovals(clone);
    clone.style.cssText += ';width:794px!important;min-height:0!important;height:auto!important;margin:0!important;box-shadow:none!important;border-radius:0!important;transform:none!important;';
    const holder = document.createElement('div');
    holder.className = 'jms-pdf-export';
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:fixed;right:-10000px;top:0;width:794px;background:#fff;z-index:-1;';
    holder.appendChild(clone);
    document.body.appendChild(holder);

    const fileName = safeFilePart(`عرض-سعر-${quote.quote_no || qid}`) + '.pdf';
    try {
      const blob = await window.html2pdf().set({
        margin: 0,
        filename: fileName,
        image: {type:'jpeg', quality:0.98},
        html2canvas: {scale:2, useCORS:true, backgroundColor:'#ffffff', scrollX:0, scrollY:0, windowWidth:794},
        jsPDF: {unit:'mm', format:'a4', orientation:'portrait'},
        pagebreak: {mode:['css','legacy']}
      }).from(clone).outputPdf('blob');
      const file = new File([blob], fileName, {type:'application/pdf'});
      if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
        await navigator.share({files:[file], title:`عرض سعر ${quote.quote_no || ''}`});
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = fileName; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1500);
        alert('تم تنزيل ملف عرض السعر. افتحه ثم شاركه عبر واتساب.');
      }
      if (quote.status === 'approved') {
        quote.status = 'sent'; quote.sent_at = new Date().toISOString();
        if (typeof window.save === 'function') window.save();
        else if (typeof save === 'function') save();
        if (typeof window.renderAll === 'function') window.renderAll();
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('JMS PDF share error', error);
        alert('تعذر إنشاء ملف PDF. حاول مرة أخرى بعد التأكد من اتصال الإنترنت.');
      }
    } finally {
      holder.remove();
    }
  }
  window.jmsShareQuotePdf = shareQuotePdf;

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
    screenStyle.textContent = `.quote-a4-approval[data-compact="1"]{grid-template-columns:1fr 1fr!important;gap:7mm!important}.quote-a4-approval[data-compact="1"] .quote-a4-sign{min-height:28mm!important;text-align:right!important}@media(max-width:700px){.quote-a4-approval[data-compact="1"]{grid-template-columns:1fr!important;gap:12px!important}}
      .jms-pdf-export .quote-a4{box-sizing:border-box!important;width:794px!important;min-height:0!important;height:auto!important;padding:30px 38px 22px!important;margin:0!important;overflow:visible!important;background:#fff!important}
      .jms-pdf-export .quote-a4-head{display:grid!important;grid-template-columns:115px 1fr 155px!important;gap:24px!important;padding-bottom:18px!important}
      .jms-pdf-export .quote-a4-logo{width:108px!important;height:78px!important}.jms-pdf-export .quote-a4-company h1{font-size:25px!important}.jms-pdf-export .quote-a4-company p{font-size:10px!important}.jms-pdf-export .quote-a4-title{text-align:left!important}.jms-pdf-export .quote-a4-title h2{font-size:31px!important;margin-bottom:8px!important}.jms-pdf-export .quote-a4-title p{font-size:10px!important;margin:3px 0!important}
      .jms-pdf-export .quote-a4-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:18px!important;margin-top:20px!important}.jms-pdf-export .quote-a4-card{padding:14px!important;border-radius:12px!important}.jms-pdf-export .quote-a4-card h3{font-size:15px!important;margin-bottom:8px!important}.jms-pdf-export .quote-a4-card p{font-size:10px!important;line-height:1.55!important}
      .jms-pdf-export .quote-a4-table{display:none!important}.jms-pdf-export .jms-smart-specs{margin-top:18px!important;border-radius:12px!important}.jms-pdf-export .jms-smart-spec-title{padding:10px 14px!important}.jms-pdf-export .jms-smart-spec-title b{font-size:15px!important}.jms-pdf-export .jms-smart-spec-title span{font-size:9px!important}.jms-pdf-export .jms-smart-spec-grid{display:grid!important;grid-template-columns:repeat(4,1fr)!important}.jms-pdf-export .jms-smart-spec-grid>div{min-height:48px!important;padding:9px 11px!important}.jms-pdf-export .jms-smart-spec-grid span{font-size:9px!important}.jms-pdf-export .jms-smart-spec-grid b{font-size:11px!important;margin-top:3px!important}
      .jms-pdf-export .jms-spec-table-wrap{overflow:visible!important}.jms-pdf-export .jms-smart-spec-table{width:100%!important;border-collapse:collapse!important;table-layout:auto!important}.jms-pdf-export .jms-smart-spec-table th{padding:7px 3px!important;font-size:7px!important;white-space:nowrap!important}.jms-pdf-export .jms-smart-spec-table td{padding:7px 3px!important;font-size:7px!important;white-space:nowrap!important}
      .jms-pdf-export .quote-a4-summary{display:grid!important;grid-template-columns:1fr 245px!important;gap:18px!important;margin-top:18px!important}.jms-pdf-export .quote-a4-terms{padding:14px!important;border-radius:12px!important}.jms-pdf-export .quote-a4-terms h3{font-size:15px!important}.jms-pdf-export .quote-a4-terms ul{font-size:9px!important;line-height:1.5!important}.jms-pdf-export .quote-a4-total-row{padding:10px!important;font-size:10px!important}.jms-pdf-export .quote-a4-total-row.final{font-size:13px!important}
      .jms-pdf-export .jms-bank-details{display:grid!important;grid-template-columns:150px 1fr!important;margin-top:15px!important;border-radius:11px!important}.jms-pdf-export .jms-bank-heading{padding:10px 12px!important}.jms-pdf-export .jms-bank-heading b{font-size:11px!important}.jms-pdf-export .jms-bank-heading span{font-size:8px!important}.jms-pdf-export .jms-bank-fields{display:grid!important;grid-template-columns:1.2fr 1fr 1.2fr!important;gap:8px!important;padding:10px 12px!important}.jms-pdf-export .jms-bank-fields span{font-size:8px!important}.jms-pdf-export .jms-bank-fields b{font-size:9px!important;white-space:nowrap!important}
      .jms-pdf-export .quote-a4-approval{display:grid!important;grid-template-columns:1fr 1fr!important;gap:18px!important;margin-top:20px!important}.jms-pdf-export .quote-a4-sign{min-height:74px!important;padding:11px!important;border-radius:11px!important}.jms-pdf-export .quote-a4-sign b{font-size:11px!important}.jms-pdf-export .quote-a4-line{font-size:8px!important;padding-top:8px!important}.jms-pdf-export .quote-a4-footer{margin-top:17px!important;padding-top:10px!important;font-size:8px!important}`;
    document.head.appendChild(screenStyle);
    window.downloadQuotePDF = openQuotePrintPage;
    window.sendQuote = shareQuotePdf;
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
      document.querySelectorAll('button[onclick^="sendQuote("]').forEach(button => {
        button.textContent = 'إرسال ملف PDF';
        button.title = 'مشاركة عرض السعر كملف PDF';
      });
    }
    refreshQuoteUi();
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-page="quotes"],button[onclick*="Quote"],button[onclick*="quote"]'))setTimeout(refreshQuoteUi,80);
    },true);
    document.addEventListener('jms:quote-opened',refreshQuoteUi);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.JMS_MOBILE_QUOTE_PDF_VERSION = VERSION;
})();
