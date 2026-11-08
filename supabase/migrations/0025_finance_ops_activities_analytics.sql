-- =============================================================================
-- 0025_finance_ops_activities_analytics.sql
--
-- 1. Fixes to 0022: outbox retry limit (operator precedence) and zero-value
--    invoice clean-up limited to invoices without ledger lines.
-- 2. Every receipt (counter or online) is announced to the institution's
--    treasurer / accountant / admins (in-app + push) — online payments are
--    recorded automatically and finance sees them immediately.
-- 3. Finance from the phone: fee reminders (single / all overdue), resend a
--    receipt, per-student message log, today's collection summary.
-- 4. Activities that need one or more lecturers/staff: assignees with a role
--    and responsibilities, accept/decline/done, notifications, budget claims.
-- 5. Analytics: finance (12-month trend, arrears ageing, collection rate,
--    classes, methods, defaulters, expenses, petty cash) and academics
--    (attendance trend, results, admissions funnel, enrolment, staff leave).
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 1a. Outbox: retry limit applies to every claimable row
-- ---------------------------------------------------------------------------
create or replace function public.claim_outbox_batch(p_limit int default 50)
returns setof public.message_outbox language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  update public.message_outbox m
  set status = 'sending',
      claimed_at = now(),
      attempts = case when m.status = 'blocked' then m.attempts else m.attempts + 1 end
  where m.id in (
    select id from public.message_outbox
    where (status in ('pending', 'blocked')
           or (status = 'sending' and claimed_at < now() - interval '5 minutes'))
      and attempts < 5
    order by created_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked)
  returning m.*;
end;
$$;
revoke all on function public.claim_outbox_batch(int) from public, anon, authenticated;
grant execute on function public.claim_outbox_batch(int) to service_role;

-- ---------------------------------------------------------------------------
-- 1b. Zero-value invoice clean-up: only invoices that never got a line.
--     (A 100 % scholarship nets to zero but has posted income + discount
--     journals — deleting it would leave the ledger inconsistent.)
-- ---------------------------------------------------------------------------
create or replace function public.generate_monthly_invoices(
  p_month text default to_char(now(), 'YYYY-MM'),
  p_org uuid default null,
  p_default_tuition numeric default null,
  p_limit int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_result jsonb;
  v_removed int := 0;
  v_fee record;
begin
  v_result := public._generate_monthly_invoices_legacy(p_month, p_org, p_default_tuition, p_limit);
  v_org := case when public.is_privileged_caller() then coalesce(p_org, public.default_org_id())
                else public.current_org_id() end;
  for v_fee in
    select f.id from public.student_fees f
    where f.org_id = v_org and f.month = p_month and f.cancelled_at is null and f.status = 'unpaid'
      and coalesce(f.total_due, 0) <= 0 and coalesce(f.paid_amount, 0) = 0
      and not exists (select 1 from public.fee_payments p where p.fee_id = f.id)
      and not exists (select 1 from public.fee_invoice_lines l where l.fee_id = f.id)
  loop
    perform set_config('app.fee_internal', 'on', true);
    delete from public.student_fees where id = v_fee.id;
    perform set_config('app.fee_internal', 'off', true);
    v_removed := v_removed + 1;
  end loop;
  return v_result || jsonb_build_object(
    'generated', greatest(0, coalesce((v_result ->> 'generated')::int, 0) - v_removed),
    'skipped', coalesce((v_result ->> 'skipped')::int, 0) + v_removed,
    'zero_value_removed', v_removed);
end;
$$;
revoke all on function public.generate_monthly_invoices(text, uuid, numeric, int) from public, anon, authenticated;
grant execute on function public.generate_monthly_invoices(text, uuid, numeric, int) to authenticated, service_role;
revoke all on function public._generate_monthly_invoices_legacy(text, uuid, numeric, int) from public, anon, authenticated;
grant execute on function public._generate_monthly_invoices_legacy(text, uuid, numeric, int) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Receipt notifications (+ finance staff)
-- ---------------------------------------------------------------------------
create or replace function public.finance_staff_ids(p_org uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles
  where org_id = p_org and is_approved
    and (role in ('admin')
         or (account_type in ('tutor', 'staff')
             and (assigned_tutor_role in ('treasurer', 'accountant') or extra_roles && array['treasurer', 'accountant'])));
$$;
revoke all on function public.finance_staff_ids(uuid) from public, anon, authenticated;

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
                               'student_id', v_sid);
  v_meta := v_data || jsonb_build_object('attach_receipt', true);

  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (v_sid, v_title, v_body, v_data, '/receipt/' || p_receipt, v_org_id);
  perform public.enqueue_user_messages(v_sid, v_title, v_body, v_meta);

  for par in
    select p.id, p.phone from public.parent_children pc join public.profiles p on p.id = pc.parent_id
    where pc.child_id = v_sid
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

  -- finance team (in-app + push): every payment, online ones included
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

-- ---------------------------------------------------------------------------
-- 3. Finance from the phone
-- ---------------------------------------------------------------------------
create or replace function public.send_fee_reminder(p_student uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  s record;
  a jsonb;
  v_body text;
  v_short text;
  par record;
  v_sent int := 0;
  v_guardian text;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id, full_name, index_number into s from public.profiles
  where id = p_student and org_id = v_org and account_type = 'student';
  if not found then
    raise exception 'Student not found';
  end if;
  a := public.student_arrears(p_student);
  if coalesce((a ->> 'total')::numeric, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_arrears');
  end if;
  if exists (select 1 from public.message_outbox
             where org_id = v_org and metadata ->> 'type' = 'fee_reminder' and metadata ->> 'student_id' = p_student::text
               and created_at > now() - interval '20 hours') then
    raise exception 'A reminder was already sent to this family in the last 20 hours';
  end if;
  select coalesce(settings ->> 'short_name', name_en) into v_short from public.organizations where id = v_org;
  v_body := format('%s: Fee reminder for %s%s. Outstanding LKR %s for %s.%s Please pay at the office or in the parent app.',
                   v_short, s.full_name, coalesce(' (' || s.index_number || ')', ''),
                   public.money_text((a ->> 'total')::numeric),
                   (select string_agg(to_char(to_date(m ->> 'month' || '-01', 'YYYY-MM-DD'), 'FMMon YYYY'), ', ')
                    from jsonb_array_elements(a -> 'months') m),
                   coalesce(' ' || nullif(trim(p_note), ''), ''));
  for par in select parent_id from public.parent_children where child_id = p_student loop
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (par.parent_id, 'Fee reminder', v_body, jsonb_build_object('type', 'fee_reminder', 'student_id', p_student), '/fees', v_org);
    perform public.enqueue_user_messages(par.parent_id, 'Fee reminder', v_body,
      jsonb_build_object('type', 'fee_reminder', 'student_id', p_student));
    v_sent := v_sent + 1;
  end loop;
  if v_sent = 0 then
    select guardian_phone into v_guardian from public.student_details where profile_id = p_student;
    if coalesce(v_guardian, '') <> '' then
      insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
      values ('sms', v_guardian, 'Fee reminder', v_body,
              jsonb_build_object('type', 'fee_reminder', 'student_id', p_student, 'recipient', 'guardian_phone'), v_org);
      v_sent := 1;
    end if;
  end if;
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (p_student, 'Fee reminder', v_body, jsonb_build_object('type', 'fee_reminder', 'student_id', p_student), '/fees', v_org);
  return jsonb_build_object('ok', true, 'recipients', v_sent, 'outstanding', (a ->> 'total')::numeric);
end;
$$;

-- Remind every family whose oldest unpaid invoice is at least p_min_days overdue.
create or replace function public.send_overdue_reminders(p_min_days int default 7, p_limit int default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  s record;
  v_ok int := 0;
  v_skipped int := 0;
  v_reasons jsonb := '{}'::jsonb;
  v_res jsonb;
  v_key text;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for s in
    select f.student_id from public.student_fees f
    where f.org_id = v_org and f.status in ('unpaid', 'partial') and f.cancelled_at is null
    group by f.student_id
    having min(f.due_date) <= public.org_today() - greatest(p_min_days, 0)
    limit greatest(1, least(p_limit, 500))
  loop
    begin
      v_res := public.send_fee_reminder(s.student_id);
      if coalesce((v_res ->> 'recipients')::int, 0) = 0 then
        v_key := 'no_contact';
        v_skipped := v_skipped + 1;
        v_reasons := jsonb_set(v_reasons, array[v_key], to_jsonb(coalesce((v_reasons ->> v_key)::int, 0) + 1));
      else
        v_ok := v_ok + 1;
      end if;
    exception when others then
      v_key := case when sqlerrm like '%already sent%' then 'already_reminded' else 'error' end;
      v_skipped := v_skipped + 1;
      v_reasons := jsonb_set(v_reasons, array[v_key], to_jsonb(coalesce((v_reasons ->> v_key)::int, 0) + 1));
    end;
  end loop;
  return jsonb_build_object('sent', v_ok, 'skipped', v_skipped, 'skipped_reasons', v_reasons);
end;
$$;

create or replace function public.resend_receipt(p_receipt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  j jsonb;
  par record;
  v_n int := 0;
  v_body text;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.fee_receipts where id = p_receipt and org_id = public.current_org_id();
  if not found then
    raise exception 'Receipt not found';
  end if;
  j := public._fee_receipt_json(p_receipt);
  v_body := format('%s: Copy of receipt %s for %s – LKR %s paid %s. Arrears LKR %s.',
                   j -> 'organization' ->> 'short_name', r.receipt_no, j -> 'student' ->> 'full_name',
                   public.money_text(r.amount), to_char(r.paid_at at time zone 'Asia/Colombo', 'DD Mon YYYY'),
                   public.money_text(r.arrears_after));
  for par in select parent_id from public.parent_children where child_id = r.student_id loop
    perform public.enqueue_user_messages(par.parent_id, 'Receipt copy', v_body,
      jsonb_build_object('type', 'fee_receipt', 'receipt_id', r.id, 'token', r.public_token, 'attach_receipt', true));
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'families', v_n);
end;
$$;

create or replace function public.student_message_log(p_student uuid, p_limit int default 50)
returns table (id uuid, channel text, to_address text, subject text, body text, status text, error text,
               created_at timestamptz, sent_at timestamptz, recipient text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_finance_viewer() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select m.id, m.channel, m.to_address, m.subject, m.body, m.status, m.error, m.created_at, m.sent_at,
         coalesce(p.full_name, m.metadata ->> 'recipient')
  from public.message_outbox m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = public.current_org_id()
    and (m.user_id = p_student
         or m.user_id in (select parent_id from public.parent_children where child_id = p_student)
         or m.metadata ->> 'student_id' = p_student::text)
  order by m.created_at desc
  limit greatest(1, least(p_limit, 200));
end;
$$;

create or replace function public.finance_today()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_day date := public.org_today();
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'date', v_day,
    'collected', coalesce((select sum(amount) from public.fee_receipts
      where org_id = v_org and status = 'posted' and (paid_at at time zone 'Asia/Colombo')::date = v_day), 0),
    'receipts', (select count(*) from public.fee_receipts
      where org_id = v_org and status = 'posted' and (paid_at at time zone 'Asia/Colombo')::date = v_day),
    'by_method', coalesce((select jsonb_object_agg(method, total) from (
      select method, sum(amount) total from public.fee_receipts
      where org_id = v_org and status = 'posted' and (paid_at at time zone 'Asia/Colombo')::date = v_day group by method) x), '{}'::jsonb),
    'online', coalesce((select sum(amount) from public.fee_receipts
      where org_id = v_org and status = 'posted' and method = 'payhere' and (paid_at at time zone 'Asia/Colombo')::date = v_day), 0),
    'latest', coalesce((select jsonb_agg(x order by x.paid_at desc) from (
      select r.id, r.receipt_no, r.amount, r.method, r.paid_at, p.full_name as student, p.index_number
      from public.fee_receipts r join public.profiles p on p.id = r.student_id
      where r.org_id = v_org and r.status = 'posted'
      order by r.paid_at desc limit 15) x), '[]'::jsonb),
    'outstanding', coalesce((select sum(total_due - paid_amount) from public.student_fees
      where org_id = v_org and status in ('unpaid', 'partial') and cancelled_at is null), 0),
    'pending_petty_cash', (select count(*) from public.petty_cash_entries where org_id = v_org and status = 'submitted'),
    'pending_expenses', (select count(*) from public.expenses where org_id = v_org and status = 'submitted'),
    'messages_failed_24h', (select count(*) from public.message_outbox
      where org_id = v_org and status = 'failed' and created_at > now() - interval '24 hours'));
end;
$$;

grant execute on function public.send_fee_reminder(uuid, text) to authenticated;
grant execute on function public.send_overdue_reminders(int, int) to authenticated;
grant execute on function public.resend_receipt(uuid) to authenticated;
grant execute on function public.student_message_log(uuid, int) to authenticated;
grant execute on function public.finance_today() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Activities with several responsible people
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  title         text not null check (length(trim(title)) > 0),
  description   text,
  category      text not null default 'event'
                check (category in ('event', 'exam_duty', 'trip', 'programme', 'meeting', 'maintenance', 'religious', 'sports', 'other')),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  location      text,
  status        text not null default 'planned' check (status in ('planned', 'ongoing', 'completed', 'cancelled')),
  budget        numeric(12,2) not null default 0 check (budget >= 0),
  duty_role_id  uuid references public.duty_roles (id) on delete set null,
  meeting_id    uuid references public.mashoora_meetings (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists idx_activities_org_start on public.activities (org_id, starts_at desc);

create table if not exists public.activity_assignees (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  activity_id      uuid not null references public.activities (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete restrict,
  role             text not null default 'member' check (role in ('lead', 'coordinator', 'supervisor', 'member', 'helper')),
  responsibilities text,
  status           text not null default 'assigned' check (status in ('assigned', 'accepted', 'declined', 'done')),
  response_note    text,
  assigned_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (activity_id, profile_id)
);
create index if not exists idx_activity_assignees_profile on public.activity_assignees (profile_id, status);

alter table public.expenses add column if not exists activity_id uuid references public.activities (id) on delete set null;

select public.apply_tenant_scope('activities');
select public.apply_tenant_scope('activity_assignees', 'activity_id', 'activities');

drop trigger if exists trg_activities_updated_at on public.activities;
create trigger trg_activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

-- Assign (or update) several people at once:
-- p_people = [{"profile_id":uuid,"role":"lead","responsibilities":"..."}]
create or replace function public.assign_activity_staff(p_activity uuid, p_people jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  a record;
  p jsonb;
  v_n int := 0;
  v_pid uuid;
begin
  if not public.is_governance_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into a from public.activities where id = p_activity and org_id = v_org;
  if not found then
    raise exception 'Activity not found';
  end if;
  for p in select * from jsonb_array_elements(p_people) loop
    v_pid := (p ->> 'profile_id')::uuid;
    if not exists (select 1 from public.profiles where id = v_pid and org_id = v_org
                   and account_type in ('tutor', 'staff') and is_approved) then
      raise exception 'Only approved lecturers / staff of this institution can be assigned';
    end if;
    insert into public.activity_assignees (org_id, activity_id, profile_id, role, responsibilities)
    values (v_org, p_activity, v_pid, coalesce(nullif(p ->> 'role', ''), 'member'), p ->> 'responsibilities')
    on conflict (activity_id, profile_id) do update
      set role = excluded.role, responsibilities = excluded.responsibilities;
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (v_pid, 'New responsibility',
            format('%s – %s (%s)%s', a.title, coalesce(nullif(p ->> 'role', ''), 'member'),
                   to_char(a.starts_at at time zone 'Asia/Colombo', 'DD Mon YYYY HH24:MI'),
                   coalesce(': ' || nullif(p ->> 'responsibilities', ''), '')),
            jsonb_build_object('type', 'activity', 'activity_id', p_activity), '/erp?module=activities', v_org);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.remove_activity_staff(p_activity uuid, p_profile uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_governance_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.activity_assignees
  where activity_id = p_activity and profile_id = p_profile and org_id = public.current_org_id();
end;
$$;

-- The assignee answers / reports completion; the organiser is notified.
create or replace function public.respond_activity(p_activity uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_name text;
begin
  if p_status not in ('accepted', 'declined', 'done') then
    raise exception 'Status must be accepted, declined or done';
  end if;
  select act.* into a from public.activities act
  join public.activity_assignees x on x.activity_id = act.id
  where act.id = p_activity and x.profile_id = auth.uid() and act.org_id = public.current_org_id();
  if not found then
    raise exception 'You are not assigned to this activity';
  end if;
  if p_status = 'declined' and coalesce(trim(p_note), '') = '' then
    raise exception 'Please give a reason when declining';
  end if;
  update public.activity_assignees set status = p_status, response_note = p_note, responded_at = now()
  where activity_id = p_activity and profile_id = auth.uid();
  select full_name into v_name from public.profiles where id = auth.uid();
  -- organiser + team leads/coordinators hear about every response
  insert into public.notifications (user_id, title, message, data, link, org_id)
  select distinct u, 'Activity response', format('%s: %s – %s%s', a.title, v_name, p_status, coalesce(' (' || p_note || ')', '')),
         jsonb_build_object('type', 'activity', 'activity_id', p_activity), '/erp?module=activities', a.org_id
  from (select a.created_by as u
        union select profile_id from public.activity_assignees
        where activity_id = p_activity and role in ('lead', 'coordinator')) r
  where u is not null and u <> auth.uid();
end;
$$;

-- Everything the signed-in person is responsible for (mobile home / web).
create or replace function public.my_responsibilities()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
begin
  return jsonb_build_object(
    'duties', coalesce((
      select jsonb_agg(jsonb_build_object('assignment_id', a.id, 'duty_role_id', r.id, 'code', r.code,
               'name_en', r.name_en, 'name_ar', r.name_ar, 'name_ta', r.name_ta, 'since', a.start_date,
               'is_lead', a.is_lead, 'grants_leave_review', r.grants_leave_review,
               'petty_fund_id', (select f.id from public.petty_cash_funds f where f.duty_role_id = r.id and f.is_active))
             order by r.name_en)
      from public.duty_assignments a join public.duty_roles r on r.id = a.duty_role_id
      where a.assignee_id = auth.uid() and a.status = 'active' and a.org_id = v_org), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('activity_id', act.id, 'title', act.title, 'category', act.category,
               'starts_at', act.starts_at, 'ends_at', act.ends_at, 'location', act.location, 'status', act.status,
               'role', x.role, 'responsibilities', x.responsibilities, 'my_status', x.status,
               'team', (select jsonb_agg(jsonb_build_object('name', p.full_name, 'role', y.role, 'status', y.status))
                        from public.activity_assignees y join public.profiles p on p.id = y.profile_id
                        where y.activity_id = act.id))
             order by act.starts_at)
      from public.activity_assignees x join public.activities act on act.id = x.activity_id
      where x.profile_id = auth.uid() and act.org_id = v_org and act.status in ('planned', 'ongoing')), '[]'::jsonb),
    'tasks', (select jsonb_build_object(
               'todo', count(*) filter (where status = 'todo'),
               'in_progress', count(*) filter (where status = 'in_progress'),
               'review', count(*) filter (where status = 'review'),
               'overdue', count(*) filter (where status <> 'done' and due_date < public.org_today()))
             from public.tasks where assignee_id = auth.uid() and org_id = v_org),
    'permissions', jsonb_build_object(
      'finance', public.is_finance_staff(), 'accountant', public.is_accountant(),
      'governance', public.is_governance_admin(), 'leave_review', public.has_leave_review_duty() or public.is_academic_admin(),
      'hr', public.is_hr_staff(), 'admissions', public.is_admissions_staff()));
end;
$$;

grant execute on function public.assign_activity_staff(uuid, jsonb) to authenticated;
grant execute on function public.remove_activity_staff(uuid, uuid) to authenticated;
grant execute on function public.respond_activity(uuid, text, text) to authenticated;
grant execute on function public.my_responsibilities() to authenticated;

alter table public.activities enable row level security;
alter table public.activity_assignees enable row level security;
drop policy if exists "activities: employee read" on public.activities;
create policy "activities: employee read" on public.activities for select to authenticated using (public.is_employee());
drop policy if exists "activities: governance write" on public.activities;
create policy "activities: governance write" on public.activities for all to authenticated
  using (public.is_governance_admin()) with check (public.is_governance_admin());
drop policy if exists "activity_assignees: employee read" on public.activity_assignees;
create policy "activity_assignees: employee read" on public.activity_assignees for select to authenticated using (public.is_employee());

select public.attach_audit(t) from unnest(array['activities', 'activity_assignees']) t;

-- ---------------------------------------------------------------------------
-- 5. Analytics
-- ---------------------------------------------------------------------------
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
               sum(f.total_due - f.paid_amount) as balance, min(f.due_date) as oldest_due
        from public.student_fees f join public.profiles p on p.id = f.student_id
        where f.org_id = v_org and f.status in ('unpaid', 'partial') and f.cancelled_at is null
        group by p.id, p.full_name, p.index_number, p.class_number
        order by sum(f.total_due - f.paid_amount) desc limit 10) x), '[]'::jsonb),
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

create or replace function public.academic_analytics(p_days int default 180)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_today date := public.org_today();
  v_from date := v_today - greatest(7, least(coalesce(p_days, 180), 730));
begin
  if not (public.is_academic_admin() or public.is_admin() or public.is_admissions_staff() or public.is_hr_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'as_of', v_today,
    'attendance_by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', mon, 'marked', n,
               'rate', case when n > 0 then round(present * 100.0 / n, 1) end) order by mon)
      from (select to_char(date, 'YYYY-MM') mon, count(*) n, count(*) filter (where status in ('present', 'late')) present
            from public.attendance where org_id = v_org and date >= v_from group by 1) x), '[]'::jsonb),
    'attendance_by_class', coalesce((
      select jsonb_agg(jsonb_build_object('class_number', class_number, 'rate', rate, 'marked', n) order by class_number)
      from (select p.class_number, count(*) n,
                   round(count(*) filter (where a.status in ('present', 'late')) * 100.0 / nullif(count(*), 0), 1) rate
            from public.attendance a join public.profiles p on p.id = a.student_id
            where a.org_id = v_org and a.date >= v_today - 30 group by p.class_number) x), '[]'::jsonb),
    'chronic_absentees', coalesce((
      select jsonb_agg(x order by x.rate) from (
        select p.id student_id, p.full_name, p.class_number, count(*) marked,
               round(count(*) filter (where a.status in ('present', 'late')) * 100.0 / count(*), 1) rate
        from public.attendance a join public.profiles p on p.id = a.student_id
        where a.org_id = v_org and a.date >= v_today - 30
        group by p.id, p.full_name, p.class_number
        having count(*) >= 5 and count(*) filter (where a.status in ('present', 'late')) * 100.0 / count(*) < 75
        order by 5 limit 15) x), '[]'::jsonb),
    'latest_exam', (
      select jsonb_build_object('exam_id', e.id, 'name', e.name, 'class_number', e.class_number,
        'subjects', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'average', avg_pct, 'pass_rate', pass_rate, 'entries', n) order by subject)
                     from (select r.subject, count(*) n,
                                  round(avg(r.marks_obtained * 100.0 / nullif(r.max_marks, 0)), 1) avg_pct,
                                  round(count(*) filter (where r.marks_obtained * 100.0 / nullif(r.max_marks, 0) >= 40) * 100.0 / count(*), 1) pass_rate
                           from public.student_results r where r.exam_id = e.id group by r.subject) s), '[]'::jsonb))
      from public.exams e where e.org_id = v_org and e.status = 'published'
      order by coalesce(e.published_at, e.created_at) desc limit 1),
    'admissions_funnel', coalesce((
      select jsonb_object_agg(stage, n) from (
        select coalesce(pipeline_stage, 'submitted') stage, count(*) n from public.admissions
        where org_id = v_org and created_at >= v_from group by 1) x), '{}'::jsonb),
    'admissions_conversion', (
      select case when count(*) > 0 then round(count(*) filter (where pipeline_stage = 'enrolled') * 100.0 / count(*), 1) end
      from public.admissions where org_id = v_org and created_at >= v_from),
    'enrolment_by_class', coalesce((
      select jsonb_agg(jsonb_build_object('class_number', class_number, 'students', n) order by class_number)
      from (select class_number, count(*) n from public.profiles
            where org_id = v_org and account_type = 'student' and is_approved group by class_number) x), '[]'::jsonb),
    'staff_leave_days', coalesce((
      select jsonb_object_agg(code, days) from (
        select t.code, sum(r.days) days from public.staff_leave_requests r
        join public.staff_leave_types t on t.id = r.leave_type_id
        where r.org_id = v_org and r.status = 'approved' and extract(year from r.start_date) = extract(year from v_today)
        group by t.code) x), '{}'::jsonb),
    'tasks', (select jsonb_build_object(
        'open', count(*) filter (where status <> 'done'),
        'overdue', count(*) filter (where status <> 'done' and due_date < v_today),
        'done_30d', count(*) filter (where status = 'done' and completed_at > now() - interval '30 days'))
      from public.tasks where org_id = v_org));
end;
$$;

grant execute on function public.finance_analytics(int) to authenticated;
grant execute on function public.academic_analytics(int) to authenticated;

create index if not exists idx_fee_receipts_org_paid on public.fee_receipts (org_id, paid_at desc);
create index if not exists idx_expenses_org_date on public.expenses (org_id, expense_date);

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['activities', 'activity_assignees'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Arrears figures everywhere exclude cancelled invoices (consistent with analytics).
create or replace function public.student_arrears(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.can_view_student(p_student) or public.is_finance_viewer()) then
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
