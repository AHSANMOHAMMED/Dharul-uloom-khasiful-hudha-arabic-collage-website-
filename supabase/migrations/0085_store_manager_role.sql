-- Add the store_manager duty introduced by 0081 to the profile role allowlists.
create or replace function public.mfa_sensitive_roles()
returns text[] language sql immutable as $$
  select array['treasurer', 'accountant', 'principal', 'vice_principal',
               'exam_officer', 'hr_manager', 'store_manager'];
$$;

create or replace function public.is_store_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and (
    public.is_admin()
    or public.is_finance_viewer()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.org_id = public.current_org_id()
        and p.is_approved
        and (
          p.assigned_tutor_role in ('principal', 'vice_principal', 'warden', 'treasurer', 'store_manager')
          or 'store_manager' = any(coalesce(p.extra_roles, '{}'::text[]))
          or 'warden' = any(coalesce(p.extra_roles, '{}'::text[]))
        )
    )
    or exists (
      select 1
      from public.duty_assignments da
      join public.duty_roles dr on dr.id = da.duty_role_id
      where da.assignee_id = auth.uid()
        and da.status = 'active'
        and dr.org_id = public.current_org_id()
        and dr.code in ('store_manager', 'warden', 'principal', 'vice_principal')
    )
  );
$$;

alter table public.profiles drop constraint if exists profiles_assigned_tutor_role_check;
alter table public.profiles add constraint profiles_assigned_tutor_role_check
  check (assigned_tutor_role in (
    'none', 'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
    'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer',
    'it_officer', 'store_manager'
  ));

alter table public.profiles drop constraint if exists profiles_extra_roles_check;
alter table public.profiles add constraint profiles_extra_roles_check
  check (extra_roles <@ array[
    'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
    'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer',
    'it_officer', 'store_manager'
  ]::text[]);
