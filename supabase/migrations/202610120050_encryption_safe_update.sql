-- Hosted Supabase's safe-update guard requires an explicit predicate, even for
-- this operator-only backfill. The primary key is non-null on every source row.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.activate_patient_encryption()'::regprocedure) into definition;
 if position('execute format(''update private.%I set id=id'',item.table_name);' in definition)=0 then
  raise exception 'Unexpected patient encryption activation definition';
 end if;
 execute replace(definition,
  'execute format(''update private.%I set id=id'',item.table_name);',
  'execute format(''update private.%I set id=id where id is not null'',item.table_name);');
end $$;
