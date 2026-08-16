-- JMS Ready Goods: add denormalized ownership columns required by the authenticated sync API.
-- Safe for existing data: no table/data deletion and no NOT NULL constraint is added.

alter table if exists public.jms_ready_goods
  add column if not exists rep_id text,
  add column if not exists customer_id text;

update public.jms_ready_goods
set
  rep_id = coalesce(nullif(rep_id,''), nullif(data->>'rep_id','')),
  customer_id = coalesce(nullif(customer_id,''), nullif(data->>'customer_id',''))
where
  rep_id is null or rep_id = '' or customer_id is null or customer_id = '';

create index if not exists jms_ready_goods_rep_id_idx
  on public.jms_ready_goods (rep_id);

create index if not exists jms_ready_goods_customer_id_idx
  on public.jms_ready_goods (customer_id);

create index if not exists jms_ready_goods_updated_at_idx
  on public.jms_ready_goods (updated_at desc);
