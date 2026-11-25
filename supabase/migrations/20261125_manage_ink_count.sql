create function public.jms_remove_counted_ink(p_year integer,p_ids uuid[])
returns integer language sql security invoker set search_path = '' as $$
 with removed as (
   delete from public.jms_ink_count_entries where count_year=p_year and id=any(p_ids) returning id
 ) select count(*)::integer from removed;
$$;
revoke all on function public.jms_remove_counted_ink(integer,uuid[]) from public,anon,authenticated;
grant execute on function public.jms_remove_counted_ink(integer,uuid[]) to service_role;
grant delete,update(shelf,gross_g) on public.jms_ink_count_entries to service_role;
