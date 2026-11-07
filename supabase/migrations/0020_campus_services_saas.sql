-- =============================================================================
-- 0020_campus_services_saas.sql
-- Hostel & boarding (billed through monthly invoices), discipline, welfare
-- cases, certificates with public verification + document requests, CRM
-- follow-ups/lead sources, SaaS platform administration (organizations,
-- plan limits) and dashboard KPI RPCs.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Hostel
-- ---------------------------------------------------------------------------
create table if not exists public.hostels (
  id         uuid primary key default extensions.gen_random_uuid(),
  org_id     uuid not null references public.organizations (id),
  name       text not null,
  gender     text not null default 'male' check (gender in ('male', 'female', 'mixed')),
  warden_id  uuid references public.profiles (id) on delete set null,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.hostel_rooms (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  hostel_id   uuid not null references public.hostels (id) on delete cascade,
  room_no     text not null,
  capacity    int  not null default 4 check (capacity > 0),
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  is_active   boolean not null default true,
  unique (hostel_id, room_no)
);

create table if not exists public.hostel_allocations (
  id           uuid primary key default extensions.gen_random_uuid(),
  org_id       uuid not null references public.organizations (id),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  room_id      uuid not null references public.hostel_rooms (id) on delete restrict,
  bed_no       text,
  start_date   date not null default current_date,
  end_date     date,
  status       text not null default 'active' check (status in ('active', 'ended')),
  notes        text,
  allocated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index if not exists idx_hostel_alloc_active on public.hostel_allocations (student_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Discipline & welfare
-- ---------------------------------------------------------------------------
create table if not exists public.discipline_incidents (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  incident_date   date not null default current_date,
  category        text not null default 'behaviour'
                  check (category in ('behaviour', 'attendance', 'uniform', 'academic_dishonesty', 'bullying', 'property', 'other')),
  severity        text not null default 'minor' check (severity in ('minor', 'moderate', 'major')),
  description     text not null,
  action_taken    text,
  status          text not null default 'open' check (status in ('open', 'resolved', 'escalated')),
  parent_notified boolean not null default false,
  reported_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_discipline_student on public.discipline_incidents (student_id, incident_date desc);

create table if not exists public.welfare_cases (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  case_type       text not null default 'counselling'
                  check (case_type in ('counselling', 'medical', 'financial_aid', 'family', 'other')),
  summary         text not null,
  details         text,
  is_confidential boolean not null default true,
  status          text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  assigned_to     uuid references public.profiles (id) on delete set null,
  opened_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.welfare_notes (
  id         uuid primary key default extensions.gen_random_uuid(),
  org_id     uuid not null references public.organizations (id),
  case_id    uuid not null references public.welfare_cases (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null default auth.uid(),
  note       text not null,
  created_at timestamptz not null default now()
);

drop trigger if exists trg_welfare_notes_author on public.welfare_notes;
create trigger trg_welfare_notes_author before insert on public.welfare_notes
  for each row execute function public.tg_force_author('author_id');

drop trigger if exists trg_welfare_cases_updated_at on public.welfare_cases;
create trigger trg_welfare_cases_updated_at before update on public.welfare_cases
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Certificates & document requests
-- ---------------------------------------------------------------------------
create table if not exists public.certificates (
  id                uuid primary key default extensions.gen_random_uuid(),
  org_id            uuid not null references public.organizations (id),
  student_id        uuid not null references public.profiles (id) on delete restrict,
  certificate_type  text not null
                    check (certificate_type in ('completion', 'character', 'transfer', 'enrolment', 'hifz',
                                                'ijazah', 'attendance', 'achievement', 'other')),
  serial_no         text not null,
  verification_code text not null unique default upper(encode(extensions.gen_random_bytes(6), 'hex')),
  title             text not null,
  issued_date       date not null default current_date,
  details           jsonb not null default '{}'::jsonb,
  status            text not null default 'issued' check (status in ('issued', 'revoked')),
  revoked_reason    text,
  issued_by         uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (org_id, serial_no)
);

create table if not exists public.document_requests (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  student_id       uuid not null references public.profiles (id) on delete cascade,
  requested_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  certificate_type text not null,
  purpose          text,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'issued')),
  certificate_id   uuid references public.certificates (id) on delete set null,
  review_note      text,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------
alter table public.admissions
  add column if not exists source       text not null default 'website',
  add column if not exists follow_up_at timestamptz;
alter table public.admissions drop constraint if exists admissions_source_check;
alter table public.admissions add constraint admissions_source_check
  check (source in ('website', 'walk_in', 'phone', 'referral', 'social', 'event', 'mobile_app', 'other'));

create table if not exists public.crm_followups (
  id           uuid primary key default extensions.gen_random_uuid(),
  org_id       uuid not null references public.organizations (id),
  admission_id uuid not null references public.admissions (id) on delete cascade,
  due_at       timestamptz not null,
  kind         text not null default 'call' check (kind in ('call', 'meeting', 'email', 'sms', 'whatsapp', 'visit')),
  note         text,
  assigned_to  uuid references public.profiles (id) on delete set null,
  done_at      timestamptz,
  outcome      text,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_crm_followups_due on public.crm_followups (org_id, due_at) where done_at is null;

-- tenant scope
select public.apply_tenant_scope('hostels');
select public.apply_tenant_scope('hostel_rooms', 'hostel_id', 'hostels');
select public.apply_tenant_scope('hostel_allocations', 'student_id');
select public.apply_tenant_scope('discipline_incidents', 'student_id');
select public.apply_tenant_scope('welfare_cases', 'student_id');
select public.apply_tenant_scope('welfare_notes', 'case_id', 'welfare_cases');
select public.apply_tenant_scope('certificates', 'student_id');
select public.apply_tenant_scope('document_requests', 'student_id');
select public.apply_tenant_scope('crm_followups', 'admission_id', 'admissions');

-- ---------------------------------------------------------------------------
-- Hostel logic
-- ---------------------------------------------------------------------------
create or replace function public.is_hostel_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal']);
$$;

create or replace function public.tg_hostel_allocation_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_cap int;
  v_used int;
begin
  if new.status = 'active' then
    select capacity into v_cap from public.hostel_rooms where id = new.room_id;
    select count(*) into v_used from public.hostel_allocations
    where room_id = new.room_id and status = 'active' and id <> new.id;
    if v_used >= v_cap then
      raise exception 'Room is full (% of % beds occupied)', v_used, v_cap;
    end if;
  end if;
  if new.status = 'ended' and new.end_date is null then
    new.end_date := current_date;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_hostel_allocation_guard on public.hostel_allocations;
create trigger trg_hostel_allocation_guard before insert or update on public.hostel_allocations
  for each row execute function public.tg_hostel_allocation_guard();

-- Hostel fee lines feed the monthly invoice generator.
create or replace function public.fee_extra_lines(p_student uuid, p_month text)
returns table (category_code text, description text, amount numeric)
language sql stable security definer set search_path = public as $$
  select 'HOSTEL', format('Hostel %s – room %s (%s)', h.name, r.room_no, p_month), r.monthly_fee
  from public.hostel_allocations a
  join public.hostel_rooms r on r.id = a.room_id
  join public.hostels h on h.id = r.hostel_id
  where a.student_id = p_student
    and a.start_date <= ((p_month || '-01')::date + interval '1 month' - interval '1 day')
    and (a.end_date is null or a.end_date >= (p_month || '-01')::date)
    and r.monthly_fee > 0;
$$;
revoke all on function public.fee_extra_lines(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Discipline: parents notified for major incidents
-- ---------------------------------------------------------------------------
create or replace function public.tg_discipline_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  par record;
  v_name text;
begin
  if new.severity = 'major' and not new.parent_notified then
    select full_name into v_name from public.profiles where id = new.student_id;
    for par in select parent_id from public.parent_children where child_id = new.student_id loop
      insert into public.notifications (user_id, title, message, org_id)
      values (par.parent_id, 'Important: student conduct report',
              format('A %s incident involving %s was recorded on %s. Please contact the college.',
                     new.category, coalesce(v_name, 'your child'), new.incident_date), new.org_id);
      perform public.enqueue_user_messages(par.parent_id, 'Student conduct report',
              format('A %s incident involving %s was recorded on %s. Please contact the college.',
                     new.category, coalesce(v_name, 'your child'), new.incident_date),
              jsonb_build_object('type', 'discipline', 'incident_id', new.id));
    end loop;
    update public.discipline_incidents set parent_notified = true where id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_discipline_notify on public.discipline_incidents;
create trigger trg_discipline_notify after insert on public.discipline_incidents
  for each row execute function public.tg_discipline_notify();

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create or replace function public.issue_certificate(
  p_student uuid, p_type text, p_title text, p_details jsonb default '{}'::jsonb, p_request uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_serial text;
  v_code text;
begin
  if not public.is_academic_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and org_id = v_org and account_type = 'student') then
    raise exception 'Student not found';
  end if;
  v_serial := public.next_document_number(v_org, 'CERT');
  insert into public.certificates (org_id, student_id, certificate_type, serial_no, title, details)
  values (v_org, p_student, p_type, v_serial, p_title, coalesce(p_details, '{}'::jsonb))
  returning id, verification_code into v_id, v_code;
  if p_request is not null then
    update public.document_requests set status = 'issued', certificate_id = v_id, reviewed_by = auth.uid()
    where id = p_request and org_id = v_org;
  end if;
  insert into public.notifications (user_id, title, message, org_id)
  values (p_student, 'Certificate issued', format('%s (serial %s) is ready.', p_title, v_serial), v_org);
  return jsonb_build_object('id', v_id, 'serial_no', v_serial, 'verification_code', v_code);
end;
$$;

create or replace function public.revoke_certificate(p_certificate uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_academic_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.certificates set status = 'revoked', revoked_reason = p_reason
  where id = p_certificate and org_id = public.current_org_id();
end;
$$;

-- Public verification (anon): minimal disclosure.
create or replace function public.verify_certificate(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
       'valid', c.status = 'issued',
       'status', c.status,
       'serial_no', c.serial_no,
       'type', c.certificate_type,
       'title', c.title,
       'issued_date', c.issued_date,
       'student_name', p.full_name,
       'institution', o.name_en,
       'institution_ar', o.name_ar)
     from public.certificates c
     join public.profiles p on p.id = c.student_id
     join public.organizations o on o.id = c.org_id
     where c.verification_code = upper(trim(p_code))),
    jsonb_build_object('valid', false, 'status', 'not_found'));
$$;

grant execute on function public.issue_certificate(uuid, text, text, jsonb, uuid) to authenticated;
grant execute on function public.revoke_certificate(uuid, text) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- SaaS platform administration
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_slug text, p_name_en text, p_code text, p_admin_email text,
  p_name_ar text default null, p_plan text default 'standard', p_max_students int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_token text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,40}$' then
    raise exception 'Slug must be 3-41 chars: lowercase letters, digits, hyphens';
  end if;
  insert into public.organizations (slug, name_en, name_ar, code, plan, max_students, contact_email, status)
  values (p_slug, p_name_en, p_name_ar, upper(p_code), p_plan, p_max_students, p_admin_email, 'active')
  returning id into v_org;

  insert into public.org_invitations (org_id, email, account_type, role, invited_by)
  values (v_org, lower(p_admin_email), 'staff', 'admin', auth.uid())
  returning token into v_token;

  return jsonb_build_object('org_id', v_org, 'slug', p_slug, 'admin_invite_token', v_token);
end;
$$;

create or replace function public.set_organization_status(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.organizations set status = p_status where id = p_org;
end;
$$;

create or replace function public.platform_overview()
returns table (org_id uuid, slug text, name_en text, code text, status text, plan text, max_students int,
               students bigint, employees bigint, parents bigint, invoiced numeric, collected numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select o.id, o.slug, o.name_en, o.code, o.status, o.plan, o.max_students,
         (select count(*) from public.profiles p where p.org_id = o.id and p.account_type = 'student'),
         (select count(*) from public.profiles p where p.org_id = o.id and p.account_type in ('tutor', 'staff')),
         (select count(*) from public.profiles p where p.org_id = o.id and p.account_type = 'parent'),
         coalesce((select sum(total_due) from public.student_fees f where f.org_id = o.id), 0)::numeric,
         coalesce((select sum(amount) from public.fee_payments fp where fp.org_id = o.id and fp.status = 'posted'), 0)::numeric,
         o.created_at
  from public.organizations o
  order by o.created_at;
end;
$$;

grant execute on function public.create_organization(text, text, text, text, text, text, int) to authenticated;
grant execute on function public.set_organization_status(uuid, text) to authenticated;
grant execute on function public.platform_overview() to authenticated;

-- Plan limit: max students per organization
create or replace function public.tg_profiles_plan_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_count int;
begin
  if new.account_type <> 'student' then
    return new;
  end if;
  select max_students into v_max from public.organizations where id = new.org_id;
  if v_max is not null then
    select count(*) into v_count from public.profiles where org_id = new.org_id and account_type = 'student';
    if v_count >= v_max then
      raise exception 'Student limit of % reached for this institution''s plan', v_max;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_plan_limit on public.profiles;
create trigger trg_profiles_plan_limit before insert on public.profiles
  for each row execute function public.tg_profiles_plan_limit();

-- ---------------------------------------------------------------------------
-- Dashboards
-- ---------------------------------------------------------------------------
create or replace function public.org_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_month text := to_char(now(), 'YYYY-MM');
begin
  if not (public.is_admin() or public.is_finance_viewer() or public.is_academic_admin() or public.is_hr_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where org_id = v_org and account_type = 'student' and is_approved),
    'employees', (select count(*) from public.profiles where org_id = v_org and account_type in ('tutor', 'staff') and is_approved),
    'parents', (select count(*) from public.profiles where org_id = v_org and account_type = 'parent'),
    'pending_approvals', (select count(*) from public.profiles where org_id = v_org and not is_approved),
    'pending_parent_links', (select count(*) from public.parent_link_requests where org_id = v_org and status = 'pending'),
    'attendance_today', (select jsonb_build_object(
        'marked', count(*), 'present', count(*) filter (where status in ('present', 'late')),
        'rate', case when count(*) > 0 then round(count(*) filter (where status in ('present', 'late')) * 100.0 / count(*), 1) end)
      from public.attendance where org_id = v_org and date = public.org_today()),
    'fees_month', (select jsonb_build_object('month', v_month, 'invoiced', coalesce(sum(total_due), 0),
        'collected', coalesce(sum(paid_amount), 0), 'outstanding', coalesce(sum(total_due - paid_amount), 0))
      from public.student_fees where org_id = v_org and month = v_month and status <> 'cancelled'),
    'fees_outstanding_total', coalesce((select sum(total_due - paid_amount) from public.student_fees
      where org_id = v_org and status in ('unpaid', 'partial')), 0),
    'collections_30d', coalesce((select sum(amount) from public.fee_payments
      where org_id = v_org and status = 'posted' and paid_at > now() - interval '30 days'), 0),
    'expenses_month', coalesce((select sum(amount) from public.expenses
      where org_id = v_org and status = 'paid' and to_char(expense_date, 'YYYY-MM') = v_month), 0),
    'expenses_pending', (select count(*) from public.expenses where org_id = v_org and status = 'submitted'),
    'donations_month', coalesce((select sum(amount) from public.donations
      where org_id = v_org and status = 'recorded' and to_char(donation_date, 'YYYY-MM') = v_month), 0),
    'last_payroll', (select jsonb_build_object('period', period, 'status', status, 'net', total_net, 'staff', staff_count)
      from public.payroll_runs where org_id = v_org and status <> 'cancelled' order by period desc limit 1),
    'admissions_pipeline', coalesce((select jsonb_object_agg(pipeline_stage, n) from (
        select coalesce(pipeline_stage, 'submitted') pipeline_stage, count(*) n from public.admissions
        where org_id = v_org group by 1) s), '{}'::jsonb),
    'followups_overdue', (select count(*) from public.crm_followups where org_id = v_org and done_at is null and due_at < now()),
    'staff_leave_pending', (select count(*) from public.staff_leave_requests where org_id = v_org and status = 'pending'),
    'student_leave_pending', (select count(*) from public.leave_requests where org_id = v_org and status = 'pending'),
    'discipline_open', (select count(*) from public.discipline_incidents where org_id = v_org and status = 'open'),
    'hostel', (select jsonb_build_object('beds', coalesce(sum(r.capacity), 0),
        'occupied', (select count(*) from public.hostel_allocations a where a.org_id = v_org and a.status = 'active'))
      from public.hostel_rooms r where r.org_id = v_org and r.is_active),
    'document_requests_pending', (select count(*) from public.document_requests where org_id = v_org and status = 'pending')
  );
end;
$$;

create or replace function public.crm_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
begin
  if not public.is_admissions_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'by_stage', coalesce((select jsonb_object_agg(s, n) from (
        select coalesce(pipeline_stage, 'submitted') s, count(*) n from public.admissions where org_id = v_org group by 1) x), '{}'::jsonb),
    'by_source', coalesce((select jsonb_object_agg(source, n) from (
        select source, count(*) n from public.admissions where org_id = v_org group by 1) x), '{}'::jsonb),
    'conversion_rate', (select case when count(*) > 0
        then round(count(*) filter (where pipeline_stage = 'enrolled') * 100.0 / count(*), 1) end
      from public.admissions where org_id = v_org),
    'last_30_days', (select count(*) from public.admissions where org_id = v_org and created_at > now() - interval '30 days'),
    'followups_due_today', (select count(*) from public.crm_followups
      where org_id = v_org and done_at is null and (due_at at time zone 'Asia/Colombo')::date = public.org_today()),
    'followups_overdue', (select count(*) from public.crm_followups where org_id = v_org and done_at is null and due_at < now())
  );
end;
$$;

grant execute on function public.org_dashboard_stats() to authenticated;
grant execute on function public.crm_dashboard() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.hostels              enable row level security;
alter table public.hostel_rooms         enable row level security;
alter table public.hostel_allocations   enable row level security;
alter table public.discipline_incidents enable row level security;
alter table public.welfare_cases        enable row level security;
alter table public.welfare_notes        enable row level security;
alter table public.certificates         enable row level security;
alter table public.document_requests    enable row level security;
alter table public.crm_followups        enable row level security;

drop policy if exists "hostels: read" on public.hostels;
create policy "hostels: read" on public.hostels for select to authenticated using (true);
drop policy if exists "hostels: manage" on public.hostels;
create policy "hostels: manage" on public.hostels for all to authenticated
  using (public.is_hostel_staff()) with check (public.is_hostel_staff());
drop policy if exists "hostel_rooms: read" on public.hostel_rooms;
create policy "hostel_rooms: read" on public.hostel_rooms for select to authenticated using (true);
drop policy if exists "hostel_rooms: manage" on public.hostel_rooms;
create policy "hostel_rooms: manage" on public.hostel_rooms for all to authenticated
  using (public.is_hostel_staff()) with check (public.is_hostel_staff());
drop policy if exists "hostel_alloc: read" on public.hostel_allocations;
create policy "hostel_alloc: read" on public.hostel_allocations for select to authenticated
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_employee());
drop policy if exists "hostel_alloc: manage" on public.hostel_allocations;
create policy "hostel_alloc: manage" on public.hostel_allocations for all to authenticated
  using (public.is_hostel_staff()) with check (public.is_hostel_staff());

drop policy if exists "discipline: read" on public.discipline_incidents;
create policy "discipline: read" on public.discipline_incidents for select to authenticated
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_employee());
drop policy if exists "discipline: employee report" on public.discipline_incidents;
create policy "discipline: employee report" on public.discipline_incidents for insert to authenticated
  with check (public.is_employee());
drop policy if exists "discipline: welfare manage" on public.discipline_incidents;
create policy "discipline: welfare manage" on public.discipline_incidents for update to authenticated
  using (public.is_welfare_staff() or reported_by = auth.uid()) with check (public.is_welfare_staff() or reported_by = auth.uid());
drop policy if exists "discipline: admin delete" on public.discipline_incidents;
create policy "discipline: admin delete" on public.discipline_incidents for delete to authenticated using (public.is_admin());

drop policy if exists "welfare_cases: staff" on public.welfare_cases;
create policy "welfare_cases: staff" on public.welfare_cases for all to authenticated
  using (public.is_welfare_staff() or assigned_to = auth.uid()
         or (not is_confidential and public.is_employee()))
  with check (public.is_welfare_staff() or assigned_to = auth.uid());
drop policy if exists "welfare_notes: staff" on public.welfare_notes;
create policy "welfare_notes: staff" on public.welfare_notes for all to authenticated
  using (public.is_welfare_staff() or exists (select 1 from public.welfare_cases c where c.id = case_id and c.assigned_to = auth.uid()))
  with check (public.is_welfare_staff() or exists (select 1 from public.welfare_cases c where c.id = case_id and c.assigned_to = auth.uid()));

drop policy if exists "certificates: read" on public.certificates;
create policy "certificates: read" on public.certificates for select to authenticated
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_employee());

drop policy if exists "document_requests: read" on public.document_requests;
create policy "document_requests: read" on public.document_requests for select to authenticated
  using (student_id = auth.uid() or requested_by = auth.uid() or public.is_parent_of(student_id) or public.is_academic_admin());
drop policy if exists "document_requests: request" on public.document_requests;
create policy "document_requests: request" on public.document_requests for insert to authenticated
  with check ((student_id = auth.uid() or public.is_parent_of(student_id)) and status = 'pending');
drop policy if exists "document_requests: process" on public.document_requests;
create policy "document_requests: process" on public.document_requests for update to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

drop policy if exists "crm_followups: admissions staff" on public.crm_followups;
create policy "crm_followups: admissions staff" on public.crm_followups for all to authenticated
  using (public.is_admissions_staff()) with check (public.is_admissions_staff());

-- admissions officers get the CRM (previously admin-only)
drop policy if exists "admissions: admissions staff read" on public.admissions;
create policy "admissions: admissions staff read" on public.admissions for select to authenticated
  using (public.is_admissions_staff());
drop policy if exists "admissions: admissions staff update" on public.admissions;
create policy "admissions: admissions staff update" on public.admissions for update to authenticated
  using (public.is_admissions_staff()) with check (public.is_admissions_staff());
drop policy if exists "admissions: staff create lead" on public.admissions;
create policy "admissions: staff create lead" on public.admissions for insert to authenticated
  with check (public.is_admissions_staff());
drop policy if exists "admission_notes: admissions staff" on public.admission_notes;
create policy "admission_notes: admissions staff" on public.admission_notes for all to authenticated
  using (public.is_admissions_staff()) with check (public.is_admissions_staff());
drop policy if exists "admission_history: admissions staff" on public.admission_status_history;
create policy "admission_history: admissions staff" on public.admission_status_history for all to authenticated
  using (public.is_admissions_staff()) with check (public.is_admissions_staff());
drop policy if exists "valid_indexes: admissions staff" on public.valid_index_numbers;
create policy "valid_indexes: admissions staff" on public.valid_index_numbers for all to authenticated
  using (public.is_admissions_staff()) with check (public.is_admissions_staff());
drop policy if exists "parent_invites: admissions staff" on public.parent_invites;
create policy "parent_invites: admissions staff" on public.parent_invites for all to authenticated
  using (public.is_admissions_staff()) with check (public.is_admissions_staff());

-- enroll_admission: allow admissions officers too (was is_staff only)
create or replace function public.enroll_admission(
  p_admission_id uuid, p_index_number text, p_class_number int default 1, p_default_fee numeric default 2000)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  adm record;
  invite_token text;
begin
  if not public.is_admissions_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into adm from public.admissions where id = p_admission_id and org_id = public.current_org_id();
  if not found then
    raise exception 'admission not found';
  end if;

  if exists (select 1 from public.valid_index_numbers
             where index_number = p_index_number and (org_id <> adm.org_id or is_registered)) then
    raise exception 'Index number % is already in use', p_index_number;
  end if;
  insert into public.valid_index_numbers (index_number, student_name, class_number, is_registered, org_id)
  values (p_index_number, adm.student_name, p_class_number, false, adm.org_id)
  on conflict (index_number) do update
    set student_name = excluded.student_name, class_number = excluded.class_number
    where public.valid_index_numbers.org_id = adm.org_id and not public.valid_index_numbers.is_registered;

  update public.admissions
  set status = 'enrolled', pipeline_stage = 'enrolled', enrolled_index = p_index_number,
      enrolled_class = p_class_number, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_admission_id;

  insert into public.admission_status_history (admission_id, from_stage, to_stage, changed_by, note, org_id)
  values (p_admission_id, adm.pipeline_stage, 'enrolled', auth.uid(),
          format('Enrolled index %s class %s', p_index_number, p_class_number), adm.org_id);

  insert into public.parent_invites (child_index, child_name, admission_id, created_by, org_id)
  values (p_index_number, adm.student_name, p_admission_id, auth.uid(), adm.org_id)
  returning token into invite_token;

  if coalesce(adm.phone, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('sms', adm.phone, 'Parent portal invite',
            format('Your child %s is enrolled (index %s). Register as a parent and use invite code %s to link.',
                   adm.student_name, p_index_number, invite_token),
            jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token), adm.org_id);
  end if;
  if coalesce(adm.email, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('email', adm.email, 'Parent portal invite',
            format(E'Assalamu alaikum %s,\n\nYour child %s has been enrolled.\nIndex number: %s\nClass: %s\nInvite code: %s\n\nPlease register as a parent and link this index in the Parent Portal.',
                   adm.parent_name, adm.student_name, p_index_number, p_class_number, invite_token),
            jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token), adm.org_id);
  end if;

  return jsonb_build_object('ok', true, 'index_number', p_index_number, 'class_number', p_class_number,
                            'fee_month', to_char(now(), 'YYYY-MM'), 'suggested_fee', p_default_fee,
                            'parent_invite_token', invite_token, 'org_id', adm.org_id);
end;
$$;

select public.attach_audit(t) from unnest(array['hostel_allocations', 'discipline_incidents', 'certificates', 'welfare_cases']) t;

-- ---------------------------------------------------------------------------
-- Native mobile push (Expo). Every in-app notification is fanned out to the
-- user's registered devices through message_outbox (channel 'push'); the
-- send-outbound function delivers them via the Expo push service.
-- ---------------------------------------------------------------------------
create table if not exists public.device_push_tokens (
  id         uuid primary key default extensions.gen_random_uuid(),
  org_id     uuid not null references public.organizations (id),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique check (token ~ '^(Exponent|Expo)PushToken\[.+\]$'),
  platform   text check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
select public.apply_tenant_scope('device_push_tokens', 'user_id');
alter table public.device_push_tokens enable row level security;
drop policy if exists "device_push_tokens: own" on public.device_push_tokens;
create policy "device_push_tokens: own" on public.device_push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Register / refresh this device for the signed-in user (moves a token that
-- was previously registered by another account on the same phone).
create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.device_push_tokens (org_id, user_id, token, platform)
  values ((select org_id from public.profiles where id = auth.uid()), auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, org_id = excluded.org_id, platform = excluded.platform, last_seen = now();
end;
$$;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.tg_notifications_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
  select new.user_id, 'push', d.token, new.title, left(new.message, 900),
         jsonb_build_object('type', 'notification', 'notification_id', new.id), new.org_id
  from public.device_push_tokens d
  join public.profiles p on p.id = d.user_id
  where d.user_id = new.user_id and p.notify_push;
  return null;
end;
$$;
drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push after insert on public.notifications
  for each row execute function public.tg_notifications_push();
