# JMS Factory CRM

نظام إدارة المبيعات والعملاء والزيارات وعروض الأسعار وطلبات التصنيع.

## التشغيل المحلي

```bash
npm install
vercel env pull .env.local --yes
npm test
npm start
```

لا توجد حسابات أو كلمات مرور افتراضية داخل المستودع. ينشئ مدير النظام المستخدمين من واجهة الإدارة، وتُحفظ كلمات المرور كقيم PBKDF2 مشتقة وليست كنص صريح.

## متطلبات الأمان قبل النشر

1. طبّق `supabase/migrations/20260907_security_lockdown.sql` على قاعدة البيانات.
2. اضبط جميع القيم المدرجة في `VERCEL_ENV_CHECKLIST.md` داخل Vercel.
3. شغّل `node scripts/check-production-env.mjs` وتأكد من نجاحه.
4. دوّر كلمات مرور المستخدمين بواسطة `node scripts/rotate-user-passwords.mjs` من بيئة آمنة.
5. غيّر `AUTH_SECRET` لإلغاء الجلسات السابقة.

## البنية الأمنية

- المتصفح يتصل بمسارات `/api` من نفس النطاق.
- مسارات الخادم وحدها تستخدم `SUPABASE_SERVICE_ROLE_KEY`.
- لا توجد سياسات قراءة أو كتابة مباشرة للأدوار `anon` و`authenticated` على جداول JMS.
- عرض السعر العام لا يعيد إلا الحقول اللازمة، ولا يُقرأ أو يُوقّع إلا بعد مطابقة رمز عام عشوائي.
- مفاتيح واتساب وأرقام التعريف تأتي حصريًا من متغيرات Vercel.

## الاختبارات

```bash
npm test
npm run check:syntax
npm run check:secrets
```

## التوثيق

دليل المندوب النهائي: `docs/JMS_Rep_User_Guide_AR.docx`.
