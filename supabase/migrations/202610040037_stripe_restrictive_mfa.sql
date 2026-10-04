-- Keep the same defense-in-depth policy convention as all existing tables.
create policy mfa_required on public.organization_stripe_billing as restrictive
 for all to authenticated using((select private.mfa_satisfied())) with check((select private.mfa_satisfied()));
