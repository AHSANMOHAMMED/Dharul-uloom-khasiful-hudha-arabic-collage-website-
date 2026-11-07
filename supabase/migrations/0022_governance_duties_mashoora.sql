-- =============================================================================
-- 0022_governance_duties_mashoora.sql
--
-- 1. Super admin central control: "act as" any institution (acting_org_id).
-- 2. Duties (responsibilities) assigned to lecturers/staff per academic year,
--    decided at the mashoora (shura). Duties change every year; the full
--    history (who held what, when, decided where) is kept forever.
-- 3. Petty cash per duty: top-ups, spends (approved by accounts, posted to the
--    ledger), returns. Every entry is tied to the person holding the duty at
--    that moment, so a duty's spending history survives hand-overs.
--    Purchases through the normal expense workflow can be tagged to a duty.
-- 4. Mashoora meetings (weekly / annual / special) with minutes & decisions.
-- 5. Task board (Kanban: todo → in progress → review → done) for tasks
--    assigned at the mashoora or by managers; comments; history.
-- 6. Admissions: date of birth → age computed in the DB and validated against
--    the institution's age limits; public (guest) applications go straight
--    into the CRM pipeline.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. Super admin "act as institution"
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists acting_org_id uuid references public.organizations (id);

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select o.id
  from public.profiles p
  join public.organizations o
    on o.id = case when p.role = 'super_admin' and p.acting_org_id is not null then p.acting_org_id else p.org_id end
  where p.id = auth.uid()
    and (o.status in ('trial', 'active') or p.role = 'super_admin');
$$;

create or replace function public.set_acting_org(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_org is not null and not exists (select 1 from public.organizations where id = p_org) then
    raise exception 'Organization not found';
  end if;
  update public.profiles set acting_org_id = p_org where id = auth.uid();
  return (select jsonb_build_object('acting_org_id', p_org, 'name_en', name_en, 'slug', slug)
          from public.organizations where id = coalesce(p_org, (select org_id from public.profiles where id = auth.uid())));
end;
$$;
grant execute on function public.set_acting_org(uuid) to authenticated;

-- Only the RPC may set acting_org_id
create or replace function public.tg_profiles_acting_org_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and new.acting_org_id is distinct from old.acting_org_id then
    raise exception 'Use set_acting_org()' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_acting_org_guard on public.profiles;
create trigger trg_profiles_acting_org_guard before update on public.profiles
  for each row execute function public.tg_profiles_acting_org_guard();

-- Governance = administrators and the principal / vice principal.
create or replace function public.is_governance_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['principal', 'vice_principal']);
$$;

-- ---------------------------------------------------------------------------
-- 2. Mashoora meetings
-- ---------------------------------------------------------------------------
create table if not exists public.mashoora_meetings (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  title         text not null,
  meeting_type  text not null default 'weekly' check (meeting_type in ('weekly', 'annual', 'special')),
  meeting_date  date not null default current_date,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  chaired_by    uuid references public.profiles (id) on delete set null,
  attendees     uuid[] not null default '{}'::uuid[],
  agenda        text,
  minutes       text,
  decisions     text,
  status        text not null default 'draft' check (status in ('draft', 'finalized')),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_mashoora_org_date on public.mashoora_meetings (org_id, meeting_date desc);

-- ---------------------------------------------------------------------------
-- 3. Duties & yearly assignments
-- ---------------------------------------------------------------------------
create table if not exists public.duty_roles (
  id                  uuid primary key default extensions.gen_random_uuid(),
  org_id              uuid not null references public.organizations (id),
  code                text not null,
  name_en             text not null,
  name_ar             text,
  name_ta             text,
  category            text not null default 'other'
                      check (category in ('academic', 'welfare', 'facilities', 'finance', 'administration', 'religious', 'other')),
  description         text,
  default_petty_cash  numeric(12,2) not null default 0 check (default_petty_cash >= 0),
  grants_leave_review boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.duty_assignments (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  duty_role_id     uuid not null references public.duty_roles (id) on delete restrict,
  assignee_id      uuid not null references public.profiles (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  is_lead          boolean not null default true,
  start_date       date not null default current_date,
  end_date         date,
  status           text not null default 'active' check (status in ('active', 'ended')),
  meeting_id       uuid references public.mashoora_meetings (id) on delete set null,
  assigned_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  notes            text,
  end_reason       text,
  created_at       timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists idx_duty_assignments_duty on public.duty_assignments (duty_role_id, start_date desc);
create index if not exists idx_duty_assignments_assignee on public.duty_assignments (assignee_id) where status = 'active';

-- Seed the usual college duties (trilingual) for every institution.
create or replace function public.seed_duty_roles(p_org uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.duty_roles (org_id, code, name_en, name_ar, name_ta, category, default_petty_cash, grants_leave_review)
  values
    (p_org, 'STUDENT_LEAVE', 'Student leave & attendance', 'إجازات الطلاب والحضور', 'மாணவர் விடுப்பு மற்றும் வரவு', 'academic', 0, true),
    (p_org, 'FOOD', 'Food & kitchen management', 'إدارة الطعام والمطبخ', 'உணவு மற்றும் சமையலறை நிர்வாகம்', 'welfare', 10000, false),
    (p_org, 'ELECTRICAL', 'Electrical & utilities', 'الكهرباء والمرافق', 'மின்சாரம் மற்றும் பயன்பாடுகள்', 'facilities', 5000, false),
    (p_org, 'CLEANING', 'Cleaning & hygiene', 'النظافة والصحة', 'சுத்தம் மற்றும் சுகாதாரம்', 'facilities', 3000, false),
    (p_org, 'MAINTENANCE', 'Buildings & maintenance', 'المباني والصيانة', 'கட்டடங்கள் மற்றும் பராமரிப்பு', 'facilities', 5000, false),
    (p_org, 'HOSTEL', 'Hostel supervision', 'الإشراف على السكن', 'விடுதி மேற்பார்வை', 'welfare', 3000, false),
    (p_org, 'EXAMS', 'Examinations', 'الامتحانات', 'பரீட்சைகள்', 'academic', 2000, false),
    (p_org, 'LIBRARY', 'Library', 'المكتبة', 'நூலகம்', 'academic', 1000, false),
    (p_org, 'DISCIPLINE', 'Discipline & student welfare', 'الانضباط ورعاية الطلاب', 'ஒழுக்கம் மற்றும் மாணவர் நலன்', 'welfare', 0, true),
    (p_org, 'MASJID', 'Masjid & prayer', 'المسجد والصلاة', 'பள்ளிவாசல் மற்றும் தொழுகை', 'religious', 2000, false),
    (p_org, 'EVENTS', 'Events & programmes', 'الفعاليات والبرامج', 'நிகழ்வுகள் மற்றும் நிகழ்ச்சிகள்', 'administration', 3000, false),
    (p_org, 'SPORTS', 'Sports & physical education', 'الرياضة والتربية البدنية', 'விளையாட்டு மற்றும் உடற்கல்வி', 'welfare', 2000, false),
    (p_org, 'TRANSPORT', 'Transport', 'النقل', 'போக்குவரத்து', 'facilities', 3000, false),
    (p_org, 'ADMISSIONS', 'Admissions & enrolment', 'القبول والتسجيل', 'அனுமதி மற்றும் சேர்க்கை', 'administration', 0, false)
  on conflict (org_id, code) do nothing;
$$;
revoke all on function public.seed_duty_roles(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Petty cash
-- ---------------------------------------------------------------------------
insert into public.accounts (org_id, code, name, name_ar, type, subtype, is_system)
select id, '1050', 'Petty Cash', 'النثرية', 'asset', 'cash', true from public.organizations
on conflict (org_id, code) do nothing;

create table if not exists public.petty_cash_funds (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  duty_role_id  uuid not null unique references public.duty_roles (id) on delete restrict,
  float_limit   numeric(12,2) not null default 0 check (float_limit >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.petty_cash_entries (
  id                 uuid primary key default extensions.gen_random_uuid(),
  org_id             uuid not null references public.organizations (id),
  fund_id            uuid not null references public.petty_cash_funds (id) on delete restrict,
  duty_assignment_id uuid references public.duty_assignments (id) on delete set null,
  holder_id          uuid references public.profiles (id) on delete set null,
  entry_type         text not null check (entry_type in ('topup', 'expense', 'return')),
  entry_date         date not null default current_date,
  amount             numeric(12,2) not null check (amount > 0),
  account_id         uuid references public.accounts (id),
  counter_account_code text,
  description        text not null,
  vendor             text,
  receipt_url        text,
  status             text not null default 'posted' check (status in ('submitted', 'posted', 'rejected')),
  submitted_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by        uuid references public.profiles (id) on delete set null,
  approved_at        timestamptz,
  rejection_reason   text,
  journal_entry_id   uuid references public.journal_entries (id),
  created_at         timestamptz not null default now()
);
create index if not exists idx_petty_cash_fund on public.petty_cash_entries (fund_id, entry_date desc);
create index if not exists idx_petty_cash_assignment on public.petty_cash_entries (duty_assignment_id);

-- Purchases via the expense workflow can be tagged to a duty / holder.
alter table public.expenses
  add column if not exists duty_role_id uuid references public.duty_roles (id) on delete set null,
  add column if not exists duty_assignment_id uuid references public.duty_assignments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. Task board
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  meeting_id    uuid references public.mashoora_meetings (id) on delete set null,
  duty_role_id  uuid references public.duty_roles (id) on delete set null,
  title         text not null check (length(trim(title)) > 0),
  description   text,
  assignee_id   uuid references public.profiles (id) on delete set null,
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date      date,
  week_start    date,
  position      int not null default 0,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_tasks_board on public.tasks (org_id, status, position);
create index if not exists idx_tasks_assignee on public.tasks (assignee_id, status);

create table if not exists public.task_comments (
  id         uuid primary key default extensions.gen_random_uuid(),
  org_id     uuid not null references public.organizations (id),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null default auth.uid(),
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references public.organizations (id),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  from_status text,
  to_status  text,
  note       text,
  created_at timestamptz not null default now()
);

select public.apply_tenant_scope('mashoora_meetings');
select public.apply_tenant_scope('duty_roles');
select public.apply_tenant_scope('duty_assignments', 'duty_role_id', 'duty_roles');
select public.apply_tenant_scope('petty_cash_funds', 'duty_role_id', 'duty_roles');
select public.apply_tenant_scope('petty_cash_entries', 'fund_id', 'petty_cash_funds');
select public.apply_tenant_scope('tasks');
select public.apply_tenant_scope('task_comments', 'task_id', 'tasks');
select public.apply_tenant_scope('task_events', 'task_id', 'tasks');

select public.seed_duty_roles(id) from public.organizations;

create or replace function public.tg_organizations_seed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_chart_of_accounts(new.id);
  insert into public.accounts (org_id, code, name, name_ar, type, subtype, is_system)
  values (new.id, '1050', 'Petty Cash', 'النثرية', 'asset', 'cash', true) on conflict (org_id, code) do nothing;
  perform public.seed_fee_categories(new.id);
  perform public.seed_hr_defaults(new.id);
  perform public.seed_duty_roles(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Duty helpers & RPCs
-- ---------------------------------------------------------------------------
create or replace function public.has_duty(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.duty_assignments a
    join public.duty_roles r on r.id = a.duty_role_id
    where a.assignee_id = auth.uid() and a.status = 'active' and r.code = p_code
      and a.org_id = public.current_org_id());
$$;

create or replace function public.has_leave_review_duty()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.duty_assignments a
    join public.duty_roles r on r.id = a.duty_role_id
    where a.assignee_id = auth.uid() and a.status = 'active' and r.grants_leave_review
      and a.org_id = public.current_org_id());
$$;

-- Hand a duty to a person (ends the current holder unless p_keep_existing).
create or replace function public.assign_duty(
  p_duty uuid, p_assignee uuid, p_start date default current_date, p_meeting uuid default null,
  p_academic_year uuid default null, p_notes text default null, p_keep_existing boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  d record;
  v_id uuid;
  v_name text;
begin
  if not public.is_governance_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into d from public.duty_roles where id = p_duty and org_id = v_org;
  if not found then
    raise exception 'Duty not found';
  end if;
  if not exists (select 1 from public.profiles where id = p_assignee and org_id = v_org
                 and account_type in ('tutor', 'staff') and is_approved) then
    raise exception 'The assignee must be an approved lecturer or staff member of this institution';
  end if;
  if p_meeting is not null and not exists (select 1 from public.mashoora_meetings where id = p_meeting and org_id = v_org) then
    raise exception 'Meeting not found';
  end if;
  if exists (select 1 from public.duty_assignments where duty_role_id = p_duty and assignee_id = p_assignee and status = 'active') then
    raise exception 'This person already holds this duty';
  end if;

  if not p_keep_existing then
    update public.duty_assignments
    set status = 'ended', end_date = greatest(start_date, coalesce(p_start, current_date) - 1),
        end_reason = coalesce(end_reason, 'Handed over')
    where duty_role_id = p_duty and status = 'active';
  end if;

  insert into public.duty_assignments (org_id, duty_role_id, assignee_id, academic_year_id, is_lead, start_date,
                                       meeting_id, notes)
  values (v_org, p_duty, p_assignee,
          coalesce(p_academic_year, (select id from public.academic_years where org_id = v_org and is_current)),
          not p_keep_existing, coalesce(p_start, current_date), p_meeting, p_notes)
  returning id into v_id;

  v_name := d.name_en;
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (p_assignee, 'New responsibility', format('You have been assigned: %s (from %s).', v_name, coalesce(p_start, current_date)),
          jsonb_build_object('type', 'duty', 'duty_role_id', p_duty, 'assignment_id', v_id), '/erp?module=duties', v_org);

  insert into public.petty_cash_funds (org_id, duty_role_id, float_limit)
  select v_org, p_duty, d.default_petty_cash where d.default_petty_cash > 0
  on conflict (duty_role_id) do nothing;
  return v_id;
end;
$$;

create or replace function public.end_duty(p_assignment uuid, p_end date default current_date, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_governance_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.duty_assignments
  set status = 'ended', end_date = greatest(start_date, coalesce(p_end, current_date)), end_reason = p_reason
  where id = p_assignment and org_id = public.current_org_id() and status = 'active';
  if not found then
    raise exception 'Active assignment not found';
  end if;
end;
$$;

-- Year-end rotation: end every active duty (history kept) before the annual mashoora.
create or replace function public.close_duty_year(p_end date default current_date, p_reason text default 'End of academic year')
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not public.is_governance_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.duty_assignments
  set status = 'ended', end_date = greatest(start_date, coalesce(p_end, current_date)), end_reason = p_reason
  where org_id = public.current_org_id() and status = 'active';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Assignment immutability: only RPCs change assignments; history rows are never deleted.
create or replace function public.tg_duty_assignments_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'Use assign_duty / end_duty' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Duty history cannot be deleted';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_duty_assignments_guard on public.duty_assignments;
create trigger trg_duty_assignments_guard before insert or update or delete on public.duty_assignments
  for each row execute function public.tg_duty_assignments_guard();

-- ---------------------------------------------------------------------------
-- Petty cash RPCs
-- ---------------------------------------------------------------------------
create or replace function public.can_view_petty_fund(p_fund uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_privileged_caller()
      or exists (select 1 from public.petty_cash_funds f where f.id = p_fund and f.org_id = public.current_org_id()
                 and (public.is_finance_viewer() or public.is_governance_admin()
                      or exists (select 1 from public.duty_assignments a where a.duty_role_id = f.duty_role_id
                                 and a.assignee_id = auth.uid() and a.status = 'active')));
$$;

create or replace function public.petty_cash_balance(p_fund uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.can_view_petty_fund(p_fund) then null else jsonb_build_object(
    'posted_balance', coalesce(sum(case when entry_type = 'topup' and status = 'posted' then amount
                                        when entry_type in ('expense', 'return') and status = 'posted' then -amount else 0 end), 0),
    'pending_spend', coalesce(sum(amount) filter (where entry_type = 'expense' and status = 'submitted'), 0),
    'available', coalesce(sum(case when entry_type = 'topup' and status = 'posted' then amount
                                   when entry_type in ('expense', 'return') and status in ('posted', 'submitted') then -amount else 0 end), 0)) end
  from public.petty_cash_entries where fund_id = p_fund;
$$;

create or replace function public._fund_holder(p_fund uuid)
returns table (assignment_id uuid, holder_id uuid)
language sql stable security definer set search_path = public as $$
  select a.id, a.assignee_id
  from public.petty_cash_funds f
  join public.duty_assignments a on a.duty_role_id = f.duty_role_id and a.status = 'active'
  where f.id = p_fund
  order by a.is_lead desc, a.start_date desc
  limit 1;
$$;
revoke all on function public._fund_holder(uuid) from public, anon, authenticated;

create or replace function public.petty_cash_topup(p_fund uuid, p_amount numeric, p_from_code text default '1000', p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  h record;
  v_id uuid;
  v_je uuid;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.petty_cash_funds where id = p_fund and org_id = public.current_org_id() and is_active;
  if not found then
    raise exception 'Petty cash fund not found';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_from_code = '1050' or not exists (select 1 from public.accounts where org_id = f.org_id and code = p_from_code and subtype in ('cash', 'bank')) then
    raise exception 'Top up from the main cash or bank account';
  end if;
  if f.float_limit > 0 and (public.petty_cash_balance(p_fund) ->> 'posted_balance')::numeric + p_amount > f.float_limit then
    raise exception 'Top-up exceeds the fund limit of LKR %', f.float_limit;
  end if;
  select * into h from public._fund_holder(p_fund);
  insert into public.petty_cash_entries (org_id, fund_id, duty_assignment_id, holder_id, entry_type, amount,
                                         counter_account_code, description, status, approved_by, approved_at)
  values (f.org_id, p_fund, h.assignment_id, h.holder_id, 'topup', round(p_amount, 2), p_from_code,
          coalesce(p_note, 'Petty cash top-up'), 'posted', auth.uid(), now())
  returning id into v_id;
  v_je := public.post_journal(f.org_id, current_date, format('Petty cash top-up – %s',
            (select name_en from public.duty_roles where id = f.duty_role_id)), 'adjustment', v_id,
            jsonb_build_array(jsonb_build_object('code', '1050', 'debit', p_amount, 'party_id', h.holder_id),
                              jsonb_build_object('code', p_from_code, 'credit', p_amount)));
  update public.petty_cash_entries set journal_entry_id = v_je where id = v_id;
  return v_id;
end;
$$;

-- Duty holder records a spend (receipt); accounts approve → posted.
create or replace function public.petty_cash_spend(
  p_fund uuid, p_amount numeric, p_expense_account uuid, p_description text,
  p_vendor text default null, p_receipt_url text default null, p_date date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  h record;
  v_id uuid;
  v_type text;
begin
  select * into f from public.petty_cash_funds where id = p_fund and org_id = public.current_org_id() and is_active;
  if not found then
    raise exception 'Petty cash fund not found';
  end if;
  select * into h from public._fund_holder(p_fund);
  if not (h.holder_id = auth.uid() or public.is_finance_staff()) then
    raise exception 'Only the current duty holder or accounts can record spending from this fund' using errcode = '42501';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if coalesce(trim(p_description), '') = '' then
    raise exception 'A description is required';
  end if;
  select type into v_type from public.accounts where id = p_expense_account and org_id = f.org_id;
  if v_type is distinct from 'expense' then
    raise exception 'Choose an expense account';
  end if;
  if p_amount > (public.petty_cash_balance(p_fund) ->> 'available')::numeric then
    raise exception 'Not enough petty cash (available LKR %)', (public.petty_cash_balance(p_fund) ->> 'available');
  end if;
  insert into public.petty_cash_entries (org_id, fund_id, duty_assignment_id, holder_id, entry_type, entry_date, amount,
                                         account_id, description, vendor, receipt_url, status)
  values (f.org_id, p_fund, h.assignment_id, h.holder_id, 'expense', coalesce(p_date, current_date), round(p_amount, 2),
          p_expense_account, p_description, p_vendor, p_receipt_url, 'submitted')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_petty_cash(p_entry uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
  v_je uuid;
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into e from public.petty_cash_entries
  where id = p_entry and org_id = public.current_org_id() and status = 'submitted' for update;
  if not found then
    raise exception 'Submitted petty cash entry not found';
  end if;
  if e.submitted_by = auth.uid() and not public.is_admin() then
    raise exception 'Segregation of duties: you cannot approve your own petty cash spend' using errcode = '42501';
  end if;
  if not p_approve then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'A reason is required';
    end if;
    update public.petty_cash_entries set status = 'rejected', rejection_reason = p_reason,
      approved_by = auth.uid(), approved_at = now() where id = e.id;
    return;
  end if;
  v_je := public.post_journal(e.org_id, e.entry_date, format('Petty cash: %s%s', e.description,
            coalesce(' – ' || e.vendor, '')), 'expense', e.id,
            jsonb_build_array(jsonb_build_object('account_id', e.account_id, 'debit', e.amount, 'memo', e.vendor),
                              jsonb_build_object('code', '1050', 'credit', e.amount, 'party_id', e.holder_id)));
  update public.petty_cash_entries set status = 'posted', approved_by = auth.uid(), approved_at = now(),
    journal_entry_id = v_je where id = e.id;
end;
$$;

-- Unused cash handed back (e.g. at hand-over / year end).
create or replace function public.petty_cash_return(p_fund uuid, p_amount numeric, p_to_code text default '1000', p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  h record;
  v_id uuid;
  v_je uuid;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.petty_cash_funds where id = p_fund and org_id = public.current_org_id();
  if not found then
    raise exception 'Petty cash fund not found';
  end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > (public.petty_cash_balance(p_fund) ->> 'available')::numeric then
    raise exception 'Return amount must be positive and not exceed the available balance';
  end if;
  if p_to_code = '1050' or not exists (select 1 from public.accounts where org_id = f.org_id and code = p_to_code and subtype in ('cash', 'bank')) then
    raise exception 'Return to the main cash or bank account';
  end if;
  select * into h from public._fund_holder(p_fund);
  insert into public.petty_cash_entries (org_id, fund_id, duty_assignment_id, holder_id, entry_type, amount,
                                         counter_account_code, description, status, approved_by, approved_at)
  values (f.org_id, p_fund, h.assignment_id, h.holder_id, 'return', round(p_amount, 2), p_to_code,
          coalesce(p_note, 'Unused petty cash returned'), 'posted', auth.uid(), now())
  returning id into v_id;
  v_je := public.post_journal(f.org_id, current_date, 'Petty cash returned', 'adjustment', v_id,
            jsonb_build_array(jsonb_build_object('code', p_to_code, 'debit', p_amount),
                              jsonb_build_object('code', '1050', 'credit', p_amount, 'party_id', h.holder_id)));
  update public.petty_cash_entries set journal_entry_id = v_je where id = v_id;
  return v_id;
end;
$$;

-- Duty history: every holder with their period and money handled.
create or replace function public.duty_history(p_duty uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_employee() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'duty', (select to_jsonb(r) from public.duty_roles r where r.id = p_duty and r.org_id = public.current_org_id()),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'assignee_id', a.assignee_id, 'assignee', p.full_name, 'status', a.status, 'is_lead', a.is_lead,
        'start_date', a.start_date, 'end_date', a.end_date, 'end_reason', a.end_reason, 'notes', a.notes,
        'academic_year', y.name, 'meeting', m.title, 'meeting_date', m.meeting_date,
        'petty_topups', coalesce((select sum(amount) from public.petty_cash_entries e where e.duty_assignment_id = a.id and e.entry_type = 'topup' and e.status = 'posted'), 0),
        'petty_spent', coalesce((select sum(amount) from public.petty_cash_entries e where e.duty_assignment_id = a.id and e.entry_type = 'expense' and e.status = 'posted'), 0),
        'petty_pending', coalesce((select sum(amount) from public.petty_cash_entries e where e.duty_assignment_id = a.id and e.entry_type = 'expense' and e.status = 'submitted'), 0),
        'petty_returned', coalesce((select sum(amount) from public.petty_cash_entries e where e.duty_assignment_id = a.id and e.entry_type = 'return' and e.status = 'posted'), 0),
        'purchases', coalesce((select sum(amount) from public.expenses x where x.duty_assignment_id = a.id and x.status = 'paid'), 0),
        'purchase_count', (select count(*) from public.expenses x where x.duty_assignment_id = a.id),
        'tasks_done', (select count(*) from public.tasks t where t.duty_role_id = a.duty_role_id and t.assignee_id = a.assignee_id and t.status = 'done'))
        order by a.start_date desc)
      from public.duty_assignments a
      join public.profiles p on p.id = a.assignee_id
      left join public.academic_years y on y.id = a.academic_year_id
      left join public.mashoora_meetings m on m.id = a.meeting_id
      where a.duty_role_id = p_duty and a.org_id = public.current_org_id()), '[]'::jsonb));
end;
$$;

-- Expense claims: tag to the claimant's active duty automatically when chosen.
create or replace function public.tg_expenses_duty()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.duty_role_id is not null and new.duty_assignment_id is null then
    select id into new.duty_assignment_id from public.duty_assignments
    where duty_role_id = new.duty_role_id and assignee_id = coalesce(new.submitted_by, auth.uid()) and status = 'active'
    limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_expenses_w_duty on public.expenses;
create trigger trg_expenses_w_duty before insert on public.expenses
  for each row execute function public.tg_expenses_duty();

-- Student-leave duty holders may review student leave requests.
drop policy if exists "leaves: duty holder review" on public.leave_requests;
create policy "leaves: duty holder review" on public.leave_requests for update to authenticated
  using (public.has_leave_review_duty()) with check (public.has_leave_review_duty());

-- ---------------------------------------------------------------------------
-- Task board rules
-- ---------------------------------------------------------------------------
create or replace function public.tg_tasks_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_manager boolean := current_user not in ('anon', 'authenticated') or public.is_governance_admin();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if not v_manager and new.assignee_id is distinct from auth.uid() then
      raise exception 'Only the principal / administrators assign tasks to others' using errcode = '42501';
    end if;
  else
    if not v_manager and old.created_by is distinct from auth.uid() then
      -- assignee: may only move the card (and not mark it done unless they created it)
      if (new.title, new.description, new.assignee_id, new.priority, new.due_date, new.meeting_id, new.duty_role_id, new.created_by)
         is distinct from
         (old.title, old.description, old.assignee_id, old.priority, old.due_date, old.meeting_id, old.duty_role_id, old.created_by) then
        raise exception 'Only the task owner can edit task details' using errcode = '42501';
      end if;
      if new.status = 'done' and old.status <> 'done' then
        raise exception 'Move the task to Review — the person who assigned it marks it Done' using errcode = '42501';
      end if;
    end if;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_tasks_v_guard on public.tasks;
create trigger trg_tasks_v_guard before insert or update on public.tasks
  for each row execute function public.tg_tasks_guard();

create or replace function public.tg_tasks_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_events (org_id, task_id, actor_id, to_status, note)
    values (new.org_id, new.id, auth.uid(), new.status, 'created');
    if new.assignee_id is not null and new.assignee_id is distinct from auth.uid() then
      insert into public.notifications (user_id, title, message, data, link, org_id)
      values (new.assignee_id, 'New task', new.title || coalesce(' (due ' || new.due_date || ')', ''),
              jsonb_build_object('type', 'task', 'task_id', new.id), '/erp?module=tasks', new.org_id);
    end if;
  elsif new.status is distinct from old.status or new.assignee_id is distinct from old.assignee_id then
    insert into public.task_events (org_id, task_id, actor_id, from_status, to_status,
                                    note)
    values (new.org_id, new.id, auth.uid(), old.status, new.status,
            case when new.assignee_id is distinct from old.assignee_id then 'reassigned' end);
    if new.status = 'review' and old.status <> 'review' and new.created_by is not null and new.created_by is distinct from auth.uid() then
      insert into public.notifications (user_id, title, message, data, link, org_id)
      values (new.created_by, 'Task ready for review', new.title,
              jsonb_build_object('type', 'task', 'task_id', new.id), '/erp?module=tasks', new.org_id);
    end if;
    if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
      insert into public.notifications (user_id, title, message, data, link, org_id)
      values (new.assignee_id, 'Task assigned to you', new.title,
              jsonb_build_object('type', 'task', 'task_id', new.id), '/erp?module=tasks', new.org_id);
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_tasks_events on public.tasks;
create trigger trg_tasks_events after insert or update on public.tasks
  for each row execute function public.tg_tasks_events();

-- Assign many tasks from one mashoora in one call:
-- p_tasks = [{"title":"","description":"","assignee_id":uuid,"due_date":"YYYY-MM-DD","priority":"high","duty_role_id":uuid}]
create or replace function public.create_meeting_tasks(p_meeting uuid, p_tasks jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  m record;
  t jsonb;
  v_n int := 0;
begin
  if not public.is_governance_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into m from public.mashoora_meetings where id = p_meeting and org_id = v_org;
  if not found then
    raise exception 'Meeting not found';
  end if;
  for t in select * from jsonb_array_elements(p_tasks) loop
    insert into public.tasks (org_id, meeting_id, duty_role_id, title, description, assignee_id, priority, due_date, week_start)
    values (v_org, p_meeting, nullif(t ->> 'duty_role_id', '')::uuid, t ->> 'title', t ->> 'description',
            nullif(t ->> 'assignee_id', '')::uuid, coalesce(nullif(t ->> 'priority', ''), 'normal'),
            nullif(t ->> 'due_date', '')::date, date_trunc('week', m.meeting_date)::date);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Admissions: date of birth, age limits, public applications
-- ---------------------------------------------------------------------------
alter table public.admissions add column if not exists date_of_birth date;

create or replace function public.admission_age_limits(p_org uuid)
returns table (min_age int, max_age int)
language sql stable security definer set search_path = public as $$
  select coalesce((settings ->> 'admission_min_age')::int, 5), coalesce((settings ->> 'admission_max_age')::int, 25)
  from public.organizations where id = p_org;
$$;

create or replace function public.tg_admissions_dob()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_min int;
  v_max int;
  v_age int;
  v_today date := (now() at time zone coalesce((select timezone from public.organizations where id = new.org_id), 'Asia/Colombo'))::date;
begin
  if new.date_of_birth is null then
    return new;
  end if;
  if new.date_of_birth > v_today then
    raise exception 'Date of birth cannot be in the future';
  end if;
  v_age := extract(year from age(v_today, new.date_of_birth))::int;
  select min_age, max_age into v_min, v_max from public.admission_age_limits(new.org_id);
  if v_age < coalesce(v_min, 5) or v_age > coalesce(v_max, 25) then
    raise exception 'Applicant must be between % and % years old (age from date of birth: %)', v_min, v_max, v_age;
  end if;
  new.age := v_age;
  return new;
end;
$$;
-- "v" so it runs after the org trigger has set org_id
drop trigger if exists trg_admissions_v_dob on public.admissions;
create trigger trg_admissions_v_dob before insert or update of date_of_birth on public.admissions
  for each row execute function public.tg_admissions_dob();

-- Public application (no login): lands in the CRM as a submitted lead.
create or replace function public.submit_public_admission(
  p_student_name text, p_date_of_birth date, p_parent_name text, p_phone text, p_address text, p_course text,
  p_email text default null, p_previous_education text default null, p_org_slug text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  staff record;
begin
  select id into v_org from public.organizations
  where slug = coalesce(nullif(p_org_slug, ''), 'kashiful-hudha') and status in ('trial', 'active');
  if v_org is null then
    raise exception 'Institution not found';
  end if;
  if length(trim(coalesce(p_student_name, ''))) < 3 or length(trim(coalesce(p_parent_name, ''))) < 3 then
    raise exception 'Student and parent names are required';
  end if;
  if v_phone !~ '^(0\d{9}|94\d{9})$' then
    raise exception 'Enter a valid Sri Lankan phone number (e.g. 0771234567)';
  end if;
  if p_date_of_birth is null then
    raise exception 'Date of birth is required';
  end if;
  -- simple abuse guard: one application per phone + student per 10 minutes
  if exists (select 1 from public.admissions where org_id = v_org and regexp_replace(phone, '\D', '', 'g') = v_phone
             and lower(student_name) = lower(trim(p_student_name)) and created_at > now() - interval '10 minutes') then
    raise exception 'This application was already received. We will contact you soon.';
  end if;
  insert into public.admissions (org_id, student_name, date_of_birth, age, parent_name, phone, email, address,
                                 previous_education, course, status, pipeline_stage, source)
  values (v_org, trim(p_student_name), p_date_of_birth, 5, trim(p_parent_name), v_phone, nullif(trim(coalesce(p_email, '')), ''),
          coalesce(nullif(trim(coalesce(p_address, '')), ''), '-'), p_previous_education, p_course,
          'pending', 'submitted', 'website')
  returning id into v_id;
  for staff in
    select id from public.profiles
    where org_id = v_org and is_approved
      and (role in ('admin') or assigned_tutor_role in ('admissions_officer', 'principal') or extra_roles && array['admissions_officer'])
  loop
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (staff.id, 'New admission application', format('%s (parent %s, %s)', trim(p_student_name), trim(p_parent_name), v_phone),
            jsonb_build_object('type', 'admission', 'admission_id', v_id), '/erp?module=crm', v_org);
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id,
                            'age', (select age from public.admissions where id = v_id));
end;
$$;
grant execute on function public.submit_public_admission(text, date, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admission_age_limits(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.mashoora_meetings   enable row level security;
alter table public.duty_roles          enable row level security;
alter table public.duty_assignments    enable row level security;
alter table public.petty_cash_funds    enable row level security;
alter table public.petty_cash_entries  enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_comments       enable row level security;
alter table public.task_events         enable row level security;

drop policy if exists "mashoora: employee read" on public.mashoora_meetings;
create policy "mashoora: employee read" on public.mashoora_meetings for select to authenticated using (public.is_employee());
drop policy if exists "mashoora: governance write" on public.mashoora_meetings;
create policy "mashoora: governance write" on public.mashoora_meetings for all to authenticated
  using (public.is_governance_admin()) with check (public.is_governance_admin());

drop policy if exists "duty_roles: employee read" on public.duty_roles;
create policy "duty_roles: employee read" on public.duty_roles for select to authenticated using (public.is_employee());
drop policy if exists "duty_roles: governance write" on public.duty_roles;
create policy "duty_roles: governance write" on public.duty_roles for all to authenticated
  using (public.is_governance_admin()) with check (public.is_governance_admin());

drop policy if exists "duty_assignments: employee read" on public.duty_assignments;
create policy "duty_assignments: employee read" on public.duty_assignments for select to authenticated using (public.is_employee());

drop policy if exists "petty_cash_funds: read" on public.petty_cash_funds;
create policy "petty_cash_funds: read" on public.petty_cash_funds for select to authenticated
  using (public.is_finance_viewer() or public.is_governance_admin()
         or exists (select 1 from public.duty_assignments a where a.duty_role_id = petty_cash_funds.duty_role_id
                    and a.assignee_id = auth.uid() and a.status = 'active'));
drop policy if exists "petty_cash_funds: finance manage" on public.petty_cash_funds;
create policy "petty_cash_funds: finance manage" on public.petty_cash_funds for all to authenticated
  using (public.is_finance_staff() or public.is_governance_admin())
  with check (public.is_finance_staff() or public.is_governance_admin());

drop policy if exists "petty_cash_entries: read" on public.petty_cash_entries;
create policy "petty_cash_entries: read" on public.petty_cash_entries for select to authenticated
  using (public.is_finance_viewer() or public.is_governance_admin() or holder_id = auth.uid() or submitted_by = auth.uid());

drop policy if exists "tasks: employee read" on public.tasks;
create policy "tasks: employee read" on public.tasks for select to authenticated using (public.is_employee());
drop policy if exists "tasks: create" on public.tasks;
create policy "tasks: create" on public.tasks for insert to authenticated with check (public.is_employee());
drop policy if exists "tasks: update" on public.tasks;
create policy "tasks: update" on public.tasks for update to authenticated
  using (public.is_governance_admin() or assignee_id = auth.uid() or created_by = auth.uid())
  with check (public.is_governance_admin() or assignee_id = auth.uid() or created_by = auth.uid());
drop policy if exists "tasks: delete" on public.tasks;
create policy "tasks: delete" on public.tasks for delete to authenticated
  using (public.is_governance_admin() or (created_by = auth.uid() and status <> 'done'));

drop policy if exists "task_comments: read" on public.task_comments;
create policy "task_comments: read" on public.task_comments for select to authenticated using (public.is_employee());
drop policy if exists "task_comments: write" on public.task_comments;
create policy "task_comments: write" on public.task_comments for insert to authenticated
  with check (public.is_employee() and author_id = auth.uid());
drop policy if exists "task_events: read" on public.task_events;
create policy "task_events: read" on public.task_events for select to authenticated using (public.is_employee());

grant execute on function public.assign_duty(uuid, uuid, date, uuid, uuid, text, boolean) to authenticated;
grant execute on function public.end_duty(uuid, date, text) to authenticated;
grant execute on function public.close_duty_year(date, text) to authenticated;
grant execute on function public.petty_cash_balance(uuid) to authenticated;
grant execute on function public.petty_cash_topup(uuid, numeric, text, text) to authenticated;
grant execute on function public.petty_cash_spend(uuid, numeric, uuid, text, text, text, date) to authenticated;
grant execute on function public.review_petty_cash(uuid, boolean, text) to authenticated;
grant execute on function public.petty_cash_return(uuid, numeric, text, text) to authenticated;
grant execute on function public.duty_history(uuid) to authenticated;
grant execute on function public.create_meeting_tasks(uuid, jsonb) to authenticated;
grant execute on function public.has_duty(text) to authenticated;

select public.attach_audit(t) from unnest(array['duty_assignments', 'petty_cash_entries', 'petty_cash_funds',
                                                'mashoora_meetings', 'tasks', 'duty_roles']) t;

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tasks', 'task_comments', 'task_events', 'duty_assignments', 'petty_cash_entries', 'mashoora_meetings'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Receipt photos for petty cash spends (private bucket, folder = uploader id)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('petty-cash', 'petty-cash', false) on conflict (id) do nothing;
drop policy if exists "petty_cash files: owner upload" on storage.objects;
create policy "petty_cash files: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'petty-cash' and (storage.foldername(name))[1] = auth.uid()::text and public.is_employee());
drop policy if exists "petty_cash files: read" on storage.objects;
create policy "petty_cash files: read" on storage.objects for select to authenticated
  using (bucket_id = 'petty-cash' and ((storage.foldername(name))[1] = auth.uid()::text
                                       or public.is_finance_viewer() or public.is_governance_admin()));
