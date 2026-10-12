-- Public mutations must pass through the application anti-abuse checks.
-- Keep the existing scheduling implementation and transaction semantics.
alter function public.create_public_booking(text,jsonb,text) set schema private;
revoke all on function private.create_public_booking(text,jsonb,text) from public,anon,authenticated,service_role;
create function public.create_public_booking(slug text,payload jsonb,request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not private.stripe_service_request() then raise exception 'Service role required' using errcode='42501'; end if;
  return private.create_public_booking(slug,payload,request_key);
end;
$$;
revoke all on function public.create_public_booking(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_public_booking(text,jsonb,text) to service_role;
