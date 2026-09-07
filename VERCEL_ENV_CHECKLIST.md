# متغيرات Vercel المطلوبة قبل النشر

اضبط القيم في Production وPreview من إعدادات Vercel، ولا تضع أي قيمة سرية في Git.

## مطلوبة

- `AUTH_SECRET`: قيمة عشوائية جديدة بطول 64 حرفًا سداسيًا على الأقل. تغييرها ينهي الجلسات القديمة.
- `SUPABASE_URL`: رابط مشروع Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: مفتاح service role، للخادم فقط.
- `META_WHATSAPP_ACCESS_TOKEN`: رمز وصول دائم مخصص لواتساب.
- `META_WHATSAPP_PHONE_NUMBER_ID`: رقم تعريف هاتف واتساب المخصص للنظام.
- `META_WHATSAPP_APP_SECRET`: سر تطبيق Meta للتحقق من توقيع طلبات Webhook.
- `META_WHATSAPP_VERIFY_TOKEN_HASH`: بصمة SHA-256 لرمز تحقق Webhook؛ لا تحفظ الرمز الخام في Git.
- `META_WHATSAPP_RESET_TEMPLATE`: اسم القالب العربي المعتمد، والقيمة المقترحة `jms_password_reset_ar`.
- `META_WHATSAPP_RESET_LANGUAGE`: القيمة `ar`.
- `META_WHATSAPP_OTP_TEMPLATE`: اسم قالب رمز العميل المعتمد.
- `META_WHATSAPP_OTP_LANGUAGE`: القيمة `ar`.
- `ALLOWED_ORIGIN`: رابط النظام النهائي فقط، مثل `https://crm.example.com`.

## تدوير كلمات مرور المستخدمين

1. شغّل `node scripts/rotate-user-passwords.mjs` في بيئة تملك `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`.
2. ستُنشأ كلمات مرور عشوائية قوية وتُحفظ مباشرة كـ PBKDF2 hashes.
3. احفظ الملف المؤقت الناتج في مدير كلمات مرور، ووزّع كل كلمة لصاحبها عبر قناة آمنة.
4. احذف الملف المؤقت بعد التسليم. لا ترفعه إلى Git.
5. غيّر `AUTH_SECRET` بعد التدوير لإلغاء كل الجلسات القديمة.

## فحص قبل الإطلاق

```bash
node scripts/check-production-env.mjs
```
