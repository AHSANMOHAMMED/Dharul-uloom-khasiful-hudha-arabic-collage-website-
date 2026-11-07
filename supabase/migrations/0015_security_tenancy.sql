-- =============================================================================
-- 0015_security_tenancy.sql
-- Security hardening + SaaS multi-tenancy + RBAC foundation + audit log.
--
-- Fixes (audit findings):
--   * profiles "update own" let any user set role='admin' / is_approved=true.
--   * handle_new_user trusted client metadata (account_type, index_number) and
--     auto-promoted a hard-coded admin e-mail.
--   * is_tutor()/is_treasurer() ignored is_approved — unapproved sign-ups had
--     staff-level read/write on attendance, results, leaves.
--   * parents could link themselves to ANY student (parent_children insert).
--   * enqueue/notify RPCs callable by any user (SMS/e-mail spam, forged notices).
--   * students could grade their own LMS submissions (with check = true).
--   * librarians had full admin power via is_staff() (fees, profiles, roles).
--   * one org admin could edit every organization row.
--   * tutors/treasurer/principal dashboards could not read student profiles.
--
-- Adds:
--   * org-level tenancy: org_id on every tenant table, set by trigger, and a
--     RESTRICTIVE "tenant isolation" policy (AND-ed with existing policies).
--   * role helpers (is_admin, has_staff_role, is_finance_staff, ...).
--   * org_invitations (SaaS onboarding by e-mail), parent_link_requests,
--     audit_logs, document number sequences.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. Organizations: SaaS fields
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists code               text,
  add column if not exists status             text not null default 'active',
  add column if not exists plan               text not null default 'standard',
  add column if not exists max_students       int,
  add column if not exists contact_email      text,
  add column if not exists contact_phone      text,
  add column if not exists address            text,
  add column if not exists country            text not null default 'LK',
  add column if not exists currency           text not null default 'LKR',
  add column if not exists timezone           text not null default 'Asia/Colombo',
  add column if not exists custom_domain      text,
  add column if not exists books_locked_until date,
  add column if not exists settings           jsonb not null default '{}'::jsonb,
  add column if not exists updated_at         timestamptz not null default now();

update public.organizations set code = 'KH' where slug = 'kashiful-hudha' and code is null;
update public.organizations set code = upper(left(regexp_replace(slug, '[^a-zA-Z0-9]', '', 'g'), 6)) where code is null;
alter table public.organizations alter column code set not null;

alter table public.organizations drop constraint if exists organizations_status_check;
alter table public.organizations add constraint organizations_status_check
  check (status in ('trial', 'active', 'suspended', 'archived'));
alter table public.organizations drop constraint if exists organizations_plan_check;
alter table public.organizations add constraint organizations_plan_check
  check (plan in ('free', 'standard', 'premium', 'enterprise'));
create unique index if not exists idx_organizations_code on public.organizations (code);
create unique index if not exists idx_organizations_custom_domain on public.organizations (lower(custom_domain)) where custom_domain is not null;

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Profiles: role model
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'librarian', 'admin', 'super_admin'));

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('guest', 'student', 'parent', 'tutor', 'staff'));

alter table public.profiles drop constraint if exists profiles_assigned_tutor_role_check;
alter table public.profiles add constraint profiles_assigned_tutor_role_check
  check (assigned_tutor_role in (
    'none', 'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
    'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer'));

alter table public.profiles
  add column if not exists extra_roles text[] not null default '{}'::text[];

alter table public.profiles drop constraint if exists profiles_extra_roles_check;
alter table public.profiles add constraint profiles_extra_roles_check
  check (extra_roles <@ array['principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
    'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer']::text[]);

-- ---------------------------------------------------------------------------
-- 3. Role / tenancy helper functions (SECURITY DEFINER: bypass profiles RLS)
-- ---------------------------------------------------------------------------
create or replace function public.default_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.organizations where slug = 'kashiful-hudha' limit 1;
$$;

-- Active tenant of the caller (null when org is suspended/archived).
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.org_id
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid() and o.status in ('trial', 'active');
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
$$;

-- is_staff() historically meant "librarian or admin". It now means
-- "organization administrator"; librarians use is_library_staff().
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
$$;

create or replace function public.has_staff_role(p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_approved
      and account_type in ('tutor', 'staff')
      and (assigned_tutor_role = any (p_roles) or extra_roles && p_roles)
  );
$$;

create or replace function public.is_tutor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_type = 'tutor' and is_approved
  );
$$;

create or replace function public.is_treasurer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_staff_role(array['treasurer']);
$$;

create or replace function public.is_library_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('librarian', 'admin', 'super_admin'))
      or public.has_staff_role(array['librarian']);
$$;

create or replace function public.is_finance_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['treasurer', 'accountant']);
$$;

create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['accountant']);
$$;

create or replace function public.is_hr_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['hr_manager']);
$$;

create or replace function public.is_academic_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['principal', 'vice_principal', 'exam_officer']);
$$;

create or replace function public.is_admissions_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['admissions_officer', 'principal', 'vice_principal']);
$$;

create or replace function public.is_welfare_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['principal', 'vice_principal', 'counselor', 'warden']);
$$;

-- Any approved employee (teaching or non-teaching) or admin.
create or replace function public.is_employee()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and account_type in ('tutor', 'staff') and is_approved
  );
$$;

-- True for service_role / direct DB / cron (no end-user JWT).
create or replace function public.is_privileged_caller()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') not in ('anon', 'authenticated');
$$;

create or replace function public.is_parent_of(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_children
    where parent_id = auth.uid() and child_id = p_student_id
  );
$$;

-- Local "now" for the caller's institution (Supabase runs in UTC).
create or replace function public.org_now()
returns timestamp language sql stable security definer set search_path = public as $$
  select now() at time zone coalesce(
    (select o.timezone from public.organizations o join public.profiles p on p.org_id = o.id where p.id = auth.uid()),
    'Asia/Colombo');
$$;
create or replace function public.org_today()
returns date language sql stable as $$ select public.org_now()::date; $$;

-- Generic: client inserts cannot spoof the author column (TG_ARGV[0]).
create or replace function public.tg_force_author()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], auth.uid()));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Document numbering (receipts, invoices, vouchers…)
-- ---------------------------------------------------------------------------
create table if not exists public.document_sequences (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  doc_type   text not null,
  period     text not null,
  last_value int  not null default 0,
  primary key (org_id, doc_type, period)
);
alter table public.document_sequences enable row level security;  -- no client policies

create or replace function public.next_document_number(p_org uuid, p_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_period text := to_char(now(), 'YYYY');
  v_next   int;
  v_code   text;
begin
  insert into public.document_sequences (org_id, doc_type, period, last_value)
  values (p_org, p_type, v_period, 1)
  on conflict (org_id, doc_type, period)
  do update set last_value = public.document_sequences.last_value + 1
  returning last_value into v_next;

  select code into v_code from public.organizations where id = p_org;
  return format('%s-%s-%s-%s', coalesce(v_code, 'ORG'), p_type, v_period, lpad(v_next::text, 6, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Generic org_id trigger: derive tenant from a referenced row
--    TG_ARGV[0] = column holding a reference (optional)
--    TG_ARGV[1] = referenced table (default 'profiles')
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_org_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref uuid;
  v_org uuid;
begin
  if new.org_id is not null then
    return new;
  end if;
  if tg_nargs > 0 then
    v_ref := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
    if v_ref is not null then
      execute format('select org_id from public.%I where id = $1',
                     case when tg_nargs > 1 then tg_argv[1] else 'profiles' end)
        into v_org using v_ref;
    end if;
  end if;
  new.org_id := coalesce(v_org, public.current_org_id(), public.default_org_id());
  return new;
end;
$$;

-- Tenant-scope a table: column, backfill, index, trigger, restrictive policy.
create or replace function public.apply_tenant_scope(p_table text, p_ref_col text default null, p_ref_table text default 'profiles')
returns void language plpgsql as $$
begin
  execute format('alter table public.%I add column if not exists org_id uuid references public.organizations (id)', p_table);

  if p_ref_col is not null then
    execute format(
      'update public.%1$I t set org_id = r.org_id from public.%2$I r where t.org_id is null and r.id = t.%3$I',
      p_table, p_ref_table, p_ref_col);
  end if;
  execute format('update public.%I set org_id = public.default_org_id() where org_id is null', p_table);
  execute format('alter table public.%I alter column org_id set not null', p_table);
  execute format('create index if not exists %I on public.%I (org_id)', 'idx_' || p_table || '_org', p_table);

  execute format('drop trigger if exists trg_%1$s_org on public.%1$I', p_table);
  if p_ref_col is not null then
    execute format(
      'create trigger trg_%1$s_org before insert on public.%1$I for each row execute function public.tg_set_org_id(%2$L, %3$L)',
      p_table, p_ref_col, p_ref_table);
  else
    execute format(
      'create trigger trg_%1$s_org before insert on public.%1$I for each row execute function public.tg_set_org_id()',
      p_table);
  end if;

  execute format('drop policy if exists "tenant isolation" on public.%I', p_table);
  execute format(
    'create policy "tenant isolation" on public.%I as restrictive for all to authenticated
       using (org_id = (select public.current_org_id()) or (select public.is_super_admin()))
       with check (org_id = (select public.current_org_id()) or (select public.is_super_admin()))',
    p_table);
end;
$$;
revoke all on function public.apply_tenant_scope(text, text, text) from public, anon, authenticated;

-- org-wide or self-referencing tables
select public.apply_tenant_scope('valid_index_numbers');
select public.apply_tenant_scope('admissions', 'submitted_by');
select public.apply_tenant_scope('news');
select public.apply_tenant_scope('faculty');
select public.apply_tenant_scope('curriculum');
select public.apply_tenant_scope('contact_messages');
select public.apply_tenant_scope('gallery_items');
select public.apply_tenant_scope('course_programs');
select public.apply_tenant_scope('events');
select public.apply_tenant_scope('import_jobs');
select public.apply_tenant_scope('parent_invites', 'admission_id', 'admissions');
select public.apply_tenant_scope('admission_notes', 'admission_id', 'admissions');
select public.apply_tenant_scope('admission_status_history', 'admission_id', 'admissions');
-- student-owned
select public.apply_tenant_scope('attendance', 'student_id');
select public.apply_tenant_scope('leave_requests', 'student_id');
select public.apply_tenant_scope('student_results', 'student_id');
select public.apply_tenant_scope('student_fees', 'student_id');
select public.apply_tenant_scope('payment_transactions', 'student_id');
select public.apply_tenant_scope('lms_submissions', 'student_id');
select public.apply_tenant_scope('parent_children', 'parent_id');
-- staff-owned
select public.apply_tenant_scope('tutor_salaries', 'tutor_id');
select public.apply_tenant_scope('tutor_jobs', 'tutor_id');
select public.apply_tenant_scope('class_schedules', 'tutor_id');
select public.apply_tenant_scope('lms_materials', 'tutor_id');
select public.apply_tenant_scope('lms_assignments', 'tutor_id');
select public.apply_tenant_scope('announcements', 'author_id');
select public.apply_tenant_scope('staff_hr', 'profile_id');
-- user-owned
select public.apply_tenant_scope('notifications', 'user_id');
select public.apply_tenant_scope('message_outbox', 'user_id');
select public.apply_tenant_scope('push_subscriptions', 'user_id');
select public.apply_tenant_scope('activation_events', 'profile_id');

drop trigger if exists trg_admission_notes_author on public.admission_notes;
create trigger trg_admission_notes_author before insert on public.admission_notes
  for each row execute function public.tg_force_author('author_id');

-- curriculum class is unique per org, not globally
alter table public.curriculum drop constraint if exists curriculum_class_number_key;
create unique index if not exists idx_curriculum_org_class on public.curriculum (org_id, class_number);

-- profiles: own row always visible (even when org suspended)
update public.profiles set org_id = public.default_org_id() where org_id is null;
alter table public.profiles alter column org_id set not null;
create index if not exists idx_profiles_org on public.profiles (org_id);
drop policy if exists "tenant isolation" on public.profiles;
create policy "tenant isolation" on public.profiles as restrictive for all to authenticated
  using (id = auth.uid() or org_id = (select public.current_org_id()) or (select public.is_super_admin()))
  with check (id = auth.uid() or org_id = (select public.current_org_id()) or (select public.is_super_admin()));

-- Directory: employees see colleagues/students of their org; parents see linked
-- children; students see their linked parents.
drop policy if exists "profiles: org directory" on public.profiles;
create policy "profiles: org directory"
  on public.profiles for select to authenticated
  using (
    public.is_employee()
    or public.is_parent_of(id)
    or exists (select 1 from public.parent_children pc where pc.child_id = auth.uid() and pc.parent_id = profiles.id)
  );

-- ---------------------------------------------------------------------------
-- 6. Profile privilege guard (fixes self-promotion to admin)
-- ---------------------------------------------------------------------------
create or replace function public.tg_profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  -- service_role / SECURITY DEFINER functions / migrations are trusted
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;

  if public.is_admin() then
    if new.role = 'super_admin' and old.role is distinct from 'super_admin' then
      raise exception 'Only a platform super admin can grant super_admin' using errcode = '42501';
    end if;
    if new.org_id is distinct from old.org_id then
      raise exception 'Users cannot be moved between organizations' using errcode = '42501';
    end if;
    if old.id = auth.uid() and new.role is distinct from old.role then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.role, new.account_type, new.is_approved, new.assigned_tutor_role, new.extra_roles,
      new.index_number, new.class_number, new.org_id, new.email)
     is distinct from
     (old.role, old.account_type, old.is_approved, old.assigned_tutor_role, old.extra_roles,
      old.index_number, old.class_number, old.org_id, old.email) then
    raise exception 'Not allowed to change role, approval, class or organization fields' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.tg_profiles_guard();

-- ---------------------------------------------------------------------------
-- 7. Organization invitations (SaaS onboarding)
-- ---------------------------------------------------------------------------
create table if not exists public.org_invitations (
  id                  uuid primary key default extensions.gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  email               text not null,
  full_name           text,
  account_type        text not null default 'staff'
                      check (account_type in ('guest', 'student', 'parent', 'tutor', 'staff')),
  role                text not null default 'user' check (role in ('user', 'librarian', 'admin')),
  assigned_tutor_role text not null default 'none',
  extra_roles         text[] not null default '{}'::text[],
  token               text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  invited_by          uuid references public.profiles (id) on delete set null,
  expires_at          timestamptz not null default (now() + interval '14 days'),
  accepted_at         timestamptz,
  accepted_by         uuid references public.profiles (id) on delete set null,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_org_invitations_email on public.org_invitations (lower(email));
alter table public.org_invitations enable row level security;

drop trigger if exists trg_org_invitations_org on public.org_invitations;
create trigger trg_org_invitations_org before insert on public.org_invitations
  for each row execute function public.tg_set_org_id();

drop policy if exists "org_invitations: admin manage" on public.org_invitations;
create policy "org_invitations: admin manage" on public.org_invitations for all to authenticated
  using ((org_id = (select public.current_org_id()) and (public.is_admin() or public.is_hr_staff())) or public.is_super_admin())
  with check ((org_id = (select public.current_org_id()) and (public.is_admin() or public.is_hr_staff())) or public.is_super_admin());

-- HR managers may invite employees, but not admins.
create or replace function public.tg_org_invitations_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() and new.role <> 'user' then
    raise exception 'Only administrators can invite administrators or librarians' using errcode = '42501';
  end if;
  new.invited_by := coalesce(new.invited_by, auth.uid());
  return new;
end;
$$;
drop trigger if exists trg_org_invitations_guard on public.org_invitations;
create trigger trg_org_invitations_guard before insert or update on public.org_invitations
  for each row execute function public.tg_org_invitations_guard();

-- ---------------------------------------------------------------------------
-- 8. Signup trigger: trust nothing privileged from client metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type      text  := coalesce(nullif(meta ->> 'account_type', ''), 'guest');
  v_index     text  := nullif(trim(coalesce(meta ->> 'index_number', '')), '');
  v_org       uuid;
  v_class     int;
  v_approved  boolean;
  v_role      text := 'user';
  v_assigned  text := 'none';
  v_extra     text[] := '{}'::text[];
  v_inv_id    uuid;
  inv         record;
  idx         record;
begin
  if v_type not in ('guest', 'student', 'parent', 'tutor', 'staff') then
    v_type := 'guest';
  end if;

  select * into inv
  from public.org_invitations
  where lower(email) = lower(new.email)
    and accepted_at is null and revoked_at is null and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    v_inv_id   := inv.id;
    v_org      := inv.org_id;
    v_type     := inv.account_type;
    v_role     := inv.role;
    v_assigned := inv.assigned_tutor_role;
    v_extra    := inv.extra_roles;
    v_approved := true;
  else
    select id into v_org from public.organizations
    where slug = nullif(meta ->> 'org_slug', '') and status in ('trial', 'active');
    v_org := coalesce(v_org, public.default_org_id());
    v_approved := v_type in ('guest', 'parent');
  end if;

  if v_type = 'student' then
    if v_index is null then
      raise exception 'Index number is required for student accounts';
    end if;
    select * into idx from public.valid_index_numbers where index_number = v_index for update;
    if not found or idx.is_registered then
      raise exception 'Invalid or already registered index number';
    end if;
    v_org   := idx.org_id;
    v_class := idx.class_number;
    if v_inv_id is null then
      v_approved := false;
    end if;
  else
    v_index := null;
  end if;

  insert into public.profiles (id, email, full_name, account_type, is_approved, index_number,
                               class_number, phone, org_id, role, assigned_tutor_role, extra_roles)
  values (
    new.id,
    new.email,
    coalesce(nullif(meta ->> 'full_name', ''), inv.full_name, ''),
    v_type,
    v_approved,
    v_index,
    v_class,
    nullif(meta ->> 'phone', ''),
    v_org,
    v_role,
    v_assigned,
    v_extra
  )
  on conflict (id) do nothing;

  if v_inv_id is not null then
    update public.org_invitations set accepted_at = now(), accepted_by = new.id where id = v_inv_id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Organizations policies (admin edits only own org; SaaS fields super admin)
-- ---------------------------------------------------------------------------
drop policy if exists "organizations: staff write" on public.organizations;
drop policy if exists "organizations: admin update own" on public.organizations;
drop policy if exists "organizations: super admin manage" on public.organizations;

create policy "organizations: admin update own" on public.organizations for update to authenticated
  using (id = (select public.current_org_id()) and public.is_admin())
  with check (id = (select public.current_org_id()) and public.is_admin());

create policy "organizations: super admin manage" on public.organizations for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.tg_organizations_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_super_admin() then
    return new;
  end if;
  if (new.slug, new.code, new.status, new.plan, new.max_students, new.custom_domain)
     is distinct from
     (old.slug, old.code, old.status, old.plan, old.max_students, old.custom_domain) then
    raise exception 'Subscription fields can only be changed by the platform operator' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_organizations_guard on public.organizations;
create trigger trg_organizations_guard before update on public.organizations
  for each row execute function public.tg_organizations_guard();

-- ---------------------------------------------------------------------------
-- 10. Library: librarians keep catalog powers via is_library_staff()
-- ---------------------------------------------------------------------------
drop policy if exists "Public users can view books" on public.books;
drop policy if exists "Admins can manage books" on public.books;

do $$
declare
  pol record;
  v_sql text;
begin
  for pol in
    select * from pg_policies
    where (
        (schemaname = 'public' and tablename in ('authors', 'categories', 'books', 'book_authors',
            'book_categories', 'book_pages', 'bookmarks', 'reads', 'user_notes', 'favorites', 'import_jobs'))
        or (schemaname = 'storage' and tablename = 'objects'
            and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'bucket_id = ''(books|covers)''')
      )
      and policyname <> 'tenant isolation'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%is_staff()%'
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    v_sql := format('create policy %I on %I.%I as %s for %s to %s',
                    pol.policyname, pol.schemaname, pol.tablename, pol.permissive, pol.cmd,
                    array_to_string(pol.roles, ', '));
    if pol.qual is not null then
      v_sql := v_sql || ' using (' || replace(pol.qual, 'is_staff()', 'is_library_staff()') || ')';
    end if;
    if pol.with_check is not null then
      v_sql := v_sql || ' with check (' || replace(pol.with_check, 'is_staff()', 'is_library_staff()') || ')';
    end if;
    execute v_sql;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Parent ↔ child linking (fixes "link any student")
-- ---------------------------------------------------------------------------
drop policy if exists "parent_children: parent insert own" on public.parent_children;

create table if not exists public.parent_link_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  parent_id     uuid not null references public.profiles (id) on delete cascade,
  child_index   text not null,
  child_id      uuid references public.profiles (id) on delete cascade,
  relationship  text not null default 'guardian'
                check (relationship in ('father', 'mother', 'guardian', 'other')),
  note          text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists idx_parent_link_requests_pending
  on public.parent_link_requests (parent_id, child_index) where status = 'pending';
alter table public.parent_link_requests enable row level security;

drop policy if exists "parent_link_requests: parent read own" on public.parent_link_requests;
create policy "parent_link_requests: parent read own" on public.parent_link_requests for select to authenticated
  using (parent_id = auth.uid() or public.is_admin() or public.is_admissions_staff());

drop policy if exists "tenant isolation" on public.parent_link_requests;
create policy "tenant isolation" on public.parent_link_requests as restrictive for all to authenticated
  using (org_id = (select public.current_org_id()) or (select public.is_super_admin()))
  with check (org_id = (select public.current_org_id()) or (select public.is_super_admin()));

-- Parent asks to link a child by index. Auto-approves when the parent's verified
-- phone/e-mail matches the enrolment record of that index; otherwise queued.
create or replace function public.request_child_link(p_index text, p_relationship text default 'guardian', p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me     record;
  child  record;
  v_auto boolean := false;
  v_id   uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.account_type <> 'parent' then
    raise exception 'Only parent accounts can link children' using errcode = '42501';
  end if;

  select id, full_name, org_id into child from public.profiles
  where index_number = trim(p_index) and account_type = 'student' and org_id = me.org_id;

  if exists (select 1 from public.parent_children where parent_id = me.id and child_id = child.id) then
    return jsonb_build_object('ok', true, 'status', 'already_linked');
  end if;

  select exists (
    select 1 from public.admissions a
    where a.enrolled_index = trim(p_index) and a.org_id = me.org_id
      and (
        (coalesce(me.phone, '') <> '' and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(me.phone, '\D', '', 'g'))
        or (coalesce(me.email, '') <> '' and lower(a.email) = lower(me.email))
      )
  ) into v_auto;

  if v_auto and child.id is not null then
    insert into public.parent_children (parent_id, child_id, org_id)
    values (me.id, child.id, me.org_id) on conflict (parent_id, child_id) do nothing;
    insert into public.parent_link_requests (org_id, parent_id, child_index, child_id, relationship, note, status, reviewed_at)
    values (me.org_id, me.id, trim(p_index), child.id, coalesce(p_relationship, 'guardian'), p_note, 'approved', now());
    insert into public.activation_events (profile_id, event_type, summary, details, org_id)
    values (child.id, 'linked_parent', format('Parent %s linked (verified contact)', coalesce(me.full_name, me.email)),
            jsonb_build_object('parent_id', me.id), me.org_id);
    return jsonb_build_object('ok', true, 'status', 'linked', 'child_name', child.full_name);
  end if;

  insert into public.parent_link_requests (org_id, parent_id, child_index, child_id, relationship, note)
  values (me.org_id, me.id, trim(p_index), child.id, coalesce(p_relationship, 'guardian'), p_note)
  on conflict (parent_id, child_index) where status = 'pending' do update set note = excluded.note
  returning id into v_id;

  return jsonb_build_object('ok', true, 'status', 'pending', 'request_id', v_id);
end;
$$;

create or replace function public.review_child_link(p_request_id uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  req   record;
  v_child uuid;
begin
  if not (public.is_admin() or public.is_admissions_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into req from public.parent_link_requests
  where id = p_request_id and org_id = public.current_org_id() and status = 'pending' for update;
  if not found then
    raise exception 'Request not found';
  end if;

  v_child := coalesce(req.child_id, (select id from public.profiles
     where index_number = req.child_index and account_type = 'student' and org_id = req.org_id));

  if p_approve and v_child is null then
    raise exception 'Student with index % has not registered yet', req.child_index;
  end if;

  update public.parent_link_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      child_id = v_child, reviewed_by = auth.uid(), reviewed_at = now()
  where id = req.id;

  if p_approve then
    insert into public.parent_children (parent_id, child_id, org_id)
    values (req.parent_id, v_child, req.org_id) on conflict (parent_id, child_id) do nothing;
    insert into public.notifications (user_id, title, message, org_id)
    values (req.parent_id, 'Child linked', format('Your request to link index %s was approved.', req.child_index), req.org_id);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.request_child_link(text, text, text) to authenticated;
grant execute on function public.review_child_link(uuid, boolean) to authenticated;

-- Student leave: a parent may only file for a LINKED child (was: any student
-- as long as parent_id = auth.uid()).
drop policy if exists "leaves: parent or student insert" on public.leave_requests;
create policy "leaves: parent or student insert" on public.leave_requests for insert to authenticated
  with check (
    (student_id = auth.uid() and parent_id is null)
    or (public.is_parent_of(student_id) and parent_id = auth.uid())
  );
drop policy if exists "leaves: owner update pending" on public.leave_requests;
create policy "leaves: owner update pending" on public.leave_requests for update to authenticated
  using ((student_id = auth.uid() or (parent_id = auth.uid() and public.is_parent_of(student_id))) and status = 'pending')
  with check (student_id = auth.uid() or (parent_id = auth.uid() and public.is_parent_of(student_id)));

-- Invite claim: the student must belong to the invite's organization.
create or replace function public.claim_parent_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv record;
  v_student uuid;
  v_me record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.account_type <> 'parent' then
    return jsonb_build_object('ok', false, 'error', 'Only parent accounts can claim invites');
  end if;
  select * into inv from public.parent_invites
  where token = p_token and claimed_by is null and expires_at > now() for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired invite');
  end if;
  if inv.org_id is distinct from v_me.org_id then
    return jsonb_build_object('ok', false, 'error', 'Invite belongs to another institution');
  end if;
  select id into v_student from public.profiles
  where index_number = inv.child_index and account_type = 'student' and org_id = inv.org_id
  limit 1;
  if v_student is null then
    return jsonb_build_object('ok', false,
      'error', 'Student has not registered yet. Link by index after the student creates an account.',
      'child_index', inv.child_index);
  end if;
  insert into public.parent_children (parent_id, child_id, org_id)
  values (auth.uid(), v_student, inv.org_id) on conflict (parent_id, child_id) do nothing;
  update public.parent_invites set claimed_by = auth.uid(), claimed_at = now() where id = inv.id;
  insert into public.activation_events (profile_id, event_type, summary, details, org_id)
  values (v_student, 'linked_parent', format('Parent linked via invite for %s', coalesce(inv.child_name, inv.child_index)),
          jsonb_build_object('parent_id', auth.uid()), inv.org_id);
  return jsonb_build_object('ok', true, 'child_id', v_student, 'child_index', inv.child_index);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Account approval RPC (admin; principal/VP for tutors, students, staff)
-- ---------------------------------------------------------------------------
create or replace function public.approve_account(p_profile_id uuid, p_approve boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target record;
begin
  select * into target from public.profiles where id = p_profile_id;
  if not found or (target.org_id <> public.current_org_id() and not public.is_super_admin()) then
    raise exception 'Account not found';
  end if;
  if not (public.is_admin()
          or (public.has_staff_role(array['principal', 'vice_principal'])
              and target.account_type in ('tutor', 'student', 'staff') and target.role = 'user')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.profiles set is_approved = p_approve where id = p_profile_id;
  insert into public.activation_events (profile_id, event_type, summary, details, org_id)
  values (p_profile_id, case when p_approve then 'approved' else 'rejected' end,
          format('%s %s', coalesce(target.full_name, target.email), case when p_approve then 'approved' else 'rejected' end),
          jsonb_build_object('by', auth.uid()), target.org_id);
  if p_approve then
    perform public.notify_profile_activated(p_profile_id);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.approve_account(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Messaging RPCs: internal only / staff only
-- ---------------------------------------------------------------------------
revoke all on function public.enqueue_user_messages(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_user_messages(uuid, text, text, jsonb) to service_role;

create or replace function public.assert_can_notify()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_privileged_caller() then
    return;
  end if;
  if not (public.is_admin() or public.has_staff_role(array['principal', 'vice_principal', 'treasurer',
          'accountant', 'hr_manager', 'admissions_officer'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Wrap the existing notify RPCs with an authorization check.
alter function public.notify_payment_received(uuid, numeric, uuid, text) rename to _notify_payment_received;
alter function public.notify_profile_activated(uuid) rename to _notify_profile_activated;
revoke all on function public._notify_payment_received(uuid, numeric, uuid, text) from public, anon, authenticated;
revoke all on function public._notify_profile_activated(uuid) from public, anon, authenticated;

create or replace function public.notify_payment_received(
  p_student_id uuid, p_amount numeric, p_fee_id uuid default null, p_receipt_no text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_can_notify();
  if not public.is_privileged_caller()
     and not exists (select 1 from public.profiles where id = p_student_id and org_id = public.current_org_id()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public._notify_payment_received(p_student_id, p_amount, p_fee_id, p_receipt_no);
end;
$$;

create or replace function public.notify_profile_activated(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_can_notify();
  if not public.is_privileged_caller()
     and not exists (select 1 from public.profiles where id = p_profile_id and org_id = public.current_org_id()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public._notify_profile_activated(p_profile_id);
end;
$$;
grant execute on function public.notify_payment_received(uuid, numeric, uuid, text) to authenticated, service_role;
grant execute on function public.notify_profile_activated(uuid) to authenticated, service_role;

-- notifications: only employees can create, and only for users of their org
drop policy if exists "notifications: staff write" on public.notifications;
create policy "notifications: staff write" on public.notifications for insert to authenticated
  with check (public.is_employee());

-- ---------------------------------------------------------------------------
-- 14. LMS: students cannot grade themselves / re-assign submissions
-- ---------------------------------------------------------------------------
create or replace function public.tg_lms_submission_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if exists (select 1 from public.lms_assignments a where a.id = new.assignment_id and a.tutor_id = auth.uid()) then
    if tg_op = 'UPDATE' and (new.student_id, new.assignment_id, new.content, new.file_url)
       is distinct from (old.student_id, old.assignment_id, old.content, old.file_url) then
      raise exception 'Tutors may only grade submissions' using errcode = '42501';
    end if;
    return new;
  end if;
  -- student path
  if new.student_id <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.grade := null;
    new.feedback := null;
  elsif (new.grade, new.feedback, new.assignment_id, new.student_id)
        is distinct from (old.grade, old.feedback, old.assignment_id, old.student_id) then
    raise exception 'Students cannot change grades or feedback' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_lms_submission_guard on public.lms_submissions;
create trigger trg_lms_submission_guard before insert or update on public.lms_submissions
  for each row execute function public.tg_lms_submission_guard();

-- ---------------------------------------------------------------------------
-- 15. Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id             bigint generated always as identity primary key,
  org_id         uuid,
  table_name     text not null,
  record_id      text,
  action         text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id       uuid,
  actor_role     text,
  changed_fields text[],
  old_data       jsonb,
  new_data       jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_audit_logs_org_created on public.audit_logs (org_id, created_at desc);
create index if not exists idx_audit_logs_record on public.audit_logs (table_name, record_id);
alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs: admin read" on public.audit_logs;
create policy "audit_logs: admin read" on public.audit_logs for select to authenticated
  using ((org_id = (select public.current_org_id()) and (public.is_admin() or public.has_staff_role(array['accountant'])))
         or public.is_super_admin());

create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k) into v_changed
    from jsonb_object_keys(v_new) k
    where v_new -> k is distinct from v_old -> k and k not in ('updated_at');
    if v_changed is null then
      return new;
    end if;
  end if;

  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role,
                                 changed_fields, old_data, new_data)
  values (
    coalesce((v_row ->> 'org_id')::uuid, case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid end),
    tg_table_name,
    v_row ->> 'id',
    tg_op,
    auth.uid(),
    coalesce(auth.jwt() ->> 'role', current_user::text),
    v_changed,
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.attach_audit(p_table text)
returns void language plpgsql as $$
begin
  execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', p_table);
  execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                  for each row execute function public.tg_audit()', p_table);
end;
$$;
revoke all on function public.attach_audit(text) from public, anon, authenticated;

select public.attach_audit(t) from unnest(array[
  'profiles', 'organizations', 'student_fees', 'payment_transactions', 'tutor_salaries',
  'staff_hr', 'valid_index_numbers', 'parent_children', 'org_invitations', 'student_results'
]) t;

-- Internal helpers must never be callable through the REST API.
revoke all on function public.next_document_number(uuid, text) from public, anon, authenticated;
revoke all on function public.tg_set_org_id() from public, anon, authenticated;
revoke all on function public.tg_audit() from public, anon, authenticated;
