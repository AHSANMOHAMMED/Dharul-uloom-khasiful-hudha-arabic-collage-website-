-- Locale-aware resend/reminders/monthly invoices; org_id on finance shares; leave review guard.
set search_path = public, extensions, pg_temp;

-- Students must not forge payment SMS (test: student cannot forge payment notifications).
revoke all on function public.notify_payment_received(uuid, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.notify_payment_received(uuid, numeric, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Leave: only review_student_leave may approve/reject (so SMS enqueue always runs).
-- ---------------------------------------------------------------------------
create or replace function public._leave_status_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE'
     and NEW.status is distinct from OLD.status
     and NEW.status in ('approved', 'rejected')
     and current_setting('app.leave_review', true) is distinct from '1' then
    raise exception 'Use review_student_leave to approve or reject leave'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_leave_status_guard on public.leave_requests;
create trigger trg_leave_status_guard
  before update on public.leave_requests
  for each row execute function public._leave_status_guard();

create or replace function public.review_student_leave(
  p_leave uuid,
  p_status text,
  p_response_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lv record;
  v_status text := lower(trim(p_status));
  v_org_name text;
  v_student_name text;
  v_copy jsonb;
  v_locale text;
  v_meta jsonb;
  par record;
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_status not in ('approved', 'rejected') then
    raise exception 'Status must be approved or rejected';
  end if;
  if not (public.is_employee() or public.is_admin() or public.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into lv from public.leave_requests where id = p_leave for update;
  if not found then raise exception 'Leave request not found'; end if;
  if lv.org_id is distinct from public.current_org_id() and not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if lv.status is distinct from 'pending' then
    raise exception 'Leave request is not pending';
  end if;

  perform set_config('app.leave_review', '1', true);
  update public.leave_requests
  set status = v_status,
      response_note = nullif(trim(p_response_note), ''),
      reviewed_by = auth.uid()
  where id = p_leave;

  select coalesce(nullif(code, ''), name_en) into v_org_name from public.organizations where id = lv.org_id;
  select full_name into v_student_name from public.profiles where id = lv.student_id;
  v_meta := jsonb_build_object(
    'type', 'leave_decision', 'leave_id', p_leave, 'purpose', 'attendance', 'urgent', true,
    'student_id', lv.student_id, 'status', v_status
  );

  v_locale := public.profile_locale(lv.student_id);
  v_copy := public._leave_decision_copy(v_locale, v_org_name, coalesce(v_student_name, 'student'),
            v_status, lv.start_date, lv.end_date, p_response_note);
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (lv.student_id, v_copy ->> 'title', v_copy ->> 'body', v_meta, '/dashboard?tab=leaves', lv.org_id);
  perform public.enqueue_user_messages(lv.student_id, v_copy ->> 'title', v_copy ->> 'body', v_meta);

  for par in
    select distinct p.id
    from public.profiles p
    where p.id = lv.parent_id
       or exists (
         select 1 from public.parent_children pc
         where pc.parent_id = p.id and pc.child_id = lv.student_id and pc.status = 'active'
           and coalesce((pc.permissions ->> 'leave')::boolean, true)
       )
  loop
    if par.id is null or par.id = lv.student_id then continue; end if;
    v_locale := public.profile_locale(par.id);
    v_copy := public._leave_decision_copy(v_locale, v_org_name, coalesce(v_student_name, 'student'),
              v_status, lv.start_date, lv.end_date, p_response_note);
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (par.id, v_copy ->> 'title', v_copy ->> 'body', v_meta, '/dashboard?tab=leaves', lv.org_id);
    perform public.enqueue_user_messages(par.id, v_copy ->> 'title', v_copy ->> 'body', v_meta);
  end loop;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;
revoke all on function public.review_student_leave(uuid, text, text) from public, anon;
grant execute on function public.review_student_leave(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Resend receipt — locale + full amount (same copy as payment notify).
-- ---------------------------------------------------------------------------
create or replace function public.resend_receipt(p_receipt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  j jsonb;
  par record;
  v_n int := 0;
  v_copy jsonb;
  v_locale text;
  v_org text;
  v_student text;
  v_index text;
  v_months text;
  v_amount text;
  v_method text;
  v_arrears text;
  v_meta jsonb;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.fee_receipts where id = p_receipt and org_id = public.current_org_id();
  if not found then
    raise exception 'Receipt not found';
  end if;
  j := public._fee_receipt_json(p_receipt);
  v_org := j -> 'organization' ->> 'short_name';
  v_student := j -> 'student' ->> 'full_name';
  v_index := j -> 'student' ->> 'index_number';
  v_amount := public.money_text((j ->> 'amount')::numeric);
  v_method := replace(j ->> 'method', '_', ' ');
  v_arrears := public.money_text((j ->> 'arrears_after')::numeric);
  select string_agg(format('%s: LKR %s', a ->> 'month_label', public.money_text((a ->> 'paid_now')::numeric)), '; ')
    into v_months
  from jsonb_array_elements(j -> 'allocations') a;
  v_meta := jsonb_build_object(
    'type', 'fee_receipt', 'receipt_id', r.id, 'token', r.public_token,
    'attach_receipt', true, 'purpose', 'fees', 'urgent', true,
    'student_id', r.student_id, 'amount', r.amount, 'receipt_no', r.receipt_no
  );

  v_locale := public.profile_locale(r.student_id);
  v_copy := public._fee_receipt_copy(v_locale, v_org, v_student, v_index, coalesce(v_months, 'Tuition'),
            v_amount, v_method, v_arrears, r.receipt_no);
  perform public.enqueue_user_messages(r.student_id, v_copy ->> 'title', v_copy ->> 'body', v_meta);
  v_n := v_n + 1;

  for par in
    select parent_id from public.parent_children
    where child_id = r.student_id and status = 'active'
      and coalesce((permissions ->> 'fees')::boolean, true)
  loop
    v_locale := public.profile_locale(par.parent_id);
    v_copy := public._fee_receipt_copy(v_locale, v_org, v_student, v_index, coalesce(v_months, 'Tuition'),
              v_amount, v_method, v_arrears, r.receipt_no);
    perform public.enqueue_user_messages(par.parent_id, v_copy ->> 'title', v_copy ->> 'body', v_meta);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'families', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fee reminder — en/ta/ar with full outstanding amount.
-- ---------------------------------------------------------------------------
create or replace function public._fee_reminder_copy(
  p_locale text, p_org text, p_student text, p_index text,
  p_amount text, p_months text, p_note text
) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  loc text := coalesce(nullif(trim(p_locale), ''), 'en');
  idx text := case when coalesce(p_index, '') <> '' then format(' (%s)', p_index) else '' end;
  note text := case when coalesce(p_note, '') <> '' then ' ' || p_note else '' end;
  title text;
  body text;
begin
  if loc = 'ta' then
    title := 'கட்டண நினைவூட்டல்';
    body := format('%s: %s%s க்கான கட்டண நினைவூட்டல். நிலுவை LKR %s (%s).%s அலுவலகம் அல்லது பெற்றோர் செயலியில் செலுத்தவும்.',
      coalesce(p_org, 'Madrasa'), p_student, idx, p_amount, coalesce(p_months, ''), note);
  elsif loc = 'ar' then
    title := 'تذكير بالرسوم';
    body := format('%s: تذكير برسوم %s%s. المستحق LKR %s (%s).%s ادفع في المكتب أو تطبيق ولي الأمر.',
      coalesce(p_org, 'Madrasa'), p_student, idx, p_amount, coalesce(p_months, ''), note);
  else
    title := 'Fee reminder';
    body := format('%s: Fee reminder for %s%s. Outstanding LKR %s for %s.%s Please pay at the office or in the parent app.',
      coalesce(p_org, 'College'), p_student, idx, p_amount, coalesce(p_months, ''), note);
  end if;
  return jsonb_build_object('title', title, 'body', body);
end;
$$;

create or replace function public.send_fee_reminder(p_student uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  s record;
  a jsonb;
  v_copy jsonb;
  v_locale text;
  v_short text;
  v_months text;
  v_amount text;
  par record;
  v_sent int := 0;
  v_parent_phones int := 0;
  v_guardian text;
  v_meta jsonb;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id, full_name, index_number into s from public.profiles
  where id = p_student and org_id = v_org and account_type = 'student';
  if not found then raise exception 'Student not found'; end if;
  a := public.student_arrears(p_student);
  if coalesce((a ->> 'total')::numeric, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_arrears');
  end if;
  if exists (select 1 from public.message_outbox
             where org_id = v_org and metadata ->> 'type' = 'fee_reminder' and metadata ->> 'student_id' = p_student::text
               and created_at > now() - interval '20 hours')
     or exists (select 1 from public.notifications
             where org_id = v_org and user_id = p_student and data ->> 'type' = 'fee_reminder'
               and data ->> 'student_id' = p_student::text and created_at > now() - interval '20 hours') then
    raise exception 'A reminder was already sent to this family in the last 20 hours';
  end if;
  select coalesce(settings ->> 'short_name', name_en) into v_short from public.organizations where id = v_org;
  v_amount := public.money_text((a ->> 'total')::numeric);
  select string_agg(to_char(to_date(m ->> 'month' || '-01', 'YYYY-MM-DD'), 'FMMon YYYY'), ', ')
    into v_months from jsonb_array_elements(a -> 'months') m;
  v_meta := jsonb_build_object('type', 'fee_reminder', 'student_id', p_student, 'purpose', 'fees', 'urgent', true);

  v_locale := public.profile_locale(p_student);
  v_copy := public._fee_reminder_copy(v_locale, v_short, s.full_name, s.index_number, v_amount, v_months, p_note);
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (p_student, v_copy ->> 'title', v_copy ->> 'body', v_meta, '/fees', v_org);
  perform public.enqueue_user_messages(p_student, v_copy ->> 'title', v_copy ->> 'body', v_meta);

  for par in
    select pc.parent_id, p.phone from public.parent_children pc
    join public.profiles p on p.id = pc.parent_id
    where pc.child_id = p_student and pc.status = 'active'
      and coalesce((pc.permissions ->> 'fees')::boolean, true)
  loop
    v_locale := public.profile_locale(par.parent_id);
    v_copy := public._fee_reminder_copy(v_locale, v_short, s.full_name, s.index_number, v_amount, v_months, p_note);
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (par.parent_id, v_copy ->> 'title', v_copy ->> 'body', v_meta, '/fees', v_org);
    perform public.enqueue_user_messages(par.parent_id, v_copy ->> 'title', v_copy ->> 'body', v_meta);
    v_sent := v_sent + 1;
    if coalesce(trim(par.phone), '') <> '' then
      v_parent_phones := v_parent_phones + 1;
    end if;
  end loop;

  if v_parent_phones = 0 then
    select guardian_phone into v_guardian from public.student_details where profile_id = p_student;
    if coalesce(trim(v_guardian), '') <> '' then
      v_copy := public._fee_reminder_copy('en', v_short, s.full_name, s.index_number, v_amount, v_months, p_note);
      insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
      values ('sms', v_guardian, v_copy ->> 'title', v_copy ->> 'body',
              v_meta || jsonb_build_object('recipient', 'guardian_phone'), v_org);
      v_sent := v_sent + 1;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'recipients', v_sent, 'outstanding', (a ->> 'total')::numeric);
end;
$$;

-- ---------------------------------------------------------------------------
-- Monthly invoice notify helper (locale + full amount).
-- ---------------------------------------------------------------------------
create or replace function public._fee_invoice_copy(
  p_locale text, p_org text, p_student text, p_month_label text,
  p_amount text, p_arrears_note text
) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  loc text := coalesce(nullif(trim(p_locale), ''), 'en');
  title text;
  body text;
begin
  if loc = 'ta' then
    title := 'மாதக் கட்டண விலைப்பட்டியல்';
    body := format('%s: %s க்கான கட்டண விலைப்பட்டியல் – %s: LKR %s.%s பெற்றோர்/மாணவர் போர்ட்டலில் செலுத்தவும்.',
      coalesce(p_org, 'Madrasa'), p_student, p_month_label, p_amount, coalesce(p_arrears_note, ''));
  elsif loc = 'ar' then
    title := 'فاتورة الرسوم الشهرية';
    body := format('%s: فاتورة رسوم لـ %s – %s: LKR %s.%s ادفع عبر بوابة ولي الأمر/الطالب.',
      coalesce(p_org, 'Madrasa'), p_student, p_month_label, p_amount, coalesce(p_arrears_note, ''));
  else
    title := 'Monthly fee invoice';
    body := format('%s: Fee invoice for %s – %s: LKR %s.%s Pay in the parent/student portal.',
      coalesce(p_org, 'College'), p_student, p_month_label, p_amount, coalesce(p_arrears_note, ''));
  end if;
  return jsonb_build_object('title', title, 'body', body);
end;
$$;

create or replace function public._notify_monthly_fee_invoice(
  p_student uuid,
  p_fee uuid,
  p_month text,
  p_total numeric,
  p_arrears numeric,
  p_org uuid,
  p_org_name text,
  p_student_name text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_locale text;
  v_copy jsonb;
  v_amount text := public.money_text(p_total);
  v_month_label text := to_char(to_date(p_month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY');
  v_arrears_note text := case when p_arrears > 0
    then format(' Previous arrears LKR %s. Total payable LKR %s.',
                public.money_text(p_arrears), public.money_text(p_arrears + p_total))
    else '' end;
  v_meta jsonb := jsonb_build_object('type', 'fee_invoice', 'fee_id', p_fee, 'month', p_month, 'purpose', 'fees');
  par record;
begin
  v_locale := public.profile_locale(p_student);
  v_copy := public._fee_invoice_copy(v_locale, p_org_name, p_student_name, v_month_label, v_amount, v_arrears_note);
  insert into public.notifications (user_id, title, message, org_id, data)
  values (p_student, v_copy ->> 'title', v_copy ->> 'body', p_org, v_meta);
  perform public.enqueue_user_messages(p_student, v_copy ->> 'title', v_copy ->> 'body', v_meta);

  for par in
    select parent_id from public.parent_children
    where child_id = p_student and status = 'active'
      and coalesce((permissions ->> 'fees')::boolean, true)
  loop
    v_locale := public.profile_locale(par.parent_id);
    v_copy := public._fee_invoice_copy(v_locale, p_org_name, p_student_name, v_month_label, v_amount, v_arrears_note);
    insert into public.notifications (user_id, title, message, org_id, data)
    values (par.parent_id, v_copy ->> 'title', v_copy ->> 'body', p_org,
            v_meta || jsonb_build_object('student_id', p_student));
    perform public.enqueue_user_messages(par.parent_id, v_copy ->> 'title', v_copy ->> 'body',
      v_meta || jsonb_build_object('student_id', p_student));
  end loop;
end;
$$;
revoke all on function public._notify_monthly_fee_invoice(uuid, uuid, text, numeric, numeric, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public._notify_monthly_fee_invoice(uuid, uuid, text, numeric, numeric, uuid, text, text)
  to service_role;

-- Wire monthly generation to locale helper (body identical to 0047 except notify block).
create or replace function public._generate_monthly_invoices_legacy(
  p_month text default to_char(now() at time zone 'Asia/Colombo', 'YYYY-MM'),
  p_org uuid default null,
  p_default_tuition numeric default null,
  p_limit int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_year uuid;
  s record;
  st record;
  x record;
  c record;
  v_fee uuid;
  v_any boolean;
  v_billable boolean;
  v_base numeric;
  v_room numeric;
  v_disc numeric;
  v_total numeric;
  v_generated int := 0;
  v_skipped int := 0;
  v_no_fee int := 0;
  v_amount_total numeric := 0;
  v_tuition record;
  v_due_day int;
  v_arrears numeric;
  v_org_name text;
  v_remaining int := 0;
begin
  if public.is_privileged_caller() then
    v_org := coalesce(p_org, public.default_org_id());
  else
    if not public.is_finance_staff() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    v_org := public.current_org_id();
  end if;
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Month must be YYYY-MM';
  end if;

  select id into v_year from public.academic_years where org_id = v_org and is_current;
  select coalesce(settings ->> 'short_name', name_en) into v_org_name from public.organizations where id = v_org;
  select * into v_tuition from public.fee_categories where org_id = v_org and code = 'TUITION';
  select min(fs.due_day) into v_due_day
  from public.fee_structures fs
  where fs.org_id = v_org and fs.is_active and fs.frequency = 'monthly';

  for s in
    select p.id, p.class_number, p.full_name
    from public.profiles p
    left join public.student_details d on d.profile_id = p.id
    where p.org_id = v_org and p.account_type = 'student' and p.is_approved
      and coalesce(d.status, 'active') = 'active'
    order by p.id
  loop
    if exists (select 1 from public.student_fees where student_id = s.id and month = p_month and cancelled_at is null) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select count(*) > 0, coalesce(bool_or(z.amount > 0), false) into v_any, v_billable
    from (select distinct on (fs.fee_category_id) fs.amount
          from public.fee_structures fs
          join public.fee_categories fc on fc.id = fs.fee_category_id and fc.is_active
          where fs.org_id = v_org and fs.is_active and fs.frequency = 'monthly'
            and (fs.class_number is null or fs.class_number = s.class_number)
            and (fs.academic_year_id is null or fs.academic_year_id = v_year)
          order by fs.fee_category_id, fs.class_number nulls last, fs.academic_year_id nulls last) z;
    v_billable := v_billable
      or (not v_any and coalesce(p_default_tuition, v_tuition.default_amount, 0) > 0)
      or exists (select 1 from public.fee_extra_lines(s.id, p_month) e where e.amount > 0);
    if not v_billable then
      v_no_fee := v_no_fee + 1;
      continue;
    end if;

    if p_limit is not null and v_generated >= p_limit then
      v_remaining := v_remaining + 1;
      continue;
    end if;

    perform set_config('app.fee_internal', 'on', true);
    insert into public.student_fees (org_id, student_id, month, total_due, paid_amount, status, due_date)
    values (v_org, s.id, p_month, 0, 0, 'unpaid', (p_month || '-' || lpad(coalesce(v_due_day, 10)::text, 2, '0'))::date)
    returning id into v_fee;
    perform set_config('app.fee_internal', 'off', true);

    v_any := false;
    perform set_config('app.fee_bulk', 'on', true);
    for st in
      select distinct on (fs.fee_category_id) fs.fee_category_id, fs.amount, fc.name
      from public.fee_structures fs
      join public.fee_categories fc on fc.id = fs.fee_category_id and fc.is_active
      where fs.org_id = v_org and fs.is_active and fs.frequency = 'monthly'
        and (fs.class_number is null or fs.class_number = s.class_number)
        and (fs.academic_year_id is null or fs.academic_year_id = v_year)
      order by fs.fee_category_id, fs.class_number nulls last, fs.academic_year_id nulls last
    loop
      v_any := true;
      if st.amount > 0 then
        insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
        values (v_org, v_fee, st.fee_category_id, 'charge', format('%s %s', st.name, p_month), st.amount);
      end if;
    end loop;

    if not v_any and coalesce(p_default_tuition, v_tuition.default_amount, 0) > 0 then
      insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
      values (v_org, v_fee, v_tuition.id, 'charge', format('Tuition %s', p_month),
              coalesce(p_default_tuition, v_tuition.default_amount));
    end if;

    for x in select * from public.fee_extra_lines(s.id, p_month) loop
      if x.amount is not null and x.amount > 0 then
        insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
        values (v_org, v_fee, (select id from public.fee_categories where org_id = v_org and code = x.category_code),
                'charge', x.description, x.amount);
      end if;
    end loop;

    for c in
      select * from public.student_fee_concessions
      where student_id = s.id and is_active
        and valid_from <= ((p_month || '-01')::date + interval '1 month' - interval '1 day')::date
        and (valid_to is null or valid_to >= (p_month || '-01')::date)
      order by created_at, id
    loop
      select coalesce(sum(amount) filter (where kind = 'charge'), 0), coalesce(sum(amount), 0)
        into v_base, v_room
      from public.fee_invoice_lines
      where fee_id = v_fee
        and (c.fee_category_id is null or fee_category_id = c.fee_category_id);
      v_disc := case when c.kind = 'percent' then round(v_base * c.value / 100, 2) else c.value end;
      v_disc := least(v_disc, greatest(v_room, 0),
                      greatest((select coalesce(sum(amount), 0) from public.fee_invoice_lines where fee_id = v_fee), 0));
      if v_disc > 0 then
        insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
        values (v_org, v_fee, c.fee_category_id, 'discount', format('Concession: %s', c.reason), -v_disc);
      end if;
    end loop;

    perform set_config('app.fee_bulk', 'off', true);
    perform public._post_invoice_lines_journal(v_fee);
    perform public._fee_recalc(v_fee);
    select total_due into v_total from public.student_fees where id = v_fee;
    v_generated := v_generated + 1;
    v_amount_total := v_amount_total + v_total;

    if v_total > 0 then
      select coalesce(sum(total_due - paid_amount), 0) into v_arrears
      from public.student_fees
      where student_id = s.id and id <> v_fee and status in ('unpaid', 'partial');
      perform public._notify_monthly_fee_invoice(
        s.id, v_fee, p_month, v_total, v_arrears, v_org, coalesce(v_org_name, 'College'), s.full_name);
    end if;
  end loop;

  return jsonb_build_object('month', p_month, 'generated', v_generated, 'skipped', v_skipped,
                            'no_fee', v_no_fee,
                            'remaining', v_remaining, 'total_amount', v_amount_total,
                            'message', format('Generated %s invoice(s) for %s. Skipped %s (already existed). %s student(s) have no billable fee.',
                                              v_generated, p_month, v_skipped, v_no_fee));
end;
$$;
revoke all on function public._generate_monthly_invoices_legacy(text, uuid, numeric, int) from public, anon, authenticated;
grant execute on function public._generate_monthly_invoices_legacy(text, uuid, numeric, int) to service_role;

-- ---------------------------------------------------------------------------
-- Finance doc share must set org_id for tenant SMS mask.
-- ---------------------------------------------------------------------------
create or replace function public.queue_finance_doc_share(
  p_id uuid,
  p_channel text,
  p_to text,
  p_message text default null,
  p_base_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  v_id uuid;
  v_to text := regexp_replace(coalesce(p_to, ''), '[^0-9+]', '', 'g');
  v_base text;
  v_name text;
  body text;
  link text;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_channel not in ('sms','whatsapp') then
    raise exception 'channel must be sms or whatsapp' using errcode = '22023';
  end if;
  if length(regexp_replace(v_to, '\D', '', 'g')) < 9 then
    raise exception 'A valid phone number is required' using errcode = '22023';
  end if;
  d := public._finance_doc_load(p_id);
  if d.status = 'draft' then raise exception 'Issue the document before sharing' using errcode = '22023'; end if;

  select coalesce(nullif(btrim(p_base_url), ''),
                  case when custom_domain is not null then 'https://' || custom_domain end,
                  settings ->> 'site_url', ''),
         coalesce(settings ->> 'short_name', name_en)
  into v_base, v_name from public.organizations where id = d.org_id;
  link := rtrim(v_base, '/') || case when d.doc_type = 'quotation' then '/q/' else '/b/' end || d.public_token;
  body := coalesce(nullif(btrim(p_message), ''),
    format('%s %s %s: %s %s. View: %s', v_name, replace(d.doc_type, '_', ' '), coalesce(d.doc_number, ''),
           d.currency, to_char(d.total - d.paid_amount, 'FM999,999,990.00'), link));

  insert into public.message_outbox (user_id, channel, to_address, subject, body, status, metadata, org_id)
  values (auth.uid(), p_channel, v_to, format('%s %s', v_name, replace(d.doc_type, '_', ' ')), body, 'pending',
          jsonb_build_object('org_id', d.org_id, 'finance_document_id', d.id, 'public_token', d.public_token, 'path', link),
          d.org_id)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.queue_finance_doc_share(uuid, text, text, text, text) to authenticated;
