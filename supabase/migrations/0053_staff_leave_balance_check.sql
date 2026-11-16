-- 0053 Paid staff leave cannot exceed the remaining annual entitlement.
--
-- review_staff_leave approved any number of paid-leave days, so a staff member
-- could take more paid leave than staff_leave_types.days_per_year allows and
-- payroll would never deduct it. Approval now checks the balance for the
-- leave's calendar year (days already approved + this request). Unpaid leave
-- types and types with no annual limit (days_per_year = 0) are not capped.
-- Body otherwise identical to 0019.

create or replace function public.review_staff_leave(p_request uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r       record;
  t       record;
  v_used  numeric;
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

  if p_approve then
    select * into t from public.staff_leave_types where id = r.leave_type_id;
    if t.is_paid and coalesce(t.days_per_year, 0) > 0 then
      -- serialize approvals for this person + type so two approvals cannot both pass
      perform pg_advisory_xact_lock(hashtext('staff_leave:' || r.profile_id::text || ':' || r.leave_type_id::text));
      select coalesce(sum(days), 0) into v_used
      from public.staff_leave_requests
      where profile_id = r.profile_id and leave_type_id = r.leave_type_id
        and status = 'approved' and id <> r.id
        and extract(year from start_date) = extract(year from r.start_date);
      if v_used + r.days > t.days_per_year then
        raise exception '% balance exceeded: % of % days already approved for %, this request is % days. Reduce the days or record it as unpaid leave.',
          t.name, v_used, t.days_per_year, extract(year from r.start_date)::int, r.days
          using errcode = '23514';
      end if;
    end if;
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
