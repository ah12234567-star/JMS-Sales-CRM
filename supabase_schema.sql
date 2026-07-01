-- JMS Factory CRM Real Database
create table if not exists users (
  id text primary key,
  name text not null,
  email text unique not null,
  password text not null,
  role text not null check (role in ('admin','sales','rep')),
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text,
  city text,
  location text,
  rep_id text references users(id),
  debt_balance numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists visits (
  id text primary key,
  customer_id text references customers(id),
  rep_id text references users(id),
  visit_date date not null,
  visit_type text,
  note text,
  followup_date date,
  lat numeric,
  lng numeric,
  created_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  customer_id text references customers(id),
  rep_id text references users(id),
  order_date date not null,
  product text,
  width numeric,
  length numeric,
  thickness numeric,
  material text,
  total_kg numeric,
  piece_weight numeric,
  pieces numeric,
  price_kg numeric,
  total_amount numeric,
  status text default 'جديد',
  created_at timestamptz default now()
);

create table if not exists collections (
  id text primary key,
  customer_id text references customers(id),
  rep_id text references users(id),
  amount numeric not null,
  collection_date date not null,
  method text,
  created_at timestamptz default now()
);

insert into users (id,name,email,password,role,active)
values ('admin-1','مدير النظام','admin@jms.local','123456','admin',true)
on conflict (email) do nothing;


create table if not exists quotes (
  id text primary key,
  customer_id text references customers(id),
  rep_id text references users(id),
  quote_no text unique,
  quote_date date not null,
  valid_until date,
  product text,
  width numeric,
  length numeric,
  thickness numeric,
  material text,
  color text,
  total_kg numeric,
  piece_weight numeric,
  pieces numeric,
  price_kg numeric,
  total_amount numeric,
  status text default 'pending' check (status in ('pending','approved','sent','accepted','cancelled','rejected')),
  manager_note text,
  cancel_reason text,
  approved_by text references users(id),
  approved_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz default now()
);
