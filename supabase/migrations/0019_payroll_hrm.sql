-- =============================================================================
-- 0019_payroll_hrm.sql
-- HRM + payroll: employee records, salary profiles & components, payroll runs
-- and payslips (Sri Lanka EPF 8%/12%, ETF 3% — configurable per org),
-- unpaid leave / absence deductions, staff advances with payroll recovery,
-- staff attendance (check-in/out), leave types, requests and balances.
--
-- Ledger postings
--   approve:  Dr 5100 gross, Dr 5110 employer contrib
--             Cr 2100 net, Cr 2200 EPF (8%+12%), Cr 2210 ETF, Cr 1300 advance
--             recoveries, Cr 2000 other withholdings
--   pay:      Dr 2100 net / Cr bank|cash
--   advance:  Dr 1300 / Cr bank|cash
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Employee record extensions
-- ---------------------------------------------------------------------------
alter table public.staff_hr
  add column if not exists employee_no     text,
  add column if not exists employment_type text not null default 'permanent',
  add column if not exists national_id     text,
  add column if not exists epf_no          text,
  add column if not exists bank_name       text,
  add column if not exists bank_branch     text,
  add column if not exists bank_account_no text,
  add column if not exists status          text not null default 'active';

alter table public.staff_hr drop constraint if exists staff_hr_employment_type_check;
alter table public.staff_hr add constraint staff_hr_employment_type_check
  check (employment_type in ('permanent', 'contract', 'part_time', 'visiting', 'volunteer'));
alter table public.staff_hr drop constraint if exists staff_hr_status_check;
alter table public.staff_hr add constraint staff_hr_status_check
  check (status in ('active', 'on_leave', 'resigned', 'terminated'));
create unique index if not exists idx_staff_hr_employee_no on public.staff_hr (org_id, employee_no) where employee_no is not null;

create or replace function public.tg_staff_hr_employee_no()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.employee_no is null then
    new.employee_no := replace(public.next_document_number(new.org_id, 'EMP'), '-' || to_char(now(), 'YYYY') || '-', '-');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_staff_hr_employee_no on public.staff_hr;
create trigger trg_staff_hr_employee_no before insert on public.staff_hr
  for each row execute function public.tg_staff_hr_employee_no();

drop policy if exists "staff_hr: hr manage" on public.staff_hr;
create policy "staff_hr: hr manage" on public.staff_hr for all to authenticated
  using (public.is_hr_staff()) with check (public.is_hr_staff());
drop policy if exists "staff_hr: principal read" on public.staff_hr;
create policy "staff_hr: principal read" on public.staff_hr for select to authenticated
  using (public.has_staff_role(array['principal', 'vice_principal', 'accountant']));

-- ---------------------------------------------------------------------------
-- Salary setup
-- ---------------------------------------------------------------------------
create table if not exists public.salary_components (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  code          text not null,
  name          text not null,
  kind          text not null check (kind in ('earning', 'deduction')),
  is_system     boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.staff_salary_profiles (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  profile_id      uuid not null unique references public.profiles (id) on delete cascade,
  basic_salary    numeric(12,2) not null check (basic_salary >= 0),
  components      jsonb not null default '[]'::jsonb,   -- [{ "code": "TRAVEL", "amount": 2500 }]
  epf_applicable  boolean not null default true,
  payment_method  text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'cash', 'cheque')),
  effective_from  date not null default current_date,
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (jsonb_typeof(components) = 'array')
);
drop trigger if exists trg_salary_profiles_updated_at on public.staff_salary_profiles;
create trigger trg_salary_profiles_updated_at before update on public.staff_salary_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.payroll_runs (
  id                  uuid primary key default extensions.gen_random_uuid(),
  org_id              uuid not null references public.organizations (id),
  period              text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status              text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled')),
  total_gross         numeric(14,2) not null default 0,
  total_deductions    numeric(14,2) not null default 0,
  total_net           numeric(14,2) not null default 0,
  total_employer      numeric(14,2) not null default 0,
  staff_count         int not null default 0,
  created_by          uuid references public.profiles (id) on delete set null,
  approved_by         uuid references public.profiles (id) on delete set null,
  approved_at         timestamptz,
  paid_by             uuid references public.profiles (id) on delete set null,
  paid_at             timestamptz,
  payment_account_code text,
  payment_reference   text,
  accrual_journal_id  uuid references public.journal_entries (id),
  payment_journal_id  uuid references public.journal_entries (id),
  notes               text,
  created_at          timestamptz not null default now()
);
create unique index if not exists idx_payroll_runs_period on public.payroll_runs (org_id, period) where status <> 'cancelled';

create table if not exists public.payslips (
  id                     uuid primary key default extensions.gen_random_uuid(),
  org_id                 uuid not null references public.organizations (id),
  run_id                 uuid not null references public.payroll_runs (id) on delete cascade,
  staff_id               uuid not null references public.profiles (id) on delete restrict,
  employee_no            text,
  staff_name             text,
  period                 text not null,
  basic                  numeric(12,2) not null default 0,
  earnings               jsonb not null default '[]'::jsonb,
  deductions             jsonb not null default '[]'::jsonb,
  employer_contributions jsonb not null default '[]'::jsonb,
  gross                  numeric(12,2) not null default 0,
  total_deductions       numeric(12,2) not null default 0,
  net                    numeric(12,2) not null default 0 check (net >= 0),
  employer_total         numeric(12,2) not null default 0,
  working_days           int,
  unpaid_days            numeric(5,1) not null default 0,
  status                 text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled')),
  paid_at                timestamptz,
  payment_reference      text,
  created_at             timestamptz not null default now(),
  unique (run_id, staff_id)
);
create index if not exists idx_payslips_staff on public.payslips (staff_id, period desc);

create table if not exists public.staff_advances (
  id                uuid primary key default extensions.gen_random_uuid(),
  org_id            uuid not null references public.organizations (id),
  profile_id        uuid not null references public.profiles (id) on delete restrict,
  amount            numeric(12,2) not null check (amount > 0),
  monthly_recovery  numeric(12,2) not null check (monthly_recovery > 0),
  recovered_amount  numeric(12,2) not null default 0 check (recovered_amount >= 0),
  issued_on         date not null default current_date,
  status            text not null default 'active' check (status in ('active', 'settled', 'cancelled')),
  reason            text,
  approved_by       uuid references public.profiles (id) on delete set null,
  journal_entry_id  uuid references public.journal_entries (id),
  created_at        timestamptz not null default now(),
  check (recovered_amount <= amount)
);

-- ---------------------------------------------------------------------------
-- Staff attendance & leave
-- ---------------------------------------------------------------------------
create table if not exists public.staff_attendance (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  date        date not null default current_date,
  status      text not null default 'present' check (status in ('present', 'absent', 'half_day', 'leave', 'holiday')),
  check_in    time,
  check_out   time,
  note        text,
  marked_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (profile_id, date)
);

create table if not exists public.staff_leave_types (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  code          text not null,
  name          text not null,
  days_per_year numeric(5,1) not null default 0,
  is_paid       boolean not null default true,
  is_active     boolean not null default true,
  unique (org_id, code)
);

create table if not exists public.staff_leave_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  leave_type_id uuid not null references public.staff_leave_types (id),
  start_date    date not null,
  end_date      date not null,
  days          numeric(5,1) not null check (days > 0),
  reason        text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists idx_staff_leave_profile on public.staff_leave_requests (profile_id, start_date);

select public.apply_tenant_scope('salary_components');
select public.apply_tenant_scope('staff_salary_profiles', 'profile_id');
select public.apply_tenant_scope('payroll_runs');
select public.apply_tenant_scope('payslips', 'run_id', 'payroll_runs');
select public.apply_tenant_scope('staff_advances', 'profile_id');
select public.apply_tenant_scope('staff_attendance', 'profile_id');
select public.apply_tenant_scope('staff_leave_types');
select public.apply_tenant_scope('staff_leave_requests', 'profile_id');

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------
create or replace function public.seed_hr_defaults(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.salary_components (org_id, code, name, kind, is_system) values
    (p_org, 'COLA',      'Cost of Living Allowance', 'earning',   false),
    (p_org, 'TRAVEL',    'Travel Allowance',         'earning',   false),
    (p_org, 'HOUSING',   'Housing Allowance',        'earning',   false),
    (p_org, 'TEACHING',  'Additional Teaching',      'earning',   false),
    (p_org, 'OVERTIME',  'Overtime',                 'earning',   false),
    (p_org, 'BONUS',     'Bonus',                    'earning',   false),
    (p_org, 'UNPAID',    'Unpaid Leave / Absence',   'earning',   true),
    (p_org, 'EPF_EE',    'EPF Employee (8%)',        'deduction', true),
    (p_org, 'ADVANCE',   'Salary Advance Recovery',  'deduction', true),
    (p_org, 'LOAN',      'Loan Repayment',           'deduction', false),
    (p_org, 'WELFARE',   'Staff Welfare Society',    'deduction', false),
    (p_org, 'OTHER_DED', 'Other Deduction',          'deduction', false)
  on conflict (org_id, code) do nothing;

  insert into public.staff_leave_types (org_id, code, name, days_per_year, is_paid) values
    (p_org, 'ANNUAL',    'Annual Leave',    14, true),
    (p_org, 'CASUAL',    'Casual Leave',     7, true),
    (p_org, 'SICK',      'Medical Leave',    7, true),
    (p_org, 'MATERNITY', 'Maternity Leave', 84, true),
    (p_org, 'HAJJ',      'Hajj Leave',      30, true),
    (p_org, 'NOPAY',     'No-pay Leave',     0, false)
  on conflict (org_id, code) do nothing;
end;
$$;
revoke all on function public.seed_hr_defaults(uuid) from public, anon, authenticated;
select public.seed_hr_defaults(id) from public.organizations;

create or replace function public.tg_organizations_seed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_chart_of_accounts(new.id);
  perform public.seed_fee_categories(new.id);
  perform public.seed_hr_defaults(new.id);
  return new;
end;
$$;

create or replace function public.payroll_setting(p_org uuid, p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (settings -> 'payroll' ->> p_key)::numeric from public.organizations where id = p_org), p_default);
$$;

-- ---------------------------------------------------------------------------
-- Payroll engine
-- ---------------------------------------------------------------------------
create or replace function public.generate_payroll(p_period text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_run record;
  v_run_id uuid;
  v_start date;
  v_end date;
  v_working numeric;
  v_epf_ee numeric;
  v_epf_er numeric;
  v_etf numeric;
  sp record;
  c jsonb;
  adv record;
  v_earn jsonb;
  v_ded jsonb;
  v_emp jsonb;
  v_gross numeric;
  v_dtotal numeric;
  v_unpaid_days numeric;
  v_unpaid_amt numeric;
  v_epf_base numeric;
  v_rec numeric;
  v_avail numeric;
  v_comp record;
  v_count int := 0;
begin
  if not (public.is_hr_staff() or public.is_accountant()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Period must be YYYY-MM';
  end if;

  select * into v_run from public.payroll_runs where org_id = v_org and period = p_period and status <> 'cancelled';
  if found and v_run.status <> 'draft' then
    raise exception 'Payroll for % is already %', p_period, v_run.status;
  end if;
  if found then
    v_run_id := v_run.id;
    delete from public.payslips where run_id = v_run_id;
    -- whoever (re)generates the draft is its preparer (segregation of duties)
    update public.payroll_runs set created_by = auth.uid() where id = v_run_id;
  else
    insert into public.payroll_runs (org_id, period, created_by) values (v_org, p_period, auth.uid())
    returning id into v_run_id;
  end if;

  v_start := (p_period || '-01')::date;
  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_working := public.payroll_setting(v_org, 'working_days', 26);
  v_epf_ee  := public.payroll_setting(v_org, 'epf_employee', 8);
  v_epf_er  := public.payroll_setting(v_org, 'epf_employer', 12);
  v_etf     := public.payroll_setting(v_org, 'etf_employer', 3);

  for sp in
    select s.*, p.full_name, h.employee_no
    from public.staff_salary_profiles s
    join public.profiles p on p.id = s.profile_id and p.is_approved
    left join public.staff_hr h on h.profile_id = s.profile_id
    where s.org_id = v_org and s.is_active and s.effective_from <= v_end
      and coalesce(h.status, 'active') in ('active', 'on_leave')
  loop
    v_earn := '[]'::jsonb;
    v_ded := '[]'::jsonb;
    v_emp := '[]'::jsonb;
    v_gross := sp.basic_salary;

    for c in select * from jsonb_array_elements(sp.components) loop
      select * into v_comp from public.salary_components where org_id = v_org and code = c ->> 'code' and is_active;
      if v_comp.id is null or coalesce((c ->> 'amount')::numeric, 0) = 0 then
        continue;
      end if;
      if v_comp.kind = 'earning' then
        v_earn := v_earn || jsonb_build_object('code', v_comp.code, 'name', v_comp.name, 'amount', round((c ->> 'amount')::numeric, 2));
        v_gross := v_gross + round((c ->> 'amount')::numeric, 2);
      else
        v_ded := v_ded || jsonb_build_object('code', v_comp.code, 'name', v_comp.name, 'amount', round((c ->> 'amount')::numeric, 2));
      end if;
    end loop;

    -- unpaid leave (approved no-pay days within period) + unexcused absences
    select coalesce(sum(
             (least(r.end_date, v_end) - greatest(r.start_date, v_start) + 1)
             * (r.days / (r.end_date - r.start_date + 1))), 0)
      into v_unpaid_days
    from public.staff_leave_requests r
    join public.staff_leave_types t on t.id = r.leave_type_id and not t.is_paid
    where r.profile_id = sp.profile_id and r.status = 'approved'
      and r.start_date <= v_end and r.end_date >= v_start;
    v_unpaid_days := v_unpaid_days + coalesce((
      select count(*) filter (where status = 'absent') + 0.5 * count(*) filter (where status = 'half_day')
      from public.staff_attendance a
      where a.profile_id = sp.profile_id and a.date between v_start and v_end), 0);
    v_unpaid_days := round(least(v_unpaid_days, v_working), 1);
    v_unpaid_amt := least(round(sp.basic_salary / v_working * v_unpaid_days, 2), sp.basic_salary);
    if v_unpaid_amt > 0 then
      v_earn := v_earn || jsonb_build_object('code', 'UNPAID', 'name', format('Unpaid leave/absence (%s days)', v_unpaid_days),
                                             'amount', -v_unpaid_amt);
      v_gross := v_gross - v_unpaid_amt;
    end if;

    -- statutory
    if sp.epf_applicable then
      v_epf_base := sp.basic_salary - v_unpaid_amt;
      if v_epf_base > 0 then
        v_ded := v_ded || jsonb_build_object('code', 'EPF_EE', 'name', format('EPF Employee (%s%%)', v_epf_ee),
                                             'amount', round(v_epf_base * v_epf_ee / 100, 2));
        v_emp := v_emp || jsonb_build_object('code', 'EPF_ER', 'name', format('EPF Employer (%s%%)', v_epf_er),
                                             'amount', round(v_epf_base * v_epf_er / 100, 2))
                       || jsonb_build_object('code', 'ETF', 'name', format('ETF (%s%%)', v_etf),
                                             'amount', round(v_epf_base * v_etf / 100, 2));
      end if;
    end if;

    select coalesce(sum((d ->> 'amount')::numeric), 0) into v_dtotal from jsonb_array_elements(v_ded) d;

    -- advance recoveries (never push net below zero)
    for adv in
      select * from public.staff_advances
      where profile_id = sp.profile_id and status = 'active' and issued_on <= v_end
      order by issued_on
    loop
      v_avail := v_gross - v_dtotal;
      v_rec := least(adv.monthly_recovery, adv.amount - adv.recovered_amount, greatest(v_avail, 0));
      if v_rec > 0 then
        v_ded := v_ded || jsonb_build_object('code', 'ADVANCE', 'name', 'Salary advance recovery',
                                             'amount', v_rec, 'advance_id', adv.id);
        v_dtotal := v_dtotal + v_rec;
      end if;
    end loop;

    if v_gross - v_dtotal < 0 then
      raise exception 'Deductions exceed gross pay for % (%)', sp.full_name, p_period;
    end if;

    insert into public.payslips (org_id, run_id, staff_id, employee_no, staff_name, period, basic, earnings,
                                 deductions, employer_contributions, gross, total_deductions, net,
                                 employer_total, working_days, unpaid_days)
    values (v_org, v_run_id, sp.profile_id, sp.employee_no, sp.full_name, p_period, sp.basic_salary, v_earn,
            v_ded, v_emp, v_gross, v_dtotal, v_gross - v_dtotal,
            coalesce((select sum((e ->> 'amount')::numeric) from jsonb_array_elements(v_emp) e), 0),
            v_working::int, v_unpaid_days);
    v_count := v_count + 1;
  end loop;

  update public.payroll_runs r set
    total_gross = coalesce((select sum(gross) from public.payslips where run_id = r.id), 0),
    total_deductions = coalesce((select sum(total_deductions) from public.payslips where run_id = r.id), 0),
    total_net = coalesce((select sum(net) from public.payslips where run_id = r.id), 0),
    total_employer = coalesce((select sum(employer_total) from public.payslips where run_id = r.id), 0),
    staff_count = v_count
  where r.id = v_run_id;

  return (select to_jsonb(r) from public.payroll_runs r where r.id = v_run_id);
end;
$$;

-- Amend a draft payslip (bonus, overtime, one-off deduction).
create or replace function public.adjust_payslip(p_payslip uuid, p_code text, p_amount numeric, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  ps record;
  v_comp record;
begin
  if not (public.is_hr_staff() or public.is_accountant()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into ps from public.payslips where id = p_payslip and org_id = public.current_org_id() for update;
  if not found or ps.status <> 'draft' then
    raise exception 'Draft payslip not found';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Adjustment amount must be positive';
  end if;
  select * into v_comp from public.salary_components where org_id = ps.org_id and code = p_code and not is_system;
  if not found then
    raise exception 'Unknown or system component %', p_code;
  end if;
  if v_comp.kind = 'earning' then
    update public.payslips set
      earnings = earnings || jsonb_build_object('code', p_code, 'name', coalesce(p_note, v_comp.name), 'amount', round(p_amount, 2)),
      gross = gross + round(p_amount, 2), net = net + round(p_amount, 2)
    where id = p_payslip;
  else
    update public.payslips set
      deductions = deductions || jsonb_build_object('code', p_code, 'name', coalesce(p_note, v_comp.name), 'amount', round(p_amount, 2)),
      total_deductions = total_deductions + round(p_amount, 2), net = net - round(p_amount, 2)
    where id = p_payslip;
  end if;
  -- (net >= 0 is enforced by the payslips check constraint)
  update public.payroll_runs r set
    total_gross = coalesce((select sum(gross) from public.payslips where run_id = r.id), 0),
    total_deductions = coalesce((select sum(total_deductions) from public.payslips where run_id = r.id), 0),
    total_net = coalesce((select sum(net) from public.payslips where run_id = r.id), 0)
  where r.id = ps.run_id;
end;
$$;

create or replace function public.approve_payroll(p_run uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_epf numeric;
  v_etf numeric;
  v_adv numeric;
  v_other numeric;
  v_je uuid;
  d record;
begin
  if not (public.is_accountant() or public.has_staff_role(array['principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.payroll_runs where id = p_run and org_id = public.current_org_id() for update;
  if not found or r.status <> 'draft' then
    raise exception 'Draft payroll run not found';
  end if;
  if r.created_by = auth.uid() and not public.is_admin() then
    raise exception 'Segregation of duties: the preparer cannot approve the payroll' using errcode = '42501';
  end if;
  if r.staff_count = 0 then
    raise exception 'Payroll run has no payslips';
  end if;

  -- employee-side withholdings
  select coalesce(sum((x ->> 'amount')::numeric) filter (where x ->> 'code' = 'EPF_EE'), 0),
         coalesce(sum((x ->> 'amount')::numeric) filter (where x ->> 'code' = 'ADVANCE'), 0),
         coalesce(sum((x ->> 'amount')::numeric) filter (where x ->> 'code' not in ('EPF_EE', 'ADVANCE')), 0)
    into v_epf, v_adv, v_other
  from public.payslips ps, jsonb_array_elements(ps.deductions) x
  where ps.run_id = p_run;
  -- employer-side contributions (EPF 12% joins employee EPF in 2200; ETF to 2210)
  select v_epf + coalesce(sum((x ->> 'amount')::numeric) filter (where x ->> 'code' = 'EPF_ER'), 0),
         coalesce(sum((x ->> 'amount')::numeric) filter (where x ->> 'code' = 'ETF'), 0)
    into v_epf, v_etf
  from public.payslips ps, jsonb_array_elements(ps.employer_contributions) x
  where ps.run_id = p_run;

  v_je := public.post_journal(r.org_id, ((r.period || '-01')::date + interval '1 month' - interval '1 day')::date,
            format('Payroll %s (%s staff)', r.period, r.staff_count), 'payroll', r.id,
            jsonb_build_array(
              jsonb_build_object('code', '5100', 'debit', r.total_gross, 'memo', 'Gross salaries'),
              jsonb_build_object('code', '5110', 'debit', r.total_employer, 'memo', 'Employer EPF/ETF'),
              jsonb_build_object('code', '2100', 'credit', r.total_net, 'memo', 'Net salaries payable'),
              jsonb_build_object('code', '2200', 'credit', v_epf, 'memo', 'EPF 8% + 12%'),
              jsonb_build_object('code', '2210', 'credit', v_etf, 'memo', 'ETF 3%'),
              jsonb_build_object('code', '1300', 'credit', v_adv, 'memo', 'Advance recoveries'),
              jsonb_build_object('code', '2000', 'credit', v_other, 'memo', 'Other withholdings')));

  -- apply advance recoveries
  for d in
    select (x ->> 'advance_id')::uuid as advance_id, sum((x ->> 'amount')::numeric) as amt
    from public.payslips ps, jsonb_array_elements(ps.deductions) x
    where ps.run_id = p_run and x ->> 'code' = 'ADVANCE' and x ? 'advance_id'
    group by 1
  loop
    update public.staff_advances
    set recovered_amount = recovered_amount + d.amt,
        status = case when recovered_amount + d.amt >= amount then 'settled' else status end
    where id = d.advance_id;
  end loop;

  update public.payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now(), accrual_journal_id = v_je
  where id = p_run;
  update public.payslips set status = 'approved' where run_id = p_run;
  return v_je;
end;
$$;

create or replace function public.pay_payroll(p_run uuid, p_account_code text default '1010', p_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_je uuid;
  ps record;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.payroll_runs where id = p_run and org_id = public.current_org_id() for update;
  if not found or r.status <> 'approved' then
    raise exception 'Approved payroll run not found';
  end if;
  if not exists (select 1 from public.accounts where org_id = r.org_id and code = p_account_code and subtype in ('cash', 'bank')) then
    raise exception 'Pay from a cash or bank account';
  end if;

  v_je := public.post_journal(r.org_id, current_date, format('Salary payment %s', r.period), 'payroll_payment', r.id,
            jsonb_build_array(
              jsonb_build_object('code', '2100', 'debit', r.total_net, 'memo', 'Net salaries'),
              jsonb_build_object('code', p_account_code, 'credit', r.total_net, 'memo', p_reference)));

  update public.payroll_runs
  set status = 'paid', paid_by = auth.uid(), paid_at = now(), payment_account_code = p_account_code,
      payment_reference = p_reference, payment_journal_id = v_je
  where id = p_run;
  update public.payslips set status = 'paid', paid_at = now(), payment_reference = p_reference where run_id = p_run;

  -- keep the legacy tutor_salaries view (tutor dashboard) in sync
  for ps in select * from public.payslips where run_id = p_run loop
    insert into public.tutor_salaries (tutor_id, month, amount, status, org_id)
    values (ps.staff_id, ps.period, ps.net, 'paid', ps.org_id)
    on conflict (tutor_id, month) do update set amount = excluded.amount, status = 'paid';
    insert into public.notifications (user_id, title, message, org_id)
    values (ps.staff_id, 'Salary paid',
            format('Your salary for %s (net LKR %s) has been paid. Your payslip is available in the portal.',
                   ps.period, trim(to_char(ps.net, 'FM999999990.00'))), ps.org_id);
  end loop;
  return v_je;
end;
$$;

create or replace function public.cancel_payroll(p_run uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  d record;
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.payroll_runs where id = p_run and org_id = public.current_org_id() for update;
  if not found or r.status not in ('draft', 'approved') then
    raise exception 'Only draft or approved (unpaid) payroll runs can be cancelled';
  end if;
  if r.status = 'approved' then
    perform public._reverse_journal(r.accrual_journal_id, coalesce(p_reason, 'Payroll cancelled'));
    for d in
      select (x ->> 'advance_id')::uuid as advance_id, sum((x ->> 'amount')::numeric) as amt
      from public.payslips ps, jsonb_array_elements(ps.deductions) x
      where ps.run_id = p_run and x ->> 'code' = 'ADVANCE' and x ? 'advance_id'
      group by 1
    loop
      update public.staff_advances set recovered_amount = recovered_amount - d.amt, status = 'active'
      where id = d.advance_id;
    end loop;
  end if;
  update public.payroll_runs set status = 'cancelled', notes = concat_ws(E'\n', notes, 'Cancelled: ' || p_reason) where id = p_run;
  update public.payslips set status = 'cancelled' where run_id = p_run;
end;
$$;

create or replace function public.issue_staff_advance(
  p_profile uuid, p_amount numeric, p_monthly_recovery numeric, p_reason text, p_paid_from_code text default '1000')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_je uuid;
begin
  if not (public.is_accountant() or public.is_treasurer()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile and org_id = v_org and account_type in ('tutor', 'staff')) then
    raise exception 'Employee not found';
  end if;
  if not exists (select 1 from public.accounts where org_id = v_org and code = p_paid_from_code and subtype in ('cash', 'bank')) then
    raise exception 'Pay the advance from a cash or bank account';
  end if;
  if coalesce(p_amount, 0) <= 0 or coalesce(p_monthly_recovery, 0) <= 0 then
    raise exception 'Amount and monthly recovery must be positive';
  end if;
  insert into public.staff_advances (org_id, profile_id, amount, monthly_recovery, reason, approved_by)
  values (v_org, p_profile, round(p_amount, 2), round(p_monthly_recovery, 2), p_reason, auth.uid())
  returning id into v_id;
  v_je := public.post_journal(v_org, current_date, format('Salary advance – %s', p_reason), 'adjustment', v_id,
            jsonb_build_array(
              jsonb_build_object('code', '1300', 'debit', p_amount, 'party_id', p_profile),
              jsonb_build_object('code', p_paid_from_code, 'credit', p_amount)));
  update public.staff_advances set journal_entry_id = v_je where id = v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance / leave RPCs
-- ---------------------------------------------------------------------------
create or replace function public.staff_check_in()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row record;
begin
  if not public.is_employee() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.staff_attendance (org_id, profile_id, date, status, check_in, marked_by)
  values (public.current_org_id(), auth.uid(), public.org_today(), 'present', public.org_now()::time(0), auth.uid())
  on conflict (profile_id, date) do update set check_in = coalesce(public.staff_attendance.check_in, excluded.check_in),
    status = case when public.staff_attendance.status = 'absent' then 'present' else public.staff_attendance.status end
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.staff_check_out()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row record;
begin
  update public.staff_attendance set check_out = public.org_now()::time(0)
  where profile_id = auth.uid() and date = public.org_today()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Check in first';
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.review_staff_leave(p_request uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select * into r from public.staff_leave_requests
  where id = p_request and org_id = public.current_org_id() and status = 'pending' for update;
  if not found then
    raise exception 'Pending leave request not found';
  end if;
  if not (public.is_hr_staff() or public.has_staff_role(array['principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if r.profile_id = auth.uid() then
    raise exception 'You cannot approve your own leave' using errcode = '42501';
  end if;
  update public.staff_leave_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_request;
  if p_approve then
    insert into public.staff_attendance (org_id, profile_id, date, status, note, marked_by)
    select r.org_id, r.profile_id, d::date, 'leave', 'Approved leave', auth.uid()
    from generate_series(r.start_date, r.end_date, interval '1 day') d
    on conflict (profile_id, date) do update set status = 'leave', note = 'Approved leave';
  end if;
  insert into public.notifications (user_id, title, message, org_id)
  values (r.profile_id, 'Leave request ' || case when p_approve then 'approved' else 'rejected' end,
          format('%s → %s%s', r.start_date, r.end_date, coalesce(': ' || p_note, '')), r.org_id);
end;
$$;

create or replace function public.staff_leave_balance(p_profile uuid default null, p_year int default extract(year from current_date)::int)
returns table (leave_type_id uuid, code text, name text, is_paid boolean, entitled numeric, used numeric, pending numeric, remaining numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_profile uuid := coalesce(p_profile, auth.uid());
begin
  if v_profile <> auth.uid() and not (public.is_hr_staff() or public.has_staff_role(array['principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select t.id, t.code, t.name, t.is_paid, t.days_per_year,
         coalesce(sum(r.days) filter (where r.status = 'approved'), 0)::numeric,
         coalesce(sum(r.days) filter (where r.status = 'pending'), 0)::numeric,
         (t.days_per_year - coalesce(sum(r.days) filter (where r.status = 'approved'), 0))::numeric
  from public.staff_leave_types t
  left join public.staff_leave_requests r on r.leave_type_id = t.id and r.profile_id = v_profile
       and extract(year from r.start_date) = p_year
  where t.org_id = public.current_org_id() and t.is_active
  group by t.id, t.code, t.name, t.is_paid, t.days_per_year
  order by t.code;
end;
$$;

create or replace function public.tg_staff_leave_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.profile_id := auth.uid();
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif (new.status, new.reviewed_by, new.profile_id) is distinct from (old.status, old.reviewed_by, old.profile_id)
        and not (old.status = 'pending' and new.status = 'cancelled' and old.profile_id = auth.uid()) then
    raise exception 'Use review_staff_leave to approve or reject' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_staff_leave_guard on public.staff_leave_requests;
create trigger trg_staff_leave_guard before insert or update on public.staff_leave_requests
  for each row execute function public.tg_staff_leave_guard();

grant execute on function public.generate_payroll(text) to authenticated;
grant execute on function public.adjust_payslip(uuid, text, numeric, text) to authenticated;
grant execute on function public.approve_payroll(uuid) to authenticated;
grant execute on function public.pay_payroll(uuid, text, text) to authenticated;
grant execute on function public.cancel_payroll(uuid, text) to authenticated;
grant execute on function public.issue_staff_advance(uuid, numeric, numeric, text, text) to authenticated;
grant execute on function public.staff_check_in() to authenticated;
grant execute on function public.staff_check_out() to authenticated;
grant execute on function public.review_staff_leave(uuid, boolean, text) to authenticated;
grant execute on function public.staff_leave_balance(uuid, int) to authenticated;
revoke all on function public.payroll_setting(uuid, text, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.salary_components     enable row level security;
alter table public.staff_salary_profiles enable row level security;
alter table public.payroll_runs          enable row level security;
alter table public.payslips              enable row level security;
alter table public.staff_advances        enable row level security;
alter table public.staff_attendance      enable row level security;
alter table public.staff_leave_types     enable row level security;
alter table public.staff_leave_requests  enable row level security;

create or replace function public.is_payroll_viewer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_hr_staff() or public.is_finance_viewer();
$$;

drop policy if exists "salary_components: employee read" on public.salary_components;
create policy "salary_components: employee read" on public.salary_components for select to authenticated using (public.is_employee());
drop policy if exists "salary_components: hr write" on public.salary_components;
create policy "salary_components: hr write" on public.salary_components for all to authenticated
  using ((public.is_hr_staff() or public.is_accountant()) and not is_system)
  with check ((public.is_hr_staff() or public.is_accountant()) and not is_system);

drop policy if exists "salary_profiles: read" on public.staff_salary_profiles;
create policy "salary_profiles: read" on public.staff_salary_profiles for select to authenticated
  using (profile_id = auth.uid() or public.is_payroll_viewer());
drop policy if exists "salary_profiles: hr write" on public.staff_salary_profiles;
create policy "salary_profiles: hr write" on public.staff_salary_profiles for all to authenticated
  using (public.is_hr_staff() or public.is_accountant()) with check (public.is_hr_staff() or public.is_accountant());

drop policy if exists "payroll_runs: read" on public.payroll_runs;
create policy "payroll_runs: read" on public.payroll_runs for select to authenticated using (public.is_payroll_viewer());

drop policy if exists "payslips: read" on public.payslips;
create policy "payslips: read" on public.payslips for select to authenticated
  using ((staff_id = auth.uid() and status in ('approved', 'paid')) or public.is_payroll_viewer());

drop policy if exists "staff_advances: read" on public.staff_advances;
create policy "staff_advances: read" on public.staff_advances for select to authenticated
  using (profile_id = auth.uid() or public.is_payroll_viewer());

drop policy if exists "staff_attendance: read" on public.staff_attendance;
create policy "staff_attendance: read" on public.staff_attendance for select to authenticated
  using (profile_id = auth.uid() or public.is_hr_staff() or public.has_staff_role(array['principal', 'vice_principal']));
drop policy if exists "staff_attendance: manage" on public.staff_attendance;
create policy "staff_attendance: manage" on public.staff_attendance for all to authenticated
  using (public.is_hr_staff() or public.has_staff_role(array['principal', 'vice_principal']))
  with check (public.is_hr_staff() or public.has_staff_role(array['principal', 'vice_principal']));

drop policy if exists "leave_types: employee read" on public.staff_leave_types;
create policy "leave_types: employee read" on public.staff_leave_types for select to authenticated using (public.is_employee());
drop policy if exists "leave_types: hr write" on public.staff_leave_types;
create policy "leave_types: hr write" on public.staff_leave_types for all to authenticated
  using (public.is_hr_staff()) with check (public.is_hr_staff());

drop policy if exists "staff_leave: read" on public.staff_leave_requests;
create policy "staff_leave: read" on public.staff_leave_requests for select to authenticated
  using (profile_id = auth.uid() or public.is_hr_staff() or public.has_staff_role(array['principal', 'vice_principal']));
drop policy if exists "staff_leave: employee request" on public.staff_leave_requests;
create policy "staff_leave: employee request" on public.staff_leave_requests for insert to authenticated
  with check (public.is_employee());
drop policy if exists "staff_leave: owner cancel" on public.staff_leave_requests;
create policy "staff_leave: owner cancel" on public.staff_leave_requests for update to authenticated
  using (profile_id = auth.uid() and status = 'pending') with check (profile_id = auth.uid());

select public.attach_audit(t) from unnest(array['staff_salary_profiles', 'payroll_runs', 'staff_advances', 'staff_leave_requests']) t;
