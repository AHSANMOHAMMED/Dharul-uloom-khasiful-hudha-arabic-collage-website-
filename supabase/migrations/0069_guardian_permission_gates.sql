-- Enforce parent_children.permissions on fee/results/attendance reads; quiz class gate.
set search_path = public, extensions, pg_temp;

-- Active guardian with named permission (key absent ⇒ allowed, matching JSON default).
create or replace function public.guardian_may(p_student uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.parent_children pc
    where pc.parent_id = auth.uid()
      and pc.child_id = p_student
      and pc.status = 'active'
      and pc.org_id = public.current_org_id()
      and coalesce((pc.permissions ->> coalesce(nullif(trim(p_perm), ''), 'fees'))::boolean, true)
  );
$$;
revoke all on function public.guardian_may(uuid, text) from public, anon;
grant execute on function public.guardian_may(uuid, text) to authenticated;

-- Fee table policies (drop legacy is_parent_of SELECT policies so permission JSON is decisive)
drop policy if exists "fees: view own or child" on public.student_fees;
drop policy if exists "payments: view own or child" on public.payment_transactions;

drop policy if exists "fee_payments: read" on public.fee_payments;
create policy "fee_payments: read" on public.fee_payments for select to authenticated
  using (
    student_id = auth.uid()
    or public.guardian_may(student_id, 'fees')
    or public.is_finance_viewer()
    or public.has_active_break_glass('read_finance')
  );

drop policy if exists "fee_receipts: read" on public.fee_receipts;
create policy "fee_receipts: read" on public.fee_receipts for select to authenticated
  using (
    student_id = auth.uid()
    or public.guardian_may(student_id, 'fees')
    or public.is_finance_viewer()
    or public.has_active_break_glass('read_finance')
  );

drop policy if exists "concessions: read" on public.student_fee_concessions;
create policy "concessions: read" on public.student_fee_concessions for select to authenticated
  using (
    student_id = auth.uid()
    or public.guardian_may(student_id, 'fees')
    or public.is_finance_viewer()
  );

drop policy if exists "fee_lines: read" on public.fee_invoice_lines;
create policy "fee_lines: read" on public.fee_invoice_lines for select to authenticated
  using (
    public.is_finance_viewer()
    or exists (
      select 1 from public.student_fees f
      where f.id = fee_id
        and (f.student_id = auth.uid() or public.guardian_may(f.student_id, 'fees'))
    )
  );

drop policy if exists "fee_adjustments: read" on public.fee_adjustments;
create policy "fee_adjustments: read" on public.fee_adjustments for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      public.is_finance_viewer()
      or student_id = auth.uid()
      or public.guardian_may(student_id, 'fees')
    )
  );

drop policy if exists "fees: self or guardian read" on public.student_fees;
create policy "fees: self or guardian read" on public.student_fees for select to authenticated
  using (student_id = auth.uid() or public.guardian_may(student_id, 'fees'));

drop policy if exists "payments: self or guardian read" on public.payment_transactions;
create policy "payments: self or guardian read" on public.payment_transactions for select to authenticated
  using (
    student_id = auth.uid()
    or public.guardian_may(student_id, 'fees')
    or payer_id = auth.uid()
  );

-- Preserve arrears shape from 0025; tighten AuthZ to fees permission for parents.
create or replace function public.student_arrears(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (
    p_student = auth.uid()
    or public.guardian_may(p_student, 'fees')
    or public.is_finance_viewer()
    or public.has_active_break_glass('read_finance')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', coalesce((select sum(total_due - paid_amount) from public.student_fees
                       where student_id = p_student and status in ('unpaid', 'partial') and cancelled_at is null), 0),
    'overdue', coalesce((select sum(total_due - paid_amount) from public.student_fees
                         where student_id = p_student and status in ('unpaid', 'partial') and cancelled_at is null
                           and due_date < public.org_today()), 0),
    'months', coalesce((select jsonb_agg(jsonb_build_object(
                          'fee_id', id, 'invoice_no', invoice_no, 'month', month, 'due_date', due_date,
                          'total_due', total_due, 'paid', paid_amount, 'balance', total_due - paid_amount,
                          'overdue', due_date < public.org_today()) order by month)
                        from public.student_fees
                        where student_id = p_student and status in ('unpaid', 'partial') and cancelled_at is null), '[]'::jsonb));
end;
$$;

create or replace function public.student_fee_statement(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := public._org_local_date((select org_id from public.profiles where id = p_student));
begin
  if not (
    p_student = auth.uid()
    or public.guardian_may(p_student, 'fees')
    or public.is_finance_viewer()
    or public.has_active_break_glass('read_finance')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'student', (select jsonb_build_object('id', id, 'full_name', full_name, 'index_number', index_number, 'class_number', class_number)
                from public.profiles where id = p_student),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'invoice_no', f.invoice_no, 'month', f.month, 'due_date', f.due_date,
        'total_due', f.total_due, 'paid_amount', f.paid_amount, 'balance', f.total_due - f.paid_amount,
        'status', f.status,
        'overdue', f.status in ('unpaid', 'partial') and f.due_date < v_today,
        'lines', coalesce((select jsonb_agg(jsonb_build_object('kind', l.kind, 'description', l.description, 'amount', l.amount) order by l.created_at)
                           from public.fee_invoice_lines l where l.fee_id = f.id), '[]'::jsonb),
        'payments', coalesce((select jsonb_agg(jsonb_build_object('receipt_no', p.receipt_no, 'amount', p.amount, 'method', p.method,
                                                                  'paid_at', p.paid_at, 'status', p.status) order by p.paid_at)
                              from public.fee_payments p where p.fee_id = f.id), '[]'::jsonb)
      ) order by f.month desc)
      from public.student_fees f where f.student_id = p_student), '[]'::jsonb),
    'total_outstanding', coalesce((select sum(total_due - paid_amount) from public.student_fees
                                   where student_id = p_student and status in ('unpaid', 'partial')), 0)
  );
end;
$$;

-- Results: parents need permissions.results
drop policy if exists "results: view own or children" on public.student_results;
create policy "results: view own or children" on public.student_results for select to authenticated
  using (
    public.is_employee()
    or (
      (student_id = auth.uid() or public.guardian_may(student_id, 'results'))
      and (exam_id is null or exists (select 1 from public.exams e where e.id = exam_id and e.status = 'published'))
    )
  );

-- Attendance: strip legacy is_parent_of; parents need permissions.attendance
drop policy if exists "attendance: student view own" on public.attendance;
create policy "attendance: student view own" on public.attendance for select to authenticated
  using (student_id = auth.uid());
drop policy if exists "attendance: parent read" on public.attendance;
create policy "attendance: parent read" on public.attendance for select to authenticated
  using (public.guardian_may(student_id, 'attendance'));

-- Leave: strip legacy is_parent_of; parents need permissions.leave
drop policy if exists "leaves: owner read" on public.leave_requests;
create policy "leaves: owner read" on public.leave_requests for select to authenticated
  using (
    student_id = auth.uid()
    or parent_id = auth.uid()
    or public.guardian_may(student_id, 'leave')
    or public.is_employee()
  );
drop policy if exists "leave_requests: parent read" on public.leave_requests;
drop policy if exists "leaves: parent or student insert" on public.leave_requests;
create policy "leaves: parent or student insert" on public.leave_requests for insert to authenticated
  with check (
    (student_id = auth.uid() and parent_id is null)
    or (public.guardian_may(student_id, 'leave') and parent_id = auth.uid())
  );
drop policy if exists "leaves: owner update pending" on public.leave_requests;
create policy "leaves: owner update pending" on public.leave_requests for update to authenticated
  using (
    (student_id = auth.uid() or (parent_id = auth.uid() and public.guardian_may(student_id, 'leave')))
    and status = 'pending'
  )
  with check (
    student_id = auth.uid()
    or (parent_id = auth.uid() and public.guardian_may(student_id, 'leave'))
  );

-- Attendance summary: parents need attendance permission
create or replace function public.attendance_summary(p_student uuid, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not (
    p_student = auth.uid()
    or public.guardian_may(p_student, 'attendance')
    or (public.is_employee() and exists (select 1 from public.profiles where id = p_student and org_id = public.current_org_id()))
    or public.is_super_admin()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'present', count(*) filter (where status = 'present'),
           'absent',  count(*) filter (where status = 'absent'),
           'late',    count(*) filter (where status = 'late'),
           'excused', count(*) filter (where status = 'excused'),
           'total',   count(*),
           'rate',    case when count(*) > 0
                        then round(count(*) filter (where status in ('present', 'late')) * 100.0 / count(*), 1) end)
    into v
  from public.attendance
  where student_id = p_student
    and (p_from is null or date >= p_from)
    and (p_to is null or date <= p_to);
  return v;
end;
$$;

-- LMS quiz questions: class membership
create or replace function public.student_quiz_questions(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q record;
begin
  select * into q from public.lms_quizzes where id = p_quiz and org_id = public.current_org_id();
  if not found or q.status <> 'published' then raise exception 'Quiz not available'; end if;
  if q.due_at is not null and now() > q.due_at then raise exception 'Quiz is past due'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.class_number = q.class_number
      and coalesce(p.account_type, '') = 'student'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', qq.id, 'sort_order', qq.sort_order, 'prompt', qq.prompt,
      'choices', qq.choices, 'points', qq.points
    ) order by qq.sort_order)
    from public.lms_quiz_questions qq where qq.quiz_id = p_quiz
  ), '[]'::jsonb);
end;
$$;
