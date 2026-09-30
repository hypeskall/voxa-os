create function public.core_options(cid uuid,module text,query text default '',selected uuid[] default '{}') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare spec jsonb=private.core_spec(module);result jsonb;begin
 if module not in ('doctors','specialities','services','categories','rooms','equipment') or spec is null or not private.has_permission(cid,'catalog.read') then raise exception 'Access denied' using errcode='42501';end if;
 if length(query)>100 or cardinality(selected)>200 then raise exception 'Invalid options';end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from (select id,name,(active and archived_at is null) as active from public.%I where clinic_id=$1 and ((active and archived_at is null and strpos(lower(name),lower($2))>0) or id=any($3)) order by (id=any($3)) desc,name,id limit 250) x',spec->>'table') into result using cid,query,selected;
 return result;
end $$;
revoke all on function public.core_options(uuid,text,text,uuid[]) from public,anon;
grant execute on function public.core_options(uuid,text,text,uuid[]) to authenticated;
