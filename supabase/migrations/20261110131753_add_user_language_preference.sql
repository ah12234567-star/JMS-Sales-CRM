-- Applied through Supabase migration add_user_language_preference.
-- Additive; existing users keep Arabic and existing authorization is unchanged.
alter table public.jms_users
  add column language text not null default 'ar'
  constraint jms_users_language_check check (language in ('ar','en'));
