-- Plausible operational durations for the explicitly marked Clinica Maria demo catalog.
with demo_clinics as (
  select distinct dl.clinic_id from public.doctor_locations dl
  join public.doctors d on d.id=dl.doctor_id where d.professional_code like 'CM-DEMO-MED-%'
), calculated as (
  select s.id,
    case
      when s.name='EKG' then 15
      when s.name like 'Holter %' then 20
      when s.name='Ergometrie / test de efort' then 45
      when s.name='Ecocardiografie + Doppler Color' then 35
      when s.name like 'Pachet cardiologie:%' then 75
      when s.name like 'Consultație %' then 30
      when s.name='Endoscopie digestivă superioară' then 35
      when s.name='Endoscopie digestivă inferioară' then 50
      when s.name='Infiltrație epidurală' then 45
      when s.name='Ecografie generală (abdomen + pelvis)' then 40
      when s.name='Ecografie abdomen' then 25
      when s.name='Ecografie pelvis' then 25
      when s.name like 'Ecografie de organ%' then 20
      when s.name like 'Ecografie%' then 30
      when s.name='Mamografie digitală 2D bilaterală' then 20
      when s.name='Mamografie cu tomosinteză bilaterală' then 30
      when s.name='Angiografie CT' then 40
      when s.name='UroCT' then 35
      when s.name like 'CT %fără substanță de contrast' then 15
      when s.name like 'CT %nativ și cu substanță de contrast' then 30
      when s.name='Colangio RMN abdomen' then 45
      when s.name='Angiografie RMN' then 50
      when s.name like 'RMN %cu substanță de contrast' or s.name like 'RMN %nativ și cu substanță de contrast' then 50
      when s.name like 'RMN abdominal nativ' or s.name like 'RMN pelvis nativ' then 40
      when s.name like 'RMN %nativ' then 35
      else s.duration_minutes
    end duration,
    case when s.name like 'Endoscopie %' or s.name='Infiltrație epidurală' then 10 else 0 end buffer_before,
    case
      when s.name like '%substanță de contrast%' or s.name in ('Angiografie CT','Angiografie RMN','Colangio RMN abdomen') then 10
      when s.name like 'Endoscopie %' or s.name='Infiltrație epidurală' or s.name='Ergometrie / test de efort' then 15
      when s.name like 'Holter %' or s.name like 'Pachet cardiologie:%' then 10
      else 5
    end buffer_after
  from public.services s where s.clinic_id in (select clinic_id from demo_clinics) and s.active and s.archived_at is null
)
update public.services s set duration_minutes=c.duration,buffer_before=c.buffer_before,buffer_after=c.buffer_after,updated_at=now()
from calculated c where s.id=c.id;

-- Keep existing synthetic calendar blocks representative after the catalog update.
update public.appointments a set
  duration_minutes=s.duration_minutes,buffer_before=s.buffer_before,buffer_after=s.buffer_after,
  end_at=a.start_at+make_interval(mins=>s.duration_minutes),
  occupied_start_at=a.start_at-make_interval(mins=>s.buffer_before),
  occupied_end_at=a.start_at+make_interval(mins=>s.duration_minutes+s.buffer_after),updated_at=now()
from public.services s where a.service_id=s.id and a.clinic_id=s.clinic_id and a.notes like 'CM_DEMO_APPT_%';
