-- JMS Manufacturing: production machine master data
-- Stable machine codes are used by production records; display names can be edited later.

create table if not exists public.jms_mfg_machines (
  id text primary key,
  work_center text not null check (work_center in ('extrusion','printing','cutting')),
  machine_no integer,
  code text not null unique,
  display_name text not null,
  capabilities jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jms_mfg_machines_center_idx
  on public.jms_mfg_machines(work_center, active, sort_order);

-- Film / extrusion machines (16)
insert into public.jms_mfg_machines(id,work_center,machine_no,code,display_name,sort_order) values
('film-01','extrusion',1,'FILM-01','فلم رقم 1 - LD',1),
('film-02','extrusion',2,'FILM-02','فلم رقم 2 - LD ABA',2),
('film-03','extrusion',3,'FILM-03','فلم رقم 3 - LD-HD',3),
('film-04','extrusion',4,'FILM-04','فلم رقم 4',4),
('film-05','extrusion',5,'FILM-05','فلم رقم 5 - LD',5),
('film-06','extrusion',6,'FILM-06','فلم رقم 6 - LD ABA / HD ABA',6),
('film-07','extrusion',7,'FILM-07','فلم رقم 7 - LD ABA / HD ABA',7),
('film-08','extrusion',8,'FILM-08','فلم رقم 8 - HD ABA',8),
('film-09','extrusion',9,'FILM-09','فلم رقم 9 - HANDEL',9),
('film-10','extrusion',10,'FILM-10','فلم رقم 10 - LD BIG',10),
('film-11','extrusion',11,'FILM-11','فلم رقم 11 - LD',11),
('film-12','extrusion',12,'FILM-12','فلم رقم 12 - LD',12),
('film-13','extrusion',13,'FILM-13','فلم رقم 13 - LD',13),
('film-14','extrusion',14,'FILM-14','فلم رقم 14 - LD',14),
('film-15','extrusion',15,'FILM-15','فلم رقم 15 - LD',15),
('film-16','extrusion',16,'FILM-16','فلم رقم 16 - LD',16)
on conflict (id) do update set display_name=excluded.display_name, sort_order=excluded.sort_order, updated_at=now();

-- Printing machines (names taken from the current factory list)
insert into public.jms_mfg_machines(id,work_center,machine_no,code,display_name,sort_order) values
('print-c1','printing',1,'PRINT-C1','C1',1),
('print-china','printing',2,'PRINT-CHINA','CHINA',2),
('print-hyplas','printing',3,'PRINT-HYPLAS','HYPLAS',3),
('print-lulu-big','printing',4,'PRINT-LULU-BIG','LULU BIG',4),
('print-lulu-sml','printing',5,'PRINT-LULU-SML','LULU SML',5),
('print-5prt5','printing',6,'PRINT-5PRT5','5PRT 5',6),
('print-6prt6','printing',7,'PRINT-6PRT6','6PRT 6',7)
on conflict (id) do update set display_name=excluded.display_name, sort_order=excluded.sort_order, updated_at=now();

-- Cutting machines. Stable numbers are authoritative; descriptions can be refined without changing IDs.
insert into public.jms_mfg_machines(id,work_center,machine_no,code,display_name,sort_order) values
('cut-01','cutting',1,'CUT-01','مقص رقم 1 - بوتوم',1),
('cut-02','cutting',2,'CUT-02','مقص رقم 2 - بوتوم',2),
('cut-03','cutting',3,'CUT-03','مقص رقم 3 - شريط',3),
('cut-04','cutting',4,'CUT-04','مقص رقم 4 - شريط',4),
('cut-05','cutting',5,'CUT-05','مقص رقم 5 - لحام سفلي - بوتوم وبنانا',5),
('cut-06','cutting',6,'CUT-06','مقص رقم 6 - سايد سيلنج - لحام جانبي',6),
('cut-07','cutting',7,'CUT-07','مقص رقم 7 - لحام سفلي - بوتوم',7),
('cut-08','cutting',8,'CUT-08','مقص رقم 8 - لحام سفلي - بوتوم - بنانا - تيشيرت',8),
('cut-09','cutting',9,'CUT-09','مقص رقم 9 - سايد سيلنج - لحام جانبي',9),
('cut-10','cutting',10,'CUT-10','مقص رقم 10 - لحام سفلي - بوتوم',10),
('cut-11','cutting',11,'CUT-11','مقص رقم 11 - سفرة - بوتوم - لحام سفلي',11),
('cut-12','cutting',12,'CUT-12','مقص رقم 12 - بوتوم - لحام سفلي',12),
('cut-13','cutting',13,'CUT-13','مقص رقم 13 - لحام سفلي - بوتوم',13),
('cut-14','cutting',14,'CUT-14','مقص رقم 14 - لحام سفلي - بوتوم',14),
('cut-15','cutting',15,'CUT-15','مقص رقم 15',15),
('cut-16','cutting',16,'CUT-16','مقص رقم 16',16),
('cut-17','cutting',17,'CUT-17','مقص رقم 17',17),
('cut-18','cutting',18,'CUT-18','مقص رقم 18',18),
('cut-abu-waleed','cutting',19,'CUT-ABU-WALEED','مقص جديد أبو وليد',19)
on conflict (id) do update set display_name=excluded.display_name, sort_order=excluded.sort_order, updated_at=now();

-- Keep machine master inaccessible directly from browser clients; server APIs use service_role.
alter table public.jms_mfg_machines enable row level security;
revoke all on table public.jms_mfg_machines from anon, authenticated;
grant all on table public.jms_mfg_machines to service_role;
