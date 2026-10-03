-- Read-only catalog inventory. No patient/user rows, tokens or SQL settings values.
with inventory as (
 select 'table' kind,n.nspname||'.'||c.relname key,jsonb_build_object('rls',c.relrowsecurity) definition
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
 union all
 select 'column',n.nspname||'.'||c.relname||'.'||a.attname,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid))
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped
 union all
 select 'constraint',n.nspname||'.'||c.relname||'.'||co.conname,jsonb_build_object('definition',pg_get_constraintdef(co.oid))
 -- PostgreSQL 18 also stores NOT NULL in pg_constraint; PostgreSQL 17 stores it
 -- only in pg_attribute. The column inventory above checks attnotnull on both.
 from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and co.contype <> 'n'
 union all
 select 'index',schemaname||'.'||tablename||'.'||indexname,jsonb_build_object('definition',indexdef) from pg_indexes where schemaname='public'
 union all
 select 'policy',schemaname||'.'||tablename||'.'||policyname,jsonb_build_object('cmd',cmd,'roles',roles,'qual',qual,'check',with_check)
 from pg_policies where schemaname in ('public','storage')
 union all
 select 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and t.tgfoid in(select p.oid from pg_proc p join pg_namespace pn on pn.oid=p.pronamespace where pn.nspname in ('public','private'))))
 union all
 select 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
 jsonb_build_object('security_definer',p.prosecdef,'config',p.proconfig,'body',p.prosrc,'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'
 union all
 select 'bucket',id,jsonb_build_object('public',public,'size_limit',file_size_limit,'mime',allowed_mime_types) from storage.buckets where id in ('voxa-medical','voxa-branding')
)
select kind,key,definition from inventory order by kind,key;
