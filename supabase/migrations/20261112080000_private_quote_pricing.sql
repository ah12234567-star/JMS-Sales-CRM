create table public.jms_private_quote_pricing (
  id text primary key check (id = 'pricing'),
  rates jsonb not null
);
alter table public.jms_private_quote_pricing enable row level security;
revoke all on public.jms_private_quote_pricing from public, anon, authenticated;
grant select, insert, update on public.jms_private_quote_pricing to service_role;
