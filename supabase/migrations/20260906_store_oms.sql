-- JMS Store OMS
create extension if not exists pgcrypto;

create table if not exists store_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id text,
  customer_name text not null,
  customer_phone text not null,
  city text,
  district text,
  address text,
  notes text,
  status text not null default 'new' check (status in ('new','approved','picking','ready','loaded','out_for_delivery','delivered','cancelled')),
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  inventory_reserved boolean not null default false,
  inventory_consumed boolean not null default false,
  cancel_reason text,
  approved_at timestamptz,
  ready_at timestamptz,
  loaded_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store_orders(id) on delete cascade,
  sku text not null,
  product_name text not null,
  attributes jsonb not null default '{}'::jsonb,
  unit text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists store_order_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id text,
  actor_name text,
  actor_role text,
  note text,
  created_at timestamptz not null default now()
);

-- Operational inventory ledger. available_stock is derived, never written by clients.
create table if not exists store_inventory (
  sku text primary key,
  total_stock numeric(14,3) not null default 0 check (total_stock >= 0),
  reserved_stock numeric(14,3) not null default 0 check (reserved_stock >= 0),
  updated_at timestamptz not null default now(),
  constraint store_inventory_reserved_lte_total check (reserved_stock <= total_stock)
);

-- Realtime invalidation only: deliberately contains no customer/order payload.
create table if not exists store_order_realtime (
  order_id uuid primary key references store_orders(id) on delete cascade,
  version bigint not null default 1,
  changed_at timestamptz not null default now()
);

create or replace function public.touch_store_order_realtime() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_order_realtime(order_id,version,changed_at)
  values(new.id,1,now())
  on conflict(order_id) do update set version=public.store_order_realtime.version+1, changed_at=now();
  return new;
end $$;

revoke all on function public.touch_store_order_realtime() from public;
revoke all on function public.touch_store_order_realtime() from anon;
revoke all on function public.touch_store_order_realtime() from authenticated;
grant execute on function public.touch_store_order_realtime() to service_role;

drop trigger if exists trg_store_order_realtime on store_orders;
create trigger trg_store_order_realtime
after insert or update on store_orders
for each row execute function public.touch_store_order_realtime();

create index if not exists idx_store_orders_status on store_orders(status);
create index if not exists idx_store_orders_phone on store_orders(customer_phone);
create index if not exists idx_store_orders_created_at on store_orders(created_at desc);
create index if not exists idx_store_order_items_order on store_order_items(order_id);
create index if not exists idx_store_order_history_order on store_order_history(order_id, created_at asc);

alter table store_orders enable row level security;
alter table store_order_items enable row level security;
alter table store_order_history enable row level security;
alter table store_inventory enable row level security;
alter table store_order_realtime enable row level security;

-- JMS custom auth keeps business data behind server-side API/service key.
-- Only the payload-free invalidation table is readable by the browser for Realtime refresh.
drop policy if exists "store realtime read" on store_order_realtime;
create policy "store realtime read" on store_order_realtime for select using (true);

do $$ begin
  alter publication supabase_realtime add table store_order_realtime;
exception when duplicate_object then null;
end $$;
