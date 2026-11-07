-- =============================================================================
-- 0013_crm_hrm_saas.sql
-- Admissions CRM pipeline, staff HRM, organizations (SaaS-ready org_id).
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Organizations (single college now; multi-tenant later)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id            uuid primary key default extensions.gen_random_uuid(),
  slug          text not null unique,
  name_en       text not null,
  name_ar       text,
  branding      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

insert into public.organizations (slug, name_en, name_ar)
values ('kashiful-hudha', 'Dharul Uloom Kashiful Hudha Arabic College', 'دار العلوم كاشف الهدى')
on conflict (slug) do nothing;

alter table public.organizations enable row level security;

create policy "organizations: public read"
  on public.organizations for select
  using (true);

create policy "organizations: staff write"
  on public.organizations for all
  using (public.is_staff())
  with check (public.is_staff());

-- Nullable org_id on tenant tables (backfill to default org)
do $$
declare
  default_org uuid;
begin
  select id into default_org from public.organizations where slug = 'kashiful-hudha' limit 1;

  alter table public.profiles add column if not exists org_id uuid references public.organizations (id);
  alter table public.admissions add column if not exists org_id uuid references public.organizations (id);
  alter table public.books add column if not exists org_id uuid references public.organizations (id);
  alter table public.student_fees add column if not exists org_id uuid references public.organizations (id);

  update public.profiles set org_id = default_org where org_id is null;
  update public.admissions set org_id = default_org where org_id is null;
  update public.books set org_id = default_org where org_id is null;
  update public.student_fees set org_id = default_org where org_id is null;
end $$;

-- ---------------------------------------------------------------------------
-- CRM: expand admissions pipeline
-- ---------------------------------------------------------------------------
alter table public.admissions
  add column if not exists pipeline_stage text,
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists enrolled_index text,
  add column if not exists enrolled_class int;

-- Migrate legacy status → pipeline_stage
update public.admissions set pipeline_stage = case status
  when 'pending' then 'submitted'
  when 'approved' then 'accepted'
  when 'rejected' then 'rejected'
  else coalesce(pipeline_stage, 'submitted')
end
where pipeline_stage is null;

alter table public.admissions
  alter column pipeline_stage set default 'submitted';

alter table public.admissions drop constraint if exists admissions_status_check;
alter table public.admissions
  add constraint admissions_status_check
  check (status in ('pending', 'approved', 'rejected', 'lead', 'submitted', 'interview', 'accepted', 'enrolled'));

alter table public.admissions drop constraint if exists admissions_pipeline_stage_check;
alter table public.admissions
  add constraint admissions_pipeline_stage_check
  check (pipeline_stage in ('lead', 'submitted', 'interview', 'accepted', 'enrolled', 'rejected'));

create table if not exists public.admission_notes (
  id            uuid primary key default extensions.gen_random_uuid(),
  admission_id  uuid not null references public.admissions (id) on delete cascade,
  author_id     uuid references public.profiles (id) on delete set null,
  body          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.admission_status_history (
  id            uuid primary key default extensions.gen_random_uuid(),
  admission_id  uuid not null references public.admissions (id) on delete cascade,
  from_stage    text,
  to_stage      text not null,
  changed_by    uuid references public.profiles (id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

alter table public.admission_notes enable row level security;
alter table public.admission_status_history enable row level security;

create policy "admission_notes: staff"
  on public.admission_notes for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "admission_history: staff"
  on public.admission_status_history for all
  using (public.is_staff())
  with check (public.is_staff());

-- Enroll: create index number + optional fee kickoff
create or replace function public.enroll_admission(
  p_admission_id uuid,
  p_index_number text,
  p_class_number int default 1,
  p_default_fee numeric default 2000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  adm record;
  month text;
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;

  select * into adm from public.admissions where id = p_admission_id;
  if not found then
    raise exception 'admission not found';
  end if;

  insert into public.valid_index_numbers (index_number, student_name, class_number, is_registered)
  values (p_index_number, adm.student_name, p_class_number, false)
  on conflict (index_number) do update
    set student_name = excluded.student_name,
        class_number = excluded.class_number;

  update public.admissions
  set status = 'enrolled',
      pipeline_stage = 'enrolled',
      enrolled_index = p_index_number,
      enrolled_class = p_class_number,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_admission_id;

  insert into public.admission_status_history (admission_id, from_stage, to_stage, changed_by, note)
  values (p_admission_id, adm.pipeline_stage, 'enrolled', auth.uid(), format('Enrolled index %s class %s', p_index_number, p_class_number));

  month := to_char(now(), 'YYYY-MM');

  return jsonb_build_object(
    'ok', true,
    'index_number', p_index_number,
    'class_number', p_class_number,
    'fee_month', month,
    'suggested_fee', p_default_fee
  );
end;
$$;

grant execute on function public.enroll_admission(uuid, text, int, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- HRM: staff employment records
-- ---------------------------------------------------------------------------
create table if not exists public.staff_hr (
  id                  uuid primary key default extensions.gen_random_uuid(),
  profile_id          uuid not null unique references public.profiles (id) on delete cascade,
  org_id              uuid references public.organizations (id),
  department          text,
  job_title           text,
  employment_start    date,
  employment_end      date,
  emergency_contact   text,
  emergency_phone     text,
  documents           jsonb not null default '[]'::jsonb,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_staff_hr_updated_at
  before update on public.staff_hr
  for each row execute function public.set_updated_at();

alter table public.staff_hr enable row level security;

create policy "staff_hr: staff manage"
  on public.staff_hr for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_hr: self read"
  on public.staff_hr for select
  using (profile_id = auth.uid());

-- Push subscription endpoints for PWA
create table if not exists public.push_subscriptions (
  id            uuid primary key default extensions.gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: own"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Import job progress (Shamela worker)
create table if not exists public.import_jobs (
  id            uuid primary key default extensions.gen_random_uuid(),
  job_type      text not null default 'shamela',
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'paused', 'completed', 'failed')),
  progress      jsonb not null default '{}'::jsonb,
  checkpoint    jsonb not null default '{}'::jsonb,
  error         text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.import_jobs enable row level security;

create policy "import_jobs: staff"
  on public.import_jobs for all
  using (public.is_staff())
  with check (public.is_staff());
