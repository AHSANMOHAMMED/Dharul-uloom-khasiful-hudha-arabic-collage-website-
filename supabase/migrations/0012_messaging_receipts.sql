-- =============================================================================
-- 0012_messaging_receipts.sql
-- Outbound SMS/WhatsApp queue, receipt numbers, notification channel prefs,
-- student activation audit for parents.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- Receipt number on payment transactions
alter table public.payment_transactions
  add column if not exists receipt_no text;

create unique index if not exists idx_payment_transactions_receipt_no
  on public.payment_transactions (receipt_no)
  where receipt_no is not null;

-- Parent/student channel preferences
alter table public.profiles
  add column if not exists notify_sms boolean not null default true,
  add column if not exists notify_whatsapp boolean not null default true,
  add column if not exists notify_push boolean not null default true,
  add column if not exists notify_email boolean not null default true;

-- Outbound message queue (processed by send-outbound edge function)
create table if not exists public.message_outbox (
  id            uuid primary key default extensions.gen_random_uuid(),
  user_id       uuid references public.profiles (id) on delete set null,
  channel       text not null check (channel in ('sms', 'whatsapp', 'email', 'push')),
  to_address    text not null,
  subject       text,
  body          text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_id   text,
  error         text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

create index if not exists idx_message_outbox_pending
  on public.message_outbox (status, created_at)
  where status = 'pending';

alter table public.message_outbox enable row level security;

create policy "message_outbox: staff read"
  on public.message_outbox for select
  using (public.is_staff());

-- Activation events (student/tutor approved) for parent visibility
create table if not exists public.activation_events (
  id            uuid primary key default extensions.gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  event_type    text not null default 'approved'
                check (event_type in ('approved', 'rejected', 'linked_parent')),
  summary       text not null,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_activation_events_profile
  on public.activation_events (profile_id, created_at desc);

alter table public.activation_events enable row level security;

create policy "activation_events: own child or self or staff"
  on public.activation_events for select
  using (
    profile_id = auth.uid()
    or public.is_parent_of(profile_id)
    or public.is_staff()
  );

create policy "activation_events: staff insert"
  on public.activation_events for insert
  with check (public.is_staff());

-- Helper: enqueue outbound channels for a user (service role / security definer)
create or replace function public.enqueue_user_messages(
  p_user_id uuid,
  p_subject text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
begin
  select id, phone, email, notify_sms, notify_whatsapp, notify_email
    into u
  from public.profiles
  where id = p_user_id;

  if not found then
    return;
  end if;

  if u.notify_sms and coalesce(u.phone, '') <> '' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata)
    values (u.id, 'sms', u.phone, p_subject, p_body, p_metadata);
  end if;

  if u.notify_whatsapp and coalesce(u.phone, '') <> '' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata)
    values (u.id, 'whatsapp', u.phone, p_subject, p_body, p_metadata);
  end if;

  if u.notify_email and coalesce(u.email, '') <> '' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata)
    values (u.id, 'email', u.email, p_subject, p_body, p_metadata);
  end if;
end;
$$;

revoke all on function public.enqueue_user_messages(uuid, text, text, jsonb) from public;
grant execute on function public.enqueue_user_messages(uuid, text, text, jsonb) to service_role;
grant execute on function public.enqueue_user_messages(uuid, text, text, jsonb) to authenticated;

-- Notify student + linked parents of a payment (in-app + outbox)
create or replace function public.notify_payment_received(
  p_student_id uuid,
  p_amount numeric,
  p_fee_id uuid default null,
  p_receipt_no text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  student_name text;
  parent_rec record;
  title text := 'Payment received';
  body text;
begin
  select full_name into student_name from public.profiles where id = p_student_id;
  body := format(
    'Tuition payment of LKR %s received for %s.%s',
    trim(to_char(p_amount, '999999990.00')),
    coalesce(student_name, 'student'),
    case when p_receipt_no is not null then format(' Receipt: %s.', p_receipt_no) else '' end
  );

  insert into public.notifications (user_id, title, message)
  values (p_student_id, title, body);

  perform public.enqueue_user_messages(
    p_student_id, title, body,
    jsonb_build_object('type', 'payment', 'fee_id', p_fee_id, 'receipt_no', p_receipt_no)
  );

  for parent_rec in
    select parent_id from public.parent_children where child_id = p_student_id
  loop
    insert into public.notifications (user_id, title, message)
    values (parent_rec.parent_id, title, body);

    perform public.enqueue_user_messages(
      parent_rec.parent_id, title, body,
      jsonb_build_object('type', 'payment', 'fee_id', p_fee_id, 'receipt_no', p_receipt_no, 'student_id', p_student_id)
    );
  end loop;
end;
$$;

revoke all on function public.notify_payment_received(uuid, numeric, uuid, text) from public;
grant execute on function public.notify_payment_received(uuid, numeric, uuid, text) to service_role;
grant execute on function public.notify_payment_received(uuid, numeric, uuid, text) to authenticated;

-- Notify linked parents when a student/tutor is approved
create or replace function public.notify_profile_activated(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  parent_rec record;
  summary text;
  detail jsonb;
begin
  select id, full_name, account_type, index_number, class_number, email, phone
    into p
  from public.profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  summary := format(
    '%s (%s) has been activated.%s%s',
    coalesce(p.full_name, 'User'),
    coalesce(p.account_type, 'user'),
    case when p.index_number is not null then format(' Index: %s.', p.index_number) else '' end,
    case when p.class_number is not null then format(' Class: %s.', p.class_number) else '' end
  );

  detail := jsonb_build_object(
    'full_name', p.full_name,
    'account_type', p.account_type,
    'index_number', p.index_number,
    'class_number', p.class_number,
    'email', p.email,
    'phone', p.phone
  );

  insert into public.activation_events (profile_id, event_type, summary, details)
  values (p.id, 'approved', summary, detail);

  insert into public.notifications (user_id, title, message)
  values (p.id, 'Account activated', summary);

  perform public.enqueue_user_messages(p.id, 'Account activated', summary, detail);

  if p.account_type = 'student' then
    for parent_rec in
      select parent_id from public.parent_children where child_id = p.id
    loop
      insert into public.notifications (user_id, title, message)
      values (parent_rec.parent_id, 'Student activated', summary);

      perform public.enqueue_user_messages(
        parent_rec.parent_id, 'Student activated', summary, detail
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.notify_profile_activated(uuid) from public;
grant execute on function public.notify_profile_activated(uuid) to service_role;
grant execute on function public.notify_profile_activated(uuid) to authenticated;
