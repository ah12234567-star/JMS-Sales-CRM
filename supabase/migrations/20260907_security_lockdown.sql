-- JMS production security lockdown.
-- Browser clients must never access CRM tables directly. All access goes
-- through authenticated same-origin Vercel API routes using service_role.

do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'jms_customers','jms_quotes','jms_visits','jms_orders','jms_collections',
    'jms_routes','jms_rep_attendance','jms_rep_locations','jms_rep_targets',
    'jms_smart_visits','jms_users','jms_password_resets','jms_ready_goods'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      for policy_row in
        select policyname from pg_policies where schemaname='public' and tablename=table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
      end loop;
    end if;
  end loop;
end $$;

-- service_role intentionally bypasses RLS and is only available to server APIs.
grant usage on schema public to service_role;
