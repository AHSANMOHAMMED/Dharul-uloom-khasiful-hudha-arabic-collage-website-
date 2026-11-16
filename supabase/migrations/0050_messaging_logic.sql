-- =============================================================================
-- 0050_messaging_logic.sql — outbox queue fairness / retry hygiene, fee
-- reminder fallback. Idempotent (create or replace only).
--
-- 1. claim_outbox_batch / claim_org_outbox_batch
--    * Before: 'blocked' rows (provider secrets missing — e.g. WhatsApp, which
--      every profile has enabled by default) were re-claimed on every run,
--      oldest first, without using up attempts. Once ≥ batch-size blocked rows
--      existed, every batch was filled with them and new pending SMS/e-mail/
--      push (receipts, reminders) were never picked up.
--      Now: pending rows first; blocked rows only every 30 minutes; blocked
--      rows older than 7 days expire as 'failed'.
--    * Failed sends were retried on the very next run; now back off
--      attempts × 1 minute.
--    * A row whose 5th attempt crashed stayed 'sending' forever (claim needs
--      attempts < 5); stale ones are now closed as 'failed'.
-- 2. send_fee_reminder
--    * Guardian-phone SMS fallback only ran when no parent was linked; a
--      linked parent account without a phone meant no SMS at all. Now it runs
--      when no linked parent has a phone (same rule as _notify_fee_receipt).
--    * The 20-hour repeat guard only looked at message_outbox, so families
--      with no external channel could be reminded repeatedly; it now also
--      checks the in-app reminder notifications.
-- =============================================================================

create or replace function public._outbox_close_dead(p_org uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.message_outbox
  set status = 'failed',
      error = case when status = 'blocked'
                   then coalesce(error, 'provider not configured') || ' (expired after 7 days)'
                   else coalesce(error, 'worker did not finish the last attempt') end
  where (p_org is null or org_id = p_org)
    and ((status = 'sending' and attempts >= 5 and claimed_at < now() - interval '5 minutes')
      or (status = 'blocked' and created_at < now() - interval '7 days'));
$$;
revoke all on function public._outbox_close_dead(uuid) from public, anon, authenticated;

create or replace function public.claim_outbox_batch(p_limit integer default 50)
returns setof public.message_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public._outbox_close_dead(null);
  return query
  update public.message_outbox m
  set status = 'sending', claimed_at = now(),
      attempts = case when m.status = 'blocked' then m.attempts else m.attempts + 1 end
  where m.id in (
    select q.id from public.message_outbox q
    where q.attempts < 5
      and ((q.status = 'pending'
            and (q.attempts = 0 or q.claimed_at is null or q.claimed_at < now() - q.attempts * interval '1 minute'))
        or (q.status = 'blocked' and (q.claimed_at is null or q.claimed_at < now() - interval '30 minutes'))
        or (q.status = 'sending' and q.claimed_at < now() - interval '5 minutes'))
    order by (q.status = 'blocked'), q.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  )
  returning m.*;
end;
$$;
revoke all on function public.claim_outbox_batch(int) from public, anon, authenticated;
grant execute on function public.claim_outbox_batch(int) to service_role;

create or replace function public.claim_org_outbox_batch(p_requester uuid, p_limit integer default 50)
returns setof public.message_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.profiles
  where id = p_requester and is_approved
    and (role in ('admin', 'super_admin') or account_type in ('tutor', 'staff'));
  if v_org is null then
    raise exception 'An approved college staff account is required' using errcode = '42501';
  end if;
  perform public._outbox_close_dead(v_org);
  return query
  update public.message_outbox m
  set status = 'sending', claimed_at = now(),
      attempts = case when m.status = 'blocked' then m.attempts else m.attempts + 1 end
  where m.id in (
    select q.id from public.message_outbox q
    where q.org_id = v_org
      and q.attempts < 5
      and ((q.status = 'pending'
            and (q.attempts = 0 or q.claimed_at is null or q.claimed_at < now() - q.attempts * interval '1 minute'))
        or (q.status = 'blocked' and (q.claimed_at is null or q.claimed_at < now() - interval '30 minutes'))
        or (q.status = 'sending' and q.claimed_at < now() - interval '5 minutes'))
    order by (q.status = 'blocked'), q.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  ) returning m.*;
end;
$$;
revoke all on function public.claim_org_outbox_batch(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_org_outbox_batch(uuid, int) to service_role;

create or replace function public.send_fee_reminder(p_student uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  s record;
  a jsonb;
  v_body text;
  v_short text;
  par record;
  v_sent int := 0;
  v_parent_phones int := 0;
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
               and created_at > now() - interval '20 hours')
     or exists (select 1 from public.notifications
             where org_id = v_org and user_id = p_student and data ->> 'type' = 'fee_reminder'
               and data ->> 'student_id' = p_student::text and created_at > now() - interval '20 hours') then
    raise exception 'A reminder was already sent to this family in the last 20 hours';
  end if;
  select coalesce(settings ->> 'short_name', name_en) into v_short from public.organizations where id = v_org;
  v_body := format('%s: Fee reminder for %s%s. Outstanding LKR %s for %s.%s Please pay at the office or in the parent app.',
                   v_short, s.full_name, coalesce(' (' || s.index_number || ')', ''),
                   public.money_text((a ->> 'total')::numeric),
                   (select string_agg(to_char(to_date(m ->> 'month' || '-01', 'YYYY-MM-DD'), 'FMMon YYYY'), ', ')
                    from jsonb_array_elements(a -> 'months') m),
                   coalesce(' ' || nullif(trim(p_note), ''), ''));
  for par in
    select pc.parent_id, p.phone from public.parent_children pc
    join public.profiles p on p.id = pc.parent_id
    where pc.child_id = p_student
  loop
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (par.parent_id, 'Fee reminder', v_body, jsonb_build_object('type', 'fee_reminder', 'student_id', p_student), '/fees', v_org);
    perform public.enqueue_user_messages(par.parent_id, 'Fee reminder', v_body,
      jsonb_build_object('type', 'fee_reminder', 'student_id', p_student));
    v_sent := v_sent + 1;
    if coalesce(trim(par.phone), '') <> '' then
      v_parent_phones := v_parent_phones + 1;
    end if;
  end loop;
  if v_parent_phones = 0 then
    select guardian_phone into v_guardian from public.student_details where profile_id = p_student;
    if coalesce(trim(v_guardian), '') <> '' then
      insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
      values ('sms', v_guardian, 'Fee reminder', v_body,
              jsonb_build_object('type', 'fee_reminder', 'student_id', p_student, 'recipient', 'guardian_phone'), v_org);
      v_sent := v_sent + 1;
    end if;
  end if;
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (p_student, 'Fee reminder', v_body, jsonb_build_object('type', 'fee_reminder', 'student_id', p_student), '/fees', v_org);
  return jsonb_build_object('ok', true, 'recipients', v_sent, 'outstanding', (a ->> 'total')::numeric);
end;
$$;

-- =============================================================================
-- DEPLOYMENT — schedule the send-outbound worker (NOT run by this migration).
--
-- Nothing in the repository schedules send-outbound. Only staff actions
-- (fee reminder, resend, broadcast, approval, chat send) trigger it, so
-- receipts, daily task/cheque reminders, leave/duty/discipline notices and
-- every native push sit 'pending' until somebody happens to press one of
-- those buttons. Run this once in the Supabase SQL editor after enabling the
-- pg_cron and pg_net extensions (Database → Extensions), replacing the two
-- placeholders. Store the service-role key in Vault, never in source control.
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'send_outbound_service_key');
--
--   select cron.unschedule(jobid) from cron.job where jobname = 'dukh-send-outbound';
--   select cron.schedule('dukh-send-outbound', '* * * * *', $job$
--     select net.http_post(
--       url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-outbound',
--       headers := jsonb_build_object(
--                    'Content-Type', 'application/json',
--                    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
--                                                   where name = 'send_outbound_service_key')),
--       body    := '{"limit": 100}'::jsonb,
--       timeout_milliseconds := 10000);
--   $job$);
--
-- The daily reminder job from 0032 is only created if pg_cron was already
-- enabled when 0032 ran; if it is missing, also run:
--   select cron.schedule('dukh-daily-reminders', '30 1 * * *', 'select public.run_daily_reminders()');
-- =============================================================================
