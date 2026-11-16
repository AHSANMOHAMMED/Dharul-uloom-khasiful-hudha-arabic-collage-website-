-- =============================================================================
-- 0047_fees_logic.sql  (independent of
-- origin/main 0043_fee_adjustments.sql, may run before or after it)
--
-- Student-fee business-logic fixes:
--  1. Concessions can no longer discount more than the invoice's charges
--     (invoice total was clamped to 0 while the ledger credited AR with the
--     full discount, so invoice ≠ lines ≠ ledger).
--  2. Students with no billable charge get no invoice at all (previously an
--     empty "completed" LKR 0 invoice was created, the 0022/0025 clean-up never
--     matched it because its status is 'completed', and it blocked billing the
--     student for that month after the fee setup was fixed). Such students are
--     not counted against p_limit. The wrapper's clean-up now also matches the
--     legacy empty 'completed' invoices so they get removed and re-billed.
--  3. add_fee_charges / direct total_due edits cannot reduce an invoice below
--     what has already been paid or below zero (paid 600 on a 100 invoice
--     showed "completed" and the 500 vanished without an advance posting).
--  4. Journal dates use the institution's local date (Asia/Colombo), not UTC:
--     a receipt taken 00:00–05:30 on the 1st was booked to the previous
--     month (and could hit a closed period). Same for invoice journals and
--     receipt reversals.
--  5. Gateway settlement: a PayHere payment for an invoice that was cancelled
--     or already paid meanwhile raised an exception (webhook 500 forever, money
--     never recorded). It is now allocated to the open invoice, then the
--     student's other open months oldest-first, any remainder held as advance.
--  6. fee_collection_report buckets by local date (UTC before) and overdue uses
--     the local today; student_fee_statement overdue likewise.
--  7. finance_today "collected"/by method/online excluded partially reversed
--     receipts' reversed allocations (it summed the full receipt amount).
-- =============================================================================
set search_path = public, extensions, pg_temp;

create or replace function public._org_local_date(p_org uuid, p_ts timestamptz default now())
returns date language sql stable security definer set search_path = public as $$
  select (coalesce(p_ts, now()) at time zone coalesce(
            (select nullif(timezone, '') from public.organizations where id = p_org), 'Asia/Colombo'))::date;
$$;
revoke all on function public._org_local_date(uuid, timestamptz) from public, anon;
grant execute on function public._org_local_date(uuid, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Local journal dates
-- ---------------------------------------------------------------------------
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

  v_je := public.post_journal(f.org_id, public._org_local_date(f.org_id),
                              format('Invoice %s (%s): %s', f.invoice_no, f.month, new.description),
                              'fee_invoice', new.id, v_lines);
  update public.fee_invoice_lines set journal_entry_id = v_je where id = new.id;
  perform public._fee_recalc(new.fee_id);
  return null;
end;
$$;

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
  v_je := public.post_journal(f.org_id, public._org_local_date(f.org_id), format('Invoice %s (%s)', f.invoice_no, f.month),
                              'fee_invoice', p_fee, v_lines);
  update public.fee_invoice_lines set journal_entry_id = v_je where fee_id = p_fee and journal_entry_id is null;
  return v_je;
end;
$$;
revoke all on function public._post_invoice_lines_journal(uuid) from public, anon, authenticated;

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
  v_je := public.post_journal(f.org_id, public._org_local_date(f.org_id, coalesce(p_paid_at, now())),
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
  v_je := public._reverse_journal(p.journal_entry_id, p_reason, public._org_local_date(p.org_id));
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

-- ---------------------------------------------------------------------------
-- 3. Discounts / total edits cannot push an invoice below what was paid
-- ---------------------------------------------------------------------------
create or replace function public.add_fee_charges(p_student uuid, p_month text, p_lines jsonb, p_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_fee uuid;
  l jsonb;
  v_cat record;
  v_before numeric;
  f record;
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
  select coalesce(sum(amount), 0) into v_before from public.fee_invoice_lines where fee_id = v_fee;
  for l in select * from jsonb_array_elements(p_lines) loop
    select * into v_cat from public.fee_categories where org_id = v_org and code = coalesce(l ->> 'category', 'OTHER');
    insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
    values (v_org, v_fee, v_cat.id, coalesce(l ->> 'kind', 'charge'),
            coalesce(l ->> 'description', v_cat.name, 'Charge'),
            case when coalesce(l ->> 'kind', 'charge') = 'discount'
                 then -abs((l ->> 'amount')::numeric) else abs((l ->> 'amount')::numeric) end);
  end loop;
  perform public._fee_recalc(v_fee);
  select f2.*, (select coalesce(sum(amount), 0) from public.fee_invoice_lines where fee_id = f2.id) as net
    into f from public.student_fees f2 where f2.id = v_fee;
  if f.net < v_before and (f.net < 0 or f.net < f.paid_amount) then
    raise exception 'Discount exceeds the outstanding balance of invoice % (balance LKR %)',
      f.invoice_no, greatest(v_before - f.paid_amount, 0);
  end if;
  return v_fee;
end;
$$;

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
    if new.total_due < 0 or (new.total_due < old.total_due and new.total_due < old.paid_amount) then
      raise exception 'Invoice total cannot be set below the amount already paid (LKR %)', old.paid_amount;
    end if;
    insert into public.fee_invoice_lines (org_id, fee_id, fee_category_id, kind, description, amount)
    values (new.org_id, new.id, v_cat, 'adjustment', 'Manual adjustment', new.total_due - old.total_due);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 + 2. Monthly generation
-- ---------------------------------------------------------------------------
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

    -- Would this student get any charge? (no empty LKR 0 invoices; they do not use the batch)
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

    -- concessions: each is computed on the gross charges it applies to, but the
    -- discounts together never exceed what is left to discount (category / invoice).
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
                            'no_fee', v_no_fee,
                            'remaining', v_remaining, 'total_amount', v_amount_total,
                            'message', format('Generated %s invoice(s) for %s. Skipped %s (already existed). %s student(s) have no billable fee.',
                                              v_generated, p_month, v_skipped, v_no_fee));
end;
$$;
revoke all on function public._generate_monthly_invoices_legacy(text, uuid, numeric, int) from public, anon, authenticated;
grant execute on function public._generate_monthly_invoices_legacy(text, uuid, numeric, int) to service_role;

create or replace function public.generate_monthly_invoices(
  p_month text default to_char(now() at time zone 'Asia/Colombo', 'YYYY-MM'),
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
  -- Remove empty invoices (no lines, nothing paid) left by earlier runs before
  -- the fee setup was complete, so the student can be billed for the month.
  -- They are 'completed' (0 >= 0), which the 0022/0025 clean-up never matched.
  v_org := case when public.is_privileged_caller() then coalesce(p_org, public.default_org_id())
                else public.current_org_id() end;
  if public.is_privileged_caller() or public.is_finance_staff() then
    for v_fee in
      select f.id from public.student_fees f
      where f.org_id = v_org and f.month = p_month and f.cancelled_at is null
        and f.status in ('unpaid', 'completed')
        and coalesce(f.total_due, 0) <= 0 and coalesce(f.paid_amount, 0) = 0
        and not exists (select 1 from public.fee_payments p where p.fee_id = f.id)
        and not exists (select 1 from public.fee_invoice_lines l where l.fee_id = f.id)
    loop
      perform set_config('app.fee_internal', 'on', true);
      delete from public.student_fees where id = v_fee.id;
      perform set_config('app.fee_internal', 'off', true);
      v_removed := v_removed + 1;
    end loop;
  end if;
  v_result := public._generate_monthly_invoices_legacy(p_month, p_org, p_default_tuition, p_limit);
  return v_result || jsonb_build_object('zero_value_removed', v_removed);
end;
$$;
revoke all on function public.generate_monthly_invoices(text, uuid, numeric, int) from public, anon, authenticated;
grant execute on function public.generate_monthly_invoices(text, uuid, numeric, int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Gateway settlement never fails on a changed invoice
-- ---------------------------------------------------------------------------
create or replace function public.apply_gateway_payment(
  p_order_id text, p_payment_id text, p_amount numeric, p_currency text, p_status_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record;
  tf record;
  f record;
  v_pid uuid;
  v_first uuid;
  v_rid uuid;
  v_receipt text;
  v_left numeric;
  v_take numeric;
  v_last uuid;
  v_now timestamptz := now();
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

  select * into tf from public.student_fees where id = t.fee_id for update;
  if tf.cancelled_at is null and tf.total_due - tf.paid_amount >= t.amount then
    -- usual case: the invoice still owes at least this amount
    v_pid := public._post_fee_payment(t.fee_id, t.amount, 'payhere', p_payment_id, format('PayHere %s', p_payment_id),
                                      v_now, t.id, true);
    select receipt_no, receipt_id into v_receipt, v_rid from public.fee_payments where id = v_pid;
  else
    -- invoice cancelled / (partly) paid at the counter meanwhile: one receipt,
    -- this invoice first, then the student's other open months oldest-first,
    -- any remainder held as advance on the last open invoice.
    v_receipt := public.next_document_number(tf.org_id, 'RCP');
    insert into public.fee_receipts (org_id, receipt_no, student_id, amount, currency, method, reference, notes, paid_at)
    values (tf.org_id, v_receipt, tf.student_id, round(t.amount, 2), t.currency, 'payhere', p_payment_id,
            format('PayHere %s', p_payment_id), v_now)
    returning id into v_rid;
    v_left := round(t.amount, 2);
    for f in
      select id, total_due, paid_amount from public.student_fees
      where student_id = tf.student_id and cancelled_at is null and status in ('unpaid', 'partial')
      order by (id = tf.id) desc, month, due_date
    loop
      exit when v_left <= 0;
      v_take := least(v_left, f.total_due - f.paid_amount);
      if v_take > 0 then
        v_pid := public._post_fee_payment(f.id, v_take, 'payhere', p_payment_id, format('PayHere %s', p_payment_id),
                                          v_now, case when v_first is null then t.id end, false, null, v_rid);
        v_first := coalesce(v_first, v_pid);
        v_last := f.id;
        v_left := v_left - v_take;
      end if;
    end loop;
    if v_left > 0 then
      v_last := coalesce(v_last,
        case when tf.cancelled_at is null then tf.id end,
        (select id from public.student_fees where student_id = tf.student_id and cancelled_at is null
         order by month desc limit 1));
      if v_last is null then
        raise exception 'No open invoice to hold PayHere payment % for order %', p_payment_id, p_order_id;
      end if;
      v_pid := public._post_fee_payment(v_last, v_left, 'payhere', p_payment_id, format('PayHere %s (advance)', p_payment_id),
                                        v_now, case when v_first is null then t.id end, true, null, v_rid);
      v_first := coalesce(v_first, v_pid);
    end if;
    v_pid := v_first;
  end if;

  update public.payment_transactions
  set status = 'paid', gateway_payment_id = p_payment_id, receipt_no = v_receipt
  where id = t.id;
  perform public._notify_fee_receipt(v_rid);
  return jsonb_build_object('ok', true, 'receipt_no', v_receipt, 'payment_id', v_pid, 'receipt_id', v_rid);
end;
$$;
revoke all on function public.apply_gateway_payment(text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.apply_gateway_payment(text, text, numeric, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Reports in local time
-- ---------------------------------------------------------------------------
create or replace function public.fee_collection_report(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_tz text := coalesce((select nullif(timezone, '') from public.organizations where id = public.current_org_id()), 'Asia/Colombo');
  v_today date := public._org_local_date(public.current_org_id());
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total_collected', coalesce((select sum(amount) from public.fee_payments
       where org_id = v_org and status = 'posted' and (paid_at at time zone v_tz)::date between p_from and p_to), 0),
    'total_invoiced', coalesce((select sum(l.amount) from public.fee_invoice_lines l
       where l.org_id = v_org and l.amount > 0 and (l.created_at at time zone v_tz)::date between p_from and p_to), 0),
    'by_method', coalesce((select jsonb_object_agg(method, total) from (
       select method, sum(amount) total from public.fee_payments
       where org_id = v_org and status = 'posted' and (paid_at at time zone v_tz)::date between p_from and p_to group by method) m), '{}'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'amount', total) order by d) from (
       select (paid_at at time zone v_tz)::date d, sum(amount) total from public.fee_payments
       where org_id = v_org and status = 'posted' and (paid_at at time zone v_tz)::date between p_from and p_to group by 1) x), '[]'::jsonb),
    'outstanding', coalesce((select sum(total_due - paid_amount) from public.student_fees
       where org_id = v_org and status in ('unpaid', 'partial')), 0),
    'overdue', coalesce((select sum(total_due - paid_amount) from public.student_fees
       where org_id = v_org and status in ('unpaid', 'partial') and due_date < v_today), 0)
  );
end;
$$;

create or replace function public.student_fee_statement(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := public._org_local_date((select org_id from public.profiles where id = p_student));
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
        'overdue', f.status in ('unpaid', 'partial') and f.due_date < v_today,
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

-- ---------------------------------------------------------------------------
-- 7. Today's collection counts only allocations that are still posted
-- ---------------------------------------------------------------------------
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
    'collected', coalesce((select sum(amount) from public.fee_payments
      where org_id = v_org and status = 'posted' and (paid_at at time zone 'Asia/Colombo')::date = v_day), 0),
    'receipts', (select count(distinct coalesce(receipt_id, id)) from public.fee_payments
      where org_id = v_org and status = 'posted' and (paid_at at time zone 'Asia/Colombo')::date = v_day),
    'by_method', coalesce((select jsonb_object_agg(method, total) from (
      select method, sum(amount) total from public.fee_payments
      where org_id = v_org and status = 'posted' and (paid_at at time zone 'Asia/Colombo')::date = v_day group by method) x), '{}'::jsonb),
    'online', coalesce((select sum(amount) from public.fee_payments
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
