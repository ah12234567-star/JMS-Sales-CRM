(function(){
  'use strict';
  const CART_KEY='jms_customer_store_cart_v1';
  const state={products:[],categories:[],category:'الكل',availability:'all',search:'',cart:loadCart(),activeProduct:null,activeVariant:null};
  const $=id=>document.getElementById(id);
  const money=value=>Number(value||0).toLocaleString('ar-SA',{minimumFractionDigits:0,maximumFractionDigits:2});
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function loadCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')}catch(_){return[]}}
  function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(state.cart));renderCartCount()}
  function toast(message){const box=$('storeToast');box.textContent=message;box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),2200)}
  function openDialog(id){const dialog=$(id);if(dialog&&!dialog.open)dialog.showModal()}
  function closeDialog(id){const dialog=$(id);if(dialog?.open)dialog.close()}
  function tierPrice(variant,quantity){let price=Number(variant.price||0);for(const tier of [...(variant.tiers||[])].sort((a,b)=>Number(a.min_qty)-Number(b.min_qty))){if(quantity>=Number(tier.min_qty||0))price=Number(tier.price||price)}return price}
  function attrText(attributes){return Object.entries(attributes||{}).map(([key,value])=>`${key}: ${value}`).join(' · ')}

  async function loadCatalog(){
    try{
      const response=await fetch('/api/store-catalog',{headers:{Accept:'application/json'}});
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
    $('catalogTitle').textContent=state.category==='الكل'?'جميع المنتجات':state.category;
    $('catalogSummary').textContent=`${products.length} منتج رئيسي — اختر المنتج لعرض المقاسات والأسعار`;
    $('catalogGrid').innerHTML=products.length?products.map(product=>`
      <article class="product-card">
        <img class="product-image" src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">
        <div class="product-card-body">
          <span class="product-category">${esc(product.category)}</span>
          <h3>${esc(product.name)}</h3>
          <span class="product-meta">${product.variants.length} مقاس أو اختيار</span>
          <div class="product-card-footer">
            <div class="product-price">${product.available?`<small>يبدأ من</small><b>${money(product.from_price)} <span>ر.س</span></b>`:`<span class="availability no">غير متوفر حاليًا</span>`}</div>
            <button type="button" class="view-product" data-product-id="${esc(product.id)}">عرض الخيارات</button>
          </div>
        </div>
      </article>`).join(''):'<div class="store-empty">لا توجد منتجات مطابقة للبحث.</div>';
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
    else state.cart.push({variant_id:variant.id,product_name:product.name,attributes:variant.attributes,unit:variant.unit,quantity,image:product.image,base_price:variant.price,tiers:variant.tiers||[]});
    saveCart();closeDialog('productDialog');toast('تمت إضافة الصنف إلى السلة');
  }

  function renderCartCount(){
    const count=state.cart.reduce((sum,item)=>sum+Number(item.quantity||0),0);$('cartCount').textContent=money(count);
  }

  function renderCart(){
    if(!state.cart.length){$('cartDialogBody').innerHTML='<div class="cart-content"><h2>سلة الطلب</h2><div class="store-empty">السلة فارغة. اختر المنتجات والمقاسات أولًا.</div></div>';return}
    const total=state.cart.reduce((sum,item)=>sum+tierPrice(item,Number(item.quantity))*Number(item.quantity),0);
    $('cartDialogBody').innerHTML=`<div class="cart-content"><h2>سلة الطلب</h2><div class="cart-list">${state.cart.map((item,index)=>`
      <div class="cart-item"><div><h3>${esc(item.product_name)}</h3><p>${esc(attrText(item.attributes))}</p><p>${money(item.quantity)} ${esc(item.unit)} × ${money(tierPrice(item,Number(item.quantity)))} ر.س</p></div><div class="cart-item-total"><b>${money(tierPrice(item,Number(item.quantity))*Number(item.quantity))} ر.س</b><button class="remove-item" type="button" data-remove-index="${index}">حذف</button></div></div>`).join('')}</div>
      <div class="cart-total"><span>الإجمالي المبدئي</span><b>${money(total)} ر.س</b></div>
      <form id="checkoutForm" class="checkout-form"><label>الاسم<input name="name" required minlength="2" autocomplete="name"></label><label>رقم الجوال<input name="phone" required inputmode="tel" placeholder="05xxxxxxxx" autocomplete="tel"></label><label>المدينة<input name="city" value="جدة" required></label><label>الحي<input name="district" required></label><label class="wide">العنوان أو رابط الموقع<input name="address" placeholder="اكتب العنوان أو ألصق رابط الموقع"></label><label class="wide">ملاحظات<textarea name="notes" rows="3" placeholder="موعد مناسب، تعليمات التسليم..."></textarea></label><input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><button class="checkout-submit" type="submit">إرسال الطلب إلى المصنع</button></form></div>`;
  }

  async function submitOrder(form){
    const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='جارٍ إرسال الطلب...';
    const values=Object.fromEntries(new FormData(form).entries());
    try{
      const response=await fetch('/api/store-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:{name:values.name,phone:values.phone,city:values.city,district:values.district,address:values.address,notes:values.notes},website:values.website,items:state.cart.map(item=>({variant_id:item.variant_id,quantity:item.quantity}))})});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.message||data.error||'تعذر إرسال الطلب');
      state.cart=[];saveCart();$('cartDialogBody').innerHTML=`<div class="order-success"><span class="check">✓</span><h2>تم استلام طلبك</h2><p>رقم الطلب: <b>${esc(data.order_no)}</b><br>الإجمالي: <b>${money(data.total)} ر.س</b><br>سيتواصل معك فريق المبيعات لتأكيد الطلب والتسليم.</p></div>`;
    }catch(error){toast(error.message);button.disabled=false;button.textContent='إرسال الطلب إلى المصنع'}
  }

  document.addEventListener('click',event=>{
    const category=event.target.closest('[data-category]');if(category){state.category=category.dataset.category;renderCategories();renderCatalog();return}
    const product=event.target.closest('[data-product-id]');if(product){openProduct(product.dataset.productId);return}
    const close=event.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return}
    const remove=event.target.closest('[data-remove-index]');if(remove){state.cart.splice(Number(remove.dataset.removeIndex),1);saveCart();renderCart();return}
    if(event.target.closest('#cartButton')){renderCart();openDialog('cartDialog');return}
    if(event.target.closest('#addCartButton'))addActiveToCart();
  });
  document.addEventListener('change',event=>{if(event.target.matches('[data-attribute]'))chooseVariant(event.target.dataset.attribute,event.target.value);if(event.target.id==='availabilityFilter'){state.availability=event.target.value;renderCatalog()}});
  document.addEventListener('input',event=>{if(event.target.id==='catalogSearch'){state.search=event.target.value;renderCatalog()}if(event.target.id==='variantQuantity')updateDialogPrice()});
  document.addEventListener('submit',event=>{if(event.target.id==='checkoutForm'){event.preventDefault();submitOrder(event.target)}});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()}));
  renderCartCount();loadCatalog();
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
})();
