-- Manual reminders can be opened for any appointment day, not only tomorrow.
-- Replace only the previous built-in template; preserve clinic custom messages.
alter table public.clinics alter column whatsapp_reminder_template set default
 'Bună ziua, {{patient_name}}. Vă reamintim programarea din {{date}}, la ora {{time}}, la {{clinic_name}}, {{clinic_address}}. Serviciu: {{service_name}}. Medic: {{doctor_name}}. Dacă nu mai puteți ajunge, vă rugăm să ne anunțați. Vă mulțumim.';

update public.clinics set whatsapp_reminder_template =
 'Bună ziua, {{patient_name}}. Vă reamintim programarea din {{date}}, la ora {{time}}, la {{clinic_name}}, {{clinic_address}}. Serviciu: {{service_name}}. Medic: {{doctor_name}}. Dacă nu mai puteți ajunge, vă rugăm să ne anunțați. Vă mulțumim.'
where whatsapp_reminder_template =
 'Bună ziua, {{patient_first_name}}. Vă reamintim că mâine, {{date}}, la ora {{time}}, aveți o programare la {{clinic_name}}, {{clinic_address}}. Dacă nu mai puteți ajunge, vă rugăm să ne anunțați. Vă mulțumim.';
