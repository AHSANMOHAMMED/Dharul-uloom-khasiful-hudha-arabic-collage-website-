-- Wire approved break-glass grants into elevated read policies (time-boxed).
-- Production use still Needs institutional policy (see docs/PRIVACY_PDPA.md).
set search_path = public, extensions, pg_temp;

-- Access check is read-only (stable). Expiry is enforced by expires_at;
-- expire_break_glass() persists status flips for audit/UI.
create or replace function public.has_active_break_glass(p_scope text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.break_glass_requests
    where requester_id = auth.uid()
      and org_id = public.current_org_id()
      and status = 'approved'
      and expires_at > now()
      and (
        p_scope is null
        or scope = 'read_all'
        or scope = p_scope
      )
  );
$$;

-- Finance elevated read
drop policy if exists "fees: break-glass read" on public.student_fees;
create policy "fees: break-glass read" on public.student_fees for select to authenticated
  using (public.has_active_break_glass('read_finance'));

drop policy if exists "fee_payments: break-glass read" on public.fee_payments;
create policy "fee_payments: break-glass read" on public.fee_payments for select to authenticated
  using (public.has_active_break_glass('read_finance'));

-- Welfare elevated read (including confidential)
drop policy if exists "welfare_cases: break-glass read" on public.welfare_cases;
create policy "welfare_cases: break-glass read" on public.welfare_cases for select to authenticated
  using (public.has_active_break_glass('read_welfare'));

drop policy if exists "welfare_notes: break-glass read" on public.welfare_notes;
create policy "welfare_notes: break-glass read" on public.welfare_notes for select to authenticated
  using (public.has_active_break_glass('read_welfare'));

-- Student identity / details elevated read for non-employee edge cases (e.g. limited staff hats)
drop policy if exists "profiles: break-glass student read" on public.profiles;
create policy "profiles: break-glass student read" on public.profiles for select to authenticated
  using (
    public.has_active_break_glass('read_student_records')
    and coalesce(account_type, '') = 'student'
  );

drop policy if exists "student_details: break-glass read" on public.student_details;
create policy "student_details: break-glass read" on public.student_details for select to authenticated
  using (public.has_active_break_glass('read_student_records'));

grant execute on function public.has_active_break_glass(text) to authenticated;
