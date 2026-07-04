# JMS CRM Secure Auth Setup

هذه النسخة أزالت بيانات الدخول من الشاشة، وأصبحت كلمة المرور تعمل عبر Backend وليس عبر LocalStorage.

## 1) شغل SQL في Supabase
افتح Supabase > SQL Editor وشغل ملف `supabase_schema.sql` كاملًا.

## 2) أضف Environment Variables في Vercel
إجباري:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`  ⚠️ لا تضعه في `config.js`
- `AUTH_SECRET` أي نص طويل عشوائي
- `INIT_ADMIN_EMAIL` مثال: `admin@jms.local`
- `INIT_ADMIN_PASSWORD` كلمة مرور أولية قوية، وليست 123456
- `INIT_ADMIN_PHONE` رقم واتساب المدير بصيغة دولية مثل `9665xxxxxxxx`

للاستعادة عبر واتساب Cloud API:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

أو عبر SMS Twilio:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM`

## 3) أول دخول
بعد النشر، سجل الدخول بـ `INIT_ADMIN_EMAIL` و `INIT_ADMIN_PASSWORD`.
سيتم إنشاء المدير في جدول `jms_users` تلقائيًا بأمان.

## 4) مهم
لن تظهر كلمة المرور في الشاشة. تغيير كلمة المرور يتم عبر Backend وينطبق على كل الأجهزة.
