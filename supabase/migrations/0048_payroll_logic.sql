-- 0048 Payroll logic fixes (audit 2026-11)
--
-- 1. adjust_payslip refreshed the run's gross/deductions/net but NOT
--    total_employer. Adding an EPF/ETF-eligible earning (DAY_SHIFT,
--    LECTURE_PAY, RAMADAN_PAY, COLA ...) makes the 0028 statutory trigger raise
--    the payslip's EPF 12% / ETF 3%, so approve_payroll then posted
--    "5110 Employer EPF/ETF" from the stale run total and the accrual journal
--    was unbalanced: the run could never be approved.
--    approve_payroll now also recomputes the run totals from its payslips
--    before posting, so any stale run (existing data) heals on approval.
-- 2. generate_payroll capped advance recoveries using EPF on basic salary only
--    (and the raw configured rates), while the 0028 trigger then charged EPF on
--    basic + EPF-eligible earnings at the statutory minimum rates. A staff
--    member with allowances and an advance could end with net < 0 and the
--    WHOLE payroll generation failed with "payslips_net_check". The engine
--    now uses the same base and rates as the trigger.
-- 3. Absences / half days marked in the staff attendance register on a day
--    already covered by approved leave were deducted again (an approved
--    no-pay day marked "absent" was docked twice; an approved paid-leave day
--    marked "absent" was docked once). Only absences outside approved leave
--    now reduce pay.
-- 4. A zero working_days payroll setting divided by zero.
-- 5. approve_payroll fails with a clear message (instead of a check-constraint
--    error) when a draft would recover more than an advance still owes, e.g.
--    after another month's run already recovered it.
-- 6. Payment / advance journal dates use the institution's local date
--    (Asia/Colombo via org_today) rather than the server's UTC date.
-- 7. Leave requests can no longer claim more days than the date range spans
--    (those extra days inflated unpaid-leave deductions). NOT VALID so
--    historical rows are untouched.

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Run totals helper
-- ---------------------------------------------------------------------------
create or replace function public._refresh_payroll_run_totals(p_run uuid)
returns void language sql security definer set search_path = public as $$
  update public.payroll_runs r set
    total_gross = coalesce((select sum(gross) from public.payslips where run_id = r.id), 0),
    total_deductions = coalesce((select sum(total_deductions) from public.payslips where run_id = r.id), 0),
    total_net = coalesce((select sum(net) from public.payslips where run_id = r.id), 0),
    total_employer = coalesce((select sum(employer_total) from public.payslips where run_id = r.id), 0),
    staff_count = (select count(*) from public.payslips where run_id = r.id)
  where r.id = p_run;
$$;
revoke all on function public._refresh_payroll_run_totals(uuid) from public, anon, authenticated;

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
  v_epf_extra numeric;
  v_etf_extra numeric;
  v_epf_base numeric;
  v_etf_base numeric;
  v_epf_amt numeric;
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
  if coalesce(v_working, 0) <= 0 then
    v_working := 26;
  end if;
  -- same statutory floors as tg_payslip_statutory_calculation (0028)
  v_epf_ee := greatest(public.payroll_setting(v_org, 'epf_employee', 8), 8);
  v_epf_er := greatest(public.payroll_setting(v_org, 'epf_employer', 12), 12);
  v_etf    := greatest(public.payroll_setting(v_org, 'etf_employer', 3), 3);

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
    v_epf_extra := 0;
    v_etf_extra := 0;

    for c in select * from jsonb_array_elements(sp.components) loop
      select * into v_comp from public.salary_components where org_id = v_org and code = c ->> 'code' and is_active;
      if v_comp.id is null or coalesce((c ->> 'amount')::numeric, 0) = 0 then
        continue;
      end if;
      if v_comp.kind = 'earning' then
        v_earn := v_earn || jsonb_build_object('code', v_comp.code, 'name', v_comp.name, 'amount', round((c ->> 'amount')::numeric, 2));
        v_gross := v_gross + round((c ->> 'amount')::numeric, 2);
        if v_comp.epf_eligible then v_epf_extra := v_epf_extra + round((c ->> 'amount')::numeric, 2); end if;
        if v_comp.etf_eligible then v_etf_extra := v_etf_extra + round((c ->> 'amount')::numeric, 2); end if;
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
    -- absences on a day already covered by approved leave are not docked again
    v_unpaid_days := v_unpaid_days + coalesce((
      select count(*) filter (where status = 'absent') + 0.5 * count(*) filter (where status = 'half_day')
      from public.staff_attendance a
      where a.profile_id = sp.profile_id and a.date between v_start and v_end
        and not exists (
          select 1 from public.staff_leave_requests lr
          where lr.profile_id = a.profile_id and lr.status = 'approved'
            and a.date between lr.start_date and lr.end_date)), 0);
    v_unpaid_days := round(least(v_unpaid_days, v_working), 1);
    v_unpaid_amt := least(round(sp.basic_salary / v_working * v_unpaid_days, 2), sp.basic_salary);
    if v_unpaid_amt > 0 then
      v_earn := v_earn || jsonb_build_object('code', 'UNPAID', 'name', format('Unpaid leave/absence (%s days)', v_unpaid_days),
                                             'amount', -v_unpaid_amt);
      v_gross := v_gross - v_unpaid_amt;
    end if;

    -- statutory: same base as the 0028 trigger (basic + eligible earnings - unpaid)
    if sp.epf_applicable then
      v_epf_base := round(greatest(sp.basic_salary + v_epf_extra - v_unpaid_amt, 0), 2);
      v_etf_base := round(greatest(sp.basic_salary + v_etf_extra - v_unpaid_amt, 0), 2);
      v_epf_amt := round(v_epf_base * v_epf_ee / 100, 2);
      if v_epf_amt > 0 then
        v_ded := v_ded || jsonb_build_object('code', 'EPF_EE', 'name', format('EPF Employee (%s%%)', v_epf_ee),
                                             'amount', v_epf_amt);
      end if;
      if round(v_epf_base * v_epf_er / 100, 2) > 0 then
        v_emp := v_emp || jsonb_build_object('code', 'EPF_ER', 'name', format('EPF Employer (%s%%)', v_epf_er),
                                             'amount', round(v_epf_base * v_epf_er / 100, 2))
                       || jsonb_build_object('code', 'ETF', 'name', format('ETF (%s%%)', v_etf),
                                             'amount', round(v_etf_base * v_etf / 100, 2));
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

  perform public._refresh_payroll_run_totals(v_run_id);

  return (select to_jsonb(r) from public.payroll_runs r where r.id = v_run_id);
end;
$$;

-- Amend a draft payslip (day shift, lecture, Ramadan, bonus, one-off deduction).
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
  -- gross / EPF / ETF / net are recomputed by tg_payslip_statutory_calculation
  if v_comp.kind = 'earning' then
    update public.payslips set
      earnings = earnings || jsonb_build_object('code', p_code, 'name', coalesce(p_note, v_comp.name), 'amount', round(p_amount, 2))
    where id = p_payslip;
  else
    update public.payslips set
      deductions = deductions || jsonb_build_object('code', p_code, 'name', coalesce(p_note, v_comp.name), 'amount', round(p_amount, 2))
    where id = p_payslip;
  end if;
  -- (net >= 0 is enforced by the payslips check constraint)
  perform public._refresh_payroll_run_totals(ps.run_id);
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
  a record;
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

  -- post from the payslips as they are now (heals totals left stale by
  -- earlier adjustments)
  perform public._refresh_payroll_run_totals(p_run);
  select * into r from public.payroll_runs where id = p_run;
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

  -- every advance recovery must still be owed (another run may have recovered it)
  for d in
    select (x ->> 'advance_id')::uuid as advance_id, sum((x ->> 'amount')::numeric) as amt
    from public.payslips ps, jsonb_array_elements(ps.deductions) x
    where ps.run_id = p_run and x ->> 'code' = 'ADVANCE' and x ? 'advance_id'
    group by 1
  loop
    select * into a from public.staff_advances where id = d.advance_id for update;
    if not found or a.status <> 'active' or a.recovered_amount + d.amt > a.amount then
      raise exception 'A salary advance in this run was already recovered, settled or cancelled elsewhere — regenerate the % draft before approving', r.period;
    end if;
  end loop;

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

  v_je := public.post_journal(r.org_id, public.org_today(), format('Salary payment %s', r.period), 'payroll_payment', r.id,
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
  insert into public.staff_advances (org_id, profile_id, amount, monthly_recovery, issued_on, reason, approved_by)
  values (v_org, p_profile, round(p_amount, 2), round(p_monthly_recovery, 2), public.org_today(), p_reason, auth.uid())
  returning id into v_id;
  v_je := public.post_journal(v_org, public.org_today(), format('Salary advance – %s', p_reason), 'adjustment', v_id,
            jsonb_build_array(
              jsonb_build_object('code', '1300', 'debit', round(p_amount, 2), 'party_id', p_profile),
              jsonb_build_object('code', p_paid_from_code, 'credit', round(p_amount, 2))));
  update public.staff_advances set journal_entry_id = v_je where id = v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leave: days cannot exceed the calendar span of the request
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_leave_requests_days_within_range'
                 and conrelid = 'public.staff_leave_requests'::regclass) then
    alter table public.staff_leave_requests
      add constraint staff_leave_requests_days_within_range
      check (days <= (end_date - start_date + 1)) not valid;
  end if;
end $$;

-- Heal draft runs whose totals were left stale by earlier adjustments.
select public._refresh_payroll_run_totals(id) from public.payroll_runs where status = 'draft';
