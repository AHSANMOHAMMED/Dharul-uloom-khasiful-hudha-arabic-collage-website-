-- =============================================================================
-- 0027_import_reports.sql
-- Bulk import (students, staff, exam marks) and report datasets.
--
-- Import model: accounts live in Supabase Auth and are created by the person
-- signing up, so an import never creates logins. Instead:
--   * students: existing accounts (matched by index number) are updated;
--     new ones become index pre-seeds whose details are applied by trigger
--     when the student registers with that index number.
--   * staff: existing accounts (matched by email) are updated; new ones get an
--     invitation whose HR details are applied when they register.
-- Every import is validated first (p_commit = false) and is all-or-nothing:
-- if any row has an error, nothing is written.
--
-- Reports are SECURITY INVOKER: RLS (tenancy, roles, 2FA) decides which rows
-- each caller sees, so a report can never show more than the tables would.
-- =============================================================================

alter table public.valid_index_numbers add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.org_invitations     add column if not exists details jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Small parsing helpers
-- ---------------------------------------------------------------------------
create or replace function public.try_date(p text)
returns date language plpgsql immutable as $$
begin
  if p is null or trim(p) = '' then return null; end if;
  if trim(p) !~ '^\d{4}-\d{1,2}-\d{1,2}$' then return null; end if;
  return trim(p)::date;
exception when others then
  return null;
end $$;

create or replace function public.try_numeric(p text)
returns numeric language plpgsql immutable as $$
begin
  if p is null or trim(p) = '' then return null; end if;
  return trim(p)::numeric;
exception when others then
  return null;
end $$;

-- Text value of a key, trimmed, '' -> null.
create or replace function public.jtext(p jsonb, k text)
returns text language sql immutable as $$
  select nullif(trim(p ->> k), '');
$$;

-- ---------------------------------------------------------------------------
-- Apply imported details (used by imports and by the sign-up hooks)
-- Only non-null incoming values overwrite existing data.
-- ---------------------------------------------------------------------------
create or replace function public.apply_student_details(p_profile uuid, p_org uuid, d jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.student_details as sd (
    profile_id, org_id, admission_no, admission_date, date_of_birth, gender, nationality, national_id,
    address, city, guardian_name, guardian_relationship, guardian_phone, guardian_email,
    emergency_contact, blood_group, medical_notes, previous_school)
  values (
    p_profile, p_org, public.jtext(d, 'admission_no'), public.try_date(d ->> 'admission_date'),
    public.try_date(d ->> 'date_of_birth'), public.jtext(d, 'gender'), coalesce(public.jtext(d, 'nationality'), 'Sri Lankan'),
    public.jtext(d, 'national_id'), public.jtext(d, 'address'), public.jtext(d, 'city'),
    public.jtext(d, 'guardian_name'), public.jtext(d, 'guardian_relationship'), public.jtext(d, 'guardian_phone'),
    public.jtext(d, 'guardian_email'), public.jtext(d, 'emergency_contact'), public.jtext(d, 'blood_group'),
    public.jtext(d, 'medical_notes'), public.jtext(d, 'previous_school'))
  on conflict (profile_id) do update set
    admission_no          = coalesce(excluded.admission_no, sd.admission_no),
    admission_date        = coalesce(excluded.admission_date, sd.admission_date),
    date_of_birth         = coalesce(excluded.date_of_birth, sd.date_of_birth),
    gender                = coalesce(excluded.gender, sd.gender),
    nationality           = coalesce(public.jtext(d, 'nationality'), sd.nationality),
    national_id           = coalesce(excluded.national_id, sd.national_id),
    address               = coalesce(excluded.address, sd.address),
    city                  = coalesce(excluded.city, sd.city),
    guardian_name         = coalesce(excluded.guardian_name, sd.guardian_name),
    guardian_relationship = coalesce(excluded.guardian_relationship, sd.guardian_relationship),
    guardian_phone        = coalesce(excluded.guardian_phone, sd.guardian_phone),
    guardian_email        = coalesce(excluded.guardian_email, sd.guardian_email),
    emergency_contact     = coalesce(excluded.emergency_contact, sd.emergency_contact),
    blood_group           = coalesce(excluded.blood_group, sd.blood_group),
    medical_notes         = coalesce(excluded.medical_notes, sd.medical_notes),
    previous_school       = coalesce(excluded.previous_school, sd.previous_school),
    updated_at            = now();
end $$;

create or replace function public.apply_staff_hr(p_profile uuid, p_org uuid, d jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff_hr as h (
    profile_id, org_id, department, job_title, employment_start, emergency_contact, emergency_phone,
    employee_no, employment_type, national_id, epf_no, bank_name, bank_branch, bank_account_no)
  values (
    p_profile, p_org, public.jtext(d, 'department'), public.jtext(d, 'job_title'), public.try_date(d ->> 'employment_start'),
    public.jtext(d, 'emergency_contact'), public.jtext(d, 'emergency_phone'), public.jtext(d, 'employee_no'),
    coalesce(public.jtext(d, 'employment_type'), 'permanent'), public.jtext(d, 'national_id'), public.jtext(d, 'epf_no'),
    public.jtext(d, 'bank_name'), public.jtext(d, 'bank_branch'), public.jtext(d, 'bank_account_no'))
  on conflict (profile_id) do update set
    department        = coalesce(excluded.department, h.department),
    job_title         = coalesce(excluded.job_title, h.job_title),
    employment_start  = coalesce(excluded.employment_start, h.employment_start),
    emergency_contact = coalesce(excluded.emergency_contact, h.emergency_contact),
    emergency_phone   = coalesce(excluded.emergency_phone, h.emergency_phone),
    employee_no       = coalesce(excluded.employee_no, h.employee_no),
    employment_type   = coalesce(public.jtext(d, 'employment_type'), h.employment_type),
    national_id       = coalesce(excluded.national_id, h.national_id),
    epf_no            = coalesce(excluded.epf_no, h.epf_no),
    bank_name         = coalesce(excluded.bank_name, h.bank_name),
    bank_branch       = coalesce(excluded.bank_branch, h.bank_branch),
    bank_account_no   = coalesce(excluded.bank_account_no, h.bank_account_no),
    updated_at        = now();
end $$;

revoke execute on function public.apply_student_details(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_staff_hr(uuid, uuid, jsonb) from public, anon, authenticated;

-- Sign-up hooks ---------------------------------------------------------------
create or replace function public.tg_profiles_apply_import()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
begin
  if new.index_number is not null then
    select details into d from public.valid_index_numbers where index_number = new.index_number;
    if d is not null and d <> '{}'::jsonb then
      perform public.apply_student_details(new.id, coalesce(new.org_id, public.default_org_id()), d);
      if new.phone is null and public.jtext(d, 'phone') is not null then
        update public.profiles set phone = public.jtext(d, 'phone') where id = new.id;
      end if;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_profiles_apply_import on public.profiles;
create trigger trg_profiles_apply_import after insert on public.profiles
  for each row execute function public.tg_profiles_apply_import();

create or replace function public.tg_invitation_apply_import()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.accepted_by is not null and old.accepted_by is null and new.details <> '{}'::jsonb then
    perform public.apply_staff_hr(new.accepted_by, new.org_id, new.details);
    if public.jtext(new.details, 'phone') is not null then
      update public.profiles set phone = coalesce(phone, public.jtext(new.details, 'phone')) where id = new.accepted_by;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_invitation_apply_import on public.org_invitations;
create trigger trg_invitation_apply_import after update of accepted_by on public.org_invitations
  for each row execute function public.tg_invitation_apply_import();

-- ---------------------------------------------------------------------------
-- import_students(rows, commit)
-- Row keys: index_number*, full_name*, class_number*, phone, email, and any
-- student_details column (date_of_birth, gender, guardian_name, …).
-- ---------------------------------------------------------------------------
create or replace function public.import_students(p_rows jsonb, p_commit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org   uuid := public.current_org_id();
  r       jsonb;
  i       int := 0;
  errs    text[];
  v_index text;
  v_name  text;
  v_class int;
  v_gender text;
  v_action text;
  v_prof  uuid;
  v_prof_org uuid;
  v_idx_org uuid;
  seen    text[] := '{}';
  clean   jsonb := '[]'::jsonb;
  report  jsonb := '[]'::jsonb;
  n_err   int := 0;
  n_new   int := 0;
  n_upd   int := 0;
  c       jsonb;
begin
  if not (public.is_admin() or public.is_admissions_staff() or public.is_academic_admin()) then
    raise exception 'You are not allowed to import students' using errcode = '42501';
  end if;
  if v_org is null then
    raise exception 'No active institution for this account' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'At most 2000 rows per import';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    errs := '{}';
    v_index := public.jtext(r, 'index_number');
    v_name  := public.jtext(r, 'full_name');
    v_class := null;
    v_prof := null; v_prof_org := null; v_idx_org := null;

    if v_index is null then errs := errs || 'index_number is required'::text; end if;
    if v_name is null then errs := errs || 'full_name is required'::text; end if;
    if public.jtext(r, 'class_number') is null then
      errs := errs || 'class_number is required'::text;
    else
      v_class := public.try_numeric(r ->> 'class_number')::int;
      if v_class is null or v_class not between 1 and 7 then
        errs := errs || 'class_number must be 1-7'::text;
      end if;
    end if;
    if public.jtext(r, 'date_of_birth') is not null and public.try_date(r ->> 'date_of_birth') is null then
      errs := errs || 'date_of_birth must be a date (YYYY-MM-DD)'::text;
    end if;
    if public.jtext(r, 'admission_date') is not null and public.try_date(r ->> 'admission_date') is null then
      errs := errs || 'admission_date must be a date (YYYY-MM-DD)'::text;
    end if;
    v_gender := lower(coalesce(public.jtext(r, 'gender'), ''));
    v_gender := case v_gender when 'm' then 'male' when 'f' then 'female' when '' then null else v_gender end;
    if v_gender is not null and v_gender not in ('male', 'female') then
      errs := errs || 'gender must be male or female'::text;
    end if;
    if public.jtext(r, 'guardian_email') is not null and public.jtext(r, 'guardian_email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      errs := errs || 'guardian_email is not a valid email'::text;
    end if;

    if v_index is not null then
      if v_index = any (seen) then
        errs := errs || 'index_number appears more than once in this file'::text;
      end if;
      seen := seen || v_index;
      select id, org_id into v_prof, v_prof_org from public.profiles where index_number = v_index;
      if v_prof is not null and v_prof_org is distinct from v_org then
        errs := errs || 'index_number belongs to another institution'::text;
      end if;
      if v_prof is null then
        select org_id into v_idx_org from public.valid_index_numbers where index_number = v_index;
        if v_idx_org is not null and v_idx_org <> v_org then
          errs := errs || 'index_number belongs to another institution'::text;
        end if;
      end if;
    end if;

    v_action := case when v_prof is not null then 'update' when v_idx_org is not null then 'update_pending' else 'create' end;
    if cardinality(errs) > 0 then
      n_err := n_err + 1;
      v_action := 'error';
    elsif v_action = 'create' then
      n_new := n_new + 1;
    else
      n_upd := n_upd + 1;
    end if;

    report := report || jsonb_build_object('row', i, 'key', v_index, 'name', v_name, 'action', v_action, 'errors', to_jsonb(errs));
    clean := clean || jsonb_build_object('index', v_index, 'name', v_name, 'class', v_class, 'profile', v_prof,
      'details', (r - 'index_number' - 'full_name' - 'class_number') || jsonb_build_object('gender', v_gender));
  end loop;

  if p_commit and n_err = 0 then
    for c in select value from jsonb_array_elements(clean) loop
      if (c ->> 'profile') is not null then
        update public.profiles
           set full_name = c ->> 'name',
               class_number = (c ->> 'class')::int,
               phone = coalesce(public.jtext(c -> 'details', 'phone'), phone)
         where id = (c ->> 'profile')::uuid;
        perform public.apply_student_details((c ->> 'profile')::uuid, v_org, c -> 'details');
        update public.valid_index_numbers
           set student_name = c ->> 'name', class_number = (c ->> 'class')::int
         where index_number = c ->> 'index';
      else
        insert into public.valid_index_numbers (index_number, student_name, class_number, org_id, details)
        values (c ->> 'index', c ->> 'name', (c ->> 'class')::int, v_org, jsonb_strip_nulls(c -> 'details'))
        on conflict (index_number) do update
          set student_name = excluded.student_name,
              class_number = excluded.class_number,
              details = public.valid_index_numbers.details || excluded.details;
      end if;
    end loop;
  end if;

  return jsonb_build_object('total', i, 'errors', n_err, 'created', n_new, 'updated', n_upd,
                            'committed', p_commit and n_err = 0, 'rows', report);
end $$;

-- ---------------------------------------------------------------------------
-- import_staff(rows, commit)
-- Row keys: email*, full_name*, account_type (tutor|staff), staff_role, phone,
-- and staff_hr columns (department, job_title, employee_no, employment_type,
-- employment_start, national_id, epf_no, bank_name, bank_branch, bank_account_no, …).
-- Roles of EXISTING accounts are never changed by an import.
-- ---------------------------------------------------------------------------
create or replace function public.import_staff(p_rows jsonb, p_commit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := public.current_org_id();
  r        jsonb;
  i        int := 0;
  errs     text[];
  warns    text[];
  v_email  text;
  v_name   text;
  v_type   text;
  v_role   text;
  v_etype  text;
  v_action text;
  v_prof   uuid;
  v_prof_org uuid;
  v_inv    uuid;
  seen     text[] := '{}';
  clean    jsonb := '[]'::jsonb;
  report   jsonb := '[]'::jsonb;
  n_err    int := 0;
  n_new    int := 0;
  n_upd    int := 0;
  c        jsonb;
  roles    text[] := array['none', 'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
                           'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer', 'it_officer'];
begin
  if not (public.is_admin() or public.is_hr_staff()) then
    raise exception 'You are not allowed to import staff' using errcode = '42501';
  end if;
  if v_org is null then
    raise exception 'No active institution for this account' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'At most 1000 rows per import';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    errs := '{}';
    warns := '{}';
    v_email := lower(public.jtext(r, 'email'));
    v_name  := public.jtext(r, 'full_name');
    v_type  := lower(coalesce(public.jtext(r, 'account_type'), 'staff'));
    v_role  := lower(coalesce(public.jtext(r, 'staff_role'), 'none'));
    v_etype := lower(public.jtext(r, 'employment_type'));
    v_prof := null; v_prof_org := null; v_inv := null;

    if v_email is null then
      errs := errs || 'email is required'::text;
    elsif v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      errs := errs || 'email is not valid'::text;
    end if;
    if v_name is null then errs := errs || 'full_name is required'::text; end if;
    if v_type not in ('tutor', 'staff') then errs := errs || 'account_type must be tutor or staff'::text; end if;
    if not (v_role = any (roles)) then errs := errs || ('staff_role must be one of: ' || array_to_string(roles, ', ')); end if;
    if v_etype is not null and v_etype not in ('permanent', 'contract', 'part_time', 'visiting', 'volunteer') then
      errs := errs || 'employment_type must be permanent, contract, part_time, visiting or volunteer'::text;
    end if;
    if public.jtext(r, 'employment_start') is not null and public.try_date(r ->> 'employment_start') is null then
      errs := errs || 'employment_start must be a date (YYYY-MM-DD)'::text;
    end if;

    if v_email is not null then
      if v_email = any (seen) then errs := errs || 'email appears more than once in this file'::text; end if;
      seen := seen || v_email;
      select id, org_id into v_prof, v_prof_org from public.profiles where lower(email) = v_email;
      if v_prof is not null and v_prof_org is distinct from v_org then
        errs := errs || 'this email belongs to an account in another institution'::text;
      end if;
      if v_prof is not null and v_role <> 'none' then
        warns := warns || 'role not changed for an existing account (use Tutors & Roles)'::text;
      end if;
      if public.jtext(r, 'employee_no') is not null and exists (
        select 1 from public.staff_hr h
        where h.org_id = v_org and h.employee_no = public.jtext(r, 'employee_no')
          and h.profile_id is distinct from v_prof) then
        errs := errs || 'employee_no is already used by another staff member'::text;
      end if;
      if v_prof is null then
        select id into v_inv from public.org_invitations
        where org_id = v_org and lower(email) = v_email
          and accepted_at is null and revoked_at is null and expires_at > now()
        order by created_at desc limit 1;
      end if;
    end if;

    v_action := case when v_prof is not null then 'update' when v_inv is not null then 'update_pending' else 'create' end;
    if cardinality(errs) > 0 then
      n_err := n_err + 1;
      v_action := 'error';
    elsif v_action = 'create' then
      n_new := n_new + 1;
    else
      n_upd := n_upd + 1;
    end if;

    report := report || jsonb_build_object('row', i, 'key', v_email, 'name', v_name, 'action', v_action,
                                           'errors', to_jsonb(errs), 'warnings', to_jsonb(warns));
    clean := clean || jsonb_build_object('email', v_email, 'name', v_name, 'type', v_type, 'role', v_role,
      'profile', v_prof, 'invitation', v_inv,
      'details', jsonb_strip_nulls((r - 'email' - 'full_name' - 'account_type' - 'staff_role')
                                   || jsonb_build_object('employment_type', v_etype)));
  end loop;

  if p_commit and n_err = 0 then
    for c in select value from jsonb_array_elements(clean) loop
      if (c ->> 'profile') is not null then
        update public.profiles
           set full_name = c ->> 'name',
               phone = coalesce(public.jtext(c -> 'details', 'phone'), phone)
         where id = (c ->> 'profile')::uuid;
        perform public.apply_staff_hr((c ->> 'profile')::uuid, v_org, c -> 'details');
      elsif (c ->> 'invitation') is not null then
        update public.org_invitations
           set full_name = c ->> 'name', account_type = c ->> 'type', assigned_tutor_role = c ->> 'role',
               details = details || (c -> 'details')
         where id = (c ->> 'invitation')::uuid;
      else
        insert into public.org_invitations (org_id, email, full_name, account_type, role, assigned_tutor_role, invited_by, details)
        values (v_org, c ->> 'email', c ->> 'name', c ->> 'type', 'user', c ->> 'role', auth.uid(), c -> 'details');
      end if;
    end loop;
  end if;

  return jsonb_build_object('total', i, 'errors', n_err, 'created', n_new, 'updated', n_upd,
                            'committed', p_commit and n_err = 0, 'rows', report);
end $$;

-- ---------------------------------------------------------------------------
-- import_exam_marks(exam, rows, commit) — SECURITY INVOKER: the existing
-- student_results policies and trigger decide who may enter marks.
-- Row keys: index_number*, subject_code*, marks*, remarks.
-- ---------------------------------------------------------------------------
create or replace function public.import_exam_marks(p_exam uuid, p_rows jsonb, p_commit boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  ex      record;
  r       jsonb;
  i       int := 0;
  errs    text[];
  v_index text;
  v_code  text;
  v_marks numeric;
  v_student uuid;
  v_subject uuid;
  v_max   numeric;
  seen    text[] := '{}';
  clean   jsonb := '[]'::jsonb;
  report  jsonb := '[]'::jsonb;
  n_err   int := 0;
  n_new   int := 0;
  n_upd   int := 0;
  c       jsonb;
begin
  select id, org_id, status, name into ex from public.exams where id = p_exam;
  if not found then
    raise exception 'Exam not found or not visible to you';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'At most 5000 rows per import';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    errs := '{}';
    v_index := public.jtext(r, 'index_number');
    v_code  := upper(public.jtext(r, 'subject_code'));
    v_marks := public.try_numeric(r ->> 'marks');
    v_student := null; v_subject := null; v_max := null;

    if v_index is null then errs := errs || 'index_number is required'::text; end if;
    if v_code is null then errs := errs || 'subject_code is required'::text; end if;
    if public.jtext(r, 'marks') is null then
      errs := errs || 'marks is required'::text;
    elsif v_marks is null then
      errs := errs || 'marks must be a number'::text;
    end if;

    if v_index is not null then
      select id into v_student from public.profiles
      where index_number = v_index and account_type = 'student' and org_id = ex.org_id;
      if v_student is null then errs := errs || 'no student with this index_number'::text; end if;
    end if;
    if v_code is not null then
      select s.id, es.max_marks into v_subject, v_max
      from public.subjects s
      join public.exam_subjects es on es.subject_id = s.id and es.exam_id = p_exam
      where upper(s.code) = v_code and s.org_id = ex.org_id;
      if v_subject is null then errs := errs || 'subject_code is not part of this exam'::text; end if;
    end if;
    if v_marks is not null and v_max is not null and (v_marks < 0 or v_marks > v_max) then
      errs := errs || ('marks must be between 0 and ' || v_max);
    end if;
    if v_student is not null and v_subject is not null then
      if (v_student::text || v_subject::text) = any (seen) then
        errs := errs || 'same student and subject appear more than once'::text;
      end if;
      seen := seen || (v_student::text || v_subject::text);
    end if;

    if cardinality(errs) > 0 then
      n_err := n_err + 1;
    elsif exists (select 1 from public.student_results where exam_id = p_exam and subject_id = v_subject and student_id = v_student) then
      n_upd := n_upd + 1;
    else
      n_new := n_new + 1;
    end if;

    report := report || jsonb_build_object('row', i, 'key', v_index, 'name', v_code,
      'action', case when cardinality(errs) > 0 then 'error' else 'upsert' end, 'errors', to_jsonb(errs));
    clean := clean || jsonb_build_object('student', v_student, 'subject', v_subject, 'marks', v_marks,
                                         'max', v_max, 'remarks', public.jtext(r, 'remarks'));
  end loop;

  if p_commit and n_err = 0 then
    for c in select value from jsonb_array_elements(clean) loop
      insert into public.student_results (student_id, exam_id, subject_id, exam_name, subject, marks_obtained, max_marks, grade, remarks)
      values ((c ->> 'student')::uuid, p_exam, (c ->> 'subject')::uuid, ex.name, '', (c ->> 'marks')::numeric,
              (c ->> 'max')::numeric, '', c ->> 'remarks')
      on conflict on constraint student_results_exam_subject_student_key do update
        set marks_obtained = excluded.marks_obtained, max_marks = excluded.max_marks,
            remarks = coalesce(excluded.remarks, public.student_results.remarks), grade = '';
    end loop;
  end if;

  return jsonb_build_object('total', i, 'errors', n_err, 'created', n_new, 'updated', n_upd,
                            'committed', p_commit and n_err = 0, 'rows', report);
end $$;

grant execute on function public.import_students(jsonb, boolean), public.import_staff(jsonb, boolean),
  public.import_exam_marks(uuid, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Report datasets (SECURITY INVOKER — RLS scopes every row)
-- ---------------------------------------------------------------------------
create or replace function public.report_student_roster(p_class int default null, p_status text default null)
returns table (
  index_number text, full_name text, class_number int, status text, gender text, date_of_birth date,
  admission_no text, admission_date date, phone text, email text, guardian_name text,
  guardian_relationship text, guardian_phone text, guardian_email text, address text, city text,
  national_id text, blood_group text, previous_school text, is_approved boolean)
language sql stable security invoker set search_path = public as $$
  select p.index_number, p.full_name, p.class_number, coalesce(d.status, 'active'), d.gender, d.date_of_birth,
         d.admission_no, d.admission_date, p.phone, p.email, d.guardian_name, d.guardian_relationship,
         d.guardian_phone, d.guardian_email, d.address, d.city, d.national_id, d.blood_group, d.previous_school,
         p.is_approved
  from public.profiles p
  left join public.student_details d on d.profile_id = p.id
  where p.account_type = 'student'
    and p.org_id = public.current_org_id()
    and (p_class is null or p.class_number = p_class)
    and (p_status is null or coalesce(d.status, 'active') = p_status)
  order by p.class_number nulls last, p.full_name;
$$;

create or replace function public.report_staff_directory(p_status text default null)
returns table (
  employee_no text, full_name text, email text, phone text, account_type text, roles text,
  department text, job_title text, employment_type text, employment_start date, status text, is_approved boolean)
language sql stable security invoker set search_path = public as $$
  select h.employee_no, p.full_name, p.email, p.phone, p.account_type,
         array_to_string(array_remove(array[nullif(p.assigned_tutor_role, 'none')] || p.extra_roles
                                      || case when p.role in ('admin', 'librarian') then array[p.role] else '{}'::text[] end, null), ', '),
         h.department, h.job_title, h.employment_type, h.employment_start, coalesce(h.status, 'active'), p.is_approved
  from public.profiles p
  left join public.staff_hr h on h.profile_id = p.id
  where p.org_id = public.current_org_id()
    and (p.account_type in ('tutor', 'staff') or p.role in ('admin', 'librarian'))
    and (p_status is null or coalesce(h.status, 'active') = p_status)
  order by p.full_name;
$$;

create or replace function public.report_attendance_summary(p_from date, p_to date, p_class int default null)
returns table (
  index_number text, full_name text, class_number int, present int, late int, excused int, absent int,
  marked_days int, attendance_pct numeric)
language sql stable security invoker set search_path = public as $$
  select p.index_number, p.full_name, p.class_number,
         count(*) filter (where a.status = 'present')::int,
         count(*) filter (where a.status = 'late')::int,
         count(*) filter (where a.status = 'excused')::int,
         count(*) filter (where a.status = 'absent')::int,
         count(a.id)::int,
         case when count(a.id) = 0 then null
              else round(100.0 * count(*) filter (where a.status in ('present', 'late')) / count(a.id), 1) end
  from public.profiles p
  left join public.attendance a on a.student_id = p.id and a.date between p_from and p_to
  where p.account_type = 'student' and p.is_approved
    and p.org_id = public.current_org_id()
    and (p_class is null or p.class_number = p_class)
  group by p.id, p.index_number, p.full_name, p.class_number
  order by p.class_number nulls last, p.full_name;
$$;

create or replace function public.report_fee_summary(p_from_month text, p_to_month text, p_class int default null)
returns table (
  index_number text, full_name text, class_number int, invoices int, invoiced numeric, paid numeric,
  outstanding numeric, unpaid_months text)
language sql stable security invoker set search_path = public as $$
  select p.index_number, p.full_name, p.class_number,
         count(f.id)::int,
         coalesce(sum(f.total_due), 0),
         coalesce(sum(f.paid_amount), 0),
         coalesce(sum(greatest(f.total_due - f.paid_amount, 0)), 0),
         string_agg(f.month, ', ' order by f.month) filter (where f.paid_amount < f.total_due)
  from public.profiles p
  join public.student_fees f on f.student_id = p.id
  where p.account_type = 'student'
    and p.org_id = public.current_org_id()
    and f.cancelled_at is null
    and f.month between p_from_month and p_to_month
    and (p_class is null or p.class_number = p_class)
  group by p.id, p.index_number, p.full_name, p.class_number
  -- Output-column names are not in scope inside the body: order by position (7 = outstanding).
  order by 7 desc, 2;
$$;

create or replace function public.report_exam_results(p_exam uuid)
returns table (
  index_number text, full_name text, class_number int, subject_code text, subject text,
  marks_obtained numeric, max_marks numeric, percentage numeric, grade text, remarks text)
language sql stable security invoker set search_path = public as $$
  select p.index_number, p.full_name, p.class_number, s.code, coalesce(s.name_en, r.subject),
         r.marks_obtained, r.max_marks, round(100.0 * r.marks_obtained / nullif(r.max_marks, 0), 1), r.grade, r.remarks
  from public.student_results r
  join public.profiles p on p.id = r.student_id
  left join public.subjects s on s.id = r.subject_id
  where r.exam_id = p_exam
  order by p.class_number nulls last, p.full_name, s.code;
$$;

grant execute on function
  public.report_student_roster(int, text), public.report_staff_directory(text),
  public.report_attendance_summary(date, date, int), public.report_fee_summary(text, text, int),
  public.report_exam_results(uuid)
to authenticated;
