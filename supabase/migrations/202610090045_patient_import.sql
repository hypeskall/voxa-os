create function public.import_patients(cid uuid,records jsonb,preview_only boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oid uuid; row jsonb; created integer=0; skipped integer=0; duplicate boolean; report jsonb='[]'; n integer=0; nm text; key text; email_value text; phone_value text; dob date; begin
 perform private.require_mfa();
 if not private.has_permission(cid,'patients.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records) not between 1 and 500 then raise exception 'Import requires 1 to 500 rows'; end if;
 select organization_id into oid from public.clinics where id=cid;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 for row in select value from jsonb_array_elements(records) loop
  n=n+1; nm=trim(coalesce(row->>'name','')); key=trim(coalesce(row->>'internal_id','')); email_value=lower(trim(coalesce(row->>'email',''))); phone_value=trim(coalesce(row->>'phone','')); dob=nullif(row->>'birth_date','')::date;
  if length(nm) not between 2 and 160 or length(key) not between 1 and 50 or length(email_value)>254 or length(phone_value)>40 or (email_value<>'' and email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or (dob is not null and (dob<'1900-01-01' or dob>current_date)) then raise exception 'Invalid import row %',n; end if;
  -- Shared family contacts are not sufficient to identify a person. Match the
  -- internal identifier, or a name plus birth date/contact. Never overwrite.
  select exists(select 1 from public.patients p where p.clinic_id=cid and
    (lower(p.internal_id)=lower(key) or (lower(trim(p.name))=lower(nm) and ((dob is not null and p.birth_date=dob) or (email_value<>'' and lower(p.email)=email_value) or (length(regexp_replace(phone_value,'[^0-9]','','g'))>=7 and regexp_replace(p.phone,'[^0-9]','','g')=regexp_replace(phone_value,'[^0-9]','','g')))))) into duplicate;
  if not duplicate then
   select exists(select 1 from jsonb_array_elements(records) with ordinality prev(value,pos) where pos<n and
    (lower(trim(value->>'internal_id'))=lower(key) or (lower(trim(value->>'name'))=lower(nm) and ((dob is not null and nullif(value->>'birth_date','')::date=dob) or (email_value<>'' and lower(trim(value->>'email'))=email_value) or (length(regexp_replace(phone_value,'[^0-9]','','g'))>=7 and regexp_replace(value->>'phone','[^0-9]','','g')=regexp_replace(phone_value,'[^0-9]','','g')))))) into duplicate;
  end if;
  if duplicate then skipped=skipped+1;
  else
   created=created+1;
   if not preview_only then insert into public.patients(organization_id,clinic_id,name,internal_id,email,phone,birth_date) values(oid,cid,nm,key,email_value,phone_value,dob); end if;
  end if;
  report=report||jsonb_build_array(jsonb_build_object('row',n,'status',case when duplicate then 'DUPLICATE' else 'NEW' end));
 end loop;
 if not preview_only then insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'import','patients',cid,jsonb_build_object('created',created,'skipped',skipped,'rows',n)); end if;
 return jsonb_build_object('created',created,'skipped',skipped,'rows',report,'preview',preview_only);
end $$;
revoke all on function public.import_patients(uuid,jsonb,boolean) from public,anon;
grant execute on function public.import_patients(uuid,jsonb,boolean) to authenticated;
