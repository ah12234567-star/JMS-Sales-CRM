(function(){
  'use strict';
  const CART_KEY='jms_customer_store_cart_v1';
  const CUSTOMER_KEY='jms_customer_store_details_v1';
  const state={products:[],categories:[],category:'الكل',availability:'all',search:'',cart:loadCart(),activeProduct:null,activeVariant:null};
  const $=id=>document.getElementById(id);
  const money=value=>Number(value||0).toLocaleString('ar-SA',{minimumFractionDigits:0,maximumFractionDigits:2});
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function storeSession(){
    try{
      const user=JSON.parse(sessionStorage.getItem('jms_current_user')||'null');
      const token=sessionStorage.getItem('jms_auth_token')||localStorage.getItem('jms_auth_token')||'';
      return user?.role==='admin'&&token?{user,token}:null;
    }catch(_){return null}
  }
  const session=storeSession();

  function loadCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')}catch(_){return[]}}
  function loadCustomer(){try{return JSON.parse(localStorage.getItem(CUSTOMER_KEY)||'{}')}catch(_){return{}}}
  function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(state.cart));renderCartCount()}
  function toast(message){const box=$('storeToast');box.textContent=message;box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),2200)}
  function openDialog(id){const dialog=$(id);if(dialog&&!dialog.open)dialog.showModal()}
  function closeDialog(id){const dialog=$(id);if(dialog?.open)dialog.close()}
  function tierPrice(variant,quantity){let price=Number(variant.price??variant.base_price??0);for(const tier of [...(variant.tiers||[])].sort((a,b)=>Number(a.min_qty)-Number(b.min_qty))){if(quantity>=Number(tier.min_qty||0))price=Number(tier.price||price)}return price}
  function attrText(attributes){return Object.entries(attributes||{}).map(([key,value])=>`${key}: ${value}`).join(' · ')}

  async function loadCatalog(){
    try{
      const response=await fetch('/api/store-catalog',{headers:{Accept:'application/json',Authorization:`Bearer ${session.token}`}});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||'catalog_failed');
      state.products=data.products||[];state.categories=data.categories||[];
      renderCategories();renderCatalog();
    }catch(error){
      console.error(error);$('catalogGrid').innerHTML='<div class="store-empty">تعذر تحميل المنتجات الآن. حاول مرة أخرى بعد قليل.</div>';
      $('catalogSummary').textContent='تعذر الاتصال بالكتالوج';
    }
  }

  function renderCategories(){
    $('categoryChips').innerHTML=['الكل',...state.categories].map(category=>`<button type="button" class="category-chip ${category===state.category?'active':''}" data-category="${esc(category)}">${esc(category)}</button>`).join('');
  }

  function visibleProducts(){
    const query=state.search.trim().toLowerCase();
    return state.products.filter(product=>{
      if(state.category!=='الكل'&&product.category!==state.category)return false;
      if(state.availability==='available'&&!product.available)return false;
      if(state.availability==='unavailable'&&product.available)return false;
      return !query||`${product.name} ${product.category}`.toLowerCase().includes(query);
    });
  }

  function renderCatalog(){
    const products=visibleProducts();
    $('catalogTitle').textContent=state.category==='الكل'?'جميع الأقسام':state.category;
    $('catalogSummary').textContent=`${products.length} منتج رئيسي — كل قسم معروض بشكل مستقل`;
    const productCard=product=>`
      <article class="product-card">
        <div class="product-card-body">
          <h3>${esc(product.name)}</h3>
          <span class="product-meta">${product.variants.length} مقاس أو اختيار</span>
          <div class="product-card-footer">
            <div class="product-price">${product.available?`<small>يبدأ من</small><b>${money(product.from_price)} <span>ر.س</span></b>`:`<span class="availability no">غير متوفر حاليًا</span>`}</div>
            <button type="button" class="view-product" data-product-id="${esc(product.id)}">عرض الخيارات</button>
          </div>
        </div>
      </article>`;
    const categories=state.category==='الكل'?state.categories:[state.category];
    $('catalogGrid').innerHTML=products.length?categories.map(category=>{
      const categoryProducts=products.filter(product=>product.category===category);
      if(!categoryProducts.length)return '';
      return `<section class="category-section">
        <header class="category-section-header">
          <img src="${esc(categoryProducts[0].image)}" alt="${esc(category)}" loading="lazy">
          <div><span>قسم المنتجات</span><h3>${esc(category)}</h3><p>${categoryProducts.length} منتجات — اختر الصنف ثم المقاس والتعبئة</p></div>
        </header>
        <div class="category-product-grid">${categoryProducts.map(productCard).join('')}</div>
      </section>`;
    }).join(''):'<div class="store-empty">لا توجد منتجات مطابقة للبحث.</div>';
  }

  function openProduct(productId){
    const product=state.products.find(item=>item.id===productId);if(!product)return;
    state.activeProduct=product;
    state.activeVariant=product.variants.find(item=>item.available)||product.variants[0];
    renderProductDialog();openDialog('productDialog');
  }

  function attributeKeys(product){
    const keys=[];for(const variant of product.variants)for(const key of Object.keys(variant.attributes||{}))if(!keys.includes(key))keys.push(key);
    return keys;
  }

  function renderProductDialog(){
    const product=state.activeProduct,variant=state.activeVariant;if(!product||!variant)return;
    const keys=attributeKeys(product);
    const controls=keys.map(key=>{
      const values=[...new Set(product.variants.map(item=>item.attributes?.[key]).filter(Boolean))];
      if(values.length===1)return `<label>${esc(key)}<select disabled><option>${esc(values[0])}</option></select></label>`;
      return `<label>${esc(key)}<select data-attribute="${esc(key)}">${values.map(value=>`<option value="${esc(value)}" ${variant.attributes?.[key]===value?'selected':''}>${esc(value)}</option>`).join('')}</select></label>`;
    }).join('');
    const quantity=Math.min(1,Math.max(0.001,Number(variant.stock||0)));
    const quantityStep=Number(variant.stock||0)<1?'0.001':'1';
    $('productDialogBody').innerHTML=`
      <img class="product-detail-image" src="${esc(product.image)}" alt="${esc(product.name)}">
      <div class="product-detail-content">
        <span class="product-category">${esc(product.category)}</span><h2>${esc(product.name)}</h2><p>اختر المواصفات المطلوبة ليظهر السعر والمخزون الصحيحان.</p>
        <div class="attribute-grid">${controls}</div>
        <div class="selected-variant"><div class="selected-variant-price"><small>سعر ${esc(variant.unit)}</small><b id="variantPrice">${money(tierPrice(variant,quantity))} ر.س</b></div><span class="stock-pill ${variant.available?'':'no'}">${variant.available?`متوفر: ${money(variant.stock)} ${esc(variant.unit)}`:'غير متوفر'}</span></div>
        <div class="quantity-row"><label>الكمية بـ${esc(variant.unit)}<input id="variantQuantity" type="number" min="${quantity}" step="${quantityStep}" max="${Math.max(0,Number(variant.stock||0))}" value="${quantity}" ${variant.available?'':'disabled'}></label><button id="addCartButton" class="add-cart" type="button" ${variant.available?'':'disabled'}>إضافة إلى السلة</button></div>
        <div id="tierNote" class="tier-note">${(variant.tiers||[]).length?'يتغير السعر تلقائيًا عند الوصول إلى كمية الخصم.':''}</div>
      </div>`;
  }

  function chooseVariant(changedKey,changedValue){
    const product=state.activeProduct,current=state.activeVariant;if(!product||!current)return;
    const desired={...(current.attributes||{}),[changedKey]:changedValue};
    let candidates=product.variants.filter(variant=>Object.entries(desired).every(([key,value])=>!value||variant.attributes?.[key]===value));
    if(!candidates.length)candidates=product.variants.filter(variant=>variant.attributes?.[changedKey]===changedValue);
    state.activeVariant=candidates.find(item=>item.available)||candidates[0]||current;
    renderProductDialog();
  }

  function updateDialogPrice(){
    const quantity=Number($('variantQuantity')?.value||0),variant=state.activeVariant;if(!variant)return;
    const price=tierPrice(variant,quantity);if($('variantPrice'))$('variantPrice').textContent=`${money(price)} ر.س`;
    const tier=[...(variant.tiers||[])].filter(item=>quantity>=Number(item.min_qty)).sort((a,b)=>b.min_qty-a.min_qty)[0];
    if($('tierNote'))$('tierNote').textContent=tier?`تم تطبيق سعر الكمية ابتداءً من ${tier.min_qty} ${variant.unit}.`:(variant.tiers||[]).length?'زد الكمية للاستفادة من سعر الجملة.':'';
  }

  function addActiveToCart(){
    const product=state.activeProduct,variant=state.activeVariant,quantity=Number($('variantQuantity')?.value||0);
    if(!product||!variant||!variant.available||quantity<=0)return;
    if(quantity>Number(variant.stock))return toast('الكمية المطلوبة أكبر من المخزون المتوفر');
    const existing=state.cart.find(item=>item.variant_id===variant.id);
    if(existing)existing.quantity=Math.round((Number(existing.quantity)+quantity)*100)/100;
    else state.cart.push({variant_id:variant.id,product_name:product.name,attributes:variant.attributes,unit:variant.unit,quantity,image:product.image,price:variant.price,base_price:variant.price,stock:variant.stock,tiers:variant.tiers||[]});
    saveCart();closeDialog('productDialog');toast('تمت إضافة الصنف إلى السلة');
  }

  function renderCartCount(){
    const count=state.cart.reduce((sum,item)=>sum+Number(item.quantity||0),0);$('cartCount').textContent=money(count);
  }

  function renderCart(){
    if(!state.cart.length){$('cartDialogBody').innerHTML='<div class="cart-content"><h2>سلة الطلب</h2><div class="store-empty">السلة فارغة. اختر المنتجات والمقاسات أولًا.</div></div>';return}
    const total=state.cart.reduce((sum,item)=>sum+tierPrice(item,Number(item.quantity))*Number(item.quantity),0);
    const customer=loadCustomer();
    const cities=['جدة','مكة المكرمة','الرياض','المدينة المنورة','الدمام','الخبر','الطائف','تبوك','أبها','خميس مشيط','جازان','ينبع','أخرى'];
    $('cartDialogBody').innerHTML=`<div class="cart-content"><div class="cart-title"><h2>سلة الطلب</h2><span>${state.cart.length} أصناف</span></div><div class="cart-list">${state.cart.map((item,index)=>{const unitPrice=tierPrice(item,Number(item.quantity));const lineTotal=unitPrice*Number(item.quantity);return `
      <div class="cart-item">
        <img class="cart-item-image" src="${esc(item.image)}" alt="${esc(item.product_name)}">
        <div class="cart-item-info"><h3>${esc(item.product_name)}</h3><p>${esc(attrText(item.attributes))}</p><div class="cart-unit-price">${unitPrice?`السعر: <b>${money(unitPrice)} ر.س</b> / ${esc(item.unit)}`:'<b>السعر عند الطلب</b>'}</div><div class="cart-item-controls"><span>الكمية:</span><div class="quantity-stepper"><button type="button" data-qty-action="minus" data-qty-index="${index}" aria-label="نقص الكمية">−</button><input data-cart-quantity="${index}" type="number" min="1" step="1" value="${Number(item.quantity)}" aria-label="كمية ${esc(item.product_name)}"><button type="button" data-qty-action="plus" data-qty-index="${index}" aria-label="زيادة الكمية">+</button></div></div></div>
        <div class="cart-item-side"><button class="remove-item" type="button" data-remove-index="${index}" aria-label="حذف ${esc(item.product_name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg><span>حذف</span></button><div class="cart-item-total"><small>المجموع</small><b>${unitPrice?`${money(lineTotal)} ر.س`:'طلب سعر'}</b></div></div>
      </div>`}).join('')}</div>
      <div class="cart-total"><span>الإجمالي المبدئي</span><b>${money(total)} ر.س</b></div>
      <section class="shipping-section"><div class="shipping-heading"><div><span>بيانات الشحن والتوصيل</span><h3>أين نوصّل طلبك؟</h3></div><button type="button" class="customer-login" disabled title="يتطلب تفعيل رمز التحقق">دخول العميل قريبًا</button></div>
      <form id="checkoutForm" class="checkout-form"><label>الاسم<input name="name" value="${esc(customer.name||'')}" required minlength="2" autocomplete="name"></label><label>رقم الجوال<input name="phone" value="${esc(customer.phone||'')}" required inputmode="tel" placeholder="05xxxxxxxx" autocomplete="tel"></label><label>البريد الإلكتروني <small>(اختياري)</small><input name="email" value="${esc(customer.email||'')}" type="email" placeholder="name@example.com" autocomplete="email"></label><label>المدينة<select name="city" required>${cities.map(city=>`<option value="${city}" ${(customer.city||'جدة')===city?'selected':''}>${city}</option>`).join('')}</select></label><label>الحي<input name="district" value="${esc(customer.district||'')}" required></label><label class="wide">العنوان أو رابط الموقع<input name="address" value="${esc(customer.address||'')}" placeholder="اكتب العنوان أو ألصق رابط الموقع"></label><label class="wide">ملاحظات<textarea name="notes" rows="3" placeholder="موعد مناسب، تعليمات التسليم...">${esc(customer.notes||'')}</textarea></label><label class="remember-details wide"><input type="checkbox" name="remember" ${Object.keys(customer).length?'checked':''}><span>حفظ بياناتي للطلب القادم على هذا الجهاز</span></label><input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><div class="checkout-sticky"><div><small>الإجمالي</small><b>${money(total)} ر.س</b></div><button class="checkout-submit" type="submit">إتمام الطلب</button></div></form></section></div>`;
  }

  function updateCartQuantity(index,value){
    const item=state.cart[index];if(!item)return;
    let quantity=Math.max(1,Math.round(Number(value||1)));
    if(Number(item.stock)>0&&quantity>Number(item.stock)){quantity=Math.floor(Number(item.stock));toast('وصلت إلى الكمية المتوفرة في المخزون')}
    item.quantity=quantity;saveCart();renderCart();
  }

  async function submitOrder(form){
    const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='جارٍ إرسال الطلب...';
    const values=Object.fromEntries(new FormData(form).entries());
    if(values.remember)localStorage.setItem(CUSTOMER_KEY,JSON.stringify({name:values.name,phone:values.phone,email:values.email,city:values.city,district:values.district,address:values.address,notes:values.notes}));
    else localStorage.removeItem(CUSTOMER_KEY);
    try{
      const response=await fetch('/api/store-orders',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify({customer:{name:values.name,phone:values.phone,email:values.email,city:values.city,district:values.district,address:values.address,notes:values.notes},website:values.website,items:state.cart.map(item=>({variant_id:item.variant_id,quantity:item.quantity}))})});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.message||data.error||'تعذر إرسال الطلب');
      state.cart=[];saveCart();$('cartDialogBody').innerHTML=`<div class="order-success"><span class="check">✓</span><h2>تم استلام طلبك</h2><p>رقم الطلب: <b>${esc(data.order_no)}</b><br>الإجمالي: <b>${money(data.total)} ر.س</b><br>سيتواصل معك فريق المبيعات لتأكيد الطلب والتسليم.</p></div>`;
    }catch(error){toast(error.message);button.disabled=false;button.textContent='إرسال الطلب إلى المصنع'}
  }

  document.addEventListener('click',event=>{
    const category=event.target.closest('[data-category]');if(category){state.category=category.dataset.category;renderCategories();renderCatalog();return}
    const product=event.target.closest('[data-product-id]');if(product){openProduct(product.dataset.productId);return}
    const close=event.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return}
    const remove=event.target.closest('[data-remove-index]');if(remove){state.cart.splice(Number(remove.dataset.removeIndex),1);saveCart();renderCart();return}
    const qty=event.target.closest('[data-qty-action]');if(qty){const index=Number(qty.dataset.qtyIndex),current=Number(state.cart[index]?.quantity||1);updateCartQuantity(index,current+(qty.dataset.qtyAction==='plus'?1:-1));return}
    if(event.target.closest('#cartButton')){renderCart();openDialog('cartDialog');return}
    if(event.target.closest('#addCartButton'))addActiveToCart();
  });
  document.addEventListener('change',event=>{if(event.target.matches('[data-attribute]'))chooseVariant(event.target.dataset.attribute,event.target.value);if(event.target.id==='availabilityFilter'){state.availability=event.target.value;renderCatalog()}if(event.target.matches('[data-cart-quantity]'))updateCartQuantity(Number(event.target.dataset.cartQuantity),event.target.value)});
  document.addEventListener('input',event=>{if(event.target.id==='catalogSearch'){state.search=event.target.value;renderCatalog()}if(event.target.id==='variantQuantity')updateDialogPrice()});
  document.addEventListener('submit',event=>{if(event.target.id==='checkoutForm'){event.preventDefault();submitOrder(event.target)}});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()}));
  if(!session){
    document.body.innerHTML='<main class="private-store"><div class="private-store-card"><img src="/assets/company-logo.svg" alt="شركة جدة النموذجية للصناعة"><span>المتجر تحت التجهيز</span><h1>الدخول خاص بالإدارة حاليًا</h1><p>سيتم فتح المتجر للعملاء بعد اكتمال مراجعة المنتجات والأسعار.</p><a href="/">دخول الإدارة</a></div></main>';
    return;
  }
  renderCartCount();loadCatalog();
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
})();
