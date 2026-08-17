-- JMS Manufacturing batch traceability patch
-- Persist the created batch ID on the completed work-center operation.

create or replace function public.jms_mfg_complete_operation(
  p_operation_id text,
  p_actual jsonb,
  p_output_kg numeric,
  p_output_pcs numeric,
  p_waste_kg numeric,
  p_waste_type text,
  p_batch_no text,
  p_client_event_id text,
  p_actor_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.jms_mfg_operations%rowtype;
  v_order public.jms_mfg_orders%rowtype;
  v_batch_id text;
  v_next_id text;
  v_progress numeric;
  v_batch_type text;
  v_now timestamptz := now();
begin
  select * into v_op
  from public.jms_mfg_operations
  where id=p_operation_id
  for update;

  if not found then raise exception 'operation_not_found'; end if;

  if p_client_event_id is not null
     and exists(select 1 from public.jms_mfg_events where client_event_id=p_client_event_id) then
    return jsonb_build_object('ok',true,'idempotent',true,'operation_id',p_operation_id);
  end if;

  select * into v_order
  from public.jms_mfg_orders
  where id=v_op.manufacturing_order_id
  for update;

  if v_op.status='completed' then
    return jsonb_build_object(
      'ok',true,
      'already_completed',true,
      'operation_id',p_operation_id,
      'batch_id',v_op.batch_id
    );
  end if;

  update public.jms_mfg_operations
  set status='completed',
      actual=coalesce(p_actual,'{}'::jsonb),
      completed_at=v_now,
      started_at=coalesce(started_at,v_now),
      operator_id=coalesce(operator_id,p_actor_id),
      updated_at=v_now,
      offline_event_id=coalesce(offline_event_id,p_client_event_id)
  where id=p_operation_id;

  if coalesce(p_batch_no,'')<>'' then
    v_batch_id := v_order.id||'-batch-'||v_op.seq::text||'-'||replace(p_batch_no,' ','-');
    v_batch_type := case v_op.work_center
      when 'mixing' then 'mix'
      when 'extrusion' then 'film'
      when 'printing' then 'printed_film'
      else 'finished_goods'
    end;

    insert into public.jms_mfg_batches(
      id,batch_no,manufacturing_order_id,operation_id,batch_type,qty_kg,qty_pcs,attributes
    ) values(
      v_batch_id,p_batch_no,v_order.id,v_op.id,v_batch_type,
      coalesce(p_output_kg,0),coalesce(p_output_pcs,0),coalesce(p_actual,'{}'::jsonb)
    )
    on conflict (id) do update
      set qty_kg=excluded.qty_kg,
          qty_pcs=excluded.qty_pcs,
          attributes=excluded.attributes;

    -- Traceability fix: bind the work-center operation directly to its output batch.
    update public.jms_mfg_operations
    set batch_id=v_batch_id,
        updated_at=v_now
    where id=p_operation_id;
  end if;

  if coalesce(p_waste_kg,0)>0 then
    insert into public.jms_mfg_waste(
      id,manufacturing_order_id,operation_id,waste_type,qty_kg,reason,attributes,client_event_id
    ) values(
      v_order.id||'-waste-'||v_op.seq::text||'-'||coalesce(p_client_event_id,extract(epoch from v_now)::text),
      v_order.id,v_op.id,coalesce(p_waste_type,'other'),p_waste_kg,
      p_actual->>'waste_reason',coalesce(p_actual,'{}'::jsonb),p_client_event_id
    )
    on conflict (client_event_id) do nothing;
  end if;

  select id into v_next_id
  from public.jms_mfg_operations
  where manufacturing_order_id=v_order.id
    and seq>v_op.seq
    and status='waiting'
  order by seq asc
  limit 1;

  if v_next_id is not null then
    update public.jms_mfg_operations
    set status='ready',updated_at=v_now
    where id=v_next_id;
  end if;

  select round((count(*) filter(where status='completed')::numeric / nullif(count(*),0))*100,2)
  into v_progress
  from public.jms_mfg_operations
  where manufacturing_order_id=v_order.id;

  update public.jms_mfg_orders
  set status=case when v_progress>=100 then 'completed' else 'in_progress' end,
      progress_percent=coalesce(v_progress,0),
      produced_qty_kg=case when v_op.work_center='cutting' then coalesce(p_output_kg,produced_qty_kg) else produced_qty_kg end,
      produced_qty_pcs=case when v_op.work_center='cutting' then coalesce(p_output_pcs,produced_qty_pcs) else produced_qty_pcs end,
      updated_at=v_now
  where id=v_order.id;

  if v_op.work_center='cutting' then
    insert into public.jms_ready_stock(
      id,manufacturing_order_id,source_operation_id,customer_id,batch_id,
      qty_kg,qty_pcs,status,attributes,created_at,updated_at
    ) values(
      v_order.id||'-stock-'||v_op.seq::text,v_order.id,v_op.id,v_order.customer_id,v_batch_id,
      coalesce(p_output_kg,0),coalesce(p_output_pcs,0),'available',coalesce(p_actual,'{}'::jsonb),v_now,v_now
    )
    on conflict (id) do update
      set batch_id=excluded.batch_id,
          qty_kg=excluded.qty_kg,
          qty_pcs=excluded.qty_pcs,
          status='available',
          attributes=excluded.attributes,
          updated_at=v_now;
  end if;

  if p_client_event_id is not null then
    insert into public.jms_mfg_events(
      id,manufacturing_order_id,operation_id,event_type,payload,actor_id,client_event_id,occurred_at,synced_at
    ) values(
      v_order.id||'-evt-'||p_client_event_id,v_order.id,v_op.id,'operation_completed',
      coalesce(p_actual,'{}'::jsonb),p_actor_id,p_client_event_id,v_now,v_now
    )
    on conflict (client_event_id) do nothing;
  end if;

  return jsonb_build_object(
    'ok',true,
    'operation_id',p_operation_id,
    'manufacturing_order_id',v_order.id,
    'batch_id',v_batch_id,
    'progress_percent',v_progress,
    'ready_stock_created',v_op.work_center='cutting'
  );
end;
$$;

revoke all on function public.jms_mfg_complete_operation(text,jsonb,numeric,numeric,numeric,text,text,text,text)
from public, anon, authenticated;

grant execute on function public.jms_mfg_complete_operation(text,jsonb,numeric,numeric,numeric,text,text,text,text)
to service_role;
