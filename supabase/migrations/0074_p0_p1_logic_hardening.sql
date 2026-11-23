-- P0/P1 logic hardening: admissions stages, fee line immutability, appeals→correction,
-- class attendance session RPC, hostel escalations, bank CSV/suggest-match,
-- offline conflicts, library renew/lost, LMS retake/timer, outbox purpose helper.
set search_path = public, extensions, pg_temp;

create or replace function public.outbox_metadata_with_purpose(p_meta jsonb, p_purpose text)
returns jsonb language sql immutable as $$
  select coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('purpose', coalesce(nullif(trim(p_purpose), ''), 'general'));
$$;

-- ============================================================================
-- 1) Admissions stage machine
-- ============================================================================
create or replace function public._admission_stage_allowed(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case
    when p_from is not distinct from p_to then true
    when p_from = 'lead' and p_to in ('submitted', 'rejected') then true
    when p_from = 'submitted' and p_to in ('interview', 'accepted', 'rejected') then true
    when p_from = 'interview' and p_to in ('accepted', 'rejected', 'submitted') then true
    when p_from = 'accepted' and p_to in ('rejected') then true
    when p_from = 'rejected' and p_to in ('submitted', 'lead') then true
    else false
  end;
$$;

create or replace function public.tg_admissions_stage_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.pipeline_stage is distinct from old.pipeline_stage
       or new.status is distinct from old.status
     )
     and current_setting('app.admission_transition', true) is distinct from '1'
     and current_user in ('anon', 'authenticated') then
    raise exception 'Use transition_admission_stage or enroll_admission to change stage'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_admissions_stage_guard on public.admissions;
create trigger trg_admissions_stage_guard
  before update on public.admissions
  for each row execute function public.tg_admissions_stage_guard();

create or replace function public.transition_admission_stage(
  p_admission uuid,
  p_to_stage text,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_to text := lower(trim(p_to_stage));
  v_status text;
begin
  if not public.is_admissions_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_to = 'enrolled' then
    raise exception 'Use enroll_admission to enrol an applicant';
  end if;
  if v_to not in ('lead', 'submitted', 'interview', 'accepted', 'rejected') then
    raise exception 'Invalid stage';
  end if;

  select * into a from public.admissions
  where id = p_admission and org_id = public.current_org_id() for update;
  if not found then raise exception 'Admission not found'; end if;
  if not public._admission_stage_allowed(a.pipeline_stage, v_to) then
    raise exception 'Transition from % to % is not allowed', a.pipeline_stage, v_to;
  end if;

  v_status := case v_to
    when 'lead' then 'lead'
    when 'submitted' then 'pending'
    when 'interview' then 'pending'
    when 'accepted' then 'approved'
    when 'rejected' then 'rejected'
    else coalesce(a.status, v_to)
  end;

  perform set_config('app.admission_transition', '1', true);
  update public.admissions set
    pipeline_stage = v_to,
    status = v_status,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_admission;

  insert into public.admission_status_history (admission_id, from_stage, to_stage, changed_by, note, org_id)
  values (p_admission, a.pipeline_stage, v_to, auth.uid(), nullif(trim(coalesce(p_note, '')), ''), a.org_id);

  return jsonb_build_object('ok', true, 'from', a.pipeline_stage, 'to', v_to, 'status', v_status);
end;
$$;

revoke all on function public.transition_admission_stage(uuid, text, text) from public, anon;
grant execute on function public.transition_admission_stage(uuid, text, text) to authenticated;

-- enroll_admission (0051 signature): set stage-guard flag before updating pipeline_stage
create or replace function public.enroll_admission(
  p_admission_id uuid, p_index_number text, p_class_number int default 1, p_default_fee numeric default 2000)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  adm record;
  invite_token text;
begin
  if not public.is_admissions_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into adm from public.admissions where id = p_admission_id and org_id = public.current_org_id() for update;
  if not found then
    raise exception 'admission not found';
  end if;
  if adm.pipeline_stage = 'enrolled' or adm.status = 'enrolled' or adm.enrolled_index is not null then
    raise exception 'This application is already enrolled (index %)', coalesce(adm.enrolled_index, '—');
  end if;
  if adm.pipeline_stage = 'rejected' then
    raise exception 'A rejected application cannot be enrolled; move it back to a review stage first';
  end if;
  if coalesce(trim(p_index_number), '') = '' then
    raise exception 'An index number is required';
  end if;

  if exists (select 1 from public.valid_index_numbers
             where index_number = p_index_number and (org_id <> adm.org_id or is_registered)) then
    raise exception 'Index number % is already in use', p_index_number;
  end if;
  insert into public.valid_index_numbers (index_number, student_name, class_number, is_registered, org_id)
  values (p_index_number, adm.student_name, p_class_number, false, adm.org_id)
  on conflict (index_number) do update
    set student_name = excluded.student_name, class_number = excluded.class_number
    where public.valid_index_numbers.org_id = adm.org_id and not public.valid_index_numbers.is_registered;

  perform set_config('app.admission_transition', '1', true);
  update public.admissions
  set status = 'enrolled', pipeline_stage = 'enrolled', enrolled_index = p_index_number,
      enrolled_class = p_class_number, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_admission_id;

  insert into public.admission_status_history (admission_id, from_stage, to_stage, changed_by, note, org_id)
  values (p_admission_id, adm.pipeline_stage, 'enrolled', auth.uid(),
          format('Enrolled index %s class %s', p_index_number, p_class_number), adm.org_id);

  insert into public.parent_invites (child_index, child_name, admission_id, created_by, org_id)
  values (p_index_number, adm.student_name, p_admission_id, auth.uid(), adm.org_id)
  returning token into invite_token;

  if coalesce(adm.phone, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('sms', adm.phone, 'Parent portal invite',
            format('Your child %s is enrolled (index %s). Register as a parent and use invite code %s to link.',
                   adm.student_name, p_index_number, invite_token),
            public.outbox_metadata_with_purpose(
              jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token),
              'general'),
            adm.org_id);
  end if;
  if coalesce(adm.email, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('email', adm.email, 'Parent portal invite',
            format(E'Assalamu alaikum %s,\n\nYour child %s has been enrolled.\nIndex number: %s\nClass: %s\nInvite code: %s\n\nPlease register as a parent and link this index in the Parent Portal.',
                   adm.parent_name, adm.student_name, p_index_number, p_class_number, invite_token),
            public.outbox_metadata_with_purpose(
              jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token),
              'general'),
            adm.org_id);
  end if;

  return jsonb_build_object('ok', true, 'index_number', p_index_number, 'class_number', p_class_number,
                            'fee_month', to_char(public.org_now(), 'YYYY-MM'), 'suggested_fee', p_default_fee,
                            'parent_invite_token', invite_token, 'org_id', adm.org_id);
end;
$$;

-- Narrow history writes to RPC (keep select for staff)
drop policy if exists "admission_history: admissions staff" on public.admission_status_history;
create policy "admission_history: admissions staff read" on public.admission_status_history
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (public.is_admin() or public.has_staff_role(array['principal', 'vice_principal', 'admissions_officer']) or public.is_employee())
  );
drop policy if exists "admission_history: no direct write" on public.admission_status_history;
create policy "admission_history: no direct write" on public.admission_status_history
  for all to authenticated using (false) with check (false);

-- ============================================================================
-- 2) Fee lines: block direct INSERT; ensure adjustments post GL
-- ============================================================================
drop policy if exists "fee_lines: finance add" on public.fee_invoice_lines;
-- Authenticated clients cannot insert lines; SECURITY DEFINER RPCs bypass RLS.

create or replace function public.credit_fee_invoice(p_fee uuid, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_amt numeric;
  v_line uuid;
  v_adj uuid;
begin
  if not (public.is_accountant() or public.is_treasurer() or public.has_staff_role(array['principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into f from public.student_fees where id = p_fee and org_id = public.current_org_id() for update;
  if not found or f.cancelled_at is not null then
    raise exception 'Open invoice not found';
  end if;
  perform public._assert_books_open_for_fee(f.id);
  v_amt := least(abs(p_amount), greatest(f.total_due - f.paid_amount, 0));
  if v_amt <= 0 then
    raise exception 'Nothing to credit';
  end if;

  insert into public.fee_invoice_lines (org_id, fee_id, kind, description, amount)
  values (f.org_id, f.id, 'adjustment', format('Credit: %s', p_reason), -v_amt)
  returning id into v_line;

  insert into public.fee_adjustments (org_id, fee_id, student_id, kind, amount, reason, line_id, approved_by)
  values (f.org_id, f.id, f.student_id, 'credit', v_amt, p_reason, v_line, auth.uid())
  returning id into v_adj;

  -- Ensure GL posted even if AFTER trigger skipped (e.g. generator flag)
  perform public._post_invoice_lines_journal(f.id);
  perform public._fee_recalc(f.id);
  return v_adj;
end;
$$;

create or replace function public.write_off_fee_invoice(p_fee uuid, p_reason text, p_amount numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_amt numeric;
  v_line uuid;
  v_adj uuid;
begin
  if not (public.is_accountant() or public.has_staff_role(array['principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into f from public.student_fees where id = p_fee and org_id = public.current_org_id() for update;
  if not found or f.cancelled_at is not null then
    raise exception 'Open invoice not found';
  end if;
  perform public._assert_books_open_for_fee(f.id);
  v_amt := least(coalesce(p_amount, f.total_due - f.paid_amount), greatest(f.total_due - f.paid_amount, 0));
  if v_amt <= 0 then
    raise exception 'Nothing to write off';
  end if;

  insert into public.fee_invoice_lines (org_id, fee_id, kind, description, amount)
  values (f.org_id, f.id, 'waiver', format('Write-off: %s', p_reason), -v_amt)
  returning id into v_line;

  insert into public.fee_adjustments (org_id, fee_id, student_id, kind, amount, reason, line_id, approved_by)
  values (f.org_id, f.id, f.student_id, 'write_off', v_amt, p_reason, v_line, auth.uid())
  returning id into v_adj;

  perform public._post_invoice_lines_journal(f.id);
  perform public._fee_recalc(f.id);
  return v_adj;
end;
$$;

-- ============================================================================
-- 3) Appeals → draft correction on accept
-- ============================================================================
create or replace function public.review_result_appeal(
  p_appeal uuid,
  p_decision text,
  p_notes text default null,
  p_resit_exam uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  r record;
  v_decision text := lower(trim(p_decision));
  v_corr uuid;
begin
  if not (public.is_admin() or public.has_staff_role(array['principal', 'vice_principal', 'exam_officer'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_decision not in ('accepted', 'rejected', 'resit_scheduled', 'under_review') then
    raise exception 'Invalid decision';
  end if;
  select * into a from public.result_appeals
  where id = p_appeal and org_id = public.current_org_id() for update;
  if not found then raise exception 'Appeal not found'; end if;
  if a.status in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'Appeal already resolved';
  end if;
  if v_decision = 'resit_scheduled' and p_resit_exam is null then
    raise exception 'Resit exam is required';
  end if;

  if v_decision = 'accepted' then
    select * into r from public.student_results where id = a.result_id;
    if not found then raise exception 'Result not found'; end if;
    insert into public.result_corrections (
      org_id, result_id, exam_id, student_id, old_marks, new_marks, old_grade, new_grade,
      reason, requester_id, status
    ) values (
      a.org_id, r.id, r.exam_id, r.student_id, r.marks_obtained, r.marks_obtained, r.grade, r.grade,
      format('Appeal accepted: %s', coalesce(nullif(trim(p_notes), ''), a.reason)),
      auth.uid(), 'draft'
    )
    returning id into v_corr;
  end if;

  update public.result_appeals
  set status = v_decision,
      reviewer_id = auth.uid(),
      review_notes = p_notes,
      resit_exam_id = case when v_decision = 'resit_scheduled' then p_resit_exam else resit_exam_id end,
      correction_id = coalesce(v_corr, correction_id),
      resolved_at = case when v_decision in ('accepted', 'rejected', 'resit_scheduled') then now() else resolved_at end
  where id = p_appeal;

  return jsonb_build_object(
    'ok', true,
    'status', v_decision,
    'correction_id', v_corr,
    'resit_exam_id', case when v_decision = 'resit_scheduled' then p_resit_exam else null end
  );
end;
$$;

-- ============================================================================
-- 4) Class attendance session RPC
-- ============================================================================
create or replace function public.save_class_attendance_session(
  p_class int,
  p_date date,
  p_marks jsonb,
  p_correction_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  m jsonb;
  v_student uuid;
  v_status text;
  v_note text;
  v_existing record;
  v_inserted int := 0;
  v_updated int := 0;
  v_corrected int := 0;
begin
  if p_class is null or p_date is null then
    raise exception 'Class and date required';
  end if;
  if not (public.is_academic_admin() or public.is_admin() or public.is_employee()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) loop
    v_student := (m ->> 'student_id')::uuid;
    v_status := lower(trim(m ->> 'status'));
    v_note := nullif(trim(coalesce(m ->> 'excuse_note', '')), '');
    if v_student is null or v_status not in ('present', 'absent', 'late', 'excused') then
      continue;
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = v_student and p.org_id = v_org and p.account_type = 'student'
        and p.class_number = p_class and p.is_approved
    ) then
      raise exception 'Student % not in class %', v_student, p_class;
    end if;
    if not (public.is_academic_admin() or public.is_admin() or public.tutor_can_teach_student(v_student)) then
      raise exception 'forbidden' using errcode = '42501';
    end if;

    select * into v_existing from public.attendance
    where student_id = v_student and date = p_date and org_id = v_org for update;

    if not found then
      insert into public.attendance (student_id, date, status, excuse_note, marked_by, org_id)
      values (v_student, p_date, v_status, v_note, auth.uid(), v_org);
      v_inserted := v_inserted + 1;
    elsif v_existing.status is distinct from v_status
       or coalesce(v_existing.excuse_note, '') is distinct from coalesce(v_note, '') then
      if coalesce(trim(p_correction_reason), '') = '' then
        raise exception 'Changing existing attendance requires p_correction_reason';
      end if;
      perform public.correct_attendance(
        v_student, p_date, v_status,
        case when v_status = 'late' then 'late' when v_status = 'excused' then 'excused' else 'corrected' end,
        p_correction_reason, p_class, 'day'
      );
      if v_note is not null then
        update public.attendance set excuse_note = v_note where student_id = v_student and date = p_date and org_id = v_org;
      end if;
      v_corrected := v_corrected + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'unchanged', v_updated,
    'corrected', v_corrected
  );
end;
$$;

revoke all on function public.save_class_attendance_session(int, date, jsonb, text) from public, anon;
grant execute on function public.save_class_attendance_session(int, date, jsonb, text) to authenticated;

-- ============================================================================
-- 5) Hostel roll-call escalations
-- ============================================================================
create table if not exists public.hostel_rollcall_escalations (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  rollcall_id   uuid not null references public.hostel_rollcalls (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete restrict,
  attempt_at    timestamptz not null default now(),
  channel       text not null default 'phone'
                check (channel in ('phone', 'sms', 'whatsapp', 'in_person', 'other')),
  outcome       text not null default 'attempted'
                check (outcome in ('attempted', 'reached', 'no_answer', 'left_message', 'escalated', 'resolved')),
  notes         text,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_hostel_esc_roll on public.hostel_rollcall_escalations (rollcall_id, student_id, attempt_at desc);

alter table public.hostel_rollcall_escalations enable row level security;
drop policy if exists "hostel_esc: read" on public.hostel_rollcall_escalations;
create policy "hostel_esc: read" on public.hostel_rollcall_escalations for select to authenticated
  using (org_id = (select public.current_org_id()) and public.is_employee());
drop policy if exists "hostel_esc: no direct write" on public.hostel_rollcall_escalations;
create policy "hostel_esc: no direct write" on public.hostel_rollcall_escalations for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('hostel_rollcall_escalations', 'student_id');
select public.apply_mfa_policy('hostel_rollcall_escalations'::regclass);
select public.attach_audit('hostel_rollcall_escalations');

create or replace function public.log_hostel_rollcall_escalation(
  p_rollcall uuid,
  p_student uuid,
  p_channel text default 'phone',
  p_outcome text default 'attempted',
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_ch text := coalesce(nullif(trim(p_channel), ''), 'phone');
  v_out text := coalesce(nullif(trim(p_outcome), ''), 'attempted');
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.hostel_rollcalls
    where id = p_rollcall and org_id = v_org and status = 'open'
  ) then
    raise exception 'Open roll-call not found';
  end if;
  if not exists (
    select 1 from public.hostel_rollcall_marks
    where rollcall_id = p_rollcall and student_id = p_student
  ) then
    raise exception 'Student not on this roll-call';
  end if;
  if v_ch not in ('phone', 'sms', 'whatsapp', 'in_person', 'other') then
    raise exception 'Invalid channel';
  end if;
  if v_out not in ('attempted', 'reached', 'no_answer', 'left_message', 'escalated', 'resolved') then
    raise exception 'Invalid outcome';
  end if;

  insert into public.hostel_rollcall_escalations (org_id, rollcall_id, student_id, channel, outcome, notes)
  values (v_org, p_rollcall, p_student, v_ch, v_out, nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.log_hostel_rollcall_escalation(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.log_hostel_rollcall_escalation(uuid, uuid, text, text, text) to authenticated;

-- ============================================================================
-- 6) Bank recon CSV import + suggest match
-- ============================================================================
create or replace function public.import_bank_statement_lines(p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  l jsonb;
  v_n int := 0;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_date date;
  v_amt numeric;
begin
  if not public.is_finance_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_date := coalesce((l ->> 'date')::date, (l ->> 'statement_date')::date);
    v_amt := round(coalesce((l ->> 'amount')::numeric, 0), 2);
    if v_date is null or v_amt = 0 then
      continue;
    end if;
    insert into public.bank_statement_lines (org_id, statement_date, amount, reference, description)
    values (
      v_org, v_date, v_amt,
      nullif(trim(coalesce(l ->> 'reference', l ->> 'ref', '')), ''),
      nullif(trim(coalesce(l ->> 'description', l ->> 'memo', '')), '')
    )
    returning id into v_id;
    v_ids := array_append(v_ids, v_id);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('imported', v_n, 'ids', to_jsonb(v_ids));
end;
$$;

create or replace function public.suggest_bank_matches(p_line uuid, p_day_window int default 3)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l record;
  v_win int := greatest(coalesce(p_day_window, 3), 0);
begin
  if not public.is_finance_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into l from public.bank_statement_lines
  where id = p_line and org_id = public.current_org_id();
  if not found then raise exception 'Statement line not found'; end if;

  return coalesce((
    select jsonb_agg(x order by x.score desc)
    from (
      select jsonb_build_object(
        'kind', 'fee_payment',
        'id', p.id,
        'receipt_no', p.receipt_no,
        'amount', p.amount,
        'paid_at', p.paid_at,
        'student_id', p.student_id,
        'score',
          case when abs(p.amount - abs(l.amount)) < 0.01 then 100 else 50 end
          + case when abs(p.paid_at::date - l.statement_date) = 0 then 20
                 when abs(p.paid_at::date - l.statement_date) <= v_win then 10
                 else 0 end
      ) as x
      from public.fee_payments p
      where p.org_id = l.org_id
        and p.status = 'posted'
        and abs(p.amount - abs(l.amount)) <= 0.01
        and p.paid_at::date between (l.statement_date - v_win) and (l.statement_date + v_win)
        and not exists (
          select 1 from public.bank_statement_lines b
          where b.matched_payment = p.id and b.status = 'matched'
        )
      limit 20
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.import_bank_statement_lines(jsonb) from public, anon;
revoke all on function public.suggest_bank_matches(uuid, int) from public, anon;
grant execute on function public.import_bank_statement_lines(jsonb) to authenticated;
grant execute on function public.suggest_bank_matches(uuid, int) to authenticated;

-- ============================================================================
-- 7) Offline attendance: conflict instead of LWW
-- ============================================================================
alter table public.offline_sync_queue drop constraint if exists offline_sync_queue_status_check;
alter table public.offline_sync_queue
  add constraint offline_sync_queue_status_check
  check (status in ('pending', 'applied', 'rejected', 'duplicate', 'conflict'));

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
  v_row record;
  v_result jsonb;
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(trim(p_device_id), '') = '' or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'device_id and idempotency_key required';
  end if;

  select * into v_existing from public.offline_sync_queue
  where org_id = v_org and device_id = trim(p_device_id) and idempotency_key = trim(p_idempotency_key);
  if found then
    return jsonb_build_object('status', 'duplicate', 'queue_id', v_existing.id, 'result', v_existing.result);
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

  insert into public.offline_sync_queue (org_id, device_id, idempotency_key, kind, payload, status)
  values (v_org, trim(p_device_id), trim(p_idempotency_key), 'attendance_draft', p_payload, 'pending')
  returning id into v_qid;

  select * into v_row from public.attendance
  where student_id = v_student and date = v_date and org_id = v_org for update;

  if found and (
       v_row.status is distinct from v_status
       or coalesce(v_row.excuse_note, '') is distinct from coalesce(v_note, '')
     ) then
    v_result := jsonb_build_object(
      'server', jsonb_build_object(
        'status', v_row.status,
        'excuse_note', v_row.excuse_note,
        'marked_by', v_row.marked_by,
        'updated_hint', v_row.marked_by
      ),
      'client', jsonb_build_object(
        'status', v_status,
        'excuse_note', v_note
      ),
      'student_id', v_student,
      'date', v_date
    );
    update public.offline_sync_queue set
      status = 'conflict',
      applied_at = now(),
      result = v_result,
      error = 'Server attendance differs; resolve via correct_attendance'
    where id = v_qid;
    return jsonb_build_object('status', 'conflict', 'queue_id', v_qid, 'result', v_result);
  end if;

  begin
    if not found then
      insert into public.attendance (student_id, date, status, excuse_note, marked_by, org_id)
      values (v_student, v_date, v_status, v_note, auth.uid(), v_org);
    end if;
    -- Identical existing row: treat as applied (no overwrite).

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

-- ============================================================================
-- 8) Library renew + lost
-- ============================================================================
alter table public.library_loans
  add column if not exists renew_count int not null default 0;

create or replace function public.renew_library_loan(p_loan uuid, p_due date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_due date;
begin
  if not (public.is_employee() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into l from public.library_loans
  where id = p_loan and org_id = public.current_org_id() for update;
  if not found then raise exception 'Loan not found'; end if;
  if l.status <> 'out' then raise exception 'Only active (out) loans can be renewed'; end if;
  if l.due_at < public.org_today() then raise exception 'Overdue loans cannot be renewed; return or mark lost'; end if;
  if l.renew_count >= 2 then raise exception 'Maximum renewals reached'; end if;
  v_due := coalesce(p_due, l.due_at + 14);
  if v_due <= l.due_at then raise exception 'New due date must be after current due date'; end if;

  update public.library_loans set
    due_at = v_due,
    renew_count = renew_count + 1,
    notes = coalesce(notes || ' | ', '') || format('renewed to %s', v_due)
  where id = p_loan;

  return jsonb_build_object('ok', true, 'due_at', v_due, 'renew_count', l.renew_count + 1);
end;
$$;

create or replace function public.mark_library_loan_lost(p_loan uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_employee() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update public.library_loans set
    status = 'lost',
    returned_at = coalesce(returned_at, now()),
    returned_by = auth.uid(),
    notes = case when coalesce(trim(p_reason), '') = '' then notes
                 else coalesce(notes || ' | ', '') || 'lost: ' || trim(p_reason) end
  where id = p_loan and org_id = public.current_org_id() and status in ('out', 'overdue');
  if not found then raise exception 'Open loan not found'; end if;
end;
$$;

revoke all on function public.renew_library_loan(uuid, date) from public, anon;
revoke all on function public.mark_library_loan_lost(uuid, text) from public, anon;
grant execute on function public.renew_library_loan(uuid, date) to authenticated;
grant execute on function public.mark_library_loan_lost(uuid, text) to authenticated;

-- Keep overdue marker org-scoped (from 0068)
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

-- ============================================================================
-- 9) LMS quiz: max attempts, time limit
-- ============================================================================
alter table public.lms_quizzes
  add column if not exists max_attempts int not null default 1
    check (max_attempts between 1 and 10),
  add column if not exists time_limit_minutes int
    check (time_limit_minutes is null or time_limit_minutes between 1 and 600);

alter table public.lms_quiz_attempts
  add column if not exists attempt_number int not null default 1;

-- Replace single-attempt unique with (quiz, student, attempt_number)
alter table public.lms_quiz_attempts drop constraint if exists lms_quiz_attempts_quiz_id_student_id_key;
create unique index if not exists uq_lms_quiz_attempt_number
  on public.lms_quiz_attempts (quiz_id, student_id, attempt_number);

create or replace function public.start_or_resume_quiz(p_quiz uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_id uuid;
  v_open uuid;
  v_count int;
  v_next int;
begin
  select * into q from public.lms_quizzes where id = p_quiz and org_id = public.current_org_id() and status = 'published';
  if not found then raise exception 'Quiz not available'; end if;
  if q.due_at is not null and now() > q.due_at then raise exception 'Quiz is past due'; end if;

  select id into v_open from public.lms_quiz_attempts
  where quiz_id = p_quiz and student_id = auth.uid() and status = 'in_progress'
  order by attempt_number desc limit 1;
  if v_open is not null then
    return v_open;
  end if;

  select count(*)::int into v_count
  from public.lms_quiz_attempts
  where quiz_id = p_quiz and student_id = auth.uid();
  if v_count >= coalesce(q.max_attempts, 1) then
    raise exception 'Maximum attempts reached';
  end if;
  v_next := coalesce((
    select max(attempt_number) from public.lms_quiz_attempts
    where quiz_id = p_quiz and student_id = auth.uid()
  ), 0) + 1;

  insert into public.lms_quiz_attempts (org_id, quiz_id, student_id, attempt_number)
  values (q.org_id, p_quiz, auth.uid(), v_next)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.submit_quiz_attempt(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  q record;
  qq record;
  v_score numeric := 0;
  v_max numeric := 0;
  v_ans text;
begin
  select * into a from public.lms_quiz_attempts
  where id = p_attempt and student_id = auth.uid() and status = 'in_progress' for update;
  if not found then raise exception 'In-progress attempt not found'; end if;
  select * into q from public.lms_quizzes where id = a.quiz_id;
  if q.due_at is not null and now() > q.due_at then raise exception 'Quiz is past due'; end if;
  if q.time_limit_minutes is not null
     and now() > a.started_at + make_interval(mins => q.time_limit_minutes) then
    raise exception 'Time limit exceeded';
  end if;

  for qq in select * from public.lms_quiz_questions where quiz_id = a.quiz_id loop
    v_max := v_max + qq.points;
    v_ans := p_answers ->> qq.id::text;
    if v_ans is not null and lower(trim(v_ans)) = lower(trim(qq.answer_key)) then
      v_score := v_score + qq.points;
    end if;
  end loop;

  update public.lms_quiz_attempts set
    answers = coalesce(p_answers, '{}'::jsonb),
    submitted_at = now(),
    score = v_score,
    max_score = v_max,
    status = 'graded'
  where id = p_attempt;

  if q.results_released_at is null then
    return jsonb_build_object('status', 'submitted', 'released', false);
  end if;
  return jsonb_build_object('status', 'graded', 'score', v_score, 'max_score', v_max, 'released', true);
end;
$$;

create or replace function public.create_lms_quiz(
  p_class int,
  p_subject text,
  p_title text,
  p_instructions text default null,
  p_due timestamptz default null,
  p_max_attempts int default 1,
  p_time_limit_minutes int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_org uuid := public.current_org_id();
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.lms_quizzes (
    org_id, tutor_id, class_number, subject, title, instructions, due_at, max_attempts, time_limit_minutes
  ) values (
    v_org, auth.uid(), p_class, coalesce(nullif(trim(p_subject), ''), 'General'),
    trim(p_title), p_instructions, p_due,
    greatest(1, least(coalesce(p_max_attempts, 1), 10)),
    p_time_limit_minutes
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_lms_quiz(int, text, text, text, timestamptz, int, int) from public, anon;
grant execute on function public.create_lms_quiz(int, text, text, text, timestamptz, int, int) to authenticated;

-- Keep 5-arg create_lms_quiz overload for existing clients
create or replace function public.create_lms_quiz(
  p_class int, p_subject text, p_title text, p_instructions text default null, p_due timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public.create_lms_quiz(p_class, p_subject, p_title, p_instructions, p_due, 1, null);
end;
$$;
revoke all on function public.create_lms_quiz(int, text, text, text, timestamptz) from public, anon;
grant execute on function public.create_lms_quiz(int, text, text, text, timestamptz) to authenticated;

-- ============================================================================
-- Outbox: tag broadcast rows with purpose=marketing for consent gating
-- ============================================================================
create or replace function public.tg_notification_broadcast_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data ->> 'external_channels' = 'true' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
    select p.id, pref.channel, pref.address, new.title, new.message,
           public.outbox_metadata_with_purpose(
             jsonb_build_object('type', 'broadcast', 'notification_id', new.id, 'link', new.link),
             'marketing'),
           new.org_id
    from public.profiles p
    cross join lateral (
      select 'sms'::text channel, p.phone address where p.notify_sms and trim(coalesce(p.phone, '')) <> ''
      union all select 'whatsapp', p.phone where p.notify_whatsapp and trim(coalesce(p.phone, '')) <> ''
      union all select 'email', p.email where p.notify_email and trim(coalesce(p.email, '')) <> ''
    ) pref
    where p.id = new.user_id and p.org_id = new.org_id and p.notify_broadcast_channels
      and public.purpose_notify_allowed(p.id, 'marketing');
  end if;
  return null;
end;
$$;
