create table if not exists public.jms_ready_goods (
  id text primary key,
  rep_id text not null,
  customer_id text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists jms_ready_goods_rep_id_idx on public.jms_ready_goods(rep_id);
create index if not exists jms_ready_goods_customer_id_idx on public.jms_ready_goods(customer_id);
create index if not exists jms_ready_goods_updated_at_idx on public.jms_ready_goods(updated_at desc);
