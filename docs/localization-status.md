# Account language

The CRM reads the language from the authenticated account on sign-in and session refresh. Arabic is the default. The sidebar language selector saves changes through the authenticated language endpoint. Arabic and English UI strings are in locales/ar.json and locales/en.json. Product option values, customer data and document language are independent of the interface language.

The development preview used a synthetic English-speaking representative. It covered navigation, opening the quotation form, English payment and product labels, computed LTR direction, and calculating 100 kg at SAR 8/kg as SAR 800. No customer quotation was created in production. Production account settings for Shafiq were checked separately.
