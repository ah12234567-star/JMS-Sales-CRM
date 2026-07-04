# JMS CRM - إعداد المرحلة الأولى للأمان

## ما تم تعديله
- إزالة أي كلمة مرور افتراضية من شاشة الدخول والكود المحلي.
- تسجيل الدخول أصبح عبر `/api/auth-login` من السيرفر.
- كلمات المرور تُحفظ مشفرة داخل جدول `jms_users` في Supabase.
- تغيير كلمة المرور يعمل على جميع الأجهزة عبر `/api/auth-change-password`.
- إنشاء المستخدمين وإعادة تعيين كلمة المرور من لوحة المدير يعمل عبر السيرفر فقط.
- استعادة كلمة المرور برمز تحقق عبر WhatsApp Cloud API أو SMS Twilio.

## 1) شغّل SQL في Supabase
افتح Supabase → SQL Editor وشغّل ملف:

`supabase_schema.sql`

هذا ينشئ الجداول:
- `jms_users`
- `jms_password_resets`

## 2) أضف متغيرات Vercel
Project → Settings → Environment Variables

المتغيرات المطلوبة:

```
SUPABASE_URL=رابط مشروع Supabase
SUPABASE_SERVICE_ROLE_KEY=Service Role Key من Supabase وليس anon key
AUTH_SECRET=اكتب نص طويل عشوائي
INIT_ADMIN_EMAIL=admin@jms.local
INIT_ADMIN_PASSWORD=كلمة مرور قوية مؤقتة للمدير أول مرة
INIT_ADMIN_PHONE=9665xxxxxxxx
```

متغيرات WhatsApp الاختيارية:

```
WHATSAPP_ACCESS_TOKEN=token من Meta WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=Phone Number ID
```

أو SMS عبر Twilio:

```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=...
```

## 3) أول دخول للمدير
بعد ضبط المتغيرات وإعادة النشر، ادخل بالبريد الموجود في:

`INIT_ADMIN_EMAIL`

وكلمة المرور الموجودة في:

`INIT_ADMIN_PASSWORD`

سيتم إنشاء المدير تلقائيًا في جدول `jms_users` أول مرة فقط، وبعدها يمكنك تغيير كلمة المرور من النظام.

## 4) مهم جدًا
- لا تضع كلمة مرور داخل `app.js`.
- لا تعرض بيانات الدخول على صفحة الدخول.
- لا تستخدم `SUPABASE_SERVICE_ROLE_KEY` داخل المتصفح؛ فقط في Vercel Environment Variables.
- بعد تعديل أي Environment Variable اضغط Redeploy.
