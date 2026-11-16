-- Finance Hub: real-world document logic on top of 0036.
--
--  * Document numbers come from document_sequences (gap-free per org / type /
--    year, safe under concurrency, never reused after a void or delete).
--  * Bills, sales and manual fee invoices can be paid (in parts); every
--    payment gets its own receipt number and posts Dr cash/bank, Cr income.
--    Payments can be reversed with a reason (journal reversed, balance restored).
--  * Issuing a donation / sadaqah records it in the donations ledger with the
--    real method and reference, or fails; it is no longer silently skipped.
--  * Void refuses while payments stand, and reverses the linked donation.
--  * Amend: never on void documents, cannot cut a total below what is paid,
--    and donation lines are fixed once posted.
--  * Quotations: convert only after issue, once, and with an optional validity date.
--  * Monthly billing job bills the whole college in one run (no 200 cap),
--    refuses to start while another run for the same month is going, and
--    unsupported job kinds are rejected instead of being logged as "done".
--  * Share messages carry an absolute link; receipt documents no longer use
--    the fee-receipt /r/ route.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.finance_documents
  add column if not exists paid_amount numeric(14,2) not null default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists valid_until date,
  add column if not exists donation_id uuid references public.donations(id) on delete set null,
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz;

alter table public.journal_entries drop constraint if exists journal_entries_source_check;
alter table public.journal_entries add constraint journal_entries_source_check
  check (source in ('manual', 'fee_invoice', 'fee_payment', 'fee_reversal', 'payroll', 'payroll_payment',
                    'expense', 'donation', 'opening_balance', 'reversal', 'adjustment', 'finance_document'));

create table if not exists public.finance_document_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  doc_id uuid not null references public.finance_documents(id) on delete cascade,
  receipt_no text not null,
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash','bank_transfer','cheque','online','payhere','other')),
  reference text,
  paid_on date not null default current_date,
  received_by uuid references public.profiles(id),
  status text not null default 'recorded' check (status in ('recorded','reversed')),
  reversal_reason text,
  journal_entry_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_fdoc_payments_doc on public.finance_document_payments (doc_id, created_at);
alter table public.finance_document_payments enable row level security;

drop policy if exists "finance_document_payments: read" on public.finance_document_payments;
create policy "finance_document_payments: read" on public.finance_document_payments for select to authenticated
  using (
    public.is_super_admin()
    or (org_id = public.current_org_id() and (public.is_admin() or public.is_finance_staff()
        or public.has_staff_role(array['principal','vice_principal'])))
  );
-- writes only through the security definer functions below
select public.apply_mfa_policy('public.finance_document_payments'::regclass);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.finance_doc_prefix(p_type text)
returns text language sql immutable as $$
  select case p_type
    when 'quotation' then 'QTN' when 'bill' then 'BIL' when 'sale' then 'SAL'
    when 'fee_invoice' then 'FIN' when 'receipt' then 'FRC'
    when 'donation' then 'DOC' when 'sadaqah' then 'SDQ' else 'DOC' end;
$$;

create or replace function public.finance_line_income_code(p_line_type text)
returns text language sql immutable as $$
  select case p_line_type
    when 'tuition' then '4100' when 'hostel' then '4130' when 'food' then '4140'
    when 'donation' then '4200' when 'sadaqah' then '4220' else '4900' end;
$$;

create or replace function public._finance_doc_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.is_admin() or public.is_finance_staff()
      or public.has_staff_role(array['principal','vice_principal']);
$$;

create or replace function public._finance_doc_load(p_id uuid)
returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
begin
  select * into d from public.finance_documents
  where id = p_id and (org_id = public.current_org_id() or public.is_super_admin())
  for update;
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  return d;
end;
$$;
revoke all on function public._finance_doc_load(uuid) from public, anon, authenticated;

create or replace function public._finance_lines_valid(p_lines jsonb)
returns void language plpgsql immutable as $$
declare
  line jsonb;
begin
  if p_lines is null then return; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Lines must be a list' using errcode = '22023'; end if;
  for line in select * from jsonb_array_elements(p_lines) loop
    if coalesce((line->>'qty')::numeric, 1) <= 0 then
      raise exception 'Quantity must be more than zero' using errcode = '22023';
    end if;
    if coalesce((line->>'unit_amount')::numeric, 0) < 0 then
      raise exception 'Amounts cannot be negative' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create (validation + validity date)
-- ---------------------------------------------------------------------------
drop function if exists public.create_finance_document(text, text, uuid, text, text, text, uuid, jsonb);
create or replace function public.create_finance_document(
  p_doc_type text,
  p_party_type text default 'external',
  p_party_id uuid default null,
  p_party_name text default null,
  p_party_phone text default null,
  p_notes text default null,
  p_letterhead_id uuid default null,
  p_lines jsonb default '[]'::jsonb,
  p_valid_until date default null
) returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  d public.finance_documents;
  line jsonb;
  i int := 0;
  v_sub numeric := 0;
begin
  if not public._finance_doc_can_manage() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_org is null then raise exception 'Organization context required' using errcode = '42501'; end if;
  if nullif(btrim(p_party_name), '') is null then
    raise exception 'Party name is required' using errcode = '22023';
  end if;
  perform public._finance_lines_valid(p_lines);
  if p_party_id is not null and not exists (select 1 from public.profiles where id = p_party_id and org_id = v_org) then
    raise exception 'Party is not in this organization' using errcode = '22023';
  end if;

  insert into public.finance_documents (
    org_id, doc_type, status, party_type, party_id, party_name, party_phone,
    notes, letterhead_id, created_by, valid_until
  ) values (
    v_org, p_doc_type, 'draft', coalesce(p_party_type, 'external'), p_party_id,
    btrim(p_party_name), nullif(btrim(p_party_phone), ''),
    p_notes, p_letterhead_id, auth.uid(),
    case when p_doc_type = 'quotation' then p_valid_until end
  ) returning * into d;

  for line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    if nullif(btrim(line->>'description'), '') is null then continue; end if;
    i := i + 1;
    insert into public.finance_document_lines (doc_id, org_id, line_type, description, qty, unit_amount, sort_order, meta)
    values (d.id, v_org, coalesce(line->>'line_type', 'other'), btrim(line->>'description'),
            coalesce((line->>'qty')::numeric, 1), coalesce((line->>'unit_amount')::numeric, 0), i,
            coalesce(line->'meta', '{}'::jsonb));
    v_sub := v_sub + round(coalesce((line->>'qty')::numeric, 1) * coalesce((line->>'unit_amount')::numeric, 0), 2);
  end loop;

  update public.finance_documents set subtotal = v_sub, total = v_sub, updated_at = now()
  where id = d.id returning * into d;
  return d;
end;
$$;
grant execute on function public.create_finance_document(text, text, uuid, text, text, text, uuid, jsonb, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Issue
-- ---------------------------------------------------------------------------
drop function if exists public.issue_finance_document(uuid);
create or replace function public.issue_finance_document(
  p_id uuid,
  p_method text default 'cash',
  p_reference text default null,
  p_fund_type text default null
) returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  v_don jsonb;
begin
  if not public._finance_doc_can_manage() then raise exception 'forbidden' using errcode = '42501'; end if;
  d := public._finance_doc_load(p_id);
  if d.status <> 'draft' then raise exception 'Only drafts can be issued' using errcode = '22023'; end if;
  if not exists (select 1 from public.finance_document_lines where doc_id = d.id) or d.total <= 0 then
    raise exception 'Add at least one line with an amount before issuing' using errcode = '22023';
  end if;

  if d.doc_type in ('donation', 'sadaqah') then
    -- the money is in hand: record it in the donations ledger (posts the journal)
    v_don := public.record_donation(
      d.total,
      coalesce(nullif(p_fund_type, ''), case when d.doc_type = 'sadaqah' then 'sadaqah' else 'general' end),
      coalesce(nullif(p_method, ''), 'cash'),
      d.party_name, d.party_phone, null, false, nullif(btrim(p_reference), ''), d.notes, null, current_date);
    update public.finance_documents
    set status = 'paid', issued_at = now(), paid_amount = d.total, paid_at = now(),
        donation_id = (v_don ->> 'id')::uuid,
        doc_number = coalesce(doc_number, v_don ->> 'receipt_no'),
        updated_at = now()
    where id = d.id returning * into d;
    return d;
  end if;

  update public.finance_documents
  set status = 'issued', issued_at = now(),
      doc_number = coalesce(doc_number, public.next_document_number(d.org_id, public.finance_doc_prefix(d.doc_type))),
      updated_at = now()
  where id = d.id returning * into d;
  return d;
end;
$$;
grant execute on function public.issue_finance_document(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Payments on bills / sales / manual fee invoices
-- ---------------------------------------------------------------------------
create or replace function public.record_finance_document_payment(
  p_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_reference text default null,
  p_date date default current_date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  v_balance numeric;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_receipt text;
  v_pay uuid;
  v_je uuid;
  v_lines jsonb := '[]'::jsonb;
  v_left numeric;
  v_share numeric;
  r record;
  n int;
  k int := 0;
begin
  if not public.is_finance_staff() and not public.is_super_admin() then
    raise exception 'Only the accounts office can receive payments' using errcode = '42501';
  end if;
  d := public._finance_doc_load(p_id);
  if d.doc_type not in ('bill', 'sale', 'fee_invoice') then
    raise exception 'Payments are taken on bills, sales and fee invoices only' using errcode = '22023';
  end if;
  if d.status not in ('issued', 'amended') then
    raise exception 'Issue the document before taking payment (current status: %)', d.status using errcode = '22023';
  end if;
  v_balance := d.total - d.paid_amount;
  if v_amount <= 0 then raise exception 'Amount must be more than zero' using errcode = '22023'; end if;
  if v_amount > v_balance then
    raise exception 'Amount % is more than the balance due %', v_amount, v_balance using errcode = '22023';
  end if;
  if coalesce(p_method, 'cash') in ('cheque', 'bank_transfer') and nullif(btrim(p_reference), '') is null then
    raise exception 'Cheque / transfer number is required' using errcode = '22023';
  end if;

  v_receipt := public.next_document_number(d.org_id, 'FRC');
  insert into public.finance_document_payments (org_id, doc_id, receipt_no, amount, method, reference, paid_on, received_by)
  values (d.org_id, d.id, v_receipt, v_amount, coalesce(p_method, 'cash'), nullif(btrim(p_reference), ''),
          coalesce(p_date, current_date), auth.uid())
  returning id into v_pay;

  -- Cr income by line type, in proportion to the lines (rounding remainder to the last)
  v_left := v_amount;
  select count(distinct public.finance_line_income_code(line_type)) into n
  from public.finance_document_lines where doc_id = d.id and line_total > 0;
  for r in
    select public.finance_line_income_code(line_type) code, sum(line_total) amt
    from public.finance_document_lines where doc_id = d.id and line_total > 0
    group by 1 order by 2
  loop
    k := k + 1;
    v_share := case when k = n then v_left else round(v_amount * r.amt / d.total, 2) end;
    v_left := v_left - v_share;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('code', r.code, 'credit', v_share, 'memo', d.doc_number));
  end loop;
  v_lines := jsonb_build_array(jsonb_build_object('code', public.method_deposit_code(coalesce(p_method, 'cash')),
                                                  'debit', v_amount, 'memo', v_receipt)) || v_lines;
  v_je := public.post_journal(d.org_id, coalesce(p_date, current_date),
            format('%s %s payment %s – %s', initcap(replace(d.doc_type, '_', ' ')), d.doc_number, v_receipt, d.party_name),
            'finance_document', d.id, v_lines);
  update public.finance_document_payments set journal_entry_id = v_je where id = v_pay;

  update public.finance_documents
  set paid_amount = paid_amount + v_amount,
      status = case when paid_amount + v_amount >= total then 'paid' else status end,
      paid_at = case when paid_amount + v_amount >= total then now() else paid_at end,
      updated_at = now()
  where id = d.id returning * into d;

  return jsonb_build_object('payment_id', v_pay, 'receipt_no', v_receipt, 'amount', v_amount,
                            'balance', d.total - d.paid_amount, 'status', d.status, 'journal_entry_id', v_je);
end;
$$;
grant execute on function public.record_finance_document_payment(uuid, numeric, text, text, date) to authenticated;

create or replace function public.reverse_finance_document_payment(p_payment uuid, p_reason text)
returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  p public.finance_document_payments;
  d public.finance_documents;
begin
  if not public.is_finance_staff() and not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = '22023'; end if;
  select * into p from public.finance_document_payments
  where id = p_payment and (org_id = public.current_org_id() or public.is_super_admin()) for update;
  if not found or p.status <> 'recorded' then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if p.journal_entry_id is not null then
    perform public._reverse_journal(p.journal_entry_id, 'Payment ' || p.receipt_no || ' reversed: ' || btrim(p_reason));
  end if;
  update public.finance_document_payments set status = 'reversed', reversal_reason = btrim(p_reason) where id = p.id;
  update public.finance_documents
  set paid_amount = greatest(paid_amount - p.amount, 0),
      status = case when status = 'paid' then 'issued' else status end,
      paid_at = null, updated_at = now()
  where id = p.doc_id returning * into d;
  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, old_data, new_data)
  values (p.org_id, 'finance_document_payments', p.id::text, 'UPDATE', auth.uid(), 'finance',
          to_jsonb(p), jsonb_build_object('status', 'reversed', 'reason', btrim(p_reason)));
  return d;
end;
$$;
grant execute on function public.reverse_finance_document_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Amend
-- ---------------------------------------------------------------------------
create or replace function public.amend_finance_document(
  p_id uuid,
  p_party_name text default null,
  p_notes text default null,
  p_lines jsonb default null,
  p_reason text default null
) returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  old jsonb;
  line jsonb;
  i int := 0;
  v_sub numeric := 0;
begin
  if not public._finance_doc_can_manage() then raise exception 'forbidden' using errcode = '42501'; end if;
  d := public._finance_doc_load(p_id);
  if d.status = 'void' then raise exception 'A void document cannot be amended' using errcode = '22023'; end if;
  if d.status <> 'draft' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Amendment reason is required' using errcode = '22023';
  end if;
  if p_lines is not null and d.doc_type in ('donation', 'sadaqah') and d.status <> 'draft' then
    raise exception 'A recorded donation cannot change amount; void it and issue a new one' using errcode = '22023';
  end if;
  perform public._finance_lines_valid(p_lines);
  old := to_jsonb(d) || jsonb_build_object('lines', (
    select coalesce(jsonb_agg(to_jsonb(l) order by l.sort_order), '[]'::jsonb) from public.finance_document_lines l where l.doc_id = d.id));

  if p_lines is not null then
    delete from public.finance_document_lines where doc_id = d.id;
    for line in select * from jsonb_array_elements(p_lines) loop
      if nullif(btrim(line->>'description'), '') is null then continue; end if;
      i := i + 1;
      insert into public.finance_document_lines (doc_id, org_id, line_type, description, qty, unit_amount, sort_order, meta)
      values (d.id, d.org_id, coalesce(line->>'line_type', 'other'), btrim(line->>'description'),
              coalesce((line->>'qty')::numeric, 1), coalesce((line->>'unit_amount')::numeric, 0), i,
              coalesce(line->'meta', '{}'::jsonb));
      v_sub := v_sub + round(coalesce((line->>'qty')::numeric, 1) * coalesce((line->>'unit_amount')::numeric, 0), 2);
    end loop;
    if v_sub < d.paid_amount then
      raise exception 'New total % is less than the % already paid; reverse a payment first', v_sub, d.paid_amount using errcode = '22023';
    end if;
    if d.status <> 'draft' and v_sub <= 0 then
      raise exception 'An issued document needs at least one line with an amount' using errcode = '22023';
    end if;
  else
    v_sub := d.total;
  end if;

  update public.finance_documents set
    party_name = coalesce(nullif(btrim(p_party_name), ''), party_name),
    notes = coalesce(p_notes, notes),
    subtotal = v_sub,
    total = v_sub,
    status = case
      when status = 'draft' then 'draft'
      when paid_amount > 0 and paid_amount >= v_sub then 'paid'
      else 'amended' end,
    amend_reason = coalesce(nullif(btrim(p_reason), ''), amend_reason),
    updated_at = now()
  where id = d.id returning * into d;

  if d.status <> 'draft' then
    insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, old_data, new_data)
    values (d.org_id, 'finance_documents', d.id::text, 'UPDATE', auth.uid(),
      case when public.is_super_admin() then 'super_admin' else 'finance' end,
      old, to_jsonb(d) || jsonb_build_object('amend_reason', p_reason));
  end if;
  return d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Void
-- ---------------------------------------------------------------------------
create or replace function public.void_finance_document(p_id uuid, p_reason text)
returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  don record;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Void reason is required' using errcode = '22023'; end if;
  d := public._finance_doc_load(p_id);
  if d.status = 'void' then return d; end if;
  if exists (select 1 from public.finance_document_payments where doc_id = d.id and status = 'recorded') then
    raise exception 'This document has payments. Reverse each payment first, then void.' using errcode = '22023';
  end if;
  if d.donation_id is not null then
    select * into don from public.donations where id = d.donation_id for update;
    if found and don.status = 'recorded' then
      if don.journal_entry_id is not null then
        perform public._reverse_journal(don.journal_entry_id, 'Document ' || d.doc_number || ' voided: ' || btrim(p_reason));
      end if;
      update public.donations set status = 'reversed', notes = concat_ws(E'\n', don.notes, 'Reversed: ' || btrim(p_reason))
      where id = don.id;
    end if;
  end if;
  update public.finance_documents
  set status = 'void', void_reason = btrim(p_reason), amend_reason = btrim(p_reason),
      voided_at = now(), updated_at = now()
  where id = d.id returning * into d;
  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, new_data)
  values (d.org_id, 'finance_documents', d.id::text, 'UPDATE', auth.uid(),
          case when public.is_super_admin() then 'super_admin' else 'finance' end,
          jsonb_build_object('status', 'void', 'reason', btrim(p_reason)));
  return d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotation → bill
-- ---------------------------------------------------------------------------
create or replace function public.convert_quotation_to_bill(p_id uuid)
returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  q public.finance_documents;
  lines jsonb;
  bill public.finance_documents;
  v_existing text;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  q := public._finance_doc_load(p_id);
  if q.doc_type <> 'quotation' then raise exception 'Quotation not found' using errcode = 'P0002'; end if;
  if q.status not in ('issued', 'amended') then
    raise exception 'Issue the quotation before converting it' using errcode = '22023';
  end if;
  select coalesce(doc_number, id::text) into v_existing from public.finance_documents
  where converted_from = q.id and status <> 'void' limit 1;
  if v_existing is not null then
    raise exception 'This quotation was already converted (bill %)', v_existing using errcode = '23505';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'line_type', l.line_type, 'description', l.description, 'qty', l.qty, 'unit_amount', l.unit_amount
  ) order by l.sort_order), '[]'::jsonb)
  into lines from public.finance_document_lines l where l.doc_id = q.id;

  bill := public.create_finance_document(
    'bill', q.party_type, q.party_id, q.party_name, q.party_phone,
    concat_ws(' ', nullif(q.notes, ''), '(from quotation ' || coalesce(q.doc_number, q.id::text) || ')'),
    q.letterhead_id, lines);
  update public.finance_documents set converted_from = q.id where id = bill.id returning * into bill;
  return bill;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public view by token: organisation header, payments and balance
-- ---------------------------------------------------------------------------
create or replace function public.finance_document_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d public.finance_documents;
  o public.organizations;
  lines jsonb;
  pays jsonb;
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  select * into d from public.finance_documents
  where public_token = p_token and status in ('issued','paid','amended','void');
  if not found then return null; end if;
  select * into o from public.organizations where id = d.org_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'line_type', l.line_type, 'description', l.description,
    'qty', l.qty, 'unit_amount', l.unit_amount, 'line_total', l.line_total
  ) order by l.sort_order, l.description), '[]'::jsonb)
  into lines from public.finance_document_lines l where l.doc_id = d.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'receipt_no', p.receipt_no, 'amount', p.amount, 'method', p.method, 'paid_on', p.paid_on
  ) order by p.created_at), '[]'::jsonb)
  into pays from public.finance_document_payments p where p.doc_id = d.id and p.status = 'recorded';
  return jsonb_build_object(
    'id', d.id, 'doc_type', d.doc_type, 'status', d.status, 'doc_number', d.doc_number,
    'party_name', d.party_name, 'currency', d.currency, 'subtotal', d.subtotal,
    'total', d.total, 'paid_amount', d.paid_amount, 'balance', d.total - d.paid_amount,
    'notes', d.notes, 'issued_at', d.issued_at, 'valid_until', d.valid_until,
    'lines', lines, 'payments', pays, 'public_token', d.public_token,
    'organization', jsonb_build_object(
      'name_en', o.name_en, 'name_ar', o.name_ar, 'address', o.address, 'phone', o.contact_phone,
      'email', o.contact_email, 'logo_url', o.branding ->> 'logo_url',
      'registration_no', o.settings ->> 'registration_no')
  );
end;
$$;
grant execute on function public.finance_document_by_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Share: absolute link
-- ---------------------------------------------------------------------------
drop function if exists public.queue_finance_doc_share(uuid, text, text, text);
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

  insert into public.message_outbox (user_id, channel, to_address, body, status, metadata)
  values (auth.uid(), p_channel, v_to, body, 'pending',
          jsonb_build_object('org_id', d.org_id, 'finance_document_id', d.id, 'public_token', d.public_token, 'path', link))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.queue_finance_doc_share(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Billing jobs
-- ---------------------------------------------------------------------------
create or replace function public.create_billing_job(
  p_kind text,
  p_month text default null,
  p_default_tuition numeric default null
) returns public.billing_jobs language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  job public.billing_jobs;
  gen jsonb;
begin
  if not public.is_finance_staff() and not public.is_super_admin() then
    raise exception 'Only the accounts office can run billing' using errcode = '42501';
  end if;
  if v_org is null then raise exception 'Organization context required' using errcode = '42501'; end if;
  if p_kind is distinct from 'monthly_fees' then
    raise exception 'Billing job "%" is not supported; create those documents in Finance Hub', p_kind using errcode = '22023';
  end if;
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Valid month (YYYY-MM) required' using errcode = '22023';
  end if;
  if p_month > to_char((now() at time zone 'Asia/Colombo') + interval '1 month', 'YYYY-MM') then
    raise exception 'Fees can be billed at most one month ahead' using errcode = '22023';
  end if;
  -- one run per org at a time
  perform pg_advisory_xact_lock(hashtextextended('billing_job:' || v_org::text, 0));
  if exists (select 1 from public.billing_jobs where org_id = v_org and kind = 'monthly_fees'
             and period_month = p_month and status = 'running' and started_at > now() - interval '30 minutes') then
    raise exception 'Billing for % is already running', p_month using errcode = '55P03';
  end if;

  insert into public.billing_jobs (org_id, kind, period_month, status, created_by, started_at)
  values (v_org, p_kind, p_month, 'running', auth.uid(), now())
  returning * into job;

  begin
    -- whole college in one run; already-billed students are skipped, so re-running is safe
    gen := public.generate_monthly_invoices(p_month, null, p_default_tuition, null);
    update public.billing_jobs
      set status = 'done', finished_at = now(), summary = coalesce(gen, '{}'::jsonb)
    where id = job.id returning * into job;
  exception when others then
    update public.billing_jobs
      set status = 'failed', finished_at = now(), error = SQLERRM
    where id = job.id returning * into job;
  end;
  return job;
end;
$$;
grant execute on function public.create_billing_job(text, text, numeric) to authenticated;
