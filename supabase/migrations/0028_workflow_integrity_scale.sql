-- Workflow integrity and scale hardening.
-- All rules in this migration are enforced in Postgres so web, mobile, and
-- privileged API callers share the same checks.

set search_path = public, extensions, pg_temp;

-- EPF/ETF apply to eligible monthly earnings, not only basic salary. Keep the
-- earnings classification with each component so allowances, overtime, and
-- bonuses can follow the institution's verified statutory treatment.
alter table public.salary_components
  add column if not exists epf_eligible boolean not null default true,
  add column if not exists etf_eligible boolean not null default true;
alter table public.salary_components add column if not exists pay_category text not null default 'recurring'
  check (pay_category in ('recurring', 'day_shift', 'lecture', 'ramadan', 'one_off'));
alter table public.payslips
  add column if not exists epf_applicable boolean not null default true,
  add column if not exists epf_basis numeric(12,2) not null default 0,
  add column if not exists etf_basis numeric(12,2) not null default 0;

-- The original attendance updated_at trigger targeted a column that did not
-- exist, causing every attendance correction to fail.
alter table public.attendance
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

-- Sri Lanka EPF guidance explicitly excludes overtime and incentive/bonus
-- payments from EPF earnings. ETF remains separately configurable by component.
update public.salary_components set epf_eligible = false where code in ('OVERTIME', 'BONUS', 'UNPAID');
update public.salary_components set epf_eligible = false, etf_eligible = false
where kind = 'deduction' or code in ('EPF_EE', 'ADVANCE', 'UNPAID');
update public.salary_components set pay_category = 'day_shift' where code = 'OVERTIME';
update public.salary_components set pay_category = 'lecture' where code = 'TEACHING';
update public.salary_components set pay_category = 'ramadan' where code = 'BONUS';

-- Treat shift/lecture/Ramadan work as separately named payroll earnings. The
-- UI records an approved monthly amount and the work reference; local HR sets
-- the rate and confirms component eligibility before payroll approval.
insert into public.salary_components (org_id, code, name, kind, is_system, pay_category, epf_eligible, etf_eligible)
select o.id, c.code, c.name, 'earning', false, c.pay_category, true, true
from public.organizations o
cross join (values
  ('DAY_SHIFT', 'Day shift payment', 'day_shift'),
  ('LECTURE_PAY', 'Additional lecture payment', 'lecture'),
  ('RAMADAN_PAY', 'Ramadan / special offer payment', 'ramadan')
) as c(code, name, pay_category)
on conflict (org_id, code) do nothing;

create or replace function public.tg_payslip_statutory_calculation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_unpaid numeric;
  v_epf_extra numeric;
  v_etf_extra numeric;
  v_earning_total numeric;
  v_employer_total numeric;
  v_epf_rate numeric;
  v_epf_employer_rate numeric;
  v_etf_rate numeric;
  v_profile_epf boolean;
  v_epf_employee numeric := 0;
  v_epf_employer numeric := 0;
  v_etf numeric := 0;
begin
  if new.status <> 'draft' then return new; end if;

  if tg_op = 'INSERT' then
    select epf_applicable into v_profile_epf
    from public.staff_salary_profiles
    where profile_id = new.staff_id and org_id = new.org_id
      and effective_from <= (new.period || '-01')::date + interval '1 month' - interval '1 day'
    order by effective_from desc limit 1;
    if found then new.epf_applicable := v_profile_epf; end if;
  end if;

  select coalesce(sum(abs((x.value ->> 'amount')::numeric)), 0) into v_unpaid
  from jsonb_array_elements(coalesce(new.earnings, '[]'::jsonb)) as x(value)
  where x.value ->> 'code' = 'UNPAID';

  if exists (
    select 1 from jsonb_array_elements(coalesce(new.earnings, '[]'::jsonb)) x(value)
    where x.value ->> 'code' = 'UNPAID' and coalesce((x.value ->> 'amount')::numeric, 0) > 0
  ) then
    raise exception 'Unpaid leave adjustment must be zero or negative';
  end if;

  select coalesce(sum((x.value ->> 'amount')::numeric) filter (where c.epf_eligible), 0),
         coalesce(sum((x.value ->> 'amount')::numeric) filter (where c.etf_eligible), 0),
         coalesce(sum((x.value ->> 'amount')::numeric), 0)
    into v_epf_extra, v_etf_extra, v_earning_total
  from jsonb_array_elements(coalesce(new.earnings, '[]'::jsonb)) as x(value)
  left join public.salary_components c
    on c.org_id = new.org_id and c.code = x.value ->> 'code';

  if exists (
    select 1 from jsonb_array_elements(coalesce(new.earnings, '[]'::jsonb)) x(value)
    where coalesce((x.value ->> 'amount')::numeric, 0) < 0
      and x.value ->> 'code' <> 'UNPAID'
  ) then
    raise exception 'Earning amounts must be non-negative (except unpaid leave)';
  end if;

  new.epf_basis := round(greatest(new.basic + v_epf_extra - v_unpaid, 0), 2);
  new.etf_basis := round(greatest(new.basic + v_etf_extra - v_unpaid, 0), 2);
  v_epf_rate := greatest(public.payroll_setting(new.org_id, 'epf_employee', 8), 8);
  v_epf_employer_rate := greatest(public.payroll_setting(new.org_id, 'epf_employer', 12), 12);
  v_etf_rate := greatest(public.payroll_setting(new.org_id, 'etf_employer', 3), 3);
  if new.epf_applicable then
    v_epf_employee := round(new.epf_basis * v_epf_rate / 100, 2);
    v_epf_employer := round(new.epf_basis * v_epf_employer_rate / 100, 2);
    v_etf := round(new.etf_basis * v_etf_rate / 100, 2);
  end if;

  select coalesce(jsonb_agg(x.value order by x.ordinality), '[]'::jsonb)
    into new.deductions
  from jsonb_array_elements(coalesce(new.deductions, '[]'::jsonb)) with ordinality as x(value, ordinality)
  where x.value ->> 'code' <> 'EPF_EE';
  if v_epf_employee > 0 then
    new.deductions := new.deductions || jsonb_build_array(jsonb_build_object(
      'code', 'EPF_EE', 'name', format('EPF Employee (%s%%)', v_epf_rate), 'amount', v_epf_employee));
  end if;

  select coalesce(jsonb_agg(x.value order by x.ordinality), '[]'::jsonb)
    into new.employer_contributions
  from jsonb_array_elements(coalesce(new.employer_contributions, '[]'::jsonb)) with ordinality as x(value, ordinality)
  where x.value ->> 'code' not in ('EPF_ER', 'ETF');
  if v_epf_employer > 0 then
    new.employer_contributions := new.employer_contributions || jsonb_build_array(
      jsonb_build_object('code', 'EPF_ER', 'name', format('EPF Employer (%s%%)', v_epf_employer_rate), 'amount', v_epf_employer),
      jsonb_build_object('code', 'ETF', 'name', format('ETF (%s%%)', v_etf_rate), 'amount', v_etf));
  end if;

  select coalesce(sum((x.value ->> 'amount')::numeric), 0) into new.total_deductions
  from jsonb_array_elements(coalesce(new.deductions, '[]'::jsonb)) as x(value);
  new.gross := round(greatest(new.basic + v_earning_total, 0), 2);
  new.net := round(new.gross - new.total_deductions, 2);
  select coalesce(sum((x.value ->> 'amount')::numeric), 0) into v_employer_total
  from jsonb_array_elements(coalesce(new.employer_contributions, '[]'::jsonb)) as x(value);
  new.employer_total := v_employer_total;
  return new;
end;
$$;
drop trigger if exists trg_payslip_statutory_calculation on public.payslips;
create trigger trg_payslip_statutory_calculation
before insert or update of basic, earnings, deductions, employer_contributions, gross, total_deductions, net, epf_applicable, status
on public.payslips for each row execute function public.tg_payslip_statutory_calculation();

-- Recalculate any existing draft run using the corrected statutory earnings
-- bases and refresh its displayed totals before it can be approved.
update public.payslips ps
set epf_applicable = coalesce((
  select sp.epf_applicable from public.staff_salary_profiles sp
  where sp.profile_id = ps.staff_id and sp.org_id = ps.org_id
  order by sp.effective_from desc limit 1
), ps.epf_applicable),
earnings = ps.earnings
where ps.status = 'draft';

update public.payroll_runs r set
  total_gross = coalesce((select sum(p.gross) from public.payslips p where p.run_id = r.id), 0),
  total_deductions = coalesce((select sum(p.total_deductions) from public.payslips p where p.run_id = r.id), 0),
  total_net = coalesce((select sum(p.net) from public.payslips p where p.run_id = r.id), 0),
  total_employer = coalesce((select sum(p.employer_total) from public.payslips p where p.run_id = r.id), 0),
  staff_count = (select count(*) from public.payslips p where p.run_id = r.id)
where r.status = 'draft';

-- A single institution-wide 5–25 default incorrectly excludes the adult
-- continuing-education course. Keep policy configurable in organization
-- settings and use the historical broad range when no policy was configured.
create or replace function public.admission_age_limits(p_org uuid)
returns table (min_age int, max_age int)
language sql stable security definer set search_path = public as $$
  select coalesce((settings ->> 'admission_min_age')::int, 3),
         coalesce((settings ->> 'admission_max_age')::int, 80)
  from public.organizations where id = p_org;
$$;

create or replace function public.tg_admissions_dob()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_min int;
  v_max int;
  v_age int;
  v_today date;
begin
  if new.org_id is null then
    new.org_id := public.current_org_id();
  end if;
  v_today := (now() at time zone coalesce(
    (select timezone from public.organizations where id = new.org_id), 'Asia/Colombo'))::date;
  if new.date_of_birth is null then
    if tg_op = 'INSERT' or old.date_of_birth is not null then
      raise exception 'Date of birth is required for an admission application';
    end if;
    return new;
  end if;
  if new.date_of_birth > v_today then
    raise exception 'Date of birth cannot be in the future';
  end if;
  v_age := extract(year from age(v_today, new.date_of_birth))::int;
  select min_age, max_age into v_min, v_max from public.admission_age_limits(new.org_id);
  if v_age < coalesce(v_min, 3) or v_age > coalesce(v_max, 80) then
    raise exception 'Applicant must be between % and % years old (age from date of birth: %)',
      coalesce(v_min, 3), coalesce(v_max, 80), v_age;
  end if;
  new.age := v_age;
  return new;
end;
$$;

-- Results must match the configured exam paper. Published marks can only be
-- corrected by academic administrators; tutors must be assigned that subject.
create or replace function public.tg_student_results_prepare()
returns trigger language plpgsql set search_path = public as $$
declare
  v_exam record;
  v_student record;
  v_paper record;
  v_class int;
  v_has_subject_assignments boolean;
begin
  select id, org_id, status, class_number, academic_year_id
    into v_exam from public.exams where id = new.exam_id;
  if new.exam_id is not null and not found then
    raise exception 'Exam not found';
  end if;

  select id, org_id, account_type, class_number
    into v_student from public.profiles where id = new.student_id;
  if not found or v_student.account_type <> 'student' then
    raise exception 'Student not found';
  end if;
  if new.org_id is null then new.org_id := v_student.org_id; end if;
  if new.org_id is distinct from v_student.org_id
     or (new.exam_id is not null and v_exam.org_id is distinct from v_student.org_id) then
    raise exception 'Student, exam, and result must belong to the same institution';
  end if;

  if new.exam_id is not null then
  v_class := v_student.class_number;
  if new.exam_id is not null and v_exam.academic_year_id is not null then
    select e.class_number into v_class from public.student_enrollments e
    where e.student_id = new.student_id and e.academic_year_id = v_exam.academic_year_id;
    if not found then v_class := v_student.class_number; end if;
  end if;
  if new.exam_id is not null and v_exam.class_number is not null and v_class is distinct from v_exam.class_number then
      raise exception 'Student is not enrolled in the exam class';
    end if;
    if v_exam.status = 'published' and current_user in ('anon', 'authenticated')
       and not public.is_academic_admin() then
      raise exception 'Published results can only be corrected by an academic administrator'
        using errcode = '42501';
    end if;
    if new.subject_id is null then
      raise exception 'An exam subject is required';
    end if;
    select max_marks into v_paper from public.exam_subjects
    where exam_id = new.exam_id and subject_id = new.subject_id and org_id = v_exam.org_id;
    if not found then
      raise exception 'Subject is not part of this exam';
    end if;
    new.max_marks := v_paper.max_marks;
    select name_en into new.subject from public.subjects where id = new.subject_id and org_id = v_exam.org_id;
    if tg_op = 'INSERT' or new.marks_obtained is distinct from old.marks_obtained then
      new.grade := public.compute_grade(new.org_id, round(new.marks_obtained * 100.0 / new.max_marks, 2));
    end if;
  end if;

  if new.marks_obtained is null or new.max_marks is null
     or new.marks_obtained < 0 or new.max_marks <= 0 or new.marks_obtained > new.max_marks then
    raise exception 'Marks must be between 0 and %', new.max_marks;
  end if;

  if new.exam_id is not null and new.subject_id is not null
     and current_user = 'authenticated' and not public.is_academic_admin() then
    select exists (
      select 1 from public.class_subjects cs
      where cs.org_id = new.org_id and cs.class_number = v_class
        and (cs.academic_year_id is null or cs.academic_year_id = v_exam.academic_year_id)
    ) into v_has_subject_assignments;
    if v_has_subject_assignments and not exists (
      select 1 from public.class_subjects cs
      where cs.org_id = new.org_id and cs.class_number = v_class
        and cs.subject_id = new.subject_id and cs.tutor_id = auth.uid()
        and (cs.academic_year_id is null or cs.academic_year_id = v_exam.academic_year_id)
    ) then
      raise exception 'Tutor is not assigned to this subject and class' using errcode = '42501';
    elsif not v_has_subject_assignments
       and not public.tutor_can_teach_student(new.student_id) then
      raise exception 'Tutor is not assigned to this class' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' or new.marks_obtained is distinct from old.marks_obtained then
    new.grade := public.compute_grade(new.org_id, round(new.marks_obtained * 100.0 / new.max_marks, 2));
  end if;
  if new.subject_id is not null and coalesce(new.subject, '') = '' then
    select name_en into new.subject from public.subjects where id = new.subject_id;
  end if;
  if new.exam_id is not null then
    select name into new.exam_name from public.exams where id = new.exam_id;
  end if;
  new.entered_by := coalesce(new.entered_by, auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

-- Serialize allocations by room before checking capacity and validate tenant,
-- room state, student state, and physical bed uniqueness.
create or replace function public.tg_hostel_allocation_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_room record;
  v_used int;
  v_student record;
begin
  select id, org_id, capacity, is_active into v_room
  from public.hostel_rooms where id = new.room_id for update;
  if not found or not v_room.is_active then
    raise exception 'Hostel room is missing or inactive';
  end if;
  select id, org_id, account_type, is_approved into v_student
  from public.profiles where id = new.student_id;
  if not found or v_student.account_type <> 'student' or not v_student.is_approved then
    raise exception 'An approved student account is required for hostel allocation';
  end if;
  if v_room.org_id is distinct from v_student.org_id
     or (new.org_id is not null and new.org_id is distinct from v_room.org_id) then
    raise exception 'Hostel, room, allocation, and student must belong to the same institution';
  end if;
  new.org_id := v_room.org_id;
  if new.status = 'active' then
    select count(*) into v_used from public.hostel_allocations
    where room_id = new.room_id and status = 'active' and id <> new.id;
    if v_used >= v_room.capacity then
      raise exception 'Room is full (% of % beds occupied)', v_used, v_room.capacity;
    end if;
    if new.bed_no is not null and exists (
      select 1 from public.hostel_allocations a
      where a.room_id = new.room_id and a.status = 'active' and a.id <> new.id
        and upper(trim(a.bed_no)) = upper(trim(new.bed_no))
    ) then
      raise exception 'Bed % is already occupied', new.bed_no;
    end if;
  end if;
  if new.status = 'ended' and new.end_date is null then new.end_date := current_date; end if;
  return new;
end;
$$;

-- Cover the high-frequency filters used by dashboards, fee reports, and staff
-- lists. These indexes are tenant-leading to keep 3k+ user requests selective.
create index if not exists idx_attendance_org_date_student
  on public.attendance (org_id, date desc, student_id);
create index if not exists idx_results_org_student_created
  on public.student_results (org_id, student_id, created_at desc);
create index if not exists idx_fees_org_month_status
  on public.student_fees (org_id, month desc, status);
create index if not exists idx_fee_payments_org_paid_at
  on public.fee_payments (org_id, paid_at desc) where status = 'posted';
create index if not exists idx_admissions_org_stage_created
  on public.admissions (org_id, pipeline_stage, created_at desc);
create index if not exists idx_profiles_org_account_approved_name
  on public.profiles (org_id, account_type, is_approved, full_name, id);
create index if not exists idx_hostel_alloc_room_active
  on public.hostel_allocations (room_id) where status = 'active';
create unique index if not exists idx_hostel_alloc_active_bed
  on public.hostel_allocations (room_id, upper(trim(bed_no)))
  where status = 'active' and bed_no is not null;
