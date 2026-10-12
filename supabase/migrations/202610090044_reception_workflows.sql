-- Reception work is clinic scoped. No new outbound messaging channel is enabled.
create table public.reception_work (
 id uuid primary key default gen_random_uuid(), clinic_id uuid not null, organization_id uuid not null,
 kind text not null check(kind in ('TASK','WAITLIST')), title text not null check(length(trim(title)) between 2 and 160),
 notes text not null default '' check(length(notes)<=2000),
 status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','DONE','CANCELLED','OFFERED','BOOKED')),
 assigned_to uuid references auth.users(id), due_at timestamptz,
 patient_id uuid, service_id uuid, doctor_id uuid, appointment_id uuid,
 preferred_from timestamptz, preferred_to timestamptz, offered_start timestamptz, offer_expires_at timestamptz,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(patient_id,clinic_id) references public.patients(id,clinic_id),
 foreign key(service_id,clinic_id) references public.services(id,clinic_id),
 foreign key(doctor_id,clinic_id) references public.doctor_locations(id,clinic_id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id),
 check((kind='TASK' and status in ('OPEN','IN_PROGRESS','DONE','CANCELLED')) or
       (kind='WAITLIST' and patient_id is not null and service_id is not null and preferred_from is not null and preferred_to>preferred_from and status in ('OPEN','OFFERED','BOOKED','CANCELLED'))),
 check(status<>'OFFERED' or (offered_start is not null and offer_expires_at is not null)),
 check(status<>'BOOKED' or appointment_id is not null)
);
create index reception_work_active on public.reception_work(clinic_id,kind,status,due_at,created_at);
alter table public.reception_work enable row level security;
create policy reception_read on public.reception_work for select to authenticated using(private.has_permission(clinic_id,'appointments.manage'));
create policy mfa_required on public.reception_work as restrictive for all to authenticated using(private.mfa_satisfied()) with check(private.mfa_satisfied());
grant select on public.reception_work to authenticated;
revoke insert,update,delete on public.reception_work from anon,authenticated;
create trigger touch before update on public.reception_work for each row execute function private.touch_updated_at();

create function private.audit_reception_work() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(new.organization_id,new.clinic_id,auth.uid(),case when TG_OP='INSERT' then 'create' else 'update' end,'reception_work',new.id,jsonb_build_object('kind',new.kind,'status',new.status));
 return new;
end $$;
revoke all on function private.audit_reception_work() from public,anon,authenticated;
create trigger audit after insert or update on public.reception_work for each row execute function private.audit_reception_work();

create function public.reception_workspace(cid uuid,work_kind text,work_status text default 'ACTIVE') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb; staff jsonb; begin
 perform private.require_mfa();
 if not private.has_permission(cid,'appointments.manage') or work_kind not in ('TASK','WAITLIST') then raise exception 'Access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
 select w.*,p.name patient_name,s.name service_name,pr.full_name assigned_name
 from public.reception_work w left join public.patients p on p.id=w.patient_id left join public.services s on s.id=w.service_id left join public.profiles pr on pr.id=w.assigned_to
 where w.clinic_id=cid and w.kind=work_kind and (work_status='ALL' or (work_status='ACTIVE' and w.status not in ('DONE','CANCELLED','BOOKED')) or w.status=work_status)
 order by w.due_at nulls last,w.created_at limit 200) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(p.full_name,''),'Colegul clinicii'))),'[]') into staff
 from public.clinic_memberships m left join public.profiles p on p.id=m.user_id where m.clinic_id=cid and m.active;
 return jsonb_build_object('items',items,'staff',staff);
end $$;

create function public.save_reception_work(cid uuid,work_id uuid,payload jsonb,expected_updated_at timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare oid uuid; existing public.reception_work; result uuid; assignee uuid; pid uuid; sid uuid; did uuid; aid uuid; k text; st text; begin
 perform private.require_mfa();
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.clinics where id=cid;
 assignee=nullif(payload->>'assigned_to','')::uuid; pid=nullif(payload->>'patient_id','')::uuid; sid=nullif(payload->>'service_id','')::uuid; did=nullif(payload->>'doctor_id','')::uuid; aid=nullif(payload->>'appointment_id','')::uuid;
 k=payload->>'kind'; st=coalesce(nullif(payload->>'status',''),'OPEN');
 if assignee is not null and not exists(select 1 from public.clinic_memberships where clinic_id=cid and user_id=assignee and active) then raise exception 'Inactive assignee'; end if;
 if pid is not null and not exists(select 1 from public.patients where id=pid and clinic_id=cid and active and archived_at is null) then raise exception 'Invalid patient'; end if;
 if sid is not null and not exists(select 1 from public.services where id=sid and clinic_id=cid and active and archived_at is null) then raise exception 'Invalid service'; end if;
 if did is not null and not exists(select 1 from public.doctor_locations where id=did and clinic_id=cid and active and archived_at is null) then raise exception 'Invalid doctor'; end if;
 if aid is not null and not exists(select 1 from public.appointments where id=aid and clinic_id=cid and (pid is null or patient_id=pid)) then raise exception 'Invalid appointment'; end if;
 if work_id is null then
  if st<>'OPEN' then raise exception 'New work must be open'; end if;
  insert into public.reception_work(clinic_id,organization_id,kind,title,notes,assigned_to,due_at,patient_id,service_id,doctor_id,appointment_id,preferred_from,preferred_to,created_by)
  values(cid,oid,k,trim(payload->>'title'),coalesce(payload->>'notes',''),assignee,nullif(payload->>'due_at','')::timestamptz,pid,sid,did,aid,nullif(payload->>'preferred_from','')::timestamptz,nullif(payload->>'preferred_to','')::timestamptz,auth.uid()) returning id into result;
 else
  select * into existing from public.reception_work where id=work_id and clinic_id=cid for update;
  if existing.id is null or existing.updated_at is distinct from expected_updated_at then raise exception 'Stale revision'; end if;
  if existing.kind<>k or existing.status in ('BOOKED','CANCELLED') or st in ('BOOKED','OFFERED') then raise exception 'Invalid transition'; end if;
  update public.reception_work set title=trim(payload->>'title'),notes=coalesce(payload->>'notes',''),status=st,assigned_to=assignee,due_at=nullif(payload->>'due_at','')::timestamptz,
    patient_id=pid,service_id=sid,doctor_id=did,appointment_id=aid,preferred_from=nullif(payload->>'preferred_from','')::timestamptz,preferred_to=nullif(payload->>'preferred_to','')::timestamptz,
    offered_start=null,offer_expires_at=null where id=existing.id returning id into result;
 end if;
 return result;
end $$;

create function public.offer_waitlist_slot(cid uuid,work_id uuid,slot_start timestamptz,expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.reception_work; preview jsonb; begin
 perform private.require_mfa();
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select * into w from public.reception_work where id=work_id and clinic_id=cid and kind='WAITLIST' for update;
 if w.id is null or w.updated_at is distinct from expected_updated_at or w.status not in ('OPEN','OFFERED') then raise exception 'Stale revision'; end if;
 if slot_start<w.preferred_from or slot_start>=w.preferred_to or slot_start<=now() then raise exception 'Outside preferred window'; end if;
 preview=private.resolve_assignment(cid,w.service_id,slot_start,w.doctor_id,null,'{}',null);
 if not coalesce((preview->>'ok')::boolean,false) then return jsonb_build_object('ok',false); end if;
 if (preview->'assignment'->>'end_at')::timestamptz>w.preferred_to then return jsonb_build_object('ok',false); end if;
 update public.reception_work set status='OFFERED',offered_start=slot_start,offer_expires_at=least(now()+interval '24 hours',slot_start) where id=w.id;
 return jsonb_build_object('ok',true);
end $$;

create function public.book_waitlist_slot(cid uuid,work_id uuid,expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.reception_work; result jsonb; begin
 perform private.require_mfa();
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select * into w from public.reception_work where id=work_id and clinic_id=cid and kind='WAITLIST' for update;
 if w.id is null or w.updated_at is distinct from expected_updated_at or w.status<>'OFFERED' or w.offer_expires_at<=now() then raise exception 'Offer expired or stale'; end if;
 result=public.create_appointment(cid,jsonb_build_object('patient_id',w.patient_id,'service_id',w.service_id,'doctor_id',w.doctor_id,'start_at',w.offered_start,'source','RECEPTION','status','CONFIRMED','notes','Programare din lista de așteptare.'));
 if coalesce((result->>'ok')::boolean,false) then update public.reception_work set status='BOOKED',appointment_id=(result->>'appointment_id')::uuid where id=w.id; end if;
 return result;
end $$;

revoke all on function public.reception_workspace(uuid,text,text),public.save_reception_work(uuid,uuid,jsonb,timestamptz),public.offer_waitlist_slot(uuid,uuid,timestamptz,timestamptz),public.book_waitlist_slot(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.reception_workspace(uuid,text,text),public.save_reception_work(uuid,uuid,jsonb,timestamptz),public.offer_waitlist_slot(uuid,uuid,timestamptz,timestamptz),public.book_waitlist_slot(uuid,uuid,timestamptz) to authenticated;
