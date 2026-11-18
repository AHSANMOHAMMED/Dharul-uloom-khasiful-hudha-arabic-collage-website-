-- Effective-dated APIT (PAYE) tax tables for payroll.
set search_path = public, extensions, pg_temp;

create table if not exists public.payroll_tax_tables (
  id             uuid primary key default extensions.gen_random_uuid(),
  org_id         uuid not null references public.organizations (id),
  effective_from date not null,
  label          text not null default 'APIT',
  brackets       jsonb not null default '[]'::jsonb,
  -- brackets: [{ "up_to": 100000, "rate": 0 }, { "up_to": 141667, "rate": 6 }, ...]
  -- last bracket may use up_to: null for remainder
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (org_id, effective_from)
);
create index if not exists idx_payroll_tax_org on public.payroll_tax_tables (org_id, effective_from desc);

alter table public.payroll_tax_tables enable row level security;
drop policy if exists "payroll_tax: hr read" on public.payroll_tax_tables;
create policy "payroll_tax: hr read" on public.payroll_tax_tables for select to authenticated
  using (org_id = (select public.current_org_id()) and (public.is_hr_staff() or public.is_accountant() or public.is_admin()));
drop policy if exists "payroll_tax: no direct write" on public.payroll_tax_tables;
create policy "payroll_tax: no direct write" on public.payroll_tax_tables for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('payroll_tax_tables');
select public.attach_audit('payroll_tax_tables');

create or replace function public.upsert_payroll_tax_table(
  p_effective_from date,
  p_brackets jsonb,
  p_label text default 'APIT'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_org uuid := public.current_org_id();
begin
  if not (public.is_hr_staff() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_effective_from is null then raise exception 'effective_from required'; end if;
  if jsonb_typeof(p_brackets) <> 'array' then raise exception 'brackets must be a JSON array'; end if;

  insert into public.payroll_tax_tables (org_id, effective_from, label, brackets, created_by)
  values (v_org, p_effective_from, coalesce(nullif(trim(p_label), ''), 'APIT'), p_brackets, auth.uid())
  on conflict (org_id, effective_from) do update set
    label = excluded.label,
    brackets = excluded.brackets,
    created_by = auth.uid()
  returning id into v_id;
  return v_id;
end;
$$;

-- Progressive APIT on monthly taxable income (gross - EPF_EE for MVP).
create or replace function public.compute_apit_amount(p_org uuid, p_as_of date, p_taxable numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_brackets jsonb;
  b jsonb;
  v_prev numeric := 0;
  v_up numeric;
  v_rate numeric;
  v_slice numeric;
  v_tax numeric := 0;
  v_remain numeric := greatest(coalesce(p_taxable, 0), 0);
begin
  select brackets into v_brackets
  from public.payroll_tax_tables
  where org_id = p_org and effective_from <= coalesce(p_as_of, current_date)
  order by effective_from desc
  limit 1;

  if v_brackets is null then
    return 0;
  end if;

  for b in select * from jsonb_array_elements(v_brackets) loop
    v_rate := coalesce((b->>'rate')::numeric, 0);
    if b->>'up_to' is null or b->>'up_to' = '' then
      v_tax := v_tax + round(v_remain * v_rate / 100, 2);
      exit;
    end if;
    v_up := (b->>'up_to')::numeric;
    v_slice := greatest(least(v_remain, v_up - v_prev), 0);
    v_tax := v_tax + round(v_slice * v_rate / 100, 2);
    v_remain := v_remain - v_slice;
    v_prev := v_up;
    exit when v_remain <= 0;
  end loop;

  return greatest(v_tax, 0);
end;
$$;

-- Apply / refresh APIT on all draft payslips in a run (idempotent: strips prior APIT lines).
create or replace function public.apply_apit_to_draft_run(p_run uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  ps record;
  v_epf numeric;
  v_taxable numeric;
  v_apit numeric;
  v_as_of date;
  v_count int := 0;
begin
  if not (public.is_hr_staff() or public.is_accountant()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.payroll_runs where id = p_run and org_id = public.current_org_id();
  if not found then raise exception 'Payroll run not found'; end if;
  if r.status <> 'draft' then raise exception 'Run is not draft'; end if;
  v_as_of := (r.period || '-01')::date;

  for ps in select * from public.payslips where run_id = p_run and status = 'draft' for update loop
    -- remove prior APIT lines
    update public.payslips set
      deductions = coalesce((
        select jsonb_agg(x) from jsonb_array_elements(deductions) x where x->>'code' <> 'APIT'
      ), '[]'::jsonb)
    where id = ps.id;

    select coalesce(sum((x->>'amount')::numeric), 0) into v_epf
    from public.payslips p2, jsonb_array_elements(p2.deductions) x
    where p2.id = ps.id and x->>'code' = 'EPF_EE';

    select gross into v_taxable from public.payslips where id = ps.id;
    v_taxable := greatest(coalesce(v_taxable, 0) - coalesce(v_epf, 0), 0);
    v_apit := public.compute_apit_amount(r.org_id, v_as_of, v_taxable);

    if v_apit > 0 then
      update public.payslips set
        deductions = deductions || jsonb_build_object(
          'code', 'APIT', 'name', 'APIT / PAYE', 'amount', v_apit),
        total_deductions = (
          select coalesce(sum((x->>'amount')::numeric), 0)
          from jsonb_array_elements(
            deductions || jsonb_build_object('code', 'APIT', 'name', 'APIT / PAYE', 'amount', v_apit)
          ) x
        ),
        net = gross - (
          select coalesce(sum((x->>'amount')::numeric), 0)
          from jsonb_array_elements(
            deductions || jsonb_build_object('code', 'APIT', 'name', 'APIT / PAYE', 'amount', v_apit)
          ) x
        )
      where id = ps.id;
    else
      update public.payslips set
        total_deductions = (select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(deductions) x),
        net = gross - (select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(deductions) x)
      where id = ps.id;
    end if;
    v_count := v_count + 1;
  end loop;

  perform public._refresh_payroll_run_totals(p_run);
  return jsonb_build_object('run_id', p_run, 'payslips', v_count);
end;
$$;

-- Wrap generate_payroll: apply APIT after core generation.
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
  v_apit numeric;
  v_taxable numeric;
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
    update public.payroll_runs set created_by = auth.uid() where id = v_run_id;
  else
    insert into public.payroll_runs (org_id, period, created_by) values (v_org, p_period, auth.uid())
    returning id into v_run_id;
  end if;

  v_start := (p_period || '-01')::date;
  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_working := public.payroll_setting(v_org, 'working_days', 26);
  if coalesce(v_working, 0) <= 0 then v_working := 26; end if;
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
      if v_comp.id is null or coalesce((c ->> 'amount')::numeric, 0) = 0 then continue; end if;
      if v_comp.kind = 'earning' then
        v_earn := v_earn || jsonb_build_object('code', v_comp.code, 'name', v_comp.name, 'amount', round((c ->> 'amount')::numeric, 2));
        v_gross := v_gross + round((c ->> 'amount')::numeric, 2);
        if v_comp.epf_eligible then v_epf_extra := v_epf_extra + round((c ->> 'amount')::numeric, 2); end if;
        if v_comp.etf_eligible then v_etf_extra := v_etf_extra + round((c ->> 'amount')::numeric, 2); end if;
      else
        v_ded := v_ded || jsonb_build_object('code', v_comp.code, 'name', v_comp.name, 'amount', round((c ->> 'amount')::numeric, 2));
      end if;
    end loop;

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

    -- APIT after EPF + advances (taxable ≈ gross − EPF_EE)
    v_taxable := greatest(v_gross - coalesce((
      select sum((d->>'amount')::numeric) from jsonb_array_elements(v_ded) d where d->>'code' = 'EPF_EE'
    ), 0), 0);
    v_apit := public.compute_apit_amount(v_org, v_start, v_taxable);
    if v_apit > 0 then
      v_ded := v_ded || jsonb_build_object('code', 'APIT', 'name', 'APIT / PAYE', 'amount', v_apit);
      v_dtotal := v_dtotal + v_apit;
    end if;

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

revoke all on function public.upsert_payroll_tax_table(date, jsonb, text) from public, anon;
revoke all on function public.compute_apit_amount(uuid, date, numeric) from public, anon, authenticated;
revoke all on function public.apply_apit_to_draft_run(uuid) from public, anon;
grant execute on function public.upsert_payroll_tax_table(date, jsonb, text) to authenticated;
grant execute on function public.apply_apit_to_draft_run(uuid) to authenticated;
grant execute on function public.generate_payroll(text) to authenticated;

select public.apply_mfa_policy('payroll_tax_tables'::regclass);
