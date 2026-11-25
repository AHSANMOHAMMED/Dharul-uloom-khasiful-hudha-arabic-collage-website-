-- ============================================================================
-- 0080_overview_analytics_arrears_guardians.sql
-- Enrich org_dashboard_stats() and finance_analytics() with:
-- - Cheques summary (in hand, due today, deposited, bounced, cleared)
-- - Chart of Accounts summary by account type
-- - 6-month financial trend & 14-day attendance trend for LineCharts
-- - Top student arrears with linked Guardian ID, Name, and Phone
-- ============================================================================

create or replace function public.org_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_today date := public.org_today();
  v_month text := to_char(v_today, 'YYYY-MM');
  v_from_6m date := (date_trunc('month', v_today) - interval '5 months')::date;
begin
  if not (public.is_admin() or public.is_finance_viewer() or public.is_academic_admin() or public.is_hr_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where org_id = v_org and account_type = 'student' and is_approved),
    'employees', (select count(*) from public.profiles where org_id = v_org and account_type in ('tutor', 'staff') and is_approved),
    'parents', (select count(*) from public.profiles where org_id = v_org and account_type = 'parent'),
    'pending_approvals', (select count(*) from public.profiles where org_id = v_org and not is_approved),
    'pending_parent_links', (select count(*) from public.parent_link_requests where org_id = v_org and status = 'pending'),
    'attendance_today', (select jsonb_build_object(
        'marked', count(*), 'present', count(*) filter (where status in ('present', 'late')),
        'rate', case when count(*) > 0 then round(count(*) filter (where status in ('present', 'late')) * 100.0 / count(*), 1) end)
      from public.attendance where org_id = v_org and date = v_today),
    'fees_month', (select jsonb_build_object('month', v_month, 'invoiced', coalesce(sum(total_due), 0),
        'collected', coalesce(sum(paid_amount), 0), 'outstanding', coalesce(sum(total_due - paid_amount), 0))
      from public.student_fees where org_id = v_org and month = v_month and status <> 'cancelled'),
    'fees_outstanding_total', coalesce((select sum(total_due - paid_amount) from public.student_fees
      where org_id = v_org and status in ('unpaid', 'partial') and cancelled_at is null), 0),
    'collections_30d', coalesce((select sum(amount) from public.fee_payments
      where org_id = v_org and status = 'posted' and paid_at > now() - interval '30 days'), 0),
    'expenses_month', coalesce((select sum(amount) from public.expenses
      where org_id = v_org and status = 'paid' and to_char(expense_date, 'YYYY-MM') = v_month), 0),
    'expenses_pending', (select count(*) from public.expenses where org_id = v_org and status = 'submitted'),
    'donations_month', coalesce((select sum(amount) from public.donations
      where org_id = v_org and status = 'recorded' and to_char(donation_date, 'YYYY-MM') = v_month), 0),
    'last_payroll', (select jsonb_build_object('period', period, 'status', status, 'net', total_net, 'staff', staff_count)
      from public.payroll_runs where org_id = v_org and status <> 'cancelled' order by period desc limit 1),
    'admissions_pipeline', coalesce((select jsonb_object_agg(pipeline_stage, n) from (
        select coalesce(pipeline_stage, 'submitted') pipeline_stage, count(*) n from public.admissions
        where org_id = v_org group by 1) s), '{}'::jsonb),
    'followups_overdue', (select count(*) from public.crm_followups where org_id = v_org and done_at is null and due_at < now()),
    'staff_leave_pending', (select count(*) from public.staff_leave_requests where org_id = v_org and status = 'pending'),
    'student_leave_pending', (select count(*) from public.leave_requests where org_id = v_org and status = 'pending'),
    'discipline_open', (select count(*) from public.discipline_incidents where org_id = v_org and status = 'open'),
    'hostel', (select jsonb_build_object('beds', coalesce(sum(r.capacity), 0),
        'occupied', (select count(*) from public.hostel_allocations a where a.org_id = v_org and a.status = 'active'))
      from public.hostel_rooms r where r.org_id = v_org and r.is_active),
    'document_requests_pending', (select count(*) from public.document_requests where org_id = v_org and status = 'pending'),
    'cheques', (select jsonb_build_object(
        'in_hand', coalesce(sum(amount) filter (where direction = 'received' and status = 'pending'), 0),
        'in_hand_count', count(*) filter (where direction = 'received' and status = 'pending'),
        'due_today', coalesce(sum(amount) filter (where direction = 'received' and status = 'pending' and cheque_date <= v_today), 0),
        'due_today_count', count(*) filter (where direction = 'received' and status = 'pending' and cheque_date <= v_today),
        'deposited', coalesce(sum(amount) filter (where status = 'deposited'), 0),
        'bounced', coalesce(sum(amount) filter (where status = 'bounced'), 0),
        'bounced_count', count(*) filter (where status = 'bounced'),
        'cleared_month', coalesce(sum(amount) filter (where status = 'cleared' and to_char(coalesce(cleared_on, cheque_date), 'YYYY-MM') = v_month), 0)
      ) from public.cheques where org_id = v_org),
    'accounts_summary', coalesce((
      select jsonb_agg(jsonb_build_object('account_type', t.type, 'count', t.cnt, 'balance', t.bal) order by t.ord)
      from (
        select a.type,
               case a.type when 'asset' then 1 when 'liability' then 2 when 'equity' then 3 when 'income' then 4 else 5 end as ord,
               count(distinct a.id) as cnt,
               coalesce(sum(
                 case when a.type in ('asset', 'expense') then coalesce(l.debit, 0) - coalesce(l.credit, 0)
                      else coalesce(l.credit, 0) - coalesce(l.debit, 0) end
               ), 0) as bal
        from public.accounts a
        left join public.journal_lines l on l.account_id = a.id and l.org_id = v_org
        left join public.journal_entries je on je.id = l.entry_id and je.status = 'posted'
        where a.org_id = v_org and a.is_active
          and (l.id is null or je.id is not null)
        group by a.type
      ) t), '[]'::jsonb),
    'finance_trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', to_char(m, 'YYYY-MM'),
        'invoiced', coalesce((select sum(total_due) from public.student_fees f where f.org_id = v_org and f.month = to_char(m, 'YYYY-MM') and f.cancelled_at is null), 0),
        'collected', coalesce((select sum(amount) from public.fee_payments fp where fp.org_id = v_org and fp.status = 'posted' and date_trunc('month', fp.paid_at at time zone 'Asia/Colombo') = m), 0),
        'expenses', coalesce((select sum(amount) from public.expenses ex where ex.org_id = v_org and ex.status = 'paid' and date_trunc('month', ex.expense_date) = m), 0)
      ) order by m)
      from generate_series(v_from_6m, date_trunc('month', v_today)::date, interval '1 month') m), '[]'::jsonb),
    'attendance_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(d, 'MM-DD'), 'rate', r) order by d)
      from (
        select date as d,
               round(count(*) filter (where status in ('present', 'late')) * 100.0 / nullif(count(*), 0), 1) as r
        from public.attendance
        where org_id = v_org and date >= v_today - 20
        group by date
        order by date desc
        limit 14
      ) sub), '[]'::jsonb),
    'top_arrears', coalesce((
      select jsonb_agg(x order by x.balance desc) from (
        select p.id as student_id,
               p.full_name,
               p.index_number,
               p.class_number,
               sum(f.total_due - f.paid_amount) as balance,
               min(f.due_date) as oldest_due,
               gp.id as guardian_id,
               gp.full_name as guardian_name,
               coalesce(gp.phone, p.phone) as guardian_phone
        from public.student_fees f
        join public.profiles p on p.id = f.student_id
        left join lateral (
          select pr.id, pr.full_name, pr.phone
          from public.parent_children pc
          join public.profiles pr on pr.id = pc.parent_id
          where pc.child_id = p.id
          order by pc.created_at asc
          limit 1
        ) gp on true
        where f.org_id = v_org and f.status in ('unpaid', 'partial') and f.cancelled_at is null
        group by p.id, p.full_name, p.index_number, p.class_number, gp.id, gp.full_name, gp.phone
        order by sum(f.total_due - f.paid_amount) desc
        limit 15
      ) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.finance_analytics(p_months int default 12)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_today date := public.org_today();
  v_n int := greatest(1, least(coalesce(p_months, 12), 36));
  v_from date := (date_trunc('month', v_today) - make_interval(months => v_n - 1))::date;
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'as_of', v_today,
    'months', (
      select jsonb_agg(jsonb_build_object(
        'month', to_char(m, 'YYYY-MM'),
        'invoiced', coalesce((select sum(total_due) from public.student_fees f
                              where f.org_id = v_org and f.month = to_char(m, 'YYYY-MM') and f.cancelled_at is null), 0),
        'collected_for_month', coalesce((select sum(paid_amount) from public.student_fees f
                              where f.org_id = v_org and f.month = to_char(m, 'YYYY-MM') and f.cancelled_at is null), 0),
        'cash_received', coalesce((select sum(amount) from public.fee_payments p where p.org_id = v_org and p.status = 'posted'
                              and date_trunc('month', p.paid_at at time zone 'Asia/Colombo') = m), 0),
        'expenses', coalesce((select sum(amount) from public.expenses e where e.org_id = v_org and e.status = 'paid'
                              and date_trunc('month', e.expense_date) = m), 0),
        'petty_cash', coalesce((select sum(amount) from public.petty_cash_entries e where e.org_id = v_org and e.status = 'posted'
                              and e.entry_type = 'expense' and date_trunc('month', e.entry_date) = m), 0),
        'donations', coalesce((select sum(amount) from public.donations d where d.org_id = v_org and d.status = 'recorded'
                              and date_trunc('month', d.donation_date) = m), 0),
        'payroll', coalesce((select sum(total_gross + total_employer) from public.payroll_runs r
                              where r.org_id = v_org and r.status in ('approved', 'paid') and r.period = to_char(m, 'YYYY-MM')), 0))
        order by m)
      from generate_series(v_from, date_trunc('month', v_today)::date, interval '1 month') m),
    'aging', (
      select jsonb_build_object(
        'not_due', coalesce(sum(bal) filter (where days < 0), 0),
        'd0_30', coalesce(sum(bal) filter (where days between 0 and 30), 0),
        'd31_60', coalesce(sum(bal) filter (where days between 31 and 60), 0),
        'd61_90', coalesce(sum(bal) filter (where days between 61 and 90), 0),
        'd90_plus', coalesce(sum(bal) filter (where days > 90), 0),
        'total', coalesce(sum(bal), 0),
        'students', count(distinct student_id))
      from (select f.student_id, f.total_due - f.paid_amount as bal, (v_today - f.due_date) as days
            from public.student_fees f
            where f.org_id = v_org and f.status in ('unpaid', 'partial') and f.cancelled_at is null) x),
    'collection_rate', (
      select case when sum(total_due) > 0 then round(sum(paid_amount) * 100.0 / sum(total_due), 1) else null end
      from public.student_fees where org_id = v_org and cancelled_at is null
        and month between to_char(v_from, 'YYYY-MM') and to_char(v_today, 'YYYY-MM')),
    'by_class', coalesce((
      select jsonb_agg(jsonb_build_object('class_number', class_number, 'invoiced', inv, 'paid', paid,
                                          'outstanding', inv - paid,
                                          'rate', case when inv > 0 then round(paid * 100.0 / inv, 1) end) order by class_number)
      from (select p.class_number, sum(f.total_due) inv, sum(f.paid_amount) paid
            from public.student_fees f join public.profiles p on p.id = f.student_id
            where f.org_id = v_org and f.cancelled_at is null
              and f.month between to_char(v_from, 'YYYY-MM') and to_char(v_today, 'YYYY-MM')
            group by p.class_number) c), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_object_agg(method, total) from (
        select method, sum(amount) total from public.fee_payments
        where org_id = v_org and status = 'posted' and paid_at >= v_from group by method) x), '{}'::jsonb),
    'top_arrears', coalesce((
      select jsonb_agg(x order by x.balance desc) from (
        select p.id as student_id, p.full_name, p.index_number, p.class_number,
               sum(f.total_due - f.paid_amount) as balance, min(f.due_date) as oldest_due,
               gp.id as guardian_id, gp.full_name as guardian_name, coalesce(gp.phone, p.phone) as guardian_phone
        from public.student_fees f join public.profiles p on p.id = f.student_id
        left join lateral (
          select pr.id, pr.full_name, pr.phone
          from public.parent_children pc
          join public.profiles pr on pr.id = pc.parent_id
          where pc.child_id = p.id
          order by pc.created_at asc
          limit 1
        ) gp on true
        where f.org_id = v_org and f.status in ('unpaid', 'partial') and f.cancelled_at is null
        group by p.id, p.full_name, p.index_number, p.class_number, gp.id, gp.full_name, gp.phone
        order by sum(f.total_due - f.paid_amount) desc limit 15) x), '[]'::jsonb),
    'expenses_by_account', coalesce((
      select jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'amount', t.total) order by t.total desc)
      from (select account_id, sum(amount) total from public.expenses
            where org_id = v_org and status = 'paid' and expense_date >= v_from group by account_id) t
      join public.accounts a on a.id = t.account_id), '[]'::jsonb),
    'petty_cash_by_duty', coalesce((
      select jsonb_agg(jsonb_build_object('duty', r.name_en, 'name_ar', r.name_ar, 'name_ta', r.name_ta, 'spent', t.total) order by t.total desc)
      from (select f.duty_role_id, sum(e.amount) total from public.petty_cash_entries e
            join public.petty_cash_funds f on f.id = e.fund_id
            where e.org_id = v_org and e.status = 'posted' and e.entry_type = 'expense' and e.entry_date >= v_from
            group by f.duty_role_id) t join public.duty_roles r on r.id = t.duty_role_id), '[]'::jsonb));
end;
$$;
