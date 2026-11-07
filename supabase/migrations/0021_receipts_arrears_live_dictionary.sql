-- =============================================================================
-- 0021_receipts_arrears_live_dictionary.sql
--
-- 1. Receipts: one receipt per payment the accountant receives, allocated to
--    the student's open months oldest-first (arrears first). Each allocation
--    snapshots the month's balance after payment, and the receipt snapshots
--    the student's total arrears — the printed slip / PDF / SMS show exactly
--    what was true at the moment of payment.
-- 2. Notifications for a receipt: student + every linked parent/guardian
--    (in-app → native push with deep link; SMS/WhatsApp/e-mail via outbox,
--    e-mail carries the PDF; guardian phone fallback when no parent account).
-- 3. Live app: tables added to the supabase_realtime publication.
-- 4. Arabic → Tamil dictionary for the Shamela reader (curated / imported
--    lexicon entries + morphology-aware lookup; AI suggestions cached and
--    flagged unverified until a librarian approves them).
-- 5. Performance: statement timeouts (< 10 s API budget) and indexes.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. Receipts
-- ---------------------------------------------------------------------------
create table if not exists public.fee_receipts (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  receipt_no    text not null,
  student_id    uuid not null references public.profiles (id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null default 'LKR',
  method        text not null check (method in ('cash', 'bank_transfer', 'cheque', 'payhere', 'online', 'other')),
  reference     text,
  notes         text,
  payer_name    text,
  paid_at       timestamptz not null default now(),
  received_by   uuid references public.profiles (id) on delete set null,
  status        text not null default 'posted' check (status in ('posted', 'reversed')),
  arrears_after numeric(12,2),
  public_token  text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  idempotency_key text,
  created_at    timestamptz not null default now(),
  unique (org_id, receipt_no)
);
-- a retried request (e.g. after a network timeout) returns the same receipt
create unique index if not exists idx_fee_receipts_idempotency
  on public.fee_receipts (org_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_fee_receipts_student on public.fee_receipts (student_id, paid_at desc);
select public.apply_tenant_scope('fee_receipts', 'student_id');
alter table public.fee_receipts enable row level security;

drop policy if exists "fee_receipts: read" on public.fee_receipts;
create policy "fee_receipts: read" on public.fee_receipts for select to authenticated
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_finance_viewer());

alter table public.fee_payments
  add column if not exists receipt_id    uuid references public.fee_receipts (id),
  add column if not exists balance_after numeric(12,2);
-- receipt_no is now shared by the allocations of one receipt
alter table public.fee_payments drop constraint if exists fee_payments_org_id_receipt_no_key;
create index if not exists idx_fee_payments_receipt on public.fee_payments (receipt_id);
create index if not exists idx_fee_payments_receipt_no on public.fee_payments (org_id, receipt_no);

-- backfill: one receipt per existing payment row
do $$
declare
  p record;
  v_id uuid;
begin
  for p in select * from public.fee_payments where receipt_id is null order by paid_at loop
    select id into v_id from public.fee_receipts where org_id = p.org_id and receipt_no = p.receipt_no;
    if v_id is null then
      insert into public.fee_receipts (org_id, receipt_no, student_id, amount, currency, method, reference, notes,
                                       paid_at, received_by, status)
      values (p.org_id, p.receipt_no, p.student_id, p.amount, p.currency, p.method, p.reference, p.notes,
              p.paid_at, p.received_by, p.status)
      returning id into v_id;
    else
      update public.fee_receipts set amount = amount + p.amount where id = v_id;
    end if;
    update public.fee_payments set receipt_id = v_id where id = p.id;
  end loop;
end $$;

-- Re-defined: every allocation belongs to a receipt; snapshots balances.
drop function if exists public._post_fee_payment(uuid, numeric, text, text, text, timestamptz, uuid, boolean, text);
create or replace function public._post_fee_payment(
  p_fee uuid, p_amount numeric, p_method text, p_reference text, p_notes text,
  p_paid_at timestamptz default now(), p_gateway_txn uuid default null,
  p_allow_overpay boolean default false, p_receipt_no text default null,
  p_receipt_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_balance numeric;
  v_amount numeric := round(p_amount, 2);
  v_receipt text;
  v_rid uuid := p_receipt_id;
  v_dep uuid;
  v_id uuid;
  v_je uuid;
  v_to_ar numeric;
begin
  select * into f from public.student_fees where id = p_fee for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if f.cancelled_at is not null then
    raise exception 'Invoice % is cancelled', f.invoice_no;
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  v_balance := f.total_due - f.paid_amount;
  if v_amount > v_balance and not p_allow_overpay then
    raise exception 'Amount % exceeds outstanding balance %', v_amount, v_balance;
  end if;

  if v_rid is null then
    v_receipt := coalesce(nullif(p_receipt_no, ''), public.next_document_number(f.org_id, 'RCP'));
    if exists (select 1 from public.fee_receipts where org_id = f.org_id and receipt_no = v_receipt) then
      v_receipt := public.next_document_number(f.org_id, 'RCP');
    end if;
    insert into public.fee_receipts (org_id, receipt_no, student_id, amount, currency, method, reference, notes,
                                     paid_at, received_by)
    values (f.org_id, v_receipt, f.student_id, v_amount, f.currency, p_method, p_reference, p_notes,
            coalesce(p_paid_at, now()), auth.uid())
    returning id into v_rid;
  else
    select receipt_no into v_receipt from public.fee_receipts where id = v_rid;
  end if;

  v_dep := public.account_id_by_code(f.org_id, public.method_deposit_code(p_method));
  insert into public.fee_payments (org_id, fee_id, student_id, amount, currency, method, reference, receipt_no,
                                   paid_at, received_by, gateway_txn_id, deposit_account_id, notes, receipt_id)
  values (f.org_id, f.id, f.student_id, v_amount, f.currency, p_method, p_reference, v_receipt,
          coalesce(p_paid_at, now()), auth.uid(), p_gateway_txn, v_dep, p_notes, v_rid)
  returning id into v_id;

  v_to_ar := least(v_amount, greatest(v_balance, 0));
  v_je := public.post_journal(f.org_id, coalesce(p_paid_at, now())::date,
            format('Receipt %s – invoice %s (%s)', v_receipt, f.invoice_no, p_method), 'fee_payment', v_id,
            jsonb_build_array(
              jsonb_build_object('account_id', v_dep, 'debit', v_amount, 'memo', p_reference),
              jsonb_build_object('code', '1200', 'credit', v_to_ar, 'party_id', f.student_id),
              jsonb_build_object('code', '2300', 'credit', v_amount - v_to_ar, 'party_id', f.student_id,
                                 'memo', 'Overpayment held in advance')));
  update public.fee_payments set journal_entry_id = v_je where id = v_id;
  perform public._fee_recalc(f.id);

  update public.fee_payments set balance_after = (select total_due - paid_amount from public.student_fees where id = f.id)
  where id = v_id;
  update public.fee_receipts set arrears_after = (
    select coalesce(sum(total_due - paid_amount), 0) from public.student_fees
    where student_id = f.student_id and status in ('unpaid', 'partial'))
  where id = v_rid;
  return v_id;
end;
$$;
revoke all on function public._post_fee_payment(uuid, numeric, text, text, text, timestamptz, uuid, boolean, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Receipt detail (single source for the printed slip, PDF, app, SMS)
-- ---------------------------------------------------------------------------
create or replace function public._fee_receipt_json(p_receipt uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'receipt_no', r.receipt_no, 'amount', r.amount, 'currency', r.currency,
    'method', r.method, 'reference', r.reference, 'notes', r.notes, 'paid_at', r.paid_at,
    'status', r.status, 'arrears_after', coalesce(r.arrears_after, 0), 'public_token', r.public_token,
    'payer_name', r.payer_name,
    'received_by', (select full_name from public.profiles where id = r.received_by),
    'organization', jsonb_build_object(
      'name_en', o.name_en, 'name_ar', o.name_ar, 'code', o.code, 'address', o.address,
      'phone', o.contact_phone, 'email', o.contact_email,
      'registration_no', o.settings ->> 'registration_no',
      'logo_url', o.branding ->> 'logo_url',
      'short_name', coalesce(o.settings ->> 'short_name', o.name_en)),
    'student', jsonb_build_object(
      'id', s.id, 'full_name', s.full_name, 'index_number', s.index_number, 'class_number', s.class_number,
      'guardian_name', d.guardian_name,
      'parents', coalesce((select jsonb_agg(p.full_name order by p.full_name)
                           from public.parent_children pc join public.profiles p on p.id = pc.parent_id
                           where pc.child_id = s.id), '[]'::jsonb)),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'invoice_no', f.invoice_no, 'month', f.month,
               'month_label', to_char(to_date(f.month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'),
               'invoice_total', f.total_due, 'paid_now', fp.amount,
               'balance_after', coalesce(fp.balance_after, f.total_due - f.paid_amount),
               'status', fp.status,
               'lines', coalesce((select jsonb_agg(jsonb_build_object('description', l.description, 'amount', l.amount)
                                                   order by l.created_at)
                                  from public.fee_invoice_lines l where l.fee_id = f.id), '[]'::jsonb))
             order by f.month)
      from public.fee_payments fp join public.student_fees f on f.id = fp.fee_id
      where fp.receipt_id = r.id), '[]'::jsonb),
    'open_months', coalesce((
      select jsonb_agg(jsonb_build_object('month', f.month, 'balance', f.total_due - f.paid_amount) order by f.month)
      from public.student_fees f where f.student_id = s.id and f.status in ('unpaid', 'partial')), '[]'::jsonb))
  from public.fee_receipts r
  join public.profiles s on s.id = r.student_id
  join public.organizations o on o.id = r.org_id
  left join public.student_details d on d.profile_id = s.id
  where r.id = p_receipt;
$$;
revoke all on function public._fee_receipt_json(uuid) from public, anon, authenticated;

create or replace function public.fee_receipt_details(p_receipt uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid;
begin
  select student_id into v_student from public.fee_receipts where id = p_receipt;
  if v_student is null or not (public.can_view_student(v_student) or public.is_finance_viewer()) then
    raise exception 'Receipt not found';
  end if;
  return public._fee_receipt_json(p_receipt);
end;
$$;

-- Secret-link access (SMS / e-mail link, PDF renderer). 128-bit token.
create or replace function public.fee_receipt_by_token(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._fee_receipt_json(id) from public.fee_receipts
  where public_token = p_token and length(p_token) = 32;
$$;
grant execute on function public.fee_receipt_details(uuid) to authenticated;
grant execute on function public.fee_receipt_by_token(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Receipt notifications
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists link text;

create or replace function public.money_text(p numeric)
returns text language sql immutable as $$
  select trim(to_char(coalesce(p, 0), 'FM999,999,999,990.00'));
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
  v_months text;
  v_title text := 'Payment received';
  v_body text;
  v_data jsonb;
  v_meta jsonb;
  par record;
  v_guardian text;
  v_parent_phones int := 0;
begin
  select org_id into v_org_id from public.fee_receipts where id = p_receipt;
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

  -- student
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (v_sid, v_title, v_body, v_data, '/receipt/' || p_receipt, v_org_id);
  perform public.enqueue_user_messages(v_sid, v_title, v_body, v_meta);

  -- every linked parent / guardian account
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

  -- guardian phone on the student record when no parent account can be reached by SMS
  select guardian_phone into v_guardian from public.student_details where profile_id = v_sid;
  if v_parent_phones = 0 and coalesce(v_guardian, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('sms', v_guardian, v_title, v_body, v_meta || jsonb_build_object('recipient', 'guardian_phone'), v_org_id);
  end if;
end;
$$;
revoke all on function public._notify_fee_receipt(uuid) from public, anon, authenticated;

-- Push fan-out now carries the notification's deep-link data.
create or replace function public.tg_notifications_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
  select new.user_id, 'push', d.token, new.title, left(new.message, 900),
         jsonb_build_object('type', 'notification', 'notification_id', new.id, 'data', new.data, 'link', new.link),
         new.org_id
  from public.device_push_tokens d
  join public.profiles p on p.id = d.user_id
  where d.user_id = new.user_id and p.notify_push;
  return null;
end;
$$;

-- Accountant receives a payment: one receipt, arrears first (oldest month first).
create or replace function public.receive_student_payment(
  p_student uuid, p_amount numeric, p_method text default 'cash', p_reference text default null,
  p_notes text default null, p_paid_at timestamptz default now(), p_fee uuid default null,
  p_payer_name text default null, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_org uuid := public.current_org_id();
  v_amount numeric := round(p_amount, 2);
  v_out numeric;
  v_rid uuid;
  v_receipt text;
  v_left numeric;
  v_take numeric;
  f record;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_method = 'payhere' then
    raise exception 'Gateway payments are settled automatically';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and org_id = v_org and account_type = 'student') then
    raise exception 'Student not found';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_idempotency_key is not null then
    -- serialise retries of the same request, then return the first result
    perform pg_advisory_xact_lock(hashtextextended(v_org::text || p_idempotency_key, 0));
    select id into v_existing from public.fee_receipts where org_id = v_org and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return public._fee_receipt_json(v_existing) || jsonb_build_object('duplicate', true);
    end if;
  end if;
  select coalesce(sum(total_due - paid_amount), 0) into v_out
  from public.student_fees
  where student_id = p_student and status in ('unpaid', 'partial') and cancelled_at is null;
  if v_amount > v_out then
    raise exception 'Amount LKR % exceeds the total outstanding LKR %', v_amount, v_out;
  end if;

  v_receipt := public.next_document_number(v_org, 'RCP');
  insert into public.fee_receipts (org_id, receipt_no, student_id, amount, method, reference, notes, payer_name,
                                   paid_at, received_by, idempotency_key)
  values (v_org, v_receipt, p_student, v_amount, coalesce(p_method, 'cash'), p_reference, p_notes, p_payer_name,
          coalesce(p_paid_at, now()), auth.uid(), p_idempotency_key)
  returning id into v_rid;

  v_left := v_amount;
  for f in
    select id, total_due, paid_amount from public.student_fees
    where student_id = p_student and status in ('unpaid', 'partial') and cancelled_at is null
    order by (id = p_fee) desc nulls last, month, due_date
  loop
    exit when v_left <= 0;
    v_take := least(v_left, f.total_due - f.paid_amount);
    if v_take > 0 then
      perform public._post_fee_payment(f.id, v_take, coalesce(p_method, 'cash'), p_reference, p_notes,
                                       p_paid_at, null, false, null, v_rid);
      v_left := v_left - v_take;
    end if;
  end loop;

  perform public._notify_fee_receipt(v_rid);
  return public._fee_receipt_json(v_rid);
end;
$$;
grant execute on function public.receive_student_payment(uuid, numeric, text, text, text, timestamptz, uuid, text, text) to authenticated;

-- Single-invoice payment keeps its signature but now uses receipts + rich notices.
create or replace function public.record_fee_payment(
  p_fee uuid, p_amount numeric, p_method text default 'cash', p_reference text default null,
  p_notes text default null, p_paid_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  p record;
  f record;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_method = 'payhere' then
    raise exception 'Gateway payments are settled automatically';
  end if;
  if not exists (select 1 from public.student_fees where id = p_fee and org_id = public.current_org_id()) then
    raise exception 'Invoice not found';
  end if;
  v_id := public._post_fee_payment(p_fee, p_amount, coalesce(p_method, 'cash'), p_reference, p_notes, p_paid_at);
  select * into p from public.fee_payments where id = v_id;
  select * into f from public.student_fees where id = p_fee;
  perform public._notify_fee_receipt(p.receipt_id);
  return jsonb_build_object('payment_id', v_id, 'receipt_id', p.receipt_id, 'receipt_no', p.receipt_no,
                            'paid_amount', f.paid_amount, 'total_due', f.total_due,
                            'balance', f.total_due - f.paid_amount, 'status', f.status,
                            'public_token', (select public_token from public.fee_receipts where id = p.receipt_id));
end;
$$;

-- Gateway settlement: same receipt + notification path.
create or replace function public.apply_gateway_payment(
  p_order_id text, p_payment_id text, p_amount numeric, p_currency text, p_status_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_pid uuid;
  v_rid uuid;
  v_receipt text;
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into t from public.payment_transactions where gateway_order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if t.status = 'paid' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'receipt_no', t.receipt_no);
  end if;
  if p_status_code is distinct from '2' then
    update public.payment_transactions
    set status = case p_status_code when '0' then 'pending' when '-1' then 'cancelled' else 'failed' end,
        gateway_payment_id = coalesce(p_payment_id, gateway_payment_id),
        metadata = metadata || jsonb_build_object('status_code', p_status_code)
    where id = t.id;
    return jsonb_build_object('ok', true, 'status', p_status_code);
  end if;
  if round(coalesce(p_amount, -1), 2) <> round(t.amount, 2) or upper(coalesce(p_currency, '')) <> upper(t.currency) then
    update public.payment_transactions
    set status = 'failed', gateway_payment_id = p_payment_id,
        metadata = metadata || jsonb_build_object('error', 'amount_mismatch', 'reported_amount', p_amount, 'reported_currency', p_currency)
    where id = t.id;
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;
  if t.fee_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_invoice');
  end if;

  v_pid := public._post_fee_payment(t.fee_id, t.amount, 'payhere', p_payment_id, format('PayHere %s', p_payment_id),
                                    now(), t.id, true);
  select receipt_no, receipt_id into v_receipt, v_rid from public.fee_payments where id = v_pid;
  update public.payment_transactions
  set status = 'paid', gateway_payment_id = p_payment_id, receipt_no = v_receipt
  where id = t.id;
  perform public._notify_fee_receipt(v_rid);
  return jsonb_build_object('ok', true, 'receipt_no', v_receipt, 'payment_id', v_pid, 'receipt_id', v_rid);
end;
$$;
revoke all on function public.apply_gateway_payment(text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.apply_gateway_payment(text, text, numeric, text, text) to service_role;

-- Reverse a whole receipt (all its allocations).
create or replace function public.reverse_fee_receipt(p_receipt uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  if not public.is_accountant() then
    raise exception 'Only accountants/administrators can reverse receipts' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  if not exists (select 1 from public.fee_receipts where id = p_receipt and org_id = public.current_org_id() and status = 'posted') then
    raise exception 'Posted receipt not found';
  end if;
  for p in select id from public.fee_payments where receipt_id = p_receipt and status = 'posted' loop
    perform public.reverse_fee_payment(p.id, p_reason);
  end loop;
end;
$$;
grant execute on function public.reverse_fee_receipt(uuid, text) to authenticated;

-- keep receipt status in sync when its allocations are reversed
create or replace function public.tg_fee_payments_receipt_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'reversed' and new.receipt_id is not null
     and not exists (select 1 from public.fee_payments where receipt_id = new.receipt_id and status = 'posted') then
    update public.fee_receipts set status = 'reversed' where id = new.receipt_id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_fee_payments_receipt_status on public.fee_payments;
create trigger trg_fee_payments_receipt_status after update of status on public.fee_payments
  for each row execute function public.tg_fee_payments_receipt_status();

-- Student arrears summary (portal / app / accountant screen)
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
                         where student_id = p_student and status in ('unpaid', 'partial') and due_date < public.org_today()), 0),
    'months', coalesce((select jsonb_agg(jsonb_build_object(
                          'fee_id', id, 'invoice_no', invoice_no, 'month', month, 'due_date', due_date,
                          'total_due', total_due, 'paid', paid_amount, 'balance', total_due - paid_amount,
                          'overdue', due_date < public.org_today()) order by month)
                        from public.student_fees
                        where student_id = p_student and status in ('unpaid', 'partial')), '[]'::jsonb));
end;
$$;
grant execute on function public.student_arrears(uuid) to authenticated;

select public.attach_audit('fee_receipts');

-- ---------------------------------------------------------------------------
-- 3. Live updates (Supabase Realtime honours RLS)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['notifications', 'student_fees', 'fee_receipts', 'attendance', 'announcements',
                             'leave_requests', 'staff_leave_requests', 'payslips'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Arabic → Tamil dictionary
-- ---------------------------------------------------------------------------
-- Normalisation: strip tashkeel / tatweel / Quranic marks, unify alef/hamza/ya/ta-marbuta.
create or replace function public.arabic_normalize(p text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(
           translate(
             regexp_replace(coalesce(p, ''), '[ؐ-ًؚ-ٰٟۖ-ۭـ]', '', 'g'),
             'أإآٱؤئىة', 'ااااوييه'),
           '[^ء-ي]', '', 'g');
$$;

-- Light stemmer: candidate stems for a surface word (clitics + common affixes),
-- longest first; the lookup tries each against lemmas and roots.
create or replace function public.arabic_candidates(p_word text)
returns text[] language plpgsql immutable as $$
declare
  w text := public.arabic_normalize(p_word);
  out text[] := array[w];
  pre text;
  suf text;
  s text;
  prefixes text[] := array['وبال', 'وكال', 'وفال', 'فبال', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'وب', 'ول', 'فب', 'فل', 'و', 'ف', 'ب', 'ك', 'ل', 'س'];
  suffixes text[] := array['كما', 'هما', 'تما', 'تين', 'تان', 'ات', 'ون', 'ين', 'ان', 'هم', 'هن', 'كم', 'كن', 'نا', 'ها', 'تم', 'وا', 'ية', 'يه', 'ه', 'ك', 'ي', 'ت', 'ا'];
begin
  if length(w) < 2 then
    return out;
  end if;
  foreach pre in array prefixes loop
    if w like pre || '%' and length(w) - length(pre) >= 2 then
      out := out || substr(w, length(pre) + 1);
    end if;
  end loop;
  foreach s in array out loop
    foreach suf in array suffixes loop
      if s like '%' || suf and length(s) - length(suf) >= 2 then
        out := out || left(s, length(s) - length(suf));
      end if;
    end loop;
  end loop;
  -- dedupe, longest first
  select array_agg(x order by length(x) desc, x) into out from (select distinct unnest(out) x) d;
  return out;
end;
$$;

create table if not exists public.dictionary_entries (
  id                bigint generated always as identity primary key,
  arabic            text not null,
  arabic_normalized text not null,
  root              text,
  part_of_speech    text check (part_of_speech in ('noun', 'verb', 'particle', 'adjective', 'phrase', 'name', 'other')),
  tamil             text not null,
  english           text,
  example_ar        text,
  example_ta        text,
  source            text not null default 'curated' check (source in ('curated', 'import', 'ai')),
  source_ref        text,
  verified          boolean not null default false,
  verified_by       uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (arabic_normalized, tamil)
);
create index if not exists idx_dictionary_norm on public.dictionary_entries (arabic_normalized);
create index if not exists idx_dictionary_root on public.dictionary_entries (public.arabic_normalize(root)) where root is not null;

create or replace function public.tg_dictionary_prepare()
returns trigger language plpgsql as $$
begin
  new.arabic_normalized := public.arabic_normalize(new.arabic);
  if new.arabic_normalized = '' then
    raise exception 'Arabic headword is required';
  end if;
  new.updated_at := now();
  if current_user in ('anon', 'authenticated') then
    -- clients may review/verify AI suggestions, but not create them
    if new.source = 'ai' and (tg_op = 'INSERT' or old.source is distinct from 'ai') then
      raise exception 'AI entries are created by the translate service only';
    end if;
    if new.verified and (tg_op = 'INSERT' or not old.verified) then
      new.verified_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dictionary_prepare on public.dictionary_entries;
create trigger trg_dictionary_prepare before insert or update on public.dictionary_entries
  for each row execute function public.tg_dictionary_prepare();

alter table public.dictionary_entries enable row level security;
drop policy if exists "dictionary: public read" on public.dictionary_entries;
create policy "dictionary: public read" on public.dictionary_entries for select using (true);
drop policy if exists "dictionary: library staff write" on public.dictionary_entries;
create policy "dictionary: library staff write" on public.dictionary_entries for all to authenticated
  using (public.is_library_staff()) with check (public.is_library_staff());

-- Lookup order: exact headword → stem candidates → root. Verified/curated first.
create or replace function public.lookup_arabic_word(p_word text, p_limit int default 8)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (
    select x as cand, ord from unnest(public.arabic_candidates(p_word)) with ordinality as t(x, ord)
  ),
  hits as (
    select e.*, 1 as tier, 0::bigint as ord from public.dictionary_entries e
    where e.arabic_normalized = public.arabic_normalize(p_word)
    union all
    select e.*, 2, c.ord from public.dictionary_entries e join c on e.arabic_normalized = c.cand
    union all
    select e.*, 3, c.ord from public.dictionary_entries e join c on public.arabic_normalize(e.root) = c.cand
    where e.root is not null
  ),
  best as (
    select distinct on (id) * from hits order by id, tier, ord
  )
  select jsonb_build_object(
    'word', p_word,
    'normalized', public.arabic_normalize(p_word),
    'candidates', to_jsonb(public.arabic_candidates(p_word)),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'arabic', arabic, 'root', root, 'part_of_speech', part_of_speech,
               'tamil', tamil, 'english', english, 'example_ar', example_ar, 'example_ta', example_ta,
               'source', source, 'verified', verified,
               'match', case tier when 1 then 'exact' when 2 then 'stem' else 'root' end)
             order by tier, (source <> 'ai') desc, verified desc, ord)
      from (select * from best order by tier, (source <> 'ai') desc, verified desc, ord limit greatest(1, least(p_limit, 25))) b),
      '[]'::jsonb));
$$;
grant execute on function public.lookup_arabic_word(text, int) to anon, authenticated, service_role;

-- AI suggestion cache (written by the translate-word edge function, service role).
create or replace function public.save_ai_dictionary_entry(
  p_arabic text, p_root text, p_pos text, p_tamil text, p_english text, p_example_ar text, p_example_ta text, p_model text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.dictionary_entries (arabic, arabic_normalized, root, part_of_speech, tamil, english,
                                         example_ar, example_ta, source, source_ref, verified)
  values (p_arabic, public.arabic_normalize(p_arabic), nullif(p_root, ''),
          case when p_pos in ('noun', 'verb', 'particle', 'adjective', 'phrase', 'name', 'other') then p_pos else 'other' end,
          p_tamil, p_english, p_example_ar, p_example_ta, 'ai', p_model, false)
  on conflict (arabic_normalized, tamil) do update set updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.save_ai_dictionary_entry(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_ai_dictionary_entry(text, text, text, text, text, text, text, text) to service_role;

-- Starter lexicon (curated). Extend via /library-admin → Dictionary or
-- scripts/library/importDictionary.mjs with a licensed Arabic–Tamil word list.
insert into public.dictionary_entries (arabic, arabic_normalized, root, part_of_speech, tamil, english, source, verified)
select v.ar, public.arabic_normalize(v.ar), v.root, v.pos, v.ta, v.en, 'curated', true
from (values
  ('كِتَاب', 'كتب', 'noun', 'நூல்; புத்தகம்', 'book'),
  ('كَتَبَ', 'كتب', 'verb', 'எழுதினான்', 'he wrote'),
  ('عِلْم', 'علم', 'noun', 'அறிவு; கல்வி', 'knowledge'),
  ('عَالِم', 'علم', 'noun', 'அறிஞர்', 'scholar'),
  ('مُعَلِّم', 'علم', 'noun', 'ஆசிரியர்', 'teacher'),
  ('تَعَلَّمَ', 'علم', 'verb', 'கற்றான்', 'he learned'),
  ('طَالِب', 'طلب', 'noun', 'மாணவர்', 'student'),
  ('مَدْرَسَة', 'درس', 'noun', 'பாடசாலை', 'school'),
  ('دَرْس', 'درس', 'noun', 'பாடம்', 'lesson'),
  ('صَلَاة', 'صلو', 'noun', 'தொழுகை', 'prayer'),
  ('صَوْم', 'صوم', 'noun', 'நோன்பு', 'fasting'),
  ('زَكَاة', 'زكو', 'noun', 'ஸகாத் (கட்டாய தர்மம்)', 'obligatory alms'),
  ('حَجّ', 'حجج', 'noun', 'ஹஜ் (புனித யாத்திரை)', 'pilgrimage'),
  ('إِيمَان', 'أمن', 'noun', 'ஈமான்; நம்பிக்கை', 'faith'),
  ('إِسْلَام', 'سلم', 'noun', 'இஸ்லாம்; (இறைவனுக்கு) அடிபணிதல்', 'Islam; submission'),
  ('سَلَام', 'سلم', 'noun', 'சாந்தி; அமைதி', 'peace'),
  ('رَحْمَة', 'رحم', 'noun', 'அருள்; கருணை', 'mercy'),
  ('رَحِيم', 'رحم', 'adjective', 'நிகரற்ற அன்புடையோன்', 'most merciful'),
  ('رَبّ', 'ربب', 'noun', 'இறைவன்; இரட்சகன்', 'Lord'),
  ('اللَّه', 'أله', 'name', 'அல்லாஹ்', 'Allah'),
  ('رَسُول', 'رسل', 'noun', 'தூதர்', 'messenger'),
  ('نَبِيّ', 'نبأ', 'noun', 'நபி; இறைத்தூதர்', 'prophet'),
  ('قُرْآن', 'قرأ', 'noun', 'குர்ஆன்', 'Quran'),
  ('قَرَأَ', 'قرأ', 'verb', 'ஓதினான்; படித்தான்', 'he read / recited'),
  ('آيَة', 'أيي', 'noun', 'வசனம்; அத்தாட்சி', 'verse; sign'),
  ('سُورَة', 'سور', 'noun', 'அத்தியாயம் (சூரா)', 'chapter of the Quran'),
  ('حَدِيث', 'حدث', 'noun', 'ஹதீஸ்; நபிமொழி', 'hadith; prophetic report'),
  ('سُنَّة', 'سنن', 'noun', 'சுன்னா; நபிவழி', 'prophetic tradition'),
  ('فِقْه', 'فقه', 'noun', 'ஃபிக்ஹ்; இஸ்லாமிய சட்டவியல்', 'jurisprudence'),
  ('عَقِيدَة', 'عقد', 'noun', 'அகீதா; கொள்கை', 'creed'),
  ('تَفْسِير', 'فسر', 'noun', 'தஃப்ஸீர்; விரிவுரை', 'exegesis'),
  ('حَلَال', 'حلل', 'adjective', 'ஹலால்; அனுமதிக்கப்பட்டது', 'permissible'),
  ('حَرَام', 'حرم', 'adjective', 'ஹராம்; தடுக்கப்பட்டது', 'forbidden'),
  ('وَاجِب', 'وجب', 'adjective', 'கடமை', 'obligatory'),
  ('مُسْتَحَبّ', 'حبب', 'adjective', 'விரும்பத்தக்கது', 'recommended'),
  ('مَكْرُوه', 'كره', 'adjective', 'வெறுக்கத்தக்கது', 'disliked'),
  ('طَهَارَة', 'طهر', 'noun', 'தூய்மை', 'purity'),
  ('وُضُوء', 'وضأ', 'noun', 'வுளூ (அங்கசுத்தி)', 'ablution'),
  ('مَسْجِد', 'سجد', 'noun', 'பள்ளிவாசல்', 'mosque'),
  ('سَجَدَ', 'سجد', 'verb', 'ஸஜ்தா செய்தான்', 'he prostrated'),
  ('قَلْب', 'قلب', 'noun', 'உள்ளம்; இதயம்', 'heart'),
  ('نَفْس', 'نفس', 'noun', 'ஆன்மா; தன்னுணர்வு', 'soul; self'),
  ('عَمَل', 'عمل', 'noun', 'செயல்', 'deed'),
  ('نِيَّة', 'نوي', 'noun', 'எண்ணம்', 'intention'),
  ('صَبْر', 'صبر', 'noun', 'பொறுமை', 'patience'),
  ('شُكْر', 'شكر', 'noun', 'நன்றி', 'gratitude'),
  ('تَقْوَى', 'وقي', 'noun', 'இறையச்சம்', 'God-consciousness'),
  ('جَنَّة', 'جنن', 'noun', 'சுவர்க்கம்', 'paradise'),
  ('نَار', 'نور', 'noun', 'நெருப்பு; நரகம்', 'fire; hell'),
  ('يَوْم', 'يوم', 'noun', 'நாள்', 'day'),
  ('آخِرَة', 'أخر', 'noun', 'மறுமை', 'hereafter'),
  ('دُنْيَا', 'دنو', 'noun', 'இவ்வுலகம்', 'this world'),
  ('بَيْت', 'بيت', 'noun', 'வீடு', 'house'),
  ('أَب', 'أبو', 'noun', 'தந்தை', 'father'),
  ('أُمّ', 'أمم', 'noun', 'தாய்', 'mother'),
  ('وَلَد', 'ولد', 'noun', 'பிள்ளை; மகன்', 'child; son'),
  ('قَالَ', 'قول', 'verb', 'கூறினான்', 'he said'),
  ('ذَهَبَ', 'ذهب', 'verb', 'சென்றான்', 'he went'),
  ('جَاءَ', 'جيأ', 'verb', 'வந்தான்', 'he came'),
  ('عَلِمَ', 'علم', 'verb', 'அறிந்தான்', 'he knew'),
  ('فِي', null, 'particle', 'இல்; உள்ளே', 'in'),
  ('مِنْ', null, 'particle', 'இருந்து; இலிருந்து', 'from'),
  ('إِلَى', null, 'particle', 'நோக்கி; வரை', 'to; towards'),
  ('عَلَى', null, 'particle', 'மீது; மேல்', 'on; upon'),
  ('عَنْ', null, 'particle', 'பற்றி; இருந்து', 'about; from'),
  ('مَعَ', null, 'particle', 'உடன்', 'with'),
  ('لَا', null, 'particle', 'இல்லை; வேண்டாம்', 'no; not'),
  ('بَابُ', 'بوب', 'noun', 'அத்தியாயம்; வாசல்', 'chapter; door'),
  ('فَصْل', 'فصل', 'noun', 'பிரிவு; பகுதி', 'section')
) as v(ar, root, pos, ta, en)
on conflict (arabic_normalized, tamil) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Performance: hard ceiling well below the 10 s API budget + indexes
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'alter role authenticated set statement_timeout = ''8s''';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter role anon set statement_timeout = ''5s''';
  end if;
end $$;

create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications (user_id) where not is_read;
create index if not exists idx_student_fees_student_month on public.student_fees (student_id, month);
create index if not exists idx_student_fees_open on public.student_fees (student_id) where status in ('unpaid', 'partial');
create index if not exists idx_attendance_date on public.attendance (org_id, date);
create index if not exists idx_leave_requests_student on public.leave_requests (student_id, created_at desc);
create index if not exists idx_leave_requests_pending on public.leave_requests (org_id) where status = 'pending';
create index if not exists idx_parent_children_child on public.parent_children (child_id);
create index if not exists idx_profiles_org_type on public.profiles (org_id, account_type, class_number);
create index if not exists idx_class_subjects_tutor on public.class_subjects (tutor_id, class_number);
create index if not exists idx_class_schedules_tutor on public.class_schedules (tutor_id, class_number);
create index if not exists idx_fee_invoice_lines_org_created on public.fee_invoice_lines (org_id, created_at);
create index if not exists idx_admissions_org_stage on public.admissions (org_id, pipeline_stage);
create index if not exists idx_journal_lines_org on public.journal_lines (org_id, account_id);

-- ---------------------------------------------------------------------------
-- 6. Outbox: safe for several concurrent workers (load-balanced / overlapping
--    cron runs). Rows are claimed with SKIP LOCKED so nothing is sent twice;
--    claims older than 5 minutes (crashed worker) are retried.
-- ---------------------------------------------------------------------------
alter table public.message_outbox drop constraint if exists message_outbox_status_check;
alter table public.message_outbox add constraint message_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));
alter table public.message_outbox
  add column if not exists attempts int not null default 0,
  add column if not exists claimed_at timestamptz;

create or replace function public.claim_outbox_batch(p_limit int default 50)
returns setof public.message_outbox language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  update public.message_outbox m
  set status = 'sending', claimed_at = now(), attempts = m.attempts + 1
  where m.id in (
    select id from public.message_outbox
    where (status = 'pending' or (status = 'sending' and claimed_at < now() - interval '5 minutes'))
      and attempts < 5
    order by created_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked)
  returning m.*;
end;
$$;
revoke all on function public.claim_outbox_batch(int) from public, anon, authenticated;
grant execute on function public.claim_outbox_batch(int) to service_role;
