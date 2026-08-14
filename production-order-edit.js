(function () {
  'use strict';

  const VERSION = '2026-08-production-order-edit-v1';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const number = value => Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0;
  const database = () => { try { return db; } catch (_) { return window.db || {}; } };
  const activeUser = () => { try { return currentUser; } catch (_) { return window.currentUser || null; } };
  const allowed = () => ['admin','sales','manager','production','production_manager'].includes(activeUser()?.role);

  function saveDb() {
    if (typeof window.save === 'function') window.save();
    else localStorage.setItem('jms_factory_crm_pro_v4', JSON.stringify(database()));
  }

  function customerOptions(selected) {
    return (database().customers || []).map(customer =>
      '<option value="' + esc(customer.id) + '" ' + (customer.id === selected ? 'selected' : '') + '>' + esc(customer.name || 'عميل بدون اسم') + '</option>'
    ).join('');
  }

  function productOptions(selected) {
    const products = ['أكياس رول','أكياس شيت','أكياس تي شيرت','أكياس نفايات','شرنك','فيلم','أكياس مطبوعة','أخرى'];
    if (selected && !products.includes(selected)) products.unshift(selected);
    return products.map(product => '<option ' + (product === selected ? 'selected' : '') + '>' + esc(product) + '</option>').join('');
  }

  function recalculate() {
    const kg = number(document.getElementById('jmsEditOrderKg')?.value);
    const price = number(document.getElementById('jmsEditOrderPrice')?.value);
    const amount = document.getElementById('jmsEditOrderAmount');
    if (amount) amount.value = kg && price ? (kg * price).toFixed(2) : '';
  }

  window.jmsEditSalesOrder = function (orderId) {
    if (!allowed()) return alert('تعديل بيانات الطلب متاح للمدير ومدير المبيعات فقط');
    const order = (database().orders || []).find(item => item.id === orderId);
    if (!order) return alert('لم يتم العثور على الطلب');
    const modal = document.getElementById('modal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return alert('تعذر فتح شاشة التعديل');

    const kg = number(order.total_kg);
    const savedPrice = number(order.price_kg) || (kg ? number(order.amount_value) / kg : 0);
    body.innerHTML = `
      <div class="jms-order-edit-head"><div><span>إكمال الطلب قبل التحويل</span><h2>تعديل بيانات طلب المبيعات</h2><p>أكمل الخانات المطلوبة ثم احفظ. بعدها تستطيع اعتماد الطلب وتسجيل التحويل وإرساله للإنتاج.</p></div></div>
      <div class="jms-order-edit-grid">
        <label class="wide">العميل<select id="jmsEditOrderCustomer"><option value="">اختر العميل</option>${customerOptions(order.customer_id)}</select></label>
        <label>المنتج<select id="jmsEditOrderProduct">${productOptions(order.product)}</select></label>
        <label>الخامة<input id="jmsEditOrderMaterial" value="${esc(order.material || '')}" placeholder="HDPE / LDPE / LLDPE"></label>
        <label>العرض<input id="jmsEditOrderWidth" type="number" min="0" step="0.01" value="${esc(order.width || '')}"></label>
        <label>الطول<input id="jmsEditOrderLength" type="number" min="0" step="0.01" value="${esc(order.length || '')}"></label>
        <label>السماكة بالميكرون<input id="jmsEditOrderThickness" type="number" min="0" step="0.01" value="${esc(order.thickness || '')}"></label>
        <label>الكمية بالكيلو<input id="jmsEditOrderKg" type="number" min="0" step="0.01" value="${esc(order.total_kg || '')}" oninput="jmsRecalculateEditedOrder()"></label>
        <label>سعر الكيلو<input id="jmsEditOrderPrice" type="number" min="0" step="0.01" value="${savedPrice ? savedPrice.toFixed(2) : ''}" oninput="jmsRecalculateEditedOrder()"></label>
        <label>الإجمالي<input id="jmsEditOrderAmount" type="number" readonly value="${esc(order.amount_value || '')}"></label>
        <label>اللون<input id="jmsEditOrderColor" value="${esc(order.color || '')}" placeholder="شفاف / أبيض / حسب الطلب"></label>
        <label class="wide">ملاحظات الطلب<textarea id="jmsEditOrderNotes" rows="3">${esc(order.notes || '')}</textarea></label>
      </div>
      <div id="jmsOrderEditError" class="jms-order-edit-error" hidden></div>
      <div class="jms-order-edit-actions"><button type="button" onclick="closeModal()">إلغاء</button><button type="button" class="primary" onclick="jmsSaveEditedSalesOrder('${esc(order.id)}')">حفظ البيانات</button></div>`;
    modal.classList.remove('hidden');
    recalculate();
  };

  window.jmsRecalculateEditedOrder = recalculate;

  window.jmsSaveEditedSalesOrder = function (orderId) {
    if (!allowed()) return alert('لا تملك صلاحية تعديل الطلب');
    const order = (database().orders || []).find(item => item.id === orderId);
    if (!order) return alert('لم يتم العثور على الطلب');
    const value = id => document.getElementById(id)?.value?.trim() || '';
    const values = {
      customer_id: value('jmsEditOrderCustomer'), product: value('jmsEditOrderProduct'), material: value('jmsEditOrderMaterial'),
      width: number(value('jmsEditOrderWidth')), length: number(value('jmsEditOrderLength')), thickness: number(value('jmsEditOrderThickness')),
      total_kg: number(value('jmsEditOrderKg')), price_kg: number(value('jmsEditOrderPrice')),
      color: value('jmsEditOrderColor'), notes: value('jmsEditOrderNotes')
    };
    const missing = [];
    if (!values.customer_id) missing.push('العميل');
    if (!values.product) missing.push('المنتج');
    if (!values.width) missing.push('العرض');
    if (!values.length) missing.push('الطول');
    if (!values.thickness) missing.push('السماكة');
    if (!values.total_kg) missing.push('الكمية');
    if (!values.price_kg) missing.push('سعر الكيلو');
    const error = document.getElementById('jmsOrderEditError');
    if (missing.length) {
      if (error) { error.hidden = false; error.textContent = 'أكمل الحقول التالية: ' + missing.join('، '); }
      return;
    }
    values.amount_value = values.total_kg * values.price_kg;
    Object.assign(order, values, {
      amount: values.amount_value.toFixed(2) + ' ريال',
      updated_at: new Date().toISOString(), updated_by: activeUser()?.name || ''
    });
    const production = (database().productionOrders || []).find(item => item.order_id === order.id);
    if (production) Object.assign(production, {
      customer_id: order.customer_id, product: order.product, material: order.material, color: order.color,
      width: order.width, length: order.length, thickness: order.thickness, total_kg: order.total_kg,
      amount_value: order.amount_value, updated_at: new Date().toISOString()
    });
    saveDb();
    window.closeModal?.();
    window.renderProductionWorkflow?.();
    alert('تم حفظ بيانات الطلب. يمكنك الآن اعتماد الطلب ثم تسجيل التحويل.');
  };

  function enhanceCards() {
    const host = document.getElementById('prodSalesBridgePanel');
    if (!host) return;
    host.querySelectorAll('.jms-prod-card').forEach(card => {
      const actions = card.querySelector('.jms-prod-actions');
      if (!actions || actions.querySelector('.jms-edit-sales-order')) return;
      const action = actions.querySelector('[onclick*="jms11aApproveOrder"], [onclick*="jms11aMarkPaid"], [onclick*="jms11aSendOrderToProduction"]');
      const match = action?.getAttribute('onclick')?.match(/\('([^']+)'\)/);
      if (!match) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jms-edit-sales-order';
      button.textContent = 'تعديل وإكمال البيانات';
      button.onclick = () => window.jmsEditSalesOrder(match[1]);
      actions.prepend(button);
    });
  }

  function injectStyle() {
    if (document.getElementById('jmsProductionOrderEditStyle')) return;
    const style = document.createElement('style');
    style.id = 'jmsProductionOrderEditStyle';
    style.textContent = `
      .jms-edit-sales-order{background:#fff7ed!important;color:#9a3412!important;border:1px solid #fdba74!important;font-weight:800}
      .jms-order-edit-head{background:linear-gradient(125deg,#172033,#34486d);color:#fff;border-radius:17px;padding:18px 20px;margin:-4px -4px 18px}.jms-order-edit-head span{font-size:12px;color:#a7f3d0}.jms-order-edit-head h2{color:#fff;margin:5px 0}.jms-order-edit-head p{margin:0;color:#dbe4f2;font-size:13px}
      .jms-order-edit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.jms-order-edit-grid label{display:flex;flex-direction:column;gap:6px;color:#344054;font-size:12px;font-weight:800}.jms-order-edit-grid .wide{grid-column:span 3}.jms-order-edit-grid input,.jms-order-edit-grid select,.jms-order-edit-grid textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:10px;padding:10px 11px;background:#fff}.jms-order-edit-grid input:focus,.jms-order-edit-grid select:focus,.jms-order-edit-grid textarea:focus{outline:0;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.12)}.jms-order-edit-grid input[readonly]{background:#f2f4f7;color:#475467}.jms-order-edit-error{margin-top:12px;padding:10px 12px;border-radius:10px;background:#fef2f2;color:#b42318;font-weight:800}.jms-order-edit-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:17px;padding-top:14px;border-top:1px solid #eaecf0}.jms-order-edit-actions button{border:1px solid #d0d5dd;border-radius:10px;padding:10px 17px;background:#fff;cursor:pointer}.jms-order-edit-actions .primary{border-color:#172033;background:#172033;color:#fff}
      @media(max-width:720px){.jms-order-edit-grid{grid-template-columns:1fr 1fr}.jms-order-edit-grid .wide{grid-column:span 2}}@media(max-width:480px){.jms-order-edit-grid{grid-template-columns:1fr}.jms-order-edit-grid .wide{grid-column:span 1}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    injectStyle(); enhanceCards();
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-page="orders"],#orders button,.jms-edit-sales-order'))setTimeout(enhanceCards,50);
    },true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.JMS_PRODUCTION_ORDER_EDIT_VERSION = VERSION;
})();
