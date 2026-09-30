-- Expose scheduling requirements through the existing versioned service editor.
create or replace function private.core_spec(module text) returns jsonb language sql immutable set search_path='' as $$
 select case module
 when 'patients' then '{"table":"patients","permission":"patients","fields":["name","internal_id","birth_date","sex","phone","email","address","city","postal_code","country","administrative_notes","active"]}'::jsonb
 when 'specialities' then '{"table":"specialities","permission":"catalog","fields":["name","description","active"]}'::jsonb
 when 'categories' then '{"table":"service_categories","permission":"catalog","fields":["name","description","active"]}'::jsonb
 when 'rooms' then '{"table":"rooms","permission":"catalog","fields":["name","type","capacity","active"]}'::jsonb
 when 'equipment' then '{"table":"equipment","permission":"catalog","fields":["name","type","internal_id","room_id","capacity","active"]}'::jsonb
 when 'services' then '{"table":"services","permission":"catalog","fields":["name","category_id","duration_minutes","price","buffer_before","buffer_after","doctor_requirement","room_required","minimum_room_capacity","instructions","required_documents","exclusion_rules","active"]}'::jsonb
 when 'doctors' then '{"table":"clinic_doctors","permission":"catalog","fields":["name","professional_code","email","phone","active"]}'::jsonb
 when 'availability' then '{"table":"availability_rules","permission":"availability","fields":["name","resource_kind","doctor_location_id","room_id","equipment_id","weekday","start_time","end_time","valid_from","valid_until","interval_kind","active"]}'::jsonb
 when 'exceptions' then '{"table":"schedule_exceptions","permission":"availability","fields":["name","resource_kind","doctor_location_id","room_id","equipment_id","starts_at","ends_at","exception_kind","notes","active"]}'::jsonb
 end
$$;
