-- FICTITIOUS development records only. Applied after seed.sql by local db reset.
-- Uses the same authenticated workflows as the application.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare
 a uuid='30000000-0000-4000-8000-000000000001';
 b uuid='30000000-0000-4000-8000-000000000002';
 speciality uuid; category uuid; room uuid; equipment uuid; service uuid; doctor uuid;
 demo_names text[]=array['Andrei Popescu','Ioana Marinescu','Radu Ionescu','Elena Dumitrescu','Mara Stan','Vlad Georgescu','Diana Pavel','Sorin Matei','Alina Tudor','Cătălin Enache','Cristina Dobre','Mihai Nistor','Laura Petrescu','Daniel Ilie','Oana Rusu','Paul Munteanu','Bianca Neagu','Adrian Lupu','Simona Stoica','Robert Preda','Irina Voicu','Ștefan Sandu','Anca Florea','Victor Barbu','Monica Oprea','Alexandru Toma','Gabriela Dinu','Rareș Mocanu','Nicoleta Ene','Lucian Dragomir'];
begin
 update public.clinics set public_booking_enabled=true,booking_slug='clinica-centru',phone='+40 359 000 000' where id=a;
 speciality=public.save_core(a,'specialities',null,'{"name":"Medicină internă","description":"Specialitate demonstrativă"}');
 category=public.save_core(a,'categories',null,'{"name":"Consultații"}');
 room=public.save_core(a,'rooms',null,'{"name":"Cabinet 01","type":"Consultații","capacity":1}');
 equipment=public.save_core(a,'equipment',null,jsonb_build_object('name','Echipament demonstrativ','type','Diagnostic','internal_id','DEMO-EQ-01','capacity',1,'room_id',room));
 service=public.save_core(a,'services',null,jsonb_build_object('name','Consultație inițială','category_id',category,'duration_minutes',30,'price',250,'buffer_before',5,'buffer_after',5,'instructions','Prezentați documentele medicale relevante.','required_documents',jsonb_build_array('Act de identitate'),'room_ids',jsonb_build_array(room),'equipment_ids',jsonb_build_array(equipment)));
 doctor=public.save_doctor(a,null,jsonb_build_object('name','Dr. Andrei Exemplu','professional_code','DEMO-MED-01','speciality_ids',jsonb_build_array(speciality),'service_ids',jsonb_build_array(service),'room_ids',jsonb_build_array(room)));
 perform public.set_doctor_credentials(a,doctor,'10000000-0000-4000-8000-000000000004',null,null,null,null);
 perform public.attach_doctor(a,doctor,b);
 for n in 1..30 loop
  perform public.save_core(a,'patients',null,jsonb_build_object('name',demo_names[n],'internal_id','DEMO-P-'||n,'phone','+4070000'||lpad(n::text,4,'0'),'email','pacient.demo.'||n||'@example.invalid','city','Oradea','administrative_notes','Înregistrare sintetică pentru demonstrație. Nu reprezintă o persoană reală.'));
 end loop;
 perform public.save_core(b,'patients',null,'{"name":"Pacient locație Nord","internal_id":"DEMO-NORD-01"}');
 for day in 1..5 loop
  perform public.save_core(a,'availability',null,jsonb_build_object('name','Program clinică — ziua '||day,'resource_kind','clinic','weekday',day,'start_time','08:00','end_time','18:00','valid_from','2026-01-01'));
  perform public.save_core(a,'availability',null,jsonb_build_object('name','Program medic — ziua '||day,'resource_kind','doctor','doctor_location_id',doctor,'weekday',day,'start_time','09:00','end_time','16:00','valid_from','2026-01-01'));
  perform public.save_core(a,'availability',null,jsonb_build_object('name','Program cabinet — ziua '||day,'resource_kind','room','room_id',room,'weekday',day,'start_time','08:00','end_time','18:00','valid_from','2026-01-01'));
  perform public.save_core(a,'availability',null,jsonb_build_object('name','Program echipament — ziua '||day,'resource_kind','equipment','equipment_id',equipment,'weekday',day,'start_time','08:00','end_time','18:00','valid_from','2026-01-01'));
 end loop;
 perform public.save_core(a,'exceptions',null,jsonb_build_object('name','Mentenanță demonstrativă','resource_kind','equipment','equipment_id',equipment,'exception_kind','maintenance','starts_at','2026-12-10T09:00:00+02:00','ends_at','2026-12-10T12:00:00+02:00'));
 perform public.save_core(a,'exceptions',null,'{"name":"Sărbătoare — clinică închisă","resource_kind":"clinic","exception_kind":"holiday","starts_at":"2026-12-25T00:00:00+02:00","ends_at":"2026-12-26T00:00:00+02:00"}');
end $$;
commit;
