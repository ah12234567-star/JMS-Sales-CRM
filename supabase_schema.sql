-- JMS CRM cloud sync schema for Supabase
-- Run this once in Supabase SQL Editor

create table if not exists jms_customers (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists jms_quotes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists jms_visits (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists jms_orders (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists jms_collections (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table jms_customers enable row level security;
alter table jms_quotes enable row level security;
alter table jms_visits enable row level security;
alter table jms_orders enable row level security;
alter table jms_collections enable row level security;

drop policy if exists "public read customers" on jms_customers;
drop policy if exists "public write customers" on jms_customers;
drop policy if exists "public read quotes" on jms_quotes;
drop policy if exists "public write quotes" on jms_quotes;
drop policy if exists "public read visits" on jms_visits;
drop policy if exists "public write visits" on jms_visits;
drop policy if exists "public read orders" on jms_orders;
drop policy if exists "public write orders" on jms_orders;
drop policy if exists "public read collections" on jms_collections;
drop policy if exists "public write collections" on jms_collections;

create policy "public read customers" on jms_customers for select using (true);
create policy "public write customers" on jms_customers for all using (true) with check (true);
create policy "public read quotes" on jms_quotes for select using (true);
create policy "public write quotes" on jms_quotes for all using (true) with check (true);
create policy "public read visits" on jms_visits for select using (true);
create policy "public write visits" on jms_visits for all using (true) with check (true);
create policy "public read orders" on jms_orders for select using (true);
create policy "public write orders" on jms_orders for all using (true) with check (true);
create policy "public read collections" on jms_collections for select using (true);
create policy "public write collections" on jms_collections for all using (true) with check (true);
