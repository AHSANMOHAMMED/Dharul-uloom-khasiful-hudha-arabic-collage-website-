-- =============================================================================
-- 0049_accounting_logic.sql
-- Accounting & cash logic fixes (idempotent; safe to re-run).
--
--  1. Expenses could be "paid from" 1050 Petty Cash (it is a cash account), which
--     credited the petty-cash GL account without a petty_cash_entries row, so the
--     GL balance of 1050 no longer matched the sum of the petty-cash funds.
--     Petty cash leaves only through petty_cash_spend / petty_cash_return now, and
--     a cash/bank account cannot be the expense account (Dr cash Cr cash).
--  2. A bounced fee cheque whose receipts were reversed could be re-presented and
--     marked cleared: the register said "cleared" while the fees stayed unpaid.
--     Re-presenting is refused in that case; a bounced cheque can be cancelled so
--     the fee can be received again by cheque (the cancelled row no longer blocks
--     the unique cheque number).
--  3. reverse_donation on a donation that a Finance Hub document recorded left the
--     document (and its public page) "paid". Such donations are reversed by voiding
--     the document, which reverses the donation too.
--  4. Server dates used current_date, which is the UTC date on Supabase: between
--     00:00 and 05:30 Sri Lanka time reversals, expense payments, petty-cash top-ups
--     and returns were dated the previous day (and could hit a period lock that had
--     just been set for yesterday). They now use the institution's local date.
--  5. The books could be locked up to a future date by mistake, which silently
--     blocks every receipt, expense and payroll posting from today on.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 4a. Local "today" for column defaults
-- ---------------------------------------------------------------------------
alter table public.journal_entries   alter column entry_date    set default public.org_today();
alter table public.expenses          alter column expense_date  set default public.org_today();
alter table public.donations         alter column donation_date set default public.org_today();
alter table public.petty_cash_entries alter column entry_date   set default public.org_today();
alter table public.cheques           alter column handled_on    set default public.org_today();
do $$
begin
  if to_regclass('public.finance_document_payments') is not null then
    execute 'alter table public.finance_document_payments alter column paid_on set default public.org_today()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4b. Posting helpers: local date when no date is given
-- ---------------------------------------------------------------------------
create or replace function public.post_journal(
  p_org uuid, p_date date, p_description text, p_source text, p_source_id uuid, p_lines jsonb,
  p_reversal_of uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  l jsonb;
begin
  insert into public.journal_entries (org_id, entry_date, description, source, source_id, reversal_of)
  values (p_org, coalesce(p_date, public.org_today()), p_description, p_source, p_source_id, p_reversal_of)
  returning id into v_id;

  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce((l ->> 'debit')::numeric, 0) = 0 and coalesce((l ->> 'credit')::numeric, 0) = 0 then
      continue;
    end if;
    insert into public.journal_lines (org_id, entry_id, account_id, debit, credit, memo, party_id)
    values (
      p_org, v_id,
      coalesce((l ->> 'account_id')::uuid, public.account_id_by_code(p_org, l ->> 'code')),
      round(coalesce((l ->> 'debit')::numeric, 0), 2),
      round(coalesce((l ->> 'credit')::numeric, 0), 2),
      l ->> 'memo',
      nullif(l ->> 'party_id', '')::uuid
    );
  end loop;

  update public.journal_entries set status = 'posted' where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.post_journal(uuid, date, text, text, uuid, jsonb, uuid) from public, anon, authenticated;

-- Reversals are dated today in the institution's time zone (was the UTC date).
create or replace function public._reverse_journal(p_entry uuid, p_reason text, p_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e record;
  v_lines jsonb;
  v_new uuid;
begin
  select * into e from public.journal_entries where id = p_entry for update;
  if not found or e.status <> 'posted' then
    raise exception 'Only posted entries can be reversed';
  end if;
  if e.reversed_by is not null then
    raise exception 'Entry already reversed';
  end if;
  select jsonb_agg(jsonb_build_object('account_id', account_id, 'debit', credit, 'credit', debit,
                                      'memo', memo, 'party_id', party_id))
    into v_lines
  from public.journal_lines where entry_id = p_entry;

  v_new := public.post_journal(e.org_id, coalesce(p_date, public.org_today()),
                               format('Reversal of %s: %s', e.entry_no, coalesce(p_reason, e.description)),
                               'reversal', e.source_id, v_lines, e.id);
  update public.journal_entries set reversed_by = v_new where id = e.id;
  return v_new;
end;
$$;
revoke all on function public._reverse_journal(uuid, text, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Period lock cannot be set in the future
-- ---------------------------------------------------------------------------
create or replace function public.set_books_lock_date(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Locking today closes the day's books; a future date (e.g. a year typo)
  -- would silently block every receipt, expense and payroll posting ahead.
  if p_date is not null and p_date > public.org_today() then
    raise exception 'The books cannot be locked beyond today (%)', public.org_today() using errcode = '22023';
  end if;
  update public.organizations set books_locked_until = p_date where id = public.current_org_id();
end;
$$;
grant execute on function public.set_books_lock_date(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 1 + 4. Expense payment: not from petty cash, not into cash; local date
-- ---------------------------------------------------------------------------
create or replace function public.pay_expense(p_expense uuid, p_paid_from_code text default '1000', p_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e record;
  v_from uuid;
  v_je uuid;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into e from public.expenses where id = p_expense and org_id = public.current_org_id() for update;
  if not found or e.status <> 'approved' then
    raise exception 'Approved expense not found';
  end if;
  if p_paid_from_code = '1050' then
    raise exception 'Petty cash is spent through the petty cash fund (record a petty cash spend); pay this expense from the main cash or bank account'
      using errcode = '22023';
  end if;
  v_from := public.account_id_by_code(e.org_id, p_paid_from_code);
  if not exists (select 1 from public.accounts where id = v_from and subtype in ('cash', 'bank')) then
    raise exception 'Pay from a cash or bank account';
  end if;
  if exists (select 1 from public.accounts where id = e.account_id and subtype in ('cash', 'bank')) then
    raise exception 'The expense account cannot be a cash or bank account; choose the expense (or asset) being bought'
      using errcode = '22023';
  end if;
  v_je := public.post_journal(e.org_id, public.org_today(), format('%s – %s (%s)', e.expense_no, e.description, e.payee),
                              'expense', e.id,
                              jsonb_build_array(
                                jsonb_build_object('account_id', e.account_id, 'debit', e.amount, 'memo', e.payee),
                                jsonb_build_object('account_id', v_from, 'credit', e.amount, 'memo', p_reference)));
  update public.expenses
  set status = 'paid', paid_by = auth.uid(), paid_at = now(), paid_from_account_id = v_from,
      reference = coalesce(p_reference, reference), journal_entry_id = v_je
  where id = p_expense;
  return v_je;
end;
$$;
grant execute on function public.pay_expense(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Petty cash top-up / return dated in local time
-- ---------------------------------------------------------------------------
create or replace function public.petty_cash_topup(p_fund uuid, p_amount numeric, p_from_code text default '1000', p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  h record;
  v_id uuid;
  v_je uuid;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.petty_cash_funds where id = p_fund and org_id = public.current_org_id() and is_active;
  if not found then
    raise exception 'Petty cash fund not found';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_from_code = '1050' or not exists (select 1 from public.accounts where org_id = f.org_id and code = p_from_code and subtype in ('cash', 'bank')) then
    raise exception 'Top up from the main cash or bank account';
  end if;
  if f.float_limit > 0 and (public.petty_cash_balance(p_fund) ->> 'posted_balance')::numeric + p_amount > f.float_limit then
    raise exception 'Top-up exceeds the fund limit of LKR %', f.float_limit;
  end if;
  select * into h from public._fund_holder(p_fund);
  insert into public.petty_cash_entries (org_id, fund_id, duty_assignment_id, holder_id, entry_type, entry_date, amount,
                                         counter_account_code, description, status, approved_by, approved_at)
  values (f.org_id, p_fund, h.assignment_id, h.holder_id, 'topup', public.org_today(), round(p_amount, 2), p_from_code,
          coalesce(p_note, 'Petty cash top-up'), 'posted', auth.uid(), now())
  returning id into v_id;
  v_je := public.post_journal(f.org_id, public.org_today(), format('Petty cash top-up – %s',
            (select name_en from public.duty_roles where id = f.duty_role_id)), 'adjustment', v_id,
            jsonb_build_array(jsonb_build_object('code', '1050', 'debit', p_amount, 'party_id', h.holder_id),
                              jsonb_build_object('code', p_from_code, 'credit', p_amount)));
  update public.petty_cash_entries set journal_entry_id = v_je where id = v_id;
  return v_id;
end;
$$;
grant execute on function public.petty_cash_topup(uuid, numeric, text, text) to authenticated;

create or replace function public.petty_cash_return(p_fund uuid, p_amount numeric, p_to_code text default '1000', p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  h record;
  v_id uuid;
  v_je uuid;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.petty_cash_funds where id = p_fund and org_id = public.current_org_id();
  if not found then
    raise exception 'Petty cash fund not found';
  end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > (public.petty_cash_balance(p_fund) ->> 'available')::numeric then
    raise exception 'Return amount must be positive and not exceed the available balance';
  end if;
  if p_to_code = '1050' or not exists (select 1 from public.accounts where org_id = f.org_id and code = p_to_code and subtype in ('cash', 'bank')) then
    raise exception 'Return to the main cash or bank account';
  end if;
  select * into h from public._fund_holder(p_fund);
  insert into public.petty_cash_entries (org_id, fund_id, duty_assignment_id, holder_id, entry_type, entry_date, amount,
                                         counter_account_code, description, status, approved_by, approved_at)
  values (f.org_id, p_fund, h.assignment_id, h.holder_id, 'return', public.org_today(), round(p_amount, 2), p_to_code,
          coalesce(p_note, 'Unused petty cash returned'), 'posted', auth.uid(), now())
  returning id into v_id;
  v_je := public.post_journal(f.org_id, public.org_today(), 'Petty cash returned', 'adjustment', v_id,
            jsonb_build_array(jsonb_build_object('code', p_to_code, 'debit', p_amount),
                              jsonb_build_object('code', '1050', 'credit', p_amount, 'party_id', h.holder_id)));
  update public.petty_cash_entries set journal_entry_id = v_je where id = v_id;
  return v_id;
end;
$$;
grant execute on function public.petty_cash_return(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Donations recorded by a Finance Hub document are reversed by voiding it
-- ---------------------------------------------------------------------------
create or replace function public.reverse_donation(p_donation uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record;
  v_doc text;
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into d from public.donations where id = p_donation and org_id = public.current_org_id() for update;
  if not found or d.status <> 'recorded' then
    raise exception 'Donation not found';
  end if;
  if to_regclass('public.finance_documents') is not null then
    execute 'select coalesce(doc_number, id::text) from public.finance_documents where donation_id = $1 and status <> ''void'' limit 1'
      into v_doc using d.id;
    if v_doc is not null then
      raise exception 'This donation was recorded by Finance Hub document %; void that document instead (it reverses the donation)', v_doc
        using errcode = '22023';
    end if;
  end if;
  perform public._reverse_journal(d.journal_entry_id, coalesce(p_reason, 'Donation reversed'));
  update public.donations set status = 'reversed', notes = concat_ws(E'\n', d.notes, 'Reversed: ' || p_reason) where id = d.id;
end;
$$;
grant execute on function public.reverse_donation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cheque life cycle: no "cleared" cheque behind reversed fee receipts
-- ---------------------------------------------------------------------------
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
    when 'bounced'   then array['deposited', 'cancelled']   -- re-presented, or written off
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
  if c.status = 'bounced' and p_status = 'deposited' and c.direction = 'received'
     and cardinality(c.fee_payment_ids) > 0
     and exists (select 1 from public.fee_payments where id = any (c.fee_payment_ids) and status = 'reversed') then
    raise exception 'The fee receipts for cheque % were reversed when it bounced. Cancel this entry and record the fee payment again by cheque.',
      c.cheque_no using errcode = '22023';
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
