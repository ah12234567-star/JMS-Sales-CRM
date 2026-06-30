create extension if not exists "pgcrypto";

create table if not exists reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  status text default 'نشط',
  created_at timestamptz default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  city text,
  activity text,
  location text,
  rep_id uuid references reps(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  rep_id uuid references reps(id) on delete set null,
  visit_date date not null,
  status text,
  location text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  rep_id uuid references reps(id) on delete set null,
  order_date date not null,
  product text,
  quantity numeric,
  amount numeric default 0,
  status text default 'جديد',
  created_at timestamptz default now()
);

alter table reps enable row level security;
alter table customers enable row level security;
alter table visits enable row level security;
alter table orders enable row level security;

create policy "public read reps" on reps for select using (true);
create policy "public insert reps" on reps for insert with check (true);
create policy "public update reps" on reps for update using (true);

create policy "public read customers" on customers for select using (true);
create policy "public insert customers" on customers for insert with check (true);
create policy "public update customers" on customers for update using (true);

create policy "public read visits" on visits for select using (true);
create policy "public insert visits" on visits for insert with check (true);
create policy "public update visits" on visits for update using (true);

create policy "public read orders" on orders for select using (true);
create policy "public insert orders" on orders for insert with check (true);
create policy "public update orders" on orders for update using (true);

insert into reps (name, phone, email, status)
select 'مندوب جدة', '', '', 'نشط'
where not exists (select 1 from reps);
