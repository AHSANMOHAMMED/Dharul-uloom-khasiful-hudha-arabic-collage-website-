-- =============================================================================
-- 0076_live_governance_payroll_sms.sql
-- 1. Add real governance tables (tasks, task_comments, task_events,
--    mashoora_meetings, duty_roles) to supabase_realtime.
-- 2. Extend has_staff_role() to recognize active duty_assignments.
-- 3. Queue SMS/WhatsApp/Email/Push via enqueue_user_messages() in pay_payroll().
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- 1. Enable Realtime for governance & Kanban tables
do $$
declare
  t text;
  tables text[] := array[
    'duty_roles',
    'duty_assignments',
    'mashoora_meetings',
    'tasks',
    'task_comments',
    'task_events'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array tables
    loop
      if to_regclass(format('public.%I', t)) is not null then
        execute format('alter table public.%I replica identity full', t);
        if not exists (
          select 1 from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = t
        ) then
          execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
      end if;
    end loop;
  end if;
end $$;

-- 2. Recognize active yearly duty_assignments in has_staff_role()
create or replace function public.has_staff_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mfa_ok() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_approved
      and p.account_type in ('tutor', 'staff')
      and (
        p.assigned_tutor_role = any (p_roles)
        or p.extra_roles && p_roles
        or exists (
          select 1
          from public.duty_assignments da
          join public.duty_roles dr on dr.id = da.duty_role_id
          where da.assignee_id = p.id
            and da.org_id = p.org_id
            and da.status = 'active'
            and dr.code = any (p_roles)
        )
      )
  );
$$;

-- 3. Lecturer / staff salary payment: notify in-app AND queue SMS/WhatsApp/Email/Push
create or replace function public.pay_payroll(
  p_run uuid,
  p_account_code text default '1010',
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_je uuid;
  ps record;
  v_msg text;
  v_meta jsonb;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.payroll_runs where id = p_run and org_id = public.current_org_id() for update;
  if not found or r.status <> 'approved' then
    raise exception 'Approved payroll run not found';
  end if;
  if not exists (
    select 1 from public.accounts
    where org_id = r.org_id and code = p_account_code and subtype in ('cash', 'bank')
  ) then
    raise exception 'Pay from a cash or bank account';
  end if;

  v_je := public.post_journal(
    r.org_id,
    public.org_today(),
    format('Salary payment %s', r.period),
    'payroll_payment',
    r.id,
    jsonb_build_array(
      jsonb_build_object('code', '2100', 'debit', r.total_net, 'memo', 'Net salaries'),
      jsonb_build_object('code', p_account_code, 'credit', r.total_net, 'memo', p_reference)
    )
  );

  update public.payroll_runs
  set status = 'paid',
      paid_by = auth.uid(),
      paid_at = now(),
      payment_account_code = p_account_code,
      payment_reference = p_reference,
      payment_journal_id = v_je
  where id = p_run;

  update public.payslips
  set status = 'paid', paid_at = now(), payment_reference = p_reference
  where run_id = p_run;

  for ps in select * from public.payslips where run_id = p_run loop
    insert into public.tutor_salaries (tutor_id, month, amount, status, org_id)
    values (ps.staff_id, ps.period, ps.net, 'paid', ps.org_id)
    on conflict (tutor_id, month) do update set amount = excluded.amount, status = 'paid';

    v_msg := format(
      'Your salary for %s (net LKR %s) has been paid. Your payslip is available in the portal.',
      ps.period,
      trim(to_char(ps.net, 'FM999999990.00'))
    );
    v_meta := jsonb_build_object(
      'type', 'payroll_paid',
      'purpose', 'general',
      'urgent', true,
      'period', ps.period,
      'payslip_id', ps.id,
      'link', '/dashboard?tab=salaries'
    );

    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (ps.staff_id, 'Salary paid', v_msg, v_meta, '/dashboard?tab=salaries', ps.org_id);

    perform public.enqueue_user_messages(ps.staff_id, 'Salary paid', v_msg, v_meta);
  end loop;

  return v_je;
end;
$$;
