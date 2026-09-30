-- FICTITIOUS local development data. Never run against production.
-- Local Supabase only; a production deployment uses migrations without seed.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',email,extensions.crypt('VoxaDev!2026',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name',name),now(),now(),'','','',''
from (values
 ('10000000-0000-4000-8000-000000000001'::uuid,'owner@voxa.test','Alexandra Ionescu'),
 ('10000000-0000-4000-8000-000000000002'::uuid,'admin@voxa.test','Mihai Dumitrescu'),
 ('10000000-0000-4000-8000-000000000003'::uuid,'reception@voxa.test','Maria Pop'),
 ('10000000-0000-4000-8000-000000000004'::uuid,'doctor@voxa.test','Andrei Popescu'),
 ('10000000-0000-4000-8000-000000000005'::uuid,'assistant@voxa.test','Ioana Marinescu'),
 ('10000000-0000-4000-8000-000000000006'::uuid,'other@voxa.test','Utilizator Clinică Separată')
) u(id,email,name);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now(),now() from auth.users where email like '%@voxa.test';
insert into public.organizations(id,name) values ('20000000-0000-4000-8000-000000000001','Clinica Maria · date fictive'),('20000000-0000-4000-8000-000000000002','Organizație separată · date fictive');
insert into public.clinics(id,organization_id,name,address) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Oradea · Centru','Str. Exemplului 10, Oradea'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Oradea · Nord','Str. Exemplului 22, Oradea'),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Locație separată','Adresă fictivă');
insert into public.clinic_memberships(user_id,organization_id,clinic_id,role)
select ('10000000-0000-4000-8000-00000000000'||n)::uuid,'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',r::public.clinic_role from (values(1,'OWNER'),(2,'ADMIN'),(3,'RECEPTION'),(4,'DOCTOR'),(5,'ASSISTANT')) t(n,r);
insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','OWNER'),
 ('10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','OWNER');
