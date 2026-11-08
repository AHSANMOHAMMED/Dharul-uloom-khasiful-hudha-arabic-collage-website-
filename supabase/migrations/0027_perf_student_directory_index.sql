-- =============================================================================
-- 0027_perf_student_directory_index.sql
-- Performance optimization for student directory queries and RLS policy evaluation.
--
-- Bottleneck addressed:
--   Concurrent requests from tutors querying:
--     /profiles?select=id,full_name,index_number,class_number&account_type=eq.student&class_number=eq.N&order=full_name
--   under 30-way load previously took 5+ seconds due to:
--     1) Lack of composite index on (account_type, class_number, full_name).
--     2) Per-row execution of unwrapped security definer functions in RLS policies.
--     3) Redundant legacy permissive policy 'profiles: read own or staff' from 0002_rls.sql.
-- =============================================================================

-- 1. Fast composite indexes for directory lookups and ordering
create index if not exists idx_profiles_student_directory
  on public.profiles (account_type, class_number, full_name)
  include (id, index_number, org_id);

create index if not exists idx_profiles_org_student_dir
  on public.profiles (org_id, account_type, class_number, full_name);

-- 2. Streamlined is_employee() helper: single indexed primary key check
create or replace function public.is_employee()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('admin', 'super_admin') or (account_type in ('tutor', 'staff') and is_approved))
  );
$$;

grant execute on function public.is_employee() to authenticated, anon;

-- 3. Replace redundant/unwrapped policies on public.profiles with cached InitPlan subqueries
drop policy if exists "profiles: read own or staff" on public.profiles;
drop policy if exists "profiles: org directory" on public.profiles;

create policy "profiles: org directory"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_employee())
    or public.is_parent_of(id)
    or exists (
      select 1 from public.parent_children pc
      where pc.child_id = (select auth.uid()) and pc.parent_id = profiles.id
    )
  );

drop policy if exists "tenant isolation" on public.profiles;
create policy "tenant isolation"
  on public.profiles as restrictive for all to authenticated
  using (
    id = (select auth.uid())
    or org_id = (select public.current_org_id())
    or (select public.is_super_admin())
  )
  with check (
    id = (select auth.uid())
    or org_id = (select public.current_org_id())
    or (select public.is_super_admin())
  );
