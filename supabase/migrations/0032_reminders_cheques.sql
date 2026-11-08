-- =============================================================================
-- 0032_reminders_cheques.sql
-- 1. Cheque register: cheques received (fees, donations) and issued
--    (expenses, salaries), with the date on the cheque, bank, and status
--    pending → deposited → cleared | bounced | cancelled.
--    A fee payment recorded with method 'cheque' creates its register entry
--    automatically; a bounced fee cheque reverses the receipt.
-- 2. Daily reminders (pg_cron when available): tasks due soon / overdue,
--    post-dated cheques due for deposit, issued cheques maturing.
-- =============================================================================

create table if not exists public.cheques (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  direction        text not null check (direction in ('received', 'issued')),
  cheque_no        text not null check (length(trim(cheque_no)) > 0),
  bank_name        text,
  branch           text,
  amount           numeric(14,2) not null check (amount > 0),
  currency         text not null default 'LKR',
  cheque_date      date not null,               -- date written on the cheque (may be post-dated)
  handled_on       date not null default current_date, -- received from drawer / handed to payee
  party_name       text not null check (length(trim(party_name)) > 0), -- drawer or payee
  purpose          text,
  student_id       uuid references public.profiles (id) on delete set null,
  fee_payment_ids  uuid[] not null default '{}',  -- one cheque may settle several invoices
  expense_id       uuid references public.expenses (id) on delete set null,
  status           text not null default 'pending'
                   check (status in ('pending', 'deposited', 'cleared', 'bounced', 'cancelled')),
  deposited_on     date,
  cleared_on       date,
  bounced_on       date,
  bounce_reason    text,
  bank_charges     numeric(12,2) not null default 0 check (bank_charges >= 0),
  notes            text,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists idx_cheques_unique_no
  on public.cheques (org_id, direction, coalesce(bank_name, ''), cheque_no) where status <> 'cancelled';
create index if not exists idx_cheques_due on public.cheques (org_id, status, cheque_date);

create table if not exists public.cheque_events (
  id         uuid primary key default extensions.gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  cheque_id  uuid not null references public.cheques (id) on delete cascade,
  from_status text,
  to_status  text not null,
  on_date    date,
  note       text,
  actor_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.cheques enable row level security;
drop policy if exists "cheques: finance read" on public.cheques;
create policy "cheques: finance read" on public.cheques for select to authenticated
  using (org_id = public.current_org_id() and public.is_finance_viewer());
drop policy if exists "cheques: finance insert" on public.cheques;
create policy "cheques: finance insert" on public.cheques for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_finance_staff() and status = 'pending');
drop policy if exists "cheques: finance edit details" on public.cheques;
create policy "cheques: finance edit details" on public.cheques for update to authenticated
  using (org_id = public.current_org_id() and public.is_finance_staff())
  with check (org_id = public.current_org_id());
select public.apply_mfa_policy('public.cheques'::regclass);

alter table public.cheque_events enable row level security;
drop policy if exists "cheque_events: finance read" on public.cheque_events;
create policy "cheque_events: finance read" on public.cheque_events for select to authenticated
  using (org_id = public.current_org_id() and public.is_finance_viewer());
select public.apply_mfa_policy('public.cheque_events'::regclass);

-- Status, amounts of settled cheques and links are server-managed.
create or replace function public.tg_cheques_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and not public.is_privileged_caller()
     and coalesce(current_setting('app.cheque_status_change', true), '') <> 'on' then
    new.status := old.status;
    new.deposited_on := old.deposited_on;
    new.cleared_on := old.cleared_on;
    new.bounced_on := old.bounced_on;
    new.fee_payment_ids := old.fee_payment_ids;
    new.org_id := old.org_id;
    new.direction := old.direction;
    if old.status in ('cleared', 'bounced', 'cancelled') then
      new.amount := old.amount;
      new.cheque_no := old.cheque_no;
      new.cheque_date := old.cheque_date;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_cheques_guard on public.cheques;
create trigger trg_cheques_guard before update on public.cheques
  for each row execute function public.tg_cheques_guard();

select public.attach_audit('cheques');

-- Recipients: public.finance_staff_ids(org) from 0025 (set-returning).

-- Move a cheque through its life cycle.
create or replace function public.update_cheque_status(p_cheque uuid, p_status text, p_on date default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c         record;
  v_on      date := coalesce(p_on, public.org_today());
  v_allowed text[];
  v_reversed boolean := false;
  v_pay     uuid;
begin
  if not public.is_finance_staff() then
    raise exception 'Only the treasurer, accountant or an administrator can update cheques' using errcode = '42501';
  end if;
  select * into c from public.cheques where id = p_cheque and org_id = public.current_org_id() for update;
  if not found then raise exception 'Cheque not found'; end if;

  v_allowed := case c.status
    when 'pending'   then array['deposited', 'cleared', 'bounced', 'cancelled']
    when 'deposited' then array['cleared', 'bounced']
    when 'bounced'   then array['deposited']   -- re-presented
    else '{}'::text[] end;
  if not (p_status = any (v_allowed)) then
    raise exception 'A % cheque cannot be marked %', c.status, p_status;
  end if;
  if p_status = 'bounced' and coalesce(trim(p_note), '') = '' then
    raise exception 'Give the reason the cheque was dishonoured';
  end if;
  if p_status = 'cancelled' and coalesce(trim(p_note), '') = '' then
    raise exception 'Give a reason for cancelling the cheque';
  end if;
  if p_status in ('deposited', 'cleared') and c.direction = 'received' and v_on < c.cheque_date then
    raise exception 'This cheque is dated %; it cannot be deposited before that date', c.cheque_date;
  end if;

  perform set_config('app.cheque_status_change', 'on', true);
  update public.cheques set
    status = p_status,
    deposited_on = case when p_status = 'deposited' then v_on else deposited_on end,
    cleared_on   = case when p_status = 'cleared' then v_on else cleared_on end,
    bounced_on   = case when p_status = 'bounced' then v_on else bounced_on end,
    bounce_reason = case when p_status = 'bounced' then p_note else bounce_reason end
  where id = c.id;

  -- A dishonoured fee cheque means the fees were not paid: reverse the receipts.
  if p_status = 'bounced' and c.direction = 'received' and cardinality(c.fee_payment_ids) > 0 then
    if public.is_accountant() then
      for v_pay in select id from public.fee_payments where id = any (c.fee_payment_ids) and status = 'posted' loop
        perform public.reverse_fee_payment(v_pay, 'Cheque ' || c.cheque_no || ' dishonoured: ' || p_note);
        v_reversed := true;
      end loop;
    else
      perform public.notify_users(array(select public.finance_staff_ids(c.org_id)),
        'Bounced cheque — reverse the receipt',
        format('Cheque %s (%s, LKR %s) from %s was dishonoured. An accountant must reverse the fee receipt.',
               c.cheque_no, coalesce(c.bank_name, '—'), c.amount, c.party_name),
        '/erp?module=cheques', jsonb_build_object('type', 'cheque_bounced', 'cheque_id', c.id));
    end if;
  end if;

  insert into public.cheque_events (org_id, cheque_id, from_status, to_status, on_date, note)
  values (c.org_id, c.id, c.status, p_status, v_on, nullif(trim(coalesce(p_note, '')), ''));
  return jsonb_build_object('status', p_status, 'receipt_reversed', v_reversed);
end $$;
grant execute on function public.update_cheque_status(uuid, text, date, text) to authenticated;

-- Fee received by cheque → register entry (bank/date filled in by the treasurer).
create or replace function public.tg_fee_payment_cheque()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_party text;
  v_no    text := coalesce(nullif(trim(new.reference), ''), 'RCPT-' || new.receipt_no);
begin
  if new.method <> 'cheque' then return null; end if;
  perform set_config('app.cheque_status_change', 'on', true);
  -- Same cheque paying another invoice of the same student: add to it.
  update public.cheques
     set amount = amount + new.amount,
         fee_payment_ids = fee_payment_ids || new.id,
         purpose = concat_ws(', ', purpose, 'Fee receipt ' || new.receipt_no)
   where org_id = new.org_id and direction = 'received' and cheque_no = v_no
     and student_id = new.student_id and status = 'pending';
  if found then return null; end if;
  select coalesce(nullif(d.guardian_name, ''), p.full_name, 'Student') into v_party
  from public.profiles p left join public.student_details d on d.profile_id = p.id
  where p.id = new.student_id;
  insert into public.cheques (org_id, direction, cheque_no, amount, currency, cheque_date, handled_on, party_name,
                              purpose, student_id, fee_payment_ids, created_by, notes)
  values (new.org_id, 'received', v_no, new.amount,
          new.currency, (new.paid_at at time zone 'Asia/Colombo')::date, (new.paid_at at time zone 'Asia/Colombo')::date,
          coalesce(v_party, 'Student'), 'Fee receipt ' || new.receipt_no, new.student_id, array[new.id], new.received_by,
          'Created from fee receipt; add the bank and cheque date.')
  on conflict do nothing;
  return null;
end $$;
drop trigger if exists trg_fee_payment_cheque on public.fee_payments;
create trigger trg_fee_payment_cheque after insert on public.fee_payments
  for each row execute function public.tg_fee_payment_cheque();

-- ---------------------------------------------------------------------------
-- Daily reminders
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists due_reminder_on     date,
  add column if not exists overdue_reminder_on date;
alter table public.cheques
  add column if not exists due_reminder_on date;

create or replace function public.run_daily_reminders()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r          record;
  v_due      int := 0;
  v_overdue  int := 0;
  v_cheques  int := 0;
begin
  -- Service role / cron, or an administrator running it by hand.
  if not (public.is_privileged_caller() or public.is_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Tasks due today or tomorrow (org-local date), once per day.
  for r in
    select t.id, t.org_id, t.title, t.due_date, t.assignee_id,
           (now() at time zone o.timezone)::date as today
    from public.tasks t join public.organizations o on o.id = t.org_id
    where t.status <> 'done' and t.assignee_id is not null and t.due_date is not null
      and t.due_date between (now() at time zone o.timezone)::date and (now() at time zone o.timezone)::date + 1
      and t.due_reminder_on is distinct from (now() at time zone o.timezone)::date
  loop
    insert into public.notifications (user_id, title, message, data, link, org_id)
    values (r.assignee_id,
            case when r.due_date = r.today then 'Task due today' else 'Task due tomorrow' end,
            r.title, jsonb_build_object('type', 'task_due', 'task_id', r.id), '/erp?module=tasks', r.org_id);
    update public.tasks set due_reminder_on = r.today where id = r.id;
    v_due := v_due + 1;
  end loop;

  -- Overdue tasks: assignee and creator, at most every 3 days.
  for r in
    select t.id, t.org_id, t.title, t.due_date, t.assignee_id, t.created_by,
           (now() at time zone o.timezone)::date as today
    from public.tasks t join public.organizations o on o.id = t.org_id
    where t.status <> 'done' and t.assignee_id is not null and t.due_date is not null
      and t.due_date < (now() at time zone o.timezone)::date
      and (t.overdue_reminder_on is null or t.overdue_reminder_on <= (now() at time zone o.timezone)::date - 3)
  loop
    insert into public.notifications (user_id, title, message, data, link, org_id)
    select u, 'Task overdue', format('%s (due %s)', r.title, to_char(r.due_date, 'DD Mon')),
           jsonb_build_object('type', 'task_overdue', 'task_id', r.id), '/erp?module=tasks', r.org_id
    from unnest(array_remove(array[r.assignee_id, nullif(r.created_by, r.assignee_id)], null)) u;
    update public.tasks set overdue_reminder_on = r.today where id = r.id;
    v_overdue := v_overdue + 1;
  end loop;

  -- Cheques reaching their date: received → deposit; issued → funds needed.
  for r in
    select c.*, (now() at time zone o.timezone)::date as today
    from public.cheques c join public.organizations o on o.id = c.org_id
    where c.status = 'pending'
      and c.cheque_date <= (now() at time zone o.timezone)::date + case when c.direction = 'issued' then 2 else 0 end
      and c.due_reminder_on is null
  loop
    insert into public.notifications (user_id, title, message, data, link, org_id)
    select u,
           case when r.direction = 'received' then 'Cheque ready to deposit' else 'Issued cheque maturing' end,
           format('%s cheque %s · %s · LKR %s · dated %s', initcap(r.direction), r.cheque_no, r.party_name,
                  to_char(r.amount, 'FM999,999,990.00'), to_char(r.cheque_date, 'DD Mon YYYY')),
           jsonb_build_object('type', 'cheque_due', 'cheque_id', r.id), '/erp?module=cheques', r.org_id
    from public.finance_staff_ids(r.org_id) u;
    perform set_config('app.cheque_status_change', 'on', true);
    update public.cheques set due_reminder_on = r.today where id = r.id;
    v_cheques := v_cheques + 1;
  end loop;

  return jsonb_build_object('tasks_due', v_due, 'tasks_overdue', v_overdue, 'cheques', v_cheques);
end $$;
grant execute on function public.run_daily_reminders() to authenticated, service_role;

-- Schedule at 07:00 Sri Lanka time (01:30 UTC) where pg_cron is installed
-- (Supabase: Database → Extensions → pg_cron). Safe to re-run.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'dukh-daily-reminders';
    perform cron.schedule('dukh-daily-reminders', '30 1 * * *', 'select public.run_daily_reminders()');
  else
    raise notice 'pg_cron is not installed: enable it, then re-run this migration to schedule daily reminders';
  end if;
exception when others then
  raise notice 'Could not schedule daily reminders: %', sqlerrm;
end $$;
