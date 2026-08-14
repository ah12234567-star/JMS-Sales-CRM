/* JMS one-time migration: Othman representative and ERP customer portfolio. */
(function () {
  'use strict';

  const VERSION = '2026-08-14-othman-portfolio-1';
  const REP_ID = 'rep-othman';
  const REP_NAME = 'عثمان';
  const SOURCE = 'أعمار عثمان - 29-04-2026';
  const customers = [
    ['11110606', 'مؤسسة جوهرة ثقيف الدولية (سليب لايت - فنون)'],
    ['11110635', 'شركة البصمة العالمية للمفروشات'],
    ['11110639', 'شركة سياج الغربية للتجارة'],
    ['11110621', 'شركة عدن العربية للتجارة - كنوز'],
    ['11110627', 'مؤسسة نوم الأحلام فرع جازان (سليب دريم)'],
    ['11110618', 'شركة فايكوم للتجارة شركة شخص واحد'],
    ['11110672', 'مؤسسة رواب الراقي للتجارة'],
    ['11110605', 'شركة مارج المتحدة التجارية (سليب راحتين)'],
    ['1111010761', 'مؤسسة سليب روعة للمفروشات'],
    ['11110646', 'مؤسسة محمد سالم الصحفي للتجارة (سليب لايف)'],
    ['11110638', 'مؤسسة زهير عبدالمجيد داود خان (سليب المستقبل - سويت دريم)'],
    ['11110615', 'مؤسسة الراقية التجارية (هابي هوم)'],
    ['11110617', 'مؤسسة سعيدة عقيل بن أحمد الثعلبي (سليب بيتي)'],
    ['11110656', 'مؤسسة كوكب الشرق المالكي'],
    ['11110650', 'مؤسسة الوردة المميزة للتشغيل والصيانة'],
    ['1111010795', 'مؤسسة مريم عبدالملك عبدالكريم للتجارة'],
    ['1111011015', 'محل نمرة للمفارش (سليب دبليو)'],
    ['1111011062', 'شركة مارج المتحدة التجارية (سليب ريلاكس)'],
    ['1111010684', 'مؤسسة أرائك المدينة للمفروشات (سليبي سمارت)'],
    ['11110678', 'شركة أشجان التجارية'],
    ['11110616', 'مصنع بيت المرتبة للصناعة (سلطان كلاسيك)'],
    ['1111010756', 'شركة دار البدرية لتقديم الوجبات (كابيبو)'],
    ['11110648', 'مؤسسة أصايل خلف دبيان العتيبي للتجارة (سليب أون لاين)'],
    ['11110607', 'مؤسسة كاملة أحمد علي الكيادي للتجارة'],
    ['11110609', 'مؤسسة خالد سعيد محمد الشويكي'],
    ['11110612', 'شركة مصنع المركز التقدمي لإنتاج كيماويات مواد البناء المحدودة (بولي فود)'],
    ['11110614', 'المصنع الوطني لصناعة الصفيح - فرع شركة مصنع عبدالرحمن محمد الهدار'],
    ['11110637', 'مصنع ريان عبدالله عسيري (سليب أحلام)'],
    ['11110674', 'مصنع سليب كمفورت (الحلم السعيد)'],
    ['11110640', 'مؤسسة عبدالله فهد بن حسين العمودي (سيفز سليب)'],
    ['11110663', 'شركة الإبداع للتجارة'],
    ['11110677', 'مؤسسة رواب الراقية (سليب جوهران)'],
    ['11110644', 'مؤسسة معيّض عوض عيضة الحليسي المالكي (سليب إخوان)'],
    ['1111010674', 'مؤسسة البساط النادر التجارية'],
    ['11110641', 'مؤسسة منى حميدان الجدعاني (سوبر نايت)'],
    ['11110652', 'مؤسسة خالد علي سالم حميدي (مراتب سوفت الطبية)'],
    ['11110630', 'سرر مرحبا']
  ];

  function normalize(value) {
    return String(value || '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[\s\-–—()]/g, '')
      .trim();
  }

  function ensureRep() {
    db.reps ||= [];
    let rep = db.reps.find(item => item.id === REP_ID || normalize(item.name) === normalize(REP_NAME));
    if (!rep) {
      rep = { id: REP_ID, name: REP_NAME, email: '', phone: '', role: 'rep', status: 'active', area: 'جدة' };
      db.reps.push(rep);
    } else {
      rep.id = rep.id || REP_ID;
      rep.name = REP_NAME;
      rep.role = 'rep';
      rep.status = 'active';
    }
    return rep.id;
  }

  function migrate() {
    if (typeof db === 'undefined') return;
    db.customers ||= [];
    const repId = ensureRep();
    let added = 0;
    let assigned = 0;

    customers.forEach(([accountCode, name]) => {
      let customer = db.customers.find(item => String(item.account_code || item.erp_code || '') === accountCode);
      if (!customer) customer = db.customers.find(item => normalize(item.name) === normalize(name));

      if (!customer) {
        customer = {
          id: 'customer-erp-' + accountCode,
          name,
          phone: '',
          city: 'جدة',
          district: '',
          location: '',
          category: 'عميل',
          status: 'active',
          rep_id: repId,
          debt_balance: 0,
          credit_limit: 0,
          account_code: accountCode,
          notes: '',
          import_source: SOURCE,
          othman_import_version: VERSION,
          created_at: new Date().toISOString()
        };
        db.customers.push(customer);
        added += 1;
        return;
      }

      customer.account_code ||= accountCode;
      customer.status ||= 'active';
      customer.category ||= 'عميل';
      if (!customer.othman_import_version) {
        customer.rep_id = repId;
        customer.debt_balance = 0;
        customer.credit_limit = 0;
        customer.import_source = SOURCE;
        customer.othman_import_version = VERSION;
        assigned += 1;
      }
    });

    db.othmanPortfolioImport = {
      version: VERSION,
      representative_id: repId,
      customer_count: customers.length,
      imported_at: db.othmanPortfolioImport?.imported_at || new Date().toISOString()
    };

    if (typeof save === 'function') save();
    if (typeof renderAll === 'function' && window.currentUser) renderAll();
    if ((added || assigned) && typeof window.jmsToast === 'function') {
      window.jmsToast('تم تجهيز مندوب عثمان وربط ' + customers.length + ' عميل بدون مديونيات', 'success');
    }
  }

  // Cloud data is pulled shortly after startup; run after it, then reconcile once more.
  window.addEventListener('load', function () {
    setTimeout(migrate, 2600);
    setTimeout(migrate, 7000);
  }, { once: true });
})();
