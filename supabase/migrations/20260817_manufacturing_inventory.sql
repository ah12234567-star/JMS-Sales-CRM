-- JMS Manufacturing inventory extension
create table if not exists public.jms_inventory_lots (
  id text primary key,
  material_code text not null,
  material_name text,
  lot_no text,
  warehouse text not null default 'RAW',
  qty_kg numeric(14,3) not null default 0 check (qty_kg >= 0),
  reserved_kg numeric(14,3) not null default 0 check (reserved_kg >= 0),
  attributes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(material_code, lot_no, warehouse)
);

create index if not exists jms_inventory_material_idx on public.jms_inventory_lots(material_code, warehouse);

alter table public.jms_inventory_lots enable row level security;
revoke all on table public.jms_inventory_lots from anon, authenticated;

create or replace function public.jms_mfg_consume_material(
  p_move_id text,
  p_manufacturing_order_id text,
  p_operation_id text,
  p_inventory_lot_id text,
  p_material_code text,
  p_qty_kg numeric,
  p_client_event_id text,
  p_actor_id text,
  p_attributes jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_lot public.jms_inventory_lots%rowtype;
  v_now timestamptz := now();
begin
  if coalesce(p_qty_kg,0)<=0 then raise exception 'invalid_quantity'; end if;
  if p_client_event_id is not null and exists(select 1 from public.jms_mfg_material_moves where client_event_id=p_client_event_id) then
    return jsonb_build_object('ok',true,'idempotent',true);
  end if;

  select * into v_lot from public.jms_inventory_lots where id=p_inventory_lot_id for update;
  if not found then raise exception 'inventory_lot_not_found'; end if;
  if v_lot.material_code<>p_material_code then raise exception 'material_mismatch'; end if;
  if v_lot.qty_kg < p_qty_kg then raise exception 'insufficient_stock'; end if;

  update public.jms_inventory_lots set qty_kg=qty_kg-p_qty_kg,updated_at=v_now where id=p_inventory_lot_id;

  insert into public.jms_mfg_material_moves(id,manufacturing_order_id,operation_id,material_code,movement_type,qty_kg,lot_no,attributes,client_event_id,created_by,created_at)
  values(p_move_id,p_manufacturing_order_id,p_operation_id,p_material_code,'consume',p_qty_kg,v_lot.lot_no,coalesce(p_attributes,'{}'::jsonb),p_client_event_id,p_actor_id,v_now);

  return jsonb_build_object('ok',true,'material_code',p_material_code,'consumed_kg',p_qty_kg,'remaining_kg',v_lot.qty_kg-p_qty_kg);
end;
$$;

revoke all on function public.jms_mfg_consume_material(text,text,text,text,text,numeric,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.jms_mfg_consume_material(text,text,text,text,text,numeric,text,text,jsonb) to service_role;
