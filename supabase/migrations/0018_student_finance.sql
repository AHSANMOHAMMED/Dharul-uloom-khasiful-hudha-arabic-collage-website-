-- =============================================================================
-- 0018_student_finance.sql
-- Student fees: categories, structures, concessions, invoice lines, an
-- immutable payment ledger with receipts, reversals, cancellations/waivers,
-- monthly invoice generation, idempotent gateway settlement — all posted to
-- the general ledger (accrual: invoice → Dr 1200 / Cr income; payment →
-- Dr cash|bank|gateway / Cr 1200).
--
-- student_fees remains the per-student monthly invoice (unique student+month)
-- so existing dashboards keep working; paid_amount/payments/status are now
-- derived from fee_payments and cannot be edited directly.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.fee_categories (
  id                  uuid primary key default extensions.gen_random_uuid(),
  org_id              uuid not null references public.organizations (id),
  code                text not null,
  name                text not null,
  name_ar             text,
  income_account_code text not null default '4100',
  is_recurring        boolean not null default false,
  default_amount      numeric(12,2) not null default 0 check (default_amount >= 0),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.fee_structures (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  class_number     int check (class_number between 1 and 20),
  fee_category_id  uuid not null references public.fee_categories (id) on delete cascade,
  amount           numeric(12,2) not null check (amount >= 0),
  frequency        text not null default 'monthly' check (frequency in ('monthly', 'term', 'annual', 'once')),
  due_day          int not null default 10 check (due_day between 1 and 28),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create unique index if not exists idx_fee_structures_unique on public.fee_structures (
  org_id, fee_category_id, frequency,
  coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(class_number, 0));

create table if not exists public.student_fee_concessions (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  fee_category_id uuid references public.fee_categories (id) on delete cascade,
  kind            text not null check (kind in ('percent', 'fixed')),
  value           numeric(12,2) not null check (value > 0),
  reason          text not null,
  valid_from      date not null default current_date,
  valid_to        date,
  is_active       boolean not null default true,
  approved_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);
create index if not exists idx_concessions_student on public.student_fee_concessions (student_id) where is_active;

-- extend the invoice table
alter table public.student_fees
  add column if not exists invoice_no    text,
  add column if not exists due_date      date,
  add column if not exists currency      text not null default 'LKR',
  add column if not exists notes         text,
  add column if not exists created_by    uuid references public.profiles (id) on delete set null,
  add column if not exists created_at    timestamptz not null default now(),
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancel_reason text;

alter table public.student_fees drop constraint if exists student_fees_status_check;
alter table public.student_fees add constraint student_fees_status_check
  check (status in ('unpaid', 'partial', 'completed', 'cancelled'));
alter table public.student_fees drop constraint if exists student_fees_month_format;
alter table public.student_fees add constraint student_fees_month_format
  check (month ~ '^\d{4}-(0[1-9]|1[0-2])$') not valid;
-- One OPEN invoice per student+month; a cancelled invoice no longer blocks re-billing.
alter table public.student_fees drop constraint if exists student_fees_student_id_month_key;
create unique index if not exists idx_student_fees_open_month
  on public.student_fees (student_id, month) where cancelled_at is null;
create unique index if not exists idx_student_fees_invoice_no on public.student_fees (org_id, invoice_no) where invoice_no is not null;
create index if not exists idx_student_fees_status on public.student_fees (org_id, status, due_date);

create table if not exists public.fee_invoice_lines (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  fee_id           uuid not null references public.student_fees (id) on delete restrict,
  fee_category_id  uuid references public.fee_categories (id) on delete set null,
  kind             text not null default 'charge'
                   check (kind in ('charge', 'fine', 'discount', 'waiver', 'adjustment', 'cancellation')),
  description      text not null,
  amount           numeric(12,2) not null,
  journal_entry_id uuid references public.journal_entries (id),
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  check (
    (kind in ('charge', 'fine') and amount > 0)
    or (kind in ('discount', 'waiver', 'cancellation') and amount < 0)
    or (kind = 'adjustment' and amount <> 0))
);
create index if not exists idx_fee_lines_fee on public.fee_invoice_lines (fee_id);

create table if not exists public.fee_payments (
  id                  uuid primary key default extensions.gen_random_uuid(),
  org_id              uuid not null references public.organizations (id),
  fee_id              uuid not null references public.student_fees (id) on delete restrict,
  student_id          uuid not null references public.profiles (id) on delete restrict,
  amount              numeric(12,2) not null check (amount > 0),
  currency            text not null default 'LKR',
  method              text not null default 'cash'
                      check (method in ('cash', 'bank_transfer', 'cheque', 'payhere', 'online', 'other')),
  reference           text,
  receipt_no          text not null,
  paid_at             timestamptz not null default now(),
  received_by         uuid references public.profiles (id) on delete set null,
  gateway_txn_id      uuid references public.payment_transactions (id),
  deposit_account_id  uuid references public.accounts (id),
  status              text not null default 'posted' check (status in ('posted', 'reversed')),
  reversal_reason     text,
  reversed_by         uuid references public.profiles (id) on delete set null,
  reversed_at         timestamptz,
  journal_entry_id    uuid references public.journal_entries (id),
  reversal_journal_id uuid references public.journal_entries (id),
  notes               text,
  created_at          timestamptz not null default now(),
  unique (org_id, receipt_no)
);
create unique index if not exists idx_fee_payments_gateway on public.fee_payments (gateway_txn_id) where gateway_txn_id is not null;
create index if not exists idx_fee_payments_fee on public.fee_payments (fee_id);
create index if not exists idx_fee_payments_paid_at on public.fee_payments (org_id, paid_at);

select public.apply_tenant_scope('fee_categories');
select public.apply_tenant_scope('fee_structures', 'fee_category_id', 'fee_categories');
select public.apply_tenant_scope('student_fee_concessions', 'student_id');
select public.apply_tenant_scope('fee_invoice_lines', 'fee_id', 'student_fees');
select public.apply_tenant_scope('fee_payments', 'fee_id', 'student_fees');

-- default fee categories for every org
create or replace function public.seed_fee_categories(p_org uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.fee_categories (org_id, code, name, name_ar, income_account_code, is_recurring, default_amount)
  values
    (p_org, 'TUITION',   'Monthly Tuition',          'الرسوم الشهرية',     '4100', true,  2000),
    (p_org, 'ADMISSION', 'Admission / Registration', 'رسوم القبول',        '4110', false, 0),
    (p_org, 'EXAM',      'Examination Fee',          'رسوم الامتحان',      '4120', false, 0),
    (p_org, 'HOSTEL',    'Hostel & Boarding',        'رسوم السكن',         '4130', true,  0),
    (p_org, 'OTHER',     'Other Charges',            'رسوم أخرى',          '4140', false, 0)
  on conflict (org_id, code) do nothing;
$$;
revoke all on function public.seed_fee_categories(uuid) from public, anon, authenticated;
select public.seed_fee_categories(id) from public.organizations;

create or replace function public.tg_organizations_seed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_chart_of_accounts(new.id);
  perform public.seed_fee_categories(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.fee_internal()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.fee_internal', true), 'off') = 'on';
$$;

create or replace function public.try_timestamptz(p text)
returns timestamptz language plpgsql immutable as $$
begin
  return p::timestamptz;
exception when others then
  return null;
end;
$$;

-- Recompute derived invoice fields from lines and posted payments.
create or replace function public._fee_recalc(p_fee uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.fee_internal', 'on', true);
  with l as (
    select greatest(coalesce(sum(amount), 0), 0) as total from public.fee_invoice_lines where fee_id = p_fee
  ), p as (
    select coalesce(sum(amount), 0) as paid,
           coalesce(jsonb_agg(jsonb_build_object(
             'amount', amount, 'date', paid_at, 'method', method, 'receipt_no', receipt_no,
             'reference', reference, 'note', coalesce(notes, method)) order by paid_at), '[]'::jsonb) as list
    from public.fee_payments where fee_id = p_fee and status = 'posted'
  )
  update public.student_fees f set
    total_due   = l.total,
    paid_amount = p.paid,
    payments    = p.list,
    status      = case when f.cancelled_at is not null then 'cancelled'
                       when p.paid >= l.total then 'completed'
                       when p.paid > 0 then 'partial'
                       else 'unpaid' end
  from l, p
  where f.id = p_fee
    and (f.total_due, f.paid_amount, f.payments, f.status) is distinct from
        (l.total, p.paid, p.list, case when f.cancelled_at is not null then 'cancelled'
                                       when p.paid >= l.total then 'completed'
                                       when p.paid > 0 then 'partial' else 'unpaid' end);
  perform set_config('app.fee_internal', 'off', true);
end;
$$;
revoke all on function public._fee_recalc(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Invoice triggers
-- ---------------------------------------------------------------------------
create or replace function public.tg_student_fees_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.org_id is null then
      select org_id into new.org_id from public.profiles where id = new.student_id;
    end if;
    new.invoice_no := coalesce(new.invoice_no, public.next_document_number(new.org_id, 'INV'));
    new.due_date   := coalesce(new.due_date, (new.month || '-10')::date);
    new.created_by := coalesce(new.created_by, auth.uid());
    if not public.fee_internal() then
      new.paid_amount := 0;
      new.payments    := '[]'::jsonb;
      new.status      := 'unpaid';
      new.cancelled_at := null;
    end if;
    return new;
  end if;

  if public.fee_internal() then
    return new;
  end if;
  if (new.paid_amount, new.payments, new.status, new.student_id, new.org_id, new.invoice_no, new.month, new.cancelled_at)
     is distinct from
     (old.paid_amount, old.payments, old.status, old.student_id, old.org_id, old.invoice_no, old.month, old.cancelled_at) then
    raise exception 'Fee payments/status are ledger-controlled: use record_fee_payment, reverse_fee_payment, cancel_fee_invoice or waive_fee_balance'
      using errcode = '42501';
  end if;
  if old.cancelled_at is not null and new.total_due is distinct from old.total_due then
    raise exception 'Cancelled invoices cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_student_fees_before on public.student_fees;
create trigger trg_student_fees_before before insert or update on public.student_fees
  for each row execute function public.tg_student_fees_before();

create or replace function public.tg_student_fees_delete_guard()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.fee_invoice_lines where fee_id = old.id)
     or exists (select 1 from public.fee_payments where fee_id = old.id) then
    raise exception 'Invoices with ledger history cannot be deleted; cancel the invoice instead' using errcode = '42501';
  end if;
  return old;
end;
$$;
drop trigger if exists trg_student_fees_delete_guard on public.student_fees;
create trigger trg_student_fees_delete_guard before delete on public.student_fees
  for each row execute function public.tg_student_fees_delete_guard();

-- Legacy writers (direct total_due) get an equivalent ledger line.
create or replace function public.tg_student_fees_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cat uuid;
begin
  if public.fee_internal() then
    return null;
  end if;
  select id into v_cat from public.fee_categories where org_id = new.org_id and code = 'TUITION';
  if tg_op = 'INSERT' then
    if new.total_due > 0 then
      insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
      values (new.org_id, new.id, v_cat, 'charge', format('Tuition %s', new.month), new.total_due);
    else
      perform public._fee_recalc(new.id);
    end if;
  elsif new.total_due is distinct from old.total_due then
    insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
    values (new.org_id, new.id, v_cat, 'adjustment', 'Manual adjustment', new.total_due - old.total_due);
  end if;
  return null;
end;
$$;
drop trigger if exists trg_student_fees_after on public.student_fees;
create trigger trg_student_fees_after after insert or update on public.student_fees
  for each row execute function public.tg_student_fees_after();

-- ---------------------------------------------------------------------------
-- Invoice line triggers: post to ledger, recalc invoice
-- ---------------------------------------------------------------------------
create or replace function public.tg_fee_lines_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if current_user in ('anon', 'authenticated') then
      raise exception 'Invoice lines are append-only; add an adjustment line instead' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end if;
  select * into f from public.student_fees where id = new.fee_id;
  if f.cancelled_at is not null and new.kind <> 'cancellation' then
    raise exception 'Invoice % is cancelled', f.invoice_no;
  end if;
  if new.kind in ('waiver', 'adjustment', 'cancellation') and current_user in ('anon', 'authenticated') then
    raise exception 'Use waive_fee_balance / cancel_fee_invoice or edit total_due' using errcode = '42501';
  end if;
  if new.fee_category_id is not null
     and not exists (select 1 from public.fee_categories where id = new.fee_category_id and org_id = f.org_id) then
    raise exception 'Fee category belongs to another organization';
  end if;
  new.org_id := f.org_id;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;
drop trigger if exists trg_fee_lines_before on public.fee_invoice_lines;
create trigger trg_fee_lines_before before insert or update or delete on public.fee_invoice_lines
  for each row execute function public.tg_fee_lines_before();

create or replace function public.tg_fee_lines_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_income text;
  v_abs numeric := abs(new.amount);
  v_lines jsonb;
  v_je uuid;
begin
  if coalesce(current_setting('app.fee_bulk', true), 'off') = 'on' then
    return null;  -- generator posts one journal per invoice (_post_invoice_lines_journal)
  end if;
  select * into f from public.student_fees where id = new.fee_id;
  select income_account_code into v_income from public.fee_categories where id = new.fee_category_id;
  v_income := coalesce(v_income, case when new.kind = 'fine' then '4140' else '4100' end);

  if new.amount > 0 then
    v_lines := jsonb_build_array(
      jsonb_build_object('code', '1200', 'debit', v_abs, 'party_id', f.student_id, 'memo', new.description),
      jsonb_build_object('code', v_income, 'credit', v_abs, 'memo', new.description));
  elsif new.kind in ('discount', 'waiver') then
    v_lines := jsonb_build_array(
      jsonb_build_object('code', '5700', 'debit', v_abs, 'memo', new.description),
      jsonb_build_object('code', '1200', 'credit', v_abs, 'party_id', f.student_id, 'memo', new.description));
  else
    v_lines := jsonb_build_array(
      jsonb_build_object('code', v_income, 'debit', v_abs, 'memo', new.description),
      jsonb_build_object('code', '1200', 'credit', v_abs, 'party_id', f.student_id, 'memo', new.description));
  end if;

  v_je := public.post_journal(f.org_id, current_date,
                              format('Invoice %s (%s): %s', f.invoice_no, f.month, new.description),
                              'fee_invoice', new.id, v_lines);
  update public.fee_invoice_lines set journal_entry_id = v_je where id = new.id;
  perform public._fee_recalc(new.fee_id);
  return null;
end;
$$;
drop trigger if exists trg_fee_lines_after on public.fee_invoice_lines;
create trigger trg_fee_lines_after after insert on public.fee_invoice_lines
  for each row execute function public.tg_fee_lines_after();

-- One balanced journal for all not-yet-posted lines of an invoice (bulk generation).
create or replace function public._post_invoice_lines_journal(p_fee uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_lines jsonb := '[]'::jsonb;
  l record;
  v_abs numeric;
  v_je uuid;
begin
  select * into f from public.student_fees where id = p_fee;
  for l in
    select li.*, coalesce(c.income_account_code, case when li.kind = 'fine' then '4140' else '4100' end) as income
    from public.fee_invoice_lines li left join public.fee_categories c on c.id = li.fee_category_id
    where li.fee_id = p_fee and li.journal_entry_id is null
  loop
    v_abs := abs(l.amount);
    if l.amount > 0 then
      v_lines := v_lines
        || jsonb_build_object('code', '1200', 'debit', v_abs, 'party_id', f.student_id, 'memo', l.description)
        || jsonb_build_object('code', l.income, 'credit', v_abs, 'memo', l.description);
    elsif l.kind in ('discount', 'waiver') then
      v_lines := v_lines
        || jsonb_build_object('code', '5700', 'debit', v_abs, 'memo', l.description)
        || jsonb_build_object('code', '1200', 'credit', v_abs, 'party_id', f.student_id, 'memo', l.description);
    else
      v_lines := v_lines
        || jsonb_build_object('code', l.income, 'debit', v_abs, 'memo', l.description)
        || jsonb_build_object('code', '1200', 'credit', v_abs, 'party_id', f.student_id, 'memo', l.description);
    end if;
  end loop;
  if jsonb_array_length(v_lines) = 0 then
    return null;
  end if;
  v_je := public.post_journal(f.org_id, current_date, format('Invoice %s (%s)', f.invoice_no, f.month),
                              'fee_invoice', p_fee, v_lines);
  update public.fee_invoice_lines set journal_entry_id = v_je where fee_id = p_fee and journal_entry_id is null;
  return v_je;
end;
$$;
revoke all on function public._post_invoice_lines_journal(uuid) from public, anon, authenticated;

-- Payment ledger rows are immutable for clients.
create or replace function public.tg_fee_payments_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payments cannot be deleted; reverse them instead' using errcode = '42501';
  end if;
  if current_user in ('anon', 'authenticated') then
    raise exception 'Payments are recorded via record_fee_payment only' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.amount, new.fee_id, new.student_id, new.receipt_no, new.method, new.paid_at, new.org_id)
     is distinct from (old.amount, old.fee_id, old.student_id, old.receipt_no, old.method, old.paid_at, old.org_id) then
    raise exception 'Posted payments are immutable';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_fee_payments_guard on public.fee_payments;
create trigger trg_fee_payments_guard before insert or update or delete on public.fee_payments
  for each row execute function public.tg_fee_payments_guard();

-- ---------------------------------------------------------------------------
-- Payment posting (internal)
-- ---------------------------------------------------------------------------
create or replace function public._post_fee_payment(
  p_fee uuid, p_amount numeric, p_method text, p_reference text, p_notes text,
  p_paid_at timestamptz default now(), p_gateway_txn uuid default null,
  p_allow_overpay boolean default false, p_receipt_no text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_balance numeric;
  v_amount numeric := round(p_amount, 2);
  v_receipt text;
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

  v_receipt := coalesce(nullif(p_receipt_no, ''), public.next_document_number(f.org_id, 'RCP'));
  if exists (select 1 from public.fee_payments where org_id = f.org_id and receipt_no = v_receipt) then
    v_receipt := public.next_document_number(f.org_id, 'RCP');
  end if;
  v_dep := public.account_id_by_code(f.org_id, public.method_deposit_code(p_method));

  insert into public.fee_payments (org_id, fee_id, student_id, amount, currency, method, reference, receipt_no,
                                   paid_at, received_by, gateway_txn_id, deposit_account_id, notes)
  values (f.org_id, f.id, f.student_id, v_amount, f.currency, p_method, p_reference, v_receipt,
          coalesce(p_paid_at, now()), auth.uid(), p_gateway_txn, v_dep, p_notes)
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
  return v_id;
end;
$$;
revoke all on function public._post_fee_payment(uuid, numeric, text, text, text, timestamptz, uuid, boolean, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff RPCs
-- ---------------------------------------------------------------------------
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
  perform public._notify_payment_received(p.student_id, p.amount, p_fee, p.receipt_no);
  return jsonb_build_object('payment_id', v_id, 'receipt_no', p.receipt_no, 'paid_amount', f.paid_amount,
                            'total_due', f.total_due, 'balance', f.total_due - f.paid_amount, 'status', f.status);
end;
$$;

create or replace function public.reverse_fee_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p record;
  v_je uuid;
begin
  if not public.is_accountant() then
    raise exception 'Only accountants/administrators can reverse receipts' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into p from public.fee_payments where id = p_payment and org_id = public.current_org_id() for update;
  if not found or p.status <> 'posted' then
    raise exception 'Posted payment not found';
  end if;
  v_je := public._reverse_journal(p.journal_entry_id, p_reason);
  update public.fee_payments
  set status = 'reversed', reversal_reason = p_reason, reversed_by = auth.uid(), reversed_at = now(),
      reversal_journal_id = v_je
  where id = p.id;
  if p.gateway_txn_id is not null then
    update public.payment_transactions set status = 'cancelled',
      metadata = metadata || jsonb_build_object('reversed', true, 'reason', p_reason)
    where id = p.gateway_txn_id;
  end if;
  perform public._fee_recalc(p.fee_id);
end;
$$;

create or replace function public.cancel_fee_invoice(p_fee uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  f record;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.student_fees where id = p_fee and org_id = public.current_org_id() for update;
  if not found or f.cancelled_at is not null then
    raise exception 'Open invoice not found';
  end if;
  if f.paid_amount > 0 then
    raise exception 'Reverse the payments on this invoice before cancelling it';
  end if;
  if f.total_due > 0 then
    insert into public.fee_invoice_lines (org_id, fee_id, kind, description, amount)
    values (f.org_id, f.id, 'cancellation', format('Cancelled: %s', coalesce(p_reason, '')), -f.total_due);
  end if;
  perform set_config('app.fee_internal', 'on', true);
  update public.student_fees set cancelled_at = now(), cancel_reason = p_reason where id = f.id;
  perform set_config('app.fee_internal', 'off', true);
  perform public._fee_recalc(f.id);
end;
$$;

create or replace function public.waive_fee_balance(p_fee uuid, p_reason text, p_amount numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_amt numeric;
begin
  if not (public.is_accountant() or public.has_staff_role(array['principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.student_fees where id = p_fee and org_id = public.current_org_id() for update;
  if not found or f.cancelled_at is not null then
    raise exception 'Open invoice not found';
  end if;
  v_amt := least(coalesce(p_amount, f.total_due - f.paid_amount), f.total_due - f.paid_amount);
  if v_amt <= 0 then
    raise exception 'Nothing to waive';
  end if;
  insert into public.fee_invoice_lines (org_id, fee_id, kind, description, amount)
  values (f.org_id, f.id, 'waiver', format('Waiver: %s', coalesce(p_reason, '')), -v_amt);
end;
$$;

-- Add charges (admission, exam, fine…) to a student's invoice for a month.
create or replace function public.add_fee_charges(p_student uuid, p_month text, p_lines jsonb, p_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_fee uuid;
  l jsonb;
  v_cat record;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and org_id = v_org and account_type = 'student') then
    raise exception 'Student not found';
  end if;
  select id into v_fee from public.student_fees
  where student_id = p_student and month = p_month and cancelled_at is null;
  if v_fee is null then
    perform set_config('app.fee_internal', 'on', true);
    insert into public.student_fees (org_id, student_id, month, total_due, paid_amount, status, due_date)
    values (v_org, p_student, p_month, 0, 0, 'unpaid', p_due_date)
    returning id into v_fee;
    perform set_config('app.fee_internal', 'off', true);
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    select * into v_cat from public.fee_categories where org_id = v_org and code = coalesce(l ->> 'category', 'OTHER');
    insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
    values (v_org, v_fee, v_cat.id, coalesce(l ->> 'kind', 'charge'),
            coalesce(l ->> 'description', v_cat.name, 'Charge'),
            case when coalesce(l ->> 'kind', 'charge') = 'discount'
                 then -abs((l ->> 'amount')::numeric) else abs((l ->> 'amount')::numeric) end);
  end loop;
  perform public._fee_recalc(v_fee);
  return v_fee;
end;
$$;

-- Extension point for other modules (hostel etc.)
create or replace function public.fee_extra_lines(p_student uuid, p_month text)
returns table (category_code text, description text, amount numeric)
language sql stable security definer set search_path = public as $$
  select null::text, null::text, null::numeric where false;
$$;

-- Generate the month's invoices for every active student of an org.
-- p_limit: process at most N students per call (keeps every request ~1 s on
-- any college size); callers repeat while result.remaining > 0.
create or replace function public.generate_monthly_invoices(
  p_month text default to_char(now(), 'YYYY-MM'),
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
  v_base numeric;
  v_disc numeric;
  v_total numeric;
  v_generated int := 0;
  v_skipped int := 0;
  v_amount_total numeric := 0;
  v_tuition record;
  v_due_day int;
  v_msg text;
  v_arrears numeric;
  v_org_name text;
  v_remaining int := 0;
  par record;
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

  for s in
    select p.id, p.class_number, p.full_name
    from public.profiles p
    left join public.student_details d on d.profile_id = p.id
    where p.org_id = v_org and p.account_type = 'student' and p.is_approved
      and coalesce(d.status, 'active') = 'active'
  loop
    if exists (select 1 from public.student_fees where student_id = s.id and month = p_month and cancelled_at is null) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if p_limit is not null and v_generated >= p_limit then
      v_remaining := v_remaining + 1;
      continue;
    end if;

    select min(fs.due_day) into v_due_day
    from public.fee_structures fs
    where fs.org_id = v_org and fs.is_active and fs.frequency = 'monthly';

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

    -- concessions
    for c in
      select * from public.student_fee_concessions
      where student_id = s.id and is_active
        and valid_from <= ((p_month || '-01')::date + interval '1 month' - interval '1 day')::date
        and (valid_to is null or valid_to >= (p_month || '-01')::date)
    loop
      select coalesce(sum(amount), 0) into v_base
      from public.fee_invoice_lines
      where fee_id = v_fee and kind = 'charge'
        and (c.fee_category_id is null or fee_category_id = c.fee_category_id);
      v_disc := case when c.kind = 'percent' then round(v_base * c.value / 100, 2) else least(c.value, v_base) end;
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
      v_msg := format('%s: Fee invoice for %s – %s: LKR %s.%s Pay in the parent/student portal.',
                      coalesce(v_org_name, 'College'), s.full_name,
                      to_char(to_date(p_month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'),
                      trim(to_char(v_total, 'FM999,999,990.00')),
                      case when v_arrears > 0
                           then format(' Previous arrears LKR %s. Total payable LKR %s.',
                                       trim(to_char(v_arrears, 'FM999,999,990.00')),
                                       trim(to_char(v_arrears + v_total, 'FM999,999,990.00')))
                           else '' end);
      insert into public.notifications (user_id, title, message, org_id) values (s.id, 'Monthly fee invoice', v_msg, v_org);
      perform public.enqueue_user_messages(s.id, 'Monthly fee invoice', v_msg,
        jsonb_build_object('type', 'fee_invoice', 'fee_id', v_fee, 'month', p_month));
      for par in select parent_id from public.parent_children where child_id = s.id loop
        insert into public.notifications (user_id, title, message, org_id)
        values (par.parent_id, 'Monthly fee invoice', v_msg, v_org);
        perform public.enqueue_user_messages(par.parent_id, 'Monthly fee invoice', v_msg,
          jsonb_build_object('type', 'fee_invoice', 'fee_id', v_fee, 'month', p_month, 'student_id', s.id));
      end loop;
    end if;
  end loop;

  return jsonb_build_object('month', p_month, 'generated', v_generated, 'skipped', v_skipped,
                            'remaining', v_remaining, 'total_amount', v_amount_total,
                            'message', format('Generated %s invoice(s) for %s. Skipped %s (already existed).',
                                              v_generated, p_month, v_skipped));
end;
$$;

-- Gateway settlement (PayHere webhook → service role). Idempotent.
create or replace function public.apply_gateway_payment(
  p_order_id text, p_payment_id text, p_amount numeric, p_currency text, p_status_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_pid uuid;
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
  select receipt_no into v_receipt from public.fee_payments where id = v_pid;
  update public.payment_transactions
  set status = 'paid', gateway_payment_id = p_payment_id, receipt_no = v_receipt
  where id = t.id;
  perform public._notify_payment_received(t.student_id, t.amount, t.fee_id, v_receipt);
  return jsonb_build_object('ok', true, 'receipt_no', v_receipt, 'payment_id', v_pid);
end;
$$;
revoke all on function public.apply_gateway_payment(text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.apply_gateway_payment(text, text, numeric, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create or replace function public.student_fee_statement(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_view_student(p_student) then
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
        'overdue', f.status in ('unpaid', 'partial') and f.due_date < current_date,
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

create or replace function public.fee_outstanding(p_class int default null, p_as_of date default current_date)
returns table (student_id uuid, full_name text, index_number text, class_number int,
               open_invoices bigint, total_due numeric, paid numeric, balance numeric,
               oldest_due_date date, days_overdue int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.index_number, p.class_number,
         count(f.id), sum(f.total_due)::numeric, sum(f.paid_amount)::numeric,
         sum(f.total_due - f.paid_amount)::numeric,
         min(f.due_date),
         greatest(p_as_of - min(f.due_date), 0)::int
  from public.student_fees f
  join public.profiles p on p.id = f.student_id
  where f.org_id = public.current_org_id() and f.status in ('unpaid', 'partial')
    and (p_class is null or p.class_number = p_class)
  group by p.id, p.full_name, p.index_number, p.class_number
  order by sum(f.total_due - f.paid_amount) desc;
end;
$$;

create or replace function public.fee_collection_report(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total_collected', coalesce((select sum(amount) from public.fee_payments
       where org_id = v_org and status = 'posted' and paid_at::date between p_from and p_to), 0),
    'total_invoiced', coalesce((select sum(l.amount) from public.fee_invoice_lines l
       where l.org_id = v_org and l.amount > 0 and l.created_at::date between p_from and p_to), 0),
    'by_method', coalesce((select jsonb_object_agg(method, total) from (
       select method, sum(amount) total from public.fee_payments
       where org_id = v_org and status = 'posted' and paid_at::date between p_from and p_to group by method) m), '{}'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'amount', total) order by d) from (
       select paid_at::date d, sum(amount) total from public.fee_payments
       where org_id = v_org and status = 'posted' and paid_at::date between p_from and p_to group by 1) x), '[]'::jsonb),
    'outstanding', coalesce((select sum(total_due - paid_amount) from public.student_fees
       where org_id = v_org and status in ('unpaid', 'partial')), 0),
    'overdue', coalesce((select sum(total_due - paid_amount) from public.student_fees
       where org_id = v_org and status in ('unpaid', 'partial') and due_date < current_date), 0)
  );
end;
$$;

grant execute on function public.record_fee_payment(uuid, numeric, text, text, text, timestamptz) to authenticated;
grant execute on function public.reverse_fee_payment(uuid, text) to authenticated;
grant execute on function public.cancel_fee_invoice(uuid, text) to authenticated;
grant execute on function public.waive_fee_balance(uuid, text, numeric) to authenticated;
grant execute on function public.add_fee_charges(uuid, text, jsonb, date) to authenticated;
grant execute on function public.generate_monthly_invoices(text, uuid, numeric, int) to authenticated, service_role;
grant execute on function public.student_fee_statement(uuid) to authenticated;
grant execute on function public.fee_outstanding(int, date) to authenticated;
grant execute on function public.fee_collection_report(date, date) to authenticated;
revoke all on function public.fee_extra_lines(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.fee_categories          enable row level security;
alter table public.fee_structures          enable row level security;
alter table public.student_fee_concessions enable row level security;
alter table public.fee_invoice_lines       enable row level security;
alter table public.fee_payments            enable row level security;

drop policy if exists "fee_categories: org read" on public.fee_categories;
create policy "fee_categories: org read" on public.fee_categories for select to authenticated using (true);
drop policy if exists "fee_categories: finance write" on public.fee_categories;
create policy "fee_categories: finance write" on public.fee_categories for all to authenticated
  using (public.is_accountant() or public.is_treasurer()) with check (public.is_accountant() or public.is_treasurer());

drop policy if exists "fee_structures: org read" on public.fee_structures;
create policy "fee_structures: org read" on public.fee_structures for select to authenticated using (true);
drop policy if exists "fee_structures: finance write" on public.fee_structures;
create policy "fee_structures: finance write" on public.fee_structures for all to authenticated
  using (public.is_finance_staff()) with check (public.is_finance_staff());

drop policy if exists "concessions: read" on public.student_fee_concessions;
create policy "concessions: read" on public.student_fee_concessions for select to authenticated
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_finance_viewer());
drop policy if exists "concessions: approve" on public.student_fee_concessions;
create policy "concessions: approve" on public.student_fee_concessions for all to authenticated
  using (public.is_accountant() or public.has_staff_role(array['principal']))
  with check (public.is_accountant() or public.has_staff_role(array['principal']));

drop policy if exists "fee_lines: read" on public.fee_invoice_lines;
create policy "fee_lines: read" on public.fee_invoice_lines for select to authenticated
  using (public.is_finance_viewer()
         or exists (select 1 from public.student_fees f
                    where f.id = fee_id and (f.student_id = auth.uid() or public.is_parent_of(f.student_id))));
drop policy if exists "fee_lines: finance add" on public.fee_invoice_lines;
create policy "fee_lines: finance add" on public.fee_invoice_lines for insert to authenticated
  with check (public.is_finance_staff());

drop policy if exists "fee_payments: read" on public.fee_payments;
create policy "fee_payments: read" on public.fee_payments for select to authenticated
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_finance_viewer());

drop policy if exists "fees: treasurer write" on public.student_fees;
drop policy if exists "fees: finance insert" on public.student_fees;
create policy "fees: finance insert" on public.student_fees for insert to authenticated
  with check (public.is_finance_staff());
drop policy if exists "fees: finance update" on public.student_fees;
create policy "fees: finance update" on public.student_fees for update to authenticated
  using (public.is_finance_staff()) with check (public.is_finance_staff());
drop policy if exists "fees: finance view" on public.student_fees;
create policy "fees: finance view" on public.student_fees for select to authenticated
  using (public.is_finance_viewer());
drop policy if exists "fees: admin delete empty" on public.student_fees;
create policy "fees: admin delete empty" on public.student_fees for delete to authenticated
  using (public.is_admin());

drop policy if exists "payments: finance view" on public.payment_transactions;
create policy "payments: finance view" on public.payment_transactions for select to authenticated
  using (public.is_finance_viewer());

select public.attach_audit(t) from unnest(array['fee_payments', 'fee_invoice_lines', 'student_fee_concessions', 'fee_structures']) t;

-- ---------------------------------------------------------------------------
-- Backfill existing invoices into the ledger
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
  p jsonb;
  v_amt numeric;
  v_sum numeric;
  v_cat uuid;
  v_method text;
begin
  for f in select * from public.student_fees order by month loop
    perform set_config('app.fee_internal', 'on', true);
    update public.student_fees
    set invoice_no = coalesce(invoice_no, public.next_document_number(org_id, 'INV')),
        due_date = coalesce(due_date, case when month ~ '^\d{4}-(0[1-9]|1[0-2])$' then (month || '-10')::date end)
    where id = f.id;
    perform set_config('app.fee_internal', 'off', true);

    if exists (select 1 from public.fee_invoice_lines where fee_id = f.id) then
      continue;
    end if;
    select id into v_cat from public.fee_categories where org_id = f.org_id and code = 'TUITION';
    if f.total_due > 0 then
      insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
      values (f.org_id, f.id, v_cat, 'charge', format('Tuition %s (migrated)', f.month), f.total_due);
    end if;

    v_sum := 0;
    for p in select * from jsonb_array_elements(coalesce(f.payments, '[]'::jsonb)) loop
      v_amt := nullif(p ->> 'amount', '')::numeric;
      if v_amt is null or v_amt <= 0 then
        continue;
      end if;
      v_method := case
        when p ->> 'gateway' = 'payhere' or p ->> 'method' = 'payhere' then 'payhere'
        when p ->> 'method' in ('cash', 'bank_transfer', 'cheque', 'online', 'other') then p ->> 'method'
        else 'cash' end;
      perform public._post_fee_payment(f.id, v_amt, v_method, p ->> 'note', 'Migrated from legacy ledger',
                                       coalesce(public.try_timestamptz(p ->> 'date'), f.updated_at), null, true,
                                       p ->> 'receipt_no');
      v_sum := v_sum + v_amt;
    end loop;
    if f.paid_amount > v_sum then
      perform public._post_fee_payment(f.id, f.paid_amount - v_sum, 'cash', null,
                                       'Migrated legacy balance (no payment detail)', f.updated_at, null, true);
    end if;
    perform public._fee_recalc(f.id);
  end loop;
end $$;
