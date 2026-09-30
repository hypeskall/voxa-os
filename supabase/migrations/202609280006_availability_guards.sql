create function private.validate_availability() returns trigger language plpgsql set search_path='' as $$
declare resource_key text; begin
 resource_key=new.clinic_id::text||':'||new.resource_kind||':'||coalesce(new.doctor_location_id,new.room_id,new.equipment_id,new.clinic_id)::text;
 perform pg_advisory_xact_lock(hashtextextended(resource_key,23));
 if not new.active or new.archived_at is not null then return new; end if;
 if tg_table_name='availability_rules' then
 if exists(select 1 from public.availability_rules a where a.clinic_id=new.clinic_id and a.id<>new.id and a.active and a.archived_at is null
 and a.resource_kind=new.resource_kind and coalesce(a.doctor_location_id,a.room_id,a.equipment_id,a.clinic_id)=coalesce(new.doctor_location_id,new.room_id,new.equipment_id,new.clinic_id)
 and a.weekday=new.weekday and a.interval_kind=new.interval_kind and a.start_time<new.end_time and a.end_time>new.start_time
 and daterange(a.valid_from,a.valid_until,'[]') && daterange(new.valid_from,new.valid_until,'[]')) then raise exception 'Overlapping weekly intervals' using errcode='23P01'; end if;
 elsif new.exception_kind='extra_work' then
 if exists(select 1 from public.schedule_exceptions e where e.clinic_id=new.clinic_id and e.id<>new.id and e.active and e.archived_at is null
 and e.resource_kind=new.resource_kind and coalesce(e.doctor_location_id,e.room_id,e.equipment_id,e.clinic_id)=coalesce(new.doctor_location_id,new.room_id,new.equipment_id,new.clinic_id)
 and e.exception_kind='extra_work' and e.starts_at<new.ends_at and e.ends_at>new.starts_at) then raise exception 'Overlapping exceptions' using errcode='23P01'; end if;
 end if;
 return new;
end $$;
create trigger validate_interval before insert or update on public.availability_rules for each row execute function private.validate_availability();
create trigger validate_interval before insert or update on public.schedule_exceptions for each row execute function private.validate_availability();
revoke all on function private.validate_availability() from public,anon,authenticated;

-- Audit link-only changes too, even if the internal helper is invoked directly.
create function private.audit_core_link() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; cid uuid; oid uuid; eid uuid; entity text; begin
 row_data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 cid=(row_data->>'clinic_id')::uuid; select organization_id into oid from public.clinics where id=cid;
 -- Invalidate editors on both sides when a relationship changes elsewhere.
 if row_data ? 'doctor_location_id' then
 update public.doctor_locations set updated_at=now() where id=(row_data->>'doctor_location_id')::uuid and clinic_id=cid;
 end if;
 if row_data ? 'service_id' then
 update public.services set updated_at=now() where id=(row_data->>'service_id')::uuid and clinic_id=cid;
 end if;
 if row_data ? 'doctor_location_id' then eid=(row_data->>'doctor_location_id')::uuid; entity='doctor_locations'; else eid=(row_data->>'service_id')::uuid;entity='services';end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(oid,cid,auth.uid(),'update',entity,eid,jsonb_build_object('relationship',tg_table_name,'operation',lower(tg_op)));
 if row_data ? 'doctor_location_id' and row_data ? 'service_id' then
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(oid,cid,auth.uid(),'update','services',(row_data->>'service_id')::uuid,jsonb_build_object('relationship',tg_table_name,'operation',lower(tg_op)));
 end if;
 return coalesce(new,old);
end $$;
do $$ declare t text; begin foreach t in array array['doctor_specialities','doctor_rooms','doctor_services','service_rooms','service_equipment'] loop
 execute format('create trigger audit_link after insert or update or delete on public.%I for each row execute function private.audit_core_link()',t); end loop; end $$;
revoke all on function private.audit_core_link() from public,anon,authenticated;
