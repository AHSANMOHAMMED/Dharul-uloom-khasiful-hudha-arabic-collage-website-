-- Critical AuthZ / privacy fixes from full-app logic audit.
set search_path = public, extensions, pg_temp;

-- 1) Library overdue: org-scoped + staff-only
create or replace function public.mark_overdue_library_loans()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
  v_org uuid := public.current_org_id();
begin
  if not (public.is_employee() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.library_loans set status = 'overdue'
  where org_id = v_org and status = 'out' and due_at < public.org_today();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.mark_overdue_library_loans() from public, anon;
grant execute on function public.mark_overdue_library_loans() to authenticated;

-- 2) Attendance corrections / offline drafts: tutor-or-academic-admin only
create or replace function public.correct_attendance(
  p_student uuid,
  p_date date,
  p_to_status text,
  p_kind text,
  p_reason text,
  p_class int default null,
  p_period text default 'day'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_att record;
  v_session uuid;
  v_exc uuid;
  v_from text;
begin
  if not (public.is_academic_admin() or public.tutor_can_teach_student(p_student)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_to_status not in ('present', 'absent', 'late', 'excused') then
    raise exception 'Invalid status';
  end if;
  if p_kind not in ('late', 'excused', 'corrected', 'substitute') then
    raise exception 'Invalid exception kind';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason required'; end if;

  select * into v_att from public.attendance
  where student_id = p_student and date = p_date and org_id = v_org for update;
  v_from := v_att.status;

  if found then
    update public.attendance set
      status = p_to_status,
      excuse_note = case when p_kind in ('excused', 'corrected') then trim(p_reason) else excuse_note end,
      marked_by = auth.uid()
    where id = v_att.id;
  else
    insert into public.attendance (student_id, date, status, excuse_note, marked_by, org_id)
    values (p_student, p_date, p_to_status, trim(p_reason), auth.uid(), v_org)
    returning * into v_att;
  end if;

  if p_class is not null then
    insert into public.attendance_sessions (org_id, class_number, session_date, period_label)
    values (v_org, p_class, p_date, coalesce(nullif(trim(p_period), ''), 'day'))
    on conflict (org_id, class_number, session_date, period_label) do update set created_by = auth.uid()
    returning id into v_session;
  end if;

  insert into public.attendance_exceptions (
    org_id, attendance_id, student_id, session_id, session_date, kind, from_status, to_status, reason
  ) values (
    v_org, v_att.id, p_student, v_session, p_date, p_kind, v_from, p_to_status, trim(p_reason)
  ) returning id into v_exc;

  return v_exc;
end;
$$;

create or replace function public.apply_offline_attendance_draft(
  p_device_id text,
  p_idempotency_key text,
  p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_existing record;
  v_qid uuid;
  v_student uuid;
  v_date date;
  v_status text;
  v_note text;
begin
  if coalesce(trim(p_device_id), '') = '' or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'device_id and idempotency_key required';
  end if;

  v_student := (p_payload->>'student_id')::uuid;
  v_date := (p_payload->>'date')::date;
  v_status := p_payload->>'status';
  v_note := nullif(trim(coalesce(p_payload->>'excuse_note', '')), '');
  if v_student is null or v_date is null or v_status not in ('present', 'absent', 'late', 'excused') then
    raise exception 'Invalid attendance draft payload';
  end if;
  if not (public.is_academic_admin() or public.tutor_can_teach_student(v_student)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_existing from public.offline_sync_queue
  where org_id = v_org and device_id = trim(p_device_id) and idempotency_key = trim(p_idempotency_key);
  if found then
    return jsonb_build_object('status', 'duplicate', 'queue_id', v_existing.id, 'result', v_existing.result);
  end if;

  insert into public.offline_sync_queue (org_id, device_id, idempotency_key, kind, payload, status)
  values (v_org, trim(p_device_id), trim(p_idempotency_key), 'attendance_draft', p_payload, 'pending')
  returning id into v_qid;

  begin
    insert into public.attendance (student_id, date, status, excuse_note, marked_by, org_id)
    values (v_student, v_date, v_status, v_note, auth.uid(), v_org)
    on conflict (student_id, date) do update set
      status = excluded.status,
      excuse_note = coalesce(excluded.excuse_note, public.attendance.excuse_note),
      marked_by = auth.uid();

    update public.offline_sync_queue set
      status = 'applied',
      applied_at = now(),
      result = jsonb_build_object('student_id', v_student, 'date', v_date, 'status', v_status)
    where id = v_qid;

    return jsonb_build_object('status', 'applied', 'queue_id', v_qid);
  exception when others then
    update public.offline_sync_queue set
      status = 'rejected', error = SQLERRM, applied_at = now()
    where id = v_qid;
    return jsonb_build_object('status', 'rejected', 'queue_id', v_qid, 'error', SQLERRM);
  end;
end;
$$;

-- 3) LMS: withhold scores until release (pending_* columns not selectable by clients)
alter table public.lms_quiz_attempts
  add column if not exists pending_score numeric(8,2),
  add column if not exists pending_max numeric(8,2);
revoke select (pending_score, pending_max) on public.lms_quiz_attempts from authenticated, anon;

create or replace function public.submit_quiz_attempt(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  q record;
  qq record;
  v_score numeric := 0;
  v_max numeric := 0;
  v_ans text;
  v_released boolean;
  v_clean jsonb;
begin
  select * into a from public.lms_quiz_attempts
  where id = p_attempt and student_id = auth.uid() and status = 'in_progress' for update;
  if not found then raise exception 'In-progress attempt not found'; end if;
  select * into q from public.lms_quizzes where id = a.quiz_id;
  if q.status <> 'published' and q.results_released_at is null then
    raise exception 'Quiz not available';
  end if;
  if q.due_at is not null and now() > q.due_at and q.results_released_at is null then
    raise exception 'Quiz is past due';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.class_number = q.class_number and coalesce(p.account_type, '') = 'student'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for qq in select * from public.lms_quiz_questions where quiz_id = a.quiz_id loop
    v_max := v_max + qq.points;
    v_ans := p_answers ->> qq.id::text;
    if v_ans is not null and lower(trim(v_ans)) = lower(trim(qq.answer_key)) then
      v_score := v_score + qq.points;
    end if;
  end loop;

  v_clean := coalesce(p_answers, '{}'::jsonb) - '_pending_score' - '_pending_max';
  v_released := q.results_released_at is not null;
  update public.lms_quiz_attempts set
    answers = v_clean,
    submitted_at = now(),
    score = case when v_released then v_score else null end,
    max_score = case when v_released then v_max else null end,
    pending_score = case when v_released then null else v_score end,
    pending_max = case when v_released then null else v_max end,
    status = case when v_released then 'graded' else 'submitted' end
  where id = p_attempt;

  if not v_released then
    return jsonb_build_object('status', 'submitted', 'released', false);
  end if;
  return jsonb_build_object('status', 'graded', 'score', v_score, 'max_score', v_max, 'released', true);
end;
$$;

create or replace function public.release_quiz_results(p_quiz uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.lms_quizzes set results_released_at = now(), status = 'closed'
  where id = p_quiz and org_id = public.current_org_id();
  if not found then raise exception 'Quiz not found'; end if;

  update public.lms_quiz_attempts a set
    score = coalesce(a.pending_score, a.score),
    max_score = coalesce(a.pending_max, a.max_score),
    pending_score = null,
    pending_max = null,
    status = 'graded'
  where a.quiz_id = p_quiz and a.status in ('submitted', 'graded', 'in_progress');
end;
$$;

create or replace function public.start_or_resume_quiz(p_quiz uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_id uuid;
begin
  select * into q from public.lms_quizzes where id = p_quiz and org_id = public.current_org_id() and status = 'published';
  if not found then raise exception 'Quiz not available'; end if;
  if q.due_at is not null and now() > q.due_at then raise exception 'Quiz is past due'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.class_number = q.class_number and coalesce(p.account_type, '') = 'student'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.lms_quiz_attempts (org_id, quiz_id, student_id)
  values (q.org_id, p_quiz, auth.uid())
  on conflict (quiz_id, student_id) do update set started_at = public.lms_quiz_attempts.started_at
  returning id into v_id;

  select id into v_id from public.lms_quiz_attempts where quiz_id = p_quiz and student_id = auth.uid();
  if exists (select 1 from public.lms_quiz_attempts where id = v_id and status <> 'in_progress') then
    raise exception 'Attempt already submitted';
  end if;
  return v_id;
end;
$$;

-- 5) Fee receipt outbox: tag purpose=fees for consent gating in send-outbound
create or replace function public._notify_fee_receipt(p_receipt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  j jsonb := public._fee_receipt_json(p_receipt);
  v_org text := j -> 'organization' ->> 'short_name';
  v_student text := j -> 'student' ->> 'full_name';
  v_index text := j -> 'student' ->> 'index_number';
  v_sid uuid := (j -> 'student' ->> 'id')::uuid;
  v_org_id uuid;
  v_recorded_by uuid;
  v_months text;
  v_title text := 'Payment received';
  v_body text;
  v_data jsonb;
  v_meta jsonb;
  par record;
  fin uuid;
  v_guardian text;
  v_parent_phones int := 0;
begin
  select org_id, received_by into v_org_id, v_recorded_by from public.fee_receipts where id = p_receipt;
  select string_agg(format('%s: LKR %s%s', a ->> 'month_label', public.money_text((a ->> 'paid_now')::numeric),
                           case when (a ->> 'balance_after')::numeric > 0
                                then format(' (balance LKR %s)', public.money_text((a ->> 'balance_after')::numeric))
                                else ' (fully paid)' end), '; ')
    into v_months
  from jsonb_array_elements(j -> 'allocations') a;

  v_body := format('%s: Payment received for %s%s. %s. Total LKR %s by %s. Total arrears now LKR %s. Receipt %s.',
                   v_org, v_student, case when v_index is not null then format(' (%s)', v_index) else '' end,
                   v_months, public.money_text((j ->> 'amount')::numeric), replace(j ->> 'method', '_', ' '),
                   public.money_text((j ->> 'arrears_after')::numeric), j ->> 'receipt_no');
  v_data := jsonb_build_object('type', 'fee_receipt', 'receipt_id', p_receipt, 'token', j ->> 'public_token',
                               'student_id', v_sid, 'purpose', 'fees');
  v_meta := v_data || jsonb_build_object('attach_receipt', true, 'purpose', 'fees', 'urgent', true);

  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (v_sid, v_title, v_body, v_data, '/receipt/' || p_receipt, v_org_id);
  perform public.enqueue_user_messages(v_sid, v_title, v_body, v_meta);

  for par in
    select p.id, p.phone from public.parent_children pc join public.profiles p on p.id = pc.parent_id
    where pc.child_id = v_sid and pc.status = 'active'
  loop
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (par.id, v_title, v_body, v_data, '/receipt/' || p_receipt, v_org_id);
    perform public.enqueue_user_messages(par.id, v_title, v_body, v_meta);
    if coalesce(par.phone, '') <> '' then
      v_parent_phones := v_parent_phones + 1;
    end if;
  end loop;

  select guardian_phone into v_guardian from public.student_details where profile_id = v_sid;
  if v_parent_phones = 0 and coalesce(v_guardian, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('sms', v_guardian, v_title, v_body, v_meta || jsonb_build_object('recipient', 'guardian_phone'), v_org_id);
  end if;

  for fin in select * from public.finance_staff_ids(v_org_id) loop
    if fin is distinct from v_recorded_by then
      insert into public.notifications (user_id, title, message, data, link, org_id)
      values (fin,
              case when j ->> 'method' = 'payhere' then 'Online payment received' else 'Payment recorded' end,
              format('%s%s – LKR %s (%s). Receipt %s.', v_student,
                     case when v_index is not null then format(' (%s)', v_index) else '' end,
                     public.money_text((j ->> 'amount')::numeric), replace(j ->> 'method', '_', ' '), j ->> 'receipt_no'),
              v_data || jsonb_build_object('audience', 'finance'), '/receipt/' || p_receipt, v_org_id);
    end if;
  end loop;
end;
$$;
revoke all on function public._notify_fee_receipt(uuid) from public, anon, authenticated;

create or replace function public.checkout_library_book(
  p_book uuid,
  p_borrower uuid,
  p_due date default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_due date := coalesce(p_due, (public.org_today() + 14));
begin
  if not (public.is_employee() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.library_loans where book_id = p_book and status = 'out') then
    raise exception 'Book already on loan';
  end if;
  if not exists (select 1 from public.books where id = p_book and org_id = v_org) then
    raise exception 'Book not found';
  end if;
  if not exists (select 1 from public.profiles where id = p_borrower and org_id = v_org) then
    raise exception 'Borrower not found in this organization';
  end if;

  insert into public.library_loans (org_id, book_id, borrower_id, due_at, notes)
  values (v_org, p_book, p_borrower, v_due, nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
