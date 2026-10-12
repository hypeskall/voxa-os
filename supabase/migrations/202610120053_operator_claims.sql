-- A pooled/local connection may retain an empty request.jwt.claims setting
-- after a user transaction. Treat that as absent for operator-only RPCs while
-- preserving their existing ACL and service-role check.
do $$ declare f record; body text; begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('activate_patient_encryption','patient_encryption_status','replace_encrypted_medical_path') loop
  body=replace(f.prosrc,$q$coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb$q$,$q$coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$q$);
  execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
 end loop;
end $$;
notify pgrst,'reload schema';
