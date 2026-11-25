create table public.jms_ink_count_items (
  id integer generated always as identity primary key,
  label text not null unique
);
create table public.jms_ink_count_entries (
  id uuid primary key,
  count_year integer not null default extract(year from now() at time zone 'Asia/Riyadh'),
  item_id integer not null references public.jms_ink_count_items,
  shelf text not null check(length(trim(shelf)) between 1 and 40),
  gross_g integer not null check(gross_g between 1750 and 1000000),
  tare_g integer not null default 1750 check(tare_g between 0 and gross_g),
  operator_id text not null,
  created_at timestamptz not null default now()
);
create index on public.jms_ink_count_entries(count_year,item_id,created_at);
alter table public.jms_ink_count_items enable row level security;
alter table public.jms_ink_count_entries enable row level security;
revoke all on public.jms_ink_count_items, public.jms_ink_count_entries from anon,authenticated;
grant select on public.jms_ink_count_items to service_role;
grant select,insert on public.jms_ink_count_entries to service_role;
