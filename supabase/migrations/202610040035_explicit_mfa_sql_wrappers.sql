-- These SQL wrappers delegated to MFA-guarded functions. Guard their own entry
-- as well so short-circuiting/reordering never changes the AAL1 denial behavior.
-- Preserve signatures/defaults, existing ACLs, fixed search paths and volatility.
create or replace function public.find_conflicts(cid uuid,payload jsonb,excluded_appointment uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_mfa();
 return coalesce(public.validate_appointment(cid,payload,excluded_appointment)->'conflicts','[]'::jsonb);
end $$;

create or replace function public.can_delete_unregistered_medical_object(object_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_mfa();
 return public.can_access_medical_object(object_name,'write')
  and not exists(select 1 from public.patient_documents where object_path=object_name)
  and not exists(select 1 from public.medical_results where pdf_object_path=object_name)
  and not exists(select 1 from public.doctor_credentials where signature_object_path=object_name or stamp_object_path=object_name);
end $$;
