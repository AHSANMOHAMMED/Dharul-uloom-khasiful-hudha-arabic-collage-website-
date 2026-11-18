-- Locale-aware fee/leave messages (en/ta/ar), org SMS sender mask, leave review RPC.
set search_path = public, extensions, pg_temp;

alter table public.profiles
  add column if not exists preferred_locale text not null default 'en'
    check (preferred_locale in ('en', 'ta', 'ar'));

create or replace function public.profile_locale(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(preferred_locale), '') from public.profiles where id = p_user),
    'en'
  );
$$;
revoke all on function public.profile_locale(uuid) from public, anon;
grant execute on function public.profile_locale(uuid) to authenticated, service_role;

create or replace function public.set_my_preferred_locale(p_locale text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v text := lower(trim(coalesce(p_locale, 'en')));
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v not in ('en', 'ta', 'ar') then raise exception 'Locale must be en, ta, or ar'; end if;
  update public.profiles set preferred_locale = v where id = auth.uid();
end;
$$;
revoke all on function public.set_my_preferred_locale(text) from public, anon;
grant execute on function public.set_my_preferred_locale(text) to authenticated;

-- Org-level madrasa SMS sender mask (Notify.lk / Text.lk / Twilio alphanumeric).
create or replace function public.set_org_sms_sender(p_sender text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_settings jsonb;
  v_sender text := nullif(trim(p_sender), '');
begin
  if not (public.is_admin() or public.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_sender is not null and length(v_sender) > 11 then
    raise exception 'SMS sender ID must be at most 11 characters';
  end if;
  select settings into v_settings from public.organizations where id = v_org for update;
  v_settings := coalesce(v_settings, '{}'::jsonb);
  if v_sender is null then
    v_settings := v_settings - 'sms_sender_id';
  else
    v_settings := v_settings || jsonb_build_object('sms_sender_id', v_sender);
  end if;
  update public.organizations set settings = v_settings where id = v_org;
end;
$$;
revoke all on function public.set_org_sms_sender(text) from public, anon;
grant execute on function public.set_org_sms_sender(text) to authenticated;

-- Ensure outbox rows always carry org_id for tenant SMS masking.
create or replace function public.enqueue_user_messages(
  p_user_id uuid,
  p_subject text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  u record;
begin
  select id, phone, email, notify_sms, notify_whatsapp, notify_email, org_id
    into u
  from public.profiles
  where id = p_user_id;
  if not found then return; end if;

  if u.notify_sms and coalesce(u.phone, '') <> '' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
    values (u.id, 'sms', u.phone, p_subject, p_body, p_metadata, u.org_id);
  end if;
  if u.notify_whatsapp and coalesce(u.phone, '') <> '' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
    values (u.id, 'whatsapp', u.phone, p_subject, p_body, p_metadata, u.org_id);
  end if;
  if u.notify_email and coalesce(u.email, '') <> '' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
    values (u.id, 'email', u.email, p_subject, p_body, p_metadata, u.org_id);
  end if;
end;
$$;
revoke all on function public.enqueue_user_messages(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_user_messages(uuid, text, text, jsonb) to service_role;

create or replace function public._fee_receipt_copy(
  p_locale text,
  p_org text,
  p_student text,
  p_index text,
  p_months text,
  p_amount text,
  p_method text,
  p_arrears text,
  p_receipt_no text
) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  loc text := coalesce(nullif(trim(p_locale), ''), 'en');
  idx text := case when coalesce(p_index, '') <> '' then format(' (%s)', p_index) else '' end;
  title text;
  body text;
begin
  if loc = 'ta' then
    title := 'கட்டணம் பெறப்பட்டது';
    body := format(
      '%s: %s%s க்கான கட்டணம் பெறப்பட்டது. %s. மொத்தம் LKR %s (%s). தற்போதைய நிலுவை LKR %s. பற்றுச்சீட்டு %s.',
      coalesce(p_org, 'Madrasa'), p_student, idx, coalesce(p_months, ''), p_amount, p_method, p_arrears, p_receipt_no
    );
  elsif loc = 'ar' then
    title := 'تم استلام الدفعة';
    body := format(
      '%s: تم استلام دفعة لـ %s%s. %s. الإجمالي LKR %s عبر %s. المتأخرات الآن LKR %s. إيصال %s.',
      coalesce(p_org, 'Madrasa'), p_student, idx, coalesce(p_months, ''), p_amount, p_method, p_arrears, p_receipt_no
    );
  else
    title := 'Payment received';
    body := format(
      '%s: Payment received for %s%s. %s. Total LKR %s by %s. Total arrears now LKR %s. Receipt %s.',
      coalesce(p_org, 'College'), p_student, idx, coalesce(p_months, ''), p_amount, p_method, p_arrears, p_receipt_no
    );
  end if;
  return jsonb_build_object('title', title, 'body', body);
end;
$$;

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
  v_amount text := public.money_text((j ->> 'amount')::numeric);
  v_method text := replace(j ->> 'method', '_', ' ');
  v_arrears text := public.money_text((j ->> 'arrears_after')::numeric);
  v_receipt_no text := j ->> 'receipt_no';
  v_copy jsonb;
  v_title text;
  v_body text;
  v_data jsonb;
  v_meta jsonb;
  par record;
  fin uuid;
  v_guardian text;
  v_parent_phones int := 0;
  v_locale text;
begin
  select org_id, received_by into v_org_id, v_recorded_by from public.fee_receipts where id = p_receipt;
  select string_agg(format('%s: LKR %s%s', a ->> 'month_label', public.money_text((a ->> 'paid_now')::numeric),
                           case when (a ->> 'balance_after')::numeric > 0
                                then format(' (balance LKR %s)', public.money_text((a ->> 'balance_after')::numeric))
                                else ' (fully paid)' end), '; ')
    into v_months
  from jsonb_array_elements(j -> 'allocations') a;

  v_data := jsonb_build_object(
    'type', 'fee_receipt', 'receipt_id', p_receipt, 'token', j ->> 'public_token',
    'student_id', v_sid, 'purpose', 'fees', 'amount', (j ->> 'amount')::numeric,
    'receipt_no', v_receipt_no
  );
  v_meta := v_data || jsonb_build_object('attach_receipt', true, 'purpose', 'fees', 'urgent', true);

  -- Student (locale-aware, full amount received)
  v_locale := public.profile_locale(v_sid);
  v_copy := public._fee_receipt_copy(v_locale, v_org, v_student, v_index, v_months, v_amount, v_method, v_arrears, v_receipt_no);
  v_title := v_copy ->> 'title';
  v_body := v_copy ->> 'body';
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (v_sid, v_title, v_body, v_data, '/receipt/' || p_receipt, v_org_id);
  perform public.enqueue_user_messages(v_sid, v_title, v_body, v_meta);

  for par in
    select p.id, p.phone from public.parent_children pc
    join public.profiles p on p.id = pc.parent_id
    where pc.child_id = v_sid and pc.status = 'active'
      and coalesce((pc.permissions ->> 'fees')::boolean, true)
  loop
    v_locale := public.profile_locale(par.id);
    v_copy := public._fee_receipt_copy(v_locale, v_org, v_student, v_index, v_months, v_amount, v_method, v_arrears, v_receipt_no);
    v_title := v_copy ->> 'title';
    v_body := v_copy ->> 'body';
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (par.id, v_title, v_body, v_data, '/receipt/' || p_receipt, v_org_id);
    perform public.enqueue_user_messages(par.id, v_title, v_body, v_meta);
    if coalesce(par.phone, '') <> '' then
      v_parent_phones := v_parent_phones + 1;
    end if;
  end loop;

  select guardian_phone into v_guardian from public.student_details where profile_id = v_sid;
  if v_parent_phones = 0 and coalesce(v_guardian, '') <> '' then
    v_copy := public._fee_receipt_copy('en', v_org, v_student, v_index, v_months, v_amount, v_method, v_arrears, v_receipt_no);
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('sms', v_guardian, v_copy ->> 'title', v_copy ->> 'body',
            v_meta || jsonb_build_object('recipient', 'guardian_phone'), v_org_id);
  end if;

  for fin in select * from public.finance_staff_ids(v_org_id) loop
    if fin is distinct from v_recorded_by then
      insert into public.notifications (user_id, title, message, data, link, org_id)
      values (fin,
              case when j ->> 'method' = 'payhere' then 'Online payment received' else 'Payment recorded' end,
              format('%s%s – LKR %s (%s). Receipt %s.', v_student,
                     case when v_index is not null then format(' (%s)', v_index) else '' end,
                     v_amount, v_method, v_receipt_no),
              v_data || jsonb_build_object('audience', 'finance'), '/receipt/' || p_receipt, v_org_id);
    end if;
  end loop;
end;
$$;
revoke all on function public._notify_fee_receipt(uuid) from public, anon, authenticated;

create or replace function public._leave_decision_copy(
  p_locale text,
  p_org text,
  p_student text,
  p_status text,
  p_start date,
  p_end date,
  p_note text
) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  loc text := coalesce(nullif(trim(p_locale), ''), 'en');
  st text := lower(trim(p_status));
  title text;
  body text;
  verb_en text := case when st = 'approved' then 'approved' else 'rejected' end;
  verb_ta text := case when st = 'approved' then 'அனுமதிக்கப்பட்டது' else 'நிராகரிக்கப்பட்டது' end;
  verb_ar text := case when st = 'approved' then 'مقبول' else 'مرفوض' end;
begin
  if loc = 'ta' then
    title := 'விடுப்புக் கோரிக்கை ' || verb_ta;
    body := format('%s: %s க்கான விடுப்பு (%s → %s) %s.%s',
      coalesce(p_org, 'Madrasa'), p_student, p_start, p_end, verb_ta,
      case when coalesce(p_note, '') <> '' then ' குறிப்பு: ' || p_note else '' end);
  elsif loc = 'ar' then
    title := 'طلب إجازة ' || verb_ar;
    body := format('%s: إجازة %s (%s → %s) %s.%s',
      coalesce(p_org, 'Madrasa'), p_student, p_start, p_end, verb_ar,
      case when coalesce(p_note, '') <> '' then ' ملاحظة: ' || p_note else '' end);
  else
    title := 'Leave request ' || verb_en;
    body := format('%s: Leave for %s (%s → %s) was %s.%s',
      coalesce(p_org, 'College'), p_student, p_start, p_end, verb_en,
      case when coalesce(p_note, '') <> '' then ' Note: ' || p_note else '' end);
  end if;
  return jsonb_build_object('title', title, 'body', body);
end;
$$;

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

  -- Notify student
  v_locale := public.profile_locale(lv.student_id);
  v_copy := public._leave_decision_copy(v_locale, v_org_name, coalesce(v_student_name, 'student'),
            v_status, lv.start_date, lv.end_date, p_response_note);
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (lv.student_id, v_copy ->> 'title', v_copy ->> 'body', v_meta, '/dashboard?tab=leaves', lv.org_id);
  perform public.enqueue_user_messages(lv.student_id, v_copy ->> 'title', v_copy ->> 'body', v_meta);

  -- Notify filing parent + active guardians with leave permission
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

-- Keep notify_payment_received locale-aware when used as a fallback path.
create or replace function public.notify_payment_received(
  p_student_id uuid,
  p_amount numeric,
  p_fee_id uuid default null,
  p_receipt_no text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  student_name text;
  v_org text;
  v_org_id uuid;
  v_locale text;
  v_copy jsonb;
  parent_rec record;
  v_amount text := public.money_text(p_amount);
  v_meta jsonb;
begin
  select full_name, org_id into student_name, v_org_id from public.profiles where id = p_student_id;
  select coalesce(nullif(code, ''), name_en) into v_org from public.organizations where id = v_org_id;
  v_meta := jsonb_build_object(
    'type', 'payment', 'fee_id', p_fee_id, 'receipt_no', p_receipt_no,
    'purpose', 'fees', 'urgent', true, 'amount', p_amount
  );

  v_locale := public.profile_locale(p_student_id);
  v_copy := public._fee_receipt_copy(
    v_locale, v_org, coalesce(student_name, 'student'), null, 'Tuition',
    v_amount, 'counter', public.money_text(0), coalesce(p_receipt_no, '—')
  );
  insert into public.notifications (user_id, title, message, data, org_id)
  values (p_student_id, v_copy ->> 'title', v_copy ->> 'body', v_meta, v_org_id);
  perform public.enqueue_user_messages(p_student_id, v_copy ->> 'title', v_copy ->> 'body', v_meta);

  for parent_rec in
    select parent_id from public.parent_children
    where child_id = p_student_id and status = 'active'
      and coalesce((permissions ->> 'fees')::boolean, true)
  loop
    v_locale := public.profile_locale(parent_rec.parent_id);
    v_copy := public._fee_receipt_copy(
      v_locale, v_org, coalesce(student_name, 'student'), null, 'Tuition',
      v_amount, 'counter', public.money_text(0), coalesce(p_receipt_no, '—')
    );
    insert into public.notifications (user_id, title, message, data, org_id)
    values (parent_rec.parent_id, v_copy ->> 'title', v_copy ->> 'body', v_meta, v_org_id);
    perform public.enqueue_user_messages(parent_rec.parent_id, v_copy ->> 'title', v_copy ->> 'body', v_meta);
  end loop;
end;
$$;
revoke all on function public.notify_payment_received(uuid, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.notify_payment_received(uuid, numeric, uuid, text) to service_role;
