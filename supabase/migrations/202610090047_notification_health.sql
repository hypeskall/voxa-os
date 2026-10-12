create function public.notification_health(cid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 perform private.require_mfa();
 if not private.has_permission(cid,'notifications.read') then raise exception 'Access denied' using errcode='42501'; end if;
 select jsonb_build_object(
 'due',count(*) filter(where status in ('QUEUED','FAILED') and scheduled_for<=now() and attempts<max_attempts),
 'overdue',count(*) filter(where status in ('QUEUED','FAILED') and scheduled_for<now()-interval '10 minutes' and attempts<max_attempts),
 'stale_sending',count(*) filter(where status='SENDING' and locked_at<now()-interval '15 minutes'),
 'exhausted',count(*) filter(where status='FAILED' and attempts>=max_attempts),
 'last_sent_at',max(sent_at) filter(where status in ('SENT','DELIVERED') and coalesce(provider_message_id,'') not like 'dev-%')) into result
 from public.notification_jobs where clinic_id=cid;
 return result;
end $$;
revoke all on function public.notification_health(uuid) from public,anon;
grant execute on function public.notification_health(uuid) to authenticated;
