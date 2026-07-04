-- JMS Sales CRM tables
create table if not exists reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  status text default 'نشط',
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null check (role in ('admin','rep')),
  rep_id uuid references reps(id) on delete set null,
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
  status text,
  created_at timestamptz default now()
);

alter table reps enable row level security;
alter table users enable row level security;
alter table customers enable row level security;
alter table visits enable row level security;
alter table orders enable row level security;

-- مبدئيًا للسماح للتطبيق بالعمل بمفتاح publishable أثناء التجربة
create policy if not exists "public read reps" on reps for select using (true);
create policy if not exists "public insert reps" on reps for insert with check (true);
create policy if not exists "public read users" on users for select using (true);
create policy if not exists "public insert users" on users for insert with check (true);
create policy if not exists "public read customers" on customers for select using (true);
create policy if not exists "public insert customers" on customers for insert with check (true);
create policy if not exists "public read visits" on visits for select using (true);
create policy if not exists "public insert visits" on visits for insert with check (true);
create policy if not exists "public read orders" on orders for select using (true);
create policy if not exists "public insert orders" on orders for insert with check (true);

insert into reps (id, name, email, status) values
('00000000-0000-0000-0000-000000000001','مندوب جدة','rep@jms.local','نشط')
on conflict (id) do nothing;

insert into users (name, email, password, role, rep_id, status) values
('مدير النظام','admin@jms.local','123456','admin',null,'نشط'),
('مندوب جدة','rep@jms.local','123456','rep','00000000-0000-0000-0000-000000000001','نشط')
on conflict (email) do nothing;
