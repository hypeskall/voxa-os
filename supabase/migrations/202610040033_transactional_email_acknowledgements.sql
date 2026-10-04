-- No email addresses, bodies or invitation tokens are retained in this ledger.
-- An uncertain SMTP outcome is never automatically resent. Message-ID alone
-- cannot promise idempotent delivery across SMTP providers.
create table private.transactional_email_deliveries (
 digest text primary key check(digest ~ '^[a-f0-9]{64}$'),
 status text not null check(status in ('sending','accepted','uncertain')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
revoke all on private.transactional_email_deliveries from public,anon,authenticated,service_role;

create function public.claim_transactional_email(digest text) returns text
language plpgsql security definer set search_path='' as $$
declare inserted integer; result text;
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',nullif(current_setting('request.jwt.claim.role',true),''),'') <> 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 if digest is null or digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid digest'; end if;
 insert into private.transactional_email_deliveries(digest,status) values(digest,'sending') on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then return 'claimed'; end if;
 select d.status into result from private.transactional_email_deliveries d where d.digest=claim_transactional_email.digest;
 return result;
end $$;
create function public.finish_transactional_email(digest text,outcome text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',nullif(current_setting('request.jwt.claim.role',true),''),'') <> 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 if digest is null or digest !~ '^[a-f0-9]{64}$' or outcome not in ('accepted','uncertain') then raise exception 'Invalid acknowledgement'; end if;
 update private.transactional_email_deliveries d set status=outcome,updated_at=now()
 where d.digest=finish_transactional_email.digest and d.status='sending';
 if not found then raise exception 'Delivery acknowledgement unavailable'; end if;
end $$;
revoke all on function public.claim_transactional_email(text),public.finish_transactional_email(text,text) from public,anon,authenticated;
grant execute on function public.claim_transactional_email(text),public.finish_transactional_email(text,text) to service_role;
