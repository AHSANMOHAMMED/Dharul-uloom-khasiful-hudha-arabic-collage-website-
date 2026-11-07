-- =============================================================================
-- 0017_accounting.sql
-- Double-entry accounting: chart of accounts, journals (immutable once
-- posted, balanced by constraint), period lock, expenses with approval
-- workflow, donations, and financial statements.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  code        text not null,
  name        text not null,
  name_ar     text,
  type        text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype     text check (subtype in ('cash', 'bank', 'receivable', 'payable', 'fixed_asset', 'contra', 'other')),
  parent_id   uuid references public.accounts (id) on delete set null,
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  description text,
  created_at  timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.journal_entries (
  id           uuid primary key default extensions.gen_random_uuid(),
  org_id       uuid not null references public.organizations (id),
  entry_no     text,
  entry_date   date not null default current_date,
  description  text not null,
  source       text not null default 'manual'
               check (source in ('manual', 'fee_invoice', 'fee_payment', 'fee_reversal', 'payroll',
                                 'payroll_payment', 'expense', 'donation', 'opening_balance', 'reversal', 'adjustment')),
  source_id    uuid,
  status       text not null default 'draft' check (status in ('draft', 'posted')),
  reversal_of  uuid references public.journal_entries (id),
  reversed_by  uuid references public.journal_entries (id),
  created_by   uuid references public.profiles (id) on delete set null,
  posted_by    uuid references public.profiles (id) on delete set null,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (org_id, entry_no)
);
create index if not exists idx_journal_entries_org_date on public.journal_entries (org_id, entry_date);
create index if not exists idx_journal_entries_source on public.journal_entries (source, source_id);

create table if not exists public.journal_lines (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  entry_id    uuid not null references public.journal_entries (id) on delete cascade,
  account_id  uuid not null references public.accounts (id),
  debit       numeric(14,2) not null default 0 check (debit >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  memo        text,
  party_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index if not exists idx_journal_lines_entry on public.journal_lines (entry_id);
create index if not exists idx_journal_lines_account on public.journal_lines (account_id);

create table if not exists public.expenses (
  id                    uuid primary key default extensions.gen_random_uuid(),
  org_id                uuid not null references public.organizations (id),
  expense_no            text,
  expense_date          date not null default current_date,
  account_id            uuid not null references public.accounts (id),
  payee                 text not null,
  description           text not null,
  amount                numeric(14,2) not null check (amount > 0),
  currency              text not null default 'LKR',
  payment_method        text not null default 'cash' check (payment_method in ('cash', 'bank_transfer', 'cheque', 'online', 'other')),
  paid_from_account_id  uuid references public.accounts (id),
  reference             text,
  attachment_url        text,
  status                text not null default 'submitted'
                        check (status in ('draft', 'submitted', 'approved', 'rejected', 'paid', 'void')),
  submitted_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by           uuid references public.profiles (id) on delete set null,
  approved_at           timestamptz,
  rejection_reason      text,
  paid_by               uuid references public.profiles (id) on delete set null,
  paid_at               timestamptz,
  journal_entry_id      uuid references public.journal_entries (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (org_id, expense_no)
);

create table if not exists public.donations (
  id                   uuid primary key default extensions.gen_random_uuid(),
  org_id               uuid not null references public.organizations (id),
  receipt_no           text,
  donation_date        date not null default current_date,
  donor_name           text,
  donor_phone          text,
  donor_email          text,
  is_anonymous         boolean not null default false,
  fund_type            text not null default 'general'
                       check (fund_type in ('general', 'zakat', 'sadaqah', 'waqf', 'sponsorship', 'building')),
  amount               numeric(14,2) not null check (amount > 0),
  currency             text not null default 'LKR',
  method               text not null default 'cash' check (method in ('cash', 'bank_transfer', 'cheque', 'online', 'other')),
  deposit_account_id   uuid references public.accounts (id),
  reference            text,
  sponsored_student_id uuid references public.profiles (id) on delete set null,
  notes                text,
  status               text not null default 'recorded' check (status in ('recorded', 'reversed')),
  received_by          uuid references public.profiles (id) on delete set null,
  journal_entry_id     uuid references public.journal_entries (id),
  created_at           timestamptz not null default now(),
  unique (org_id, receipt_no)
);

select public.apply_tenant_scope('accounts');
select public.apply_tenant_scope('journal_entries');
select public.apply_tenant_scope('journal_lines', 'entry_id', 'journal_entries');
select public.apply_tenant_scope('expenses');
select public.apply_tenant_scope('donations');

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------
create or replace function public.is_finance_viewer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_finance_staff() or public.has_staff_role(array['principal', 'vice_principal']);
$$;

-- ---------------------------------------------------------------------------
-- Default chart of accounts
-- ---------------------------------------------------------------------------
create or replace function public.seed_chart_of_accounts(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (org_id, code, name, name_ar, type, subtype, is_system)
  select p_org, v.code, v.name, v.name_ar, v.type, v.subtype, true
  from (values
    ('1000', 'Cash in Hand',                    'النقد في الصندوق',       'asset',     'cash'),
    ('1010', 'Bank - Current Account',          'الحساب البنكي الجاري',   'asset',     'bank'),
    ('1020', 'PayHere Clearing',                'تسوية بي هير',           'asset',     'bank'),
    ('1200', 'Student Fees Receivable',         'رسوم الطلاب المستحقة',   'asset',     'receivable'),
    ('1300', 'Staff Advances',                  'سلف الموظفين',           'asset',     'receivable'),
    ('1500', 'Fixed Assets',                    'الأصول الثابتة',         'asset',     'fixed_asset'),
    ('2000', 'Accounts Payable',                'الحسابات الدائنة',       'liability', 'payable'),
    ('2100', 'Salaries Payable',                'الرواتب المستحقة',       'liability', 'payable'),
    ('2200', 'EPF Payable',                     'صندوق الادخار المستحق',  'liability', 'payable'),
    ('2210', 'ETF Payable',                     'صندوق الثقة المستحق',    'liability', 'payable'),
    ('2300', 'Fees Received in Advance',        'رسوم مقبوضة مقدماً',     'liability', 'other'),
    ('3000', 'Accumulated Fund',                'الصندوق المتراكم',       'equity',    'other'),
    ('4100', 'Tuition Fee Income',              'إيرادات الرسوم الدراسية', 'income',    'other'),
    ('4110', 'Admission & Registration Fees',   'رسوم القبول والتسجيل',   'income',    'other'),
    ('4120', 'Examination Fees',                'رسوم الامتحانات',        'income',    'other'),
    ('4130', 'Hostel Fees',                     'رسوم السكن',             'income',    'other'),
    ('4140', 'Other Fee Income',                'إيرادات رسوم أخرى',      'income',    'other'),
    ('4200', 'General Donations',               'التبرعات العامة',        'income',    'other'),
    ('4210', 'Zakat Income',                    'الزكاة',                 'income',    'other'),
    ('4220', 'Sadaqah Income',                  'الصدقات',                'income',    'other'),
    ('4230', 'Sponsorship Income',              'الكفالات',               'income',    'other'),
    ('4240', 'Waqf Income',                     'الأوقاف',                'income',    'other'),
    ('4250', 'Building Fund Donations',         'تبرعات صندوق البناء',    'income',    'other'),
    ('4900', 'Other Income',                    'إيرادات أخرى',           'income',    'other'),
    ('5100', 'Salaries & Wages',                'الرواتب والأجور',        'expense',   'other'),
    ('5110', 'EPF/ETF Employer Contribution',   'مساهمة صاحب العمل',      'expense',   'other'),
    ('5200', 'Utilities',                       'المرافق',                'expense',   'other'),
    ('5300', 'Repairs & Maintenance',           'الإصلاح والصيانة',       'expense',   'other'),
    ('5400', 'Food & Hostel Expenses',          'مصاريف الطعام والسكن',   'expense',   'other'),
    ('5500', 'Books & Academic Materials',      'الكتب والمواد التعليمية', 'expense',   'other'),
    ('5600', 'Transport',                       'النقل',                  'expense',   'other'),
    ('5700', 'Fee Discounts & Waivers',         'خصومات وإعفاءات الرسوم', 'expense',   'contra'),
    ('5800', 'Bank & Gateway Charges',          'رسوم البنك والدفع',      'expense',   'other'),
    ('5900', 'General & Administrative',        'المصاريف الإدارية العامة', 'expense',  'other')
  ) as v(code, name, name_ar, type, subtype)
  on conflict (org_id, code) do nothing;
end;
$$;
revoke all on function public.seed_chart_of_accounts(uuid) from public, anon, authenticated;

select public.seed_chart_of_accounts(id) from public.organizations;

create or replace function public.tg_organizations_seed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_chart_of_accounts(new.id);
  return new;
end;
$$;
drop trigger if exists trg_organizations_seed on public.organizations;
create trigger trg_organizations_seed after insert on public.organizations
  for each row execute function public.tg_organizations_seed();

create or replace function public.account_id_by_code(p_org uuid, p_code text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v uuid;
begin
  select id into v from public.accounts where org_id = p_org and code = p_code and is_active;
  if v is null then
    raise exception 'Account % not found for organization', p_code;
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------
-- Document numbers are assigned by a SECURITY DEFINER trigger so invoker-rights
-- guard triggers never need access to the (revoked) numbering function.
create or replace function public.tg_assign_doc_no()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v jsonb := to_jsonb(new);
begin
  if v ->> tg_argv[0] is null then
    new := jsonb_populate_record(new, jsonb_build_object(
      tg_argv[0], public.next_document_number((v ->> 'org_id')::uuid, tg_argv[1])));
  end if;
  return new;
end;
$$;
revoke all on function public.tg_assign_doc_no() from public, anon, authenticated;

create or replace function public.tg_journal_lines_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_status text;
  v_entry_org uuid;
  v_acc_org uuid;
begin
  select status, org_id into v_status, v_entry_org
  from public.journal_entries where id = coalesce(new.entry_id, old.entry_id);
  if v_status = 'posted' then
    raise exception 'Journal entry is posted; lines are immutable (use a reversal)' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    select org_id into v_acc_org from public.accounts where id = new.account_id;
    if v_acc_org is distinct from v_entry_org then
      raise exception 'Account belongs to a different organization';
    end if;
    new.org_id := v_entry_org;
    return new;
  end if;
  return old;
end;
$$;
drop trigger if exists trg_journal_lines_guard on public.journal_lines;
create trigger trg_journal_lines_guard before insert or update or delete on public.journal_lines
  for each row execute function public.tg_journal_lines_guard();

create or replace function public.tg_journal_entries_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_dr numeric;
  v_cr numeric;
  v_n  int;
  v_lock date;
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Posted journal entries cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.status = 'posted' then
      raise exception 'Insert as draft, add lines, then post';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'posted' then
    if (new.org_id, new.entry_no, new.entry_date, new.description, new.source, new.source_id, new.status, new.reversal_of)
       is distinct from
       (old.org_id, old.entry_no, old.entry_date, old.description, old.source, old.source_id, old.status, old.reversal_of) then
      raise exception 'Posted journal entries are immutable (use a reversal)' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'posted' then
    select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
      into v_dr, v_cr, v_n
    from public.journal_lines where entry_id = new.id;
    if v_n < 2 or v_dr = 0 or v_dr <> v_cr then
      raise exception 'Journal entry is not balanced (debits % / credits %)', v_dr, v_cr;
    end if;
    select books_locked_until into v_lock from public.organizations where id = new.org_id;
    if v_lock is not null and new.entry_date <= v_lock then
      raise exception 'Accounting period is closed up to %', v_lock;
    end if;
    new.posted_at := now();
    new.posted_by := coalesce(new.posted_by, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists trg_journal_entries_guard on public.journal_entries;
create trigger trg_journal_entries_guard before insert or update or delete on public.journal_entries
  for each row execute function public.tg_journal_entries_guard();
-- "zz" so it fires after the org trigger (BEFORE triggers run in name order)
drop trigger if exists trg_journal_entries_zz_number on public.journal_entries;
create trigger trg_journal_entries_zz_number before insert on public.journal_entries
  for each row execute function public.tg_assign_doc_no('entry_no', 'JV');

-- ---------------------------------------------------------------------------
-- Posting API
-- p_lines: [{"code":"1000"|"account_id":uuid, "debit":n, "credit":n, "memo":"", "party_id":uuid}]
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
  values (p_org, coalesce(p_date, current_date), p_description, p_source, p_source_id, p_reversal_of)
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

-- Reverse a posted entry with an equal-and-opposite posted entry.
create or replace function public._reverse_journal(p_entry uuid, p_reason text, p_date date default current_date)
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

  v_new := public.post_journal(e.org_id, coalesce(p_date, current_date),
                               format('Reversal of %s: %s', e.entry_no, coalesce(p_reason, e.description)),
                               'reversal', e.source_id, v_lines, e.id);
  update public.journal_entries set reversed_by = v_new where id = e.id;
  return v_new;
end;
$$;
revoke all on function public._reverse_journal(uuid, text, date) from public, anon, authenticated;

-- Accountant-facing RPCs
create or replace function public.create_journal_entry(p_date date, p_description text, p_lines jsonb, p_post boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  l jsonb;
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_post then
    return public.post_journal(v_org, p_date, p_description, 'manual', null, p_lines);
  end if;
  insert into public.journal_entries (org_id, entry_date, description, source)
  values (v_org, coalesce(p_date, current_date), p_description, 'manual') returning id into v_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    insert into public.journal_lines (org_id, entry_id, account_id, debit, credit, memo)
    values (v_org, v_id,
            coalesce((l ->> 'account_id')::uuid, public.account_id_by_code(v_org, l ->> 'code')),
            coalesce((l ->> 'debit')::numeric, 0), coalesce((l ->> 'credit')::numeric, 0), l ->> 'memo');
  end loop;
  return v_id;
end;
$$;

create or replace function public.post_journal_entry(p_entry uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.journal_entries set status = 'posted'
  where id = p_entry and org_id = public.current_org_id() and status = 'draft';
  if not found then
    raise exception 'Draft entry not found';
  end if;
end;
$$;

create or replace function public.reverse_journal_entry(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.journal_entries where id = p_entry and org_id = public.current_org_id()) then
    raise exception 'Entry not found';
  end if;
  -- Sub-ledger postings must be reversed from their source document so the
  -- document and the ledger stay consistent.
  if exists (select 1 from public.journal_entries where id = p_entry and source not in ('manual', 'opening_balance')) then
    raise exception 'This entry belongs to a fee/payroll/expense/donation document; reverse it from that document instead';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  return public._reverse_journal(p_entry, p_reason);
end;
$$;

create or replace function public.set_books_lock_date(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.organizations set books_locked_until = p_date where id = public.current_org_id();
end;
$$;

grant execute on function public.create_journal_entry(date, text, jsonb, boolean) to authenticated;
grant execute on function public.post_journal_entry(uuid) to authenticated;
grant execute on function public.reverse_journal_entry(uuid, text) to authenticated;
grant execute on function public.set_books_lock_date(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Expenses workflow
-- ---------------------------------------------------------------------------
create or replace function public.tg_expenses_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_type text;
begin
  select type into v_type from public.accounts where id = new.account_id and org_id = new.org_id;
  if v_type is distinct from 'expense' and v_type is distinct from 'asset' then
    raise exception 'Expense account must be an expense (or asset) account of this organization';
  end if;
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'New expenses must be draft or submitted';
    end if;
    new.submitted_by := auth.uid();
    new.approved_by := null; new.approved_at := null; new.paid_by := null; new.paid_at := null; new.journal_entry_id := null;
  elsif old.status not in ('draft', 'submitted')
        or new.status not in ('draft', 'submitted')
        or (new.approved_by, new.paid_by, new.journal_entry_id, new.submitted_by)
           is distinct from (old.approved_by, old.paid_by, old.journal_entry_id, old.submitted_by) then
    raise exception 'Use approve_expense / pay_expense to change workflow state' using errcode = '42501';
  end if;
  return new;
end;
$$;
-- "v_" so it fires after trg_expenses_org has set org_id
drop trigger if exists trg_expenses_guard on public.expenses;
drop trigger if exists trg_expenses_v_guard on public.expenses;
create trigger trg_expenses_v_guard before insert or update on public.expenses
  for each row execute function public.tg_expenses_guard();
drop trigger if exists trg_expenses_zz_number on public.expenses;
create trigger trg_expenses_zz_number before insert on public.expenses
  for each row execute function public.tg_assign_doc_no('expense_no', 'EXP');

create or replace function public.approve_expense(p_expense uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
begin
  if not public.is_accountant() and not public.has_staff_role(array['principal']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into e from public.expenses where id = p_expense and org_id = public.current_org_id() for update;
  if not found or e.status <> 'submitted' then
    raise exception 'Submitted expense not found';
  end if;
  if e.submitted_by = auth.uid() and not public.is_admin() then
    raise exception 'Segregation of duties: you cannot approve your own expense' using errcode = '42501';
  end if;
  update public.expenses
  set status = case when p_approve then 'approved' else 'rejected' end,
      approved_by = auth.uid(), approved_at = now(),
      rejection_reason = case when p_approve then null else p_reason end
  where id = p_expense;
end;
$$;

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
  v_from := public.account_id_by_code(e.org_id, p_paid_from_code);
  if not exists (select 1 from public.accounts where id = v_from and subtype in ('cash', 'bank')) then
    raise exception 'Pay from a cash or bank account';
  end if;
  v_je := public.post_journal(e.org_id, current_date, format('%s – %s (%s)', e.expense_no, e.description, e.payee),
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

create or replace function public.void_expense(p_expense uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
begin
  if not public.is_accountant() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into e from public.expenses where id = p_expense and org_id = public.current_org_id() for update;
  if not found or e.status = 'void' then
    raise exception 'Expense not found';
  end if;
  if e.journal_entry_id is not null then
    perform public._reverse_journal(e.journal_entry_id, coalesce(p_reason, 'Expense voided'));
  end if;
  update public.expenses set status = 'void', rejection_reason = p_reason where id = p_expense;
end;
$$;

grant execute on function public.approve_expense(uuid, boolean, text) to authenticated;
grant execute on function public.pay_expense(uuid, text, text) to authenticated;
grant execute on function public.void_expense(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Donations
-- ---------------------------------------------------------------------------
create or replace function public.donation_income_code(p_fund text)
returns text language sql immutable as $$
  select case p_fund
    when 'zakat' then '4210' when 'sadaqah' then '4220' when 'sponsorship' then '4230'
    when 'waqf' then '4240' when 'building' then '4250' else '4200' end;
$$;

create or replace function public.method_deposit_code(p_method text)
returns text language sql immutable as $$
  select case p_method when 'cash' then '1000' when 'payhere' then '1020' else '1010' end;
$$;

create or replace function public.record_donation(
  p_amount numeric, p_fund_type text default 'general', p_method text default 'cash',
  p_donor_name text default null, p_donor_phone text default null, p_donor_email text default null,
  p_is_anonymous boolean default false, p_reference text default null, p_notes text default null,
  p_sponsored_student uuid default null, p_date date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_receipt text;
  v_je uuid;
  v_dep uuid;
begin
  if not public.is_finance_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  v_receipt := public.next_document_number(v_org, 'DON');
  v_dep := public.account_id_by_code(v_org, public.method_deposit_code(p_method));

  insert into public.donations (org_id, receipt_no, donation_date, donor_name, donor_phone, donor_email,
                                is_anonymous, fund_type, amount, method, deposit_account_id, reference,
                                sponsored_student_id, notes, received_by)
  values (v_org, v_receipt, coalesce(p_date, current_date), p_donor_name, p_donor_phone, p_donor_email,
          coalesce(p_is_anonymous, false), coalesce(p_fund_type, 'general'), round(p_amount, 2), p_method, v_dep,
          p_reference, p_sponsored_student, p_notes, auth.uid())
  returning id into v_id;

  v_je := public.post_journal(v_org, coalesce(p_date, current_date),
            format('Donation %s (%s) – %s', v_receipt, p_fund_type, coalesce(case when p_is_anonymous then 'Anonymous' end, p_donor_name, 'Donor')),
            'donation', v_id,
            jsonb_build_array(
              jsonb_build_object('account_id', v_dep, 'debit', p_amount),
              jsonb_build_object('code', public.donation_income_code(p_fund_type), 'credit', p_amount)));
  update public.donations set journal_entry_id = v_je where id = v_id;
  return jsonb_build_object('id', v_id, 'receipt_no', v_receipt, 'journal_entry_id', v_je);
end;
$$;

create or replace function public.reverse_donation(p_donation uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record;
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
  perform public._reverse_journal(d.journal_entry_id, coalesce(p_reason, 'Donation reversed'));
  update public.donations set status = 'reversed', notes = concat_ws(E'\n', d.notes, 'Reversed: ' || p_reason) where id = d.id;
end;
$$;

grant execute on function public.record_donation(numeric, text, text, text, text, text, boolean, text, text, uuid, date) to authenticated;
grant execute on function public.reverse_donation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Financial reports
-- ---------------------------------------------------------------------------
create or replace function public.trial_balance(p_from date default null, p_to date default null)
returns table (account_id uuid, code text, name text, type text, debit numeric, credit numeric, balance numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select a.id, a.code, a.name, a.type,
         coalesce(sum(l.debit), 0)::numeric, coalesce(sum(l.credit), 0)::numeric,
         (case when a.type in ('asset', 'expense') then coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)
               else coalesce(sum(l.credit), 0) - coalesce(sum(l.debit), 0) end)::numeric
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
    and exists (select 1 from public.journal_entries e
                where e.id = l.entry_id and e.status = 'posted'
                  and (p_from is null or e.entry_date >= p_from)
                  and (p_to is null or e.entry_date <= p_to))
  where a.org_id = public.current_org_id()
  group by a.id, a.code, a.name, a.type
  order by a.code;
end;
$$;

create or replace function public.income_statement(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_income jsonb;
  v_expense jsonb;
  v_ti numeric;
  v_te numeric;
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'amount', balance) order by code) filter (where balance <> 0), '[]'),
         coalesce(sum(balance), 0)
    into v_income, v_ti
  from public.trial_balance(p_from, p_to) where type = 'income';
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'amount', balance) order by code) filter (where balance <> 0), '[]'),
         coalesce(sum(balance), 0)
    into v_expense, v_te
  from public.trial_balance(p_from, p_to) where type = 'expense';
  return jsonb_build_object('from', p_from, 'to', p_to, 'income', v_income, 'expenses', v_expense,
                            'total_income', v_ti, 'total_expenses', v_te, 'net_surplus', v_ti - v_te);
end;
$$;

create or replace function public.balance_sheet(p_as_of date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_assets jsonb; v_liab jsonb; v_equity jsonb;
  v_ta numeric; v_tl numeric; v_te numeric; v_surplus numeric;
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'amount', balance) order by code) filter (where balance <> 0), '[]'),
         coalesce(sum(balance), 0) into v_assets, v_ta
  from public.trial_balance(null, p_as_of) where type = 'asset';
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'amount', balance) order by code) filter (where balance <> 0), '[]'),
         coalesce(sum(balance), 0) into v_liab, v_tl
  from public.trial_balance(null, p_as_of) where type = 'liability';
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'amount', balance) order by code) filter (where balance <> 0), '[]'),
         coalesce(sum(balance), 0) into v_equity, v_te
  from public.trial_balance(null, p_as_of) where type = 'equity';
  select coalesce(sum(case when type = 'income' then balance else -balance end), 0) into v_surplus
  from public.trial_balance(null, p_as_of) where type in ('income', 'expense');
  return jsonb_build_object('as_of', p_as_of, 'assets', v_assets, 'liabilities', v_liab, 'equity', v_equity,
                            'total_assets', v_ta, 'total_liabilities', v_tl, 'total_equity', v_te,
                            'accumulated_surplus', v_surplus,
                            'balanced', v_ta = v_tl + v_te + v_surplus);
end;
$$;

create or replace function public.account_ledger(p_account uuid, p_from date default null, p_to date default null)
returns table (entry_id uuid, entry_no text, entry_date date, description text, memo text,
               debit numeric, credit numeric, running_balance numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_type text;
  v_opening numeric := 0;
begin
  if not public.is_finance_viewer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select type into v_type from public.accounts where id = p_account and org_id = public.current_org_id();
  if v_type is null then
    raise exception 'Account not found';
  end if;
  -- opening balance = everything posted before p_from
  select coalesce(sum(case when v_type in ('asset', 'expense') then l.debit - l.credit else l.credit - l.debit end), 0)
    into v_opening
  from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id and e.status = 'posted'
  where l.account_id = p_account and p_from is not null and e.entry_date < p_from;

  return query
  select null::uuid, null::text, p_from, 'Opening balance'::text, null::text, 0::numeric, 0::numeric, v_opening
  where p_from is not null
  union all
  select * from (
  select e.id, e.entry_no, e.entry_date, e.description, l.memo, l.debit, l.credit,
         (v_opening + sum(case when v_type in ('asset', 'expense') then l.debit - l.credit else l.credit - l.debit end)
           over (order by e.entry_date, e.created_at, l.id))::numeric
  from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id and e.status = 'posted'
  where l.account_id = p_account
    and (p_from is null or e.entry_date >= p_from)
    and (p_to is null or e.entry_date <= p_to)
  order by e.entry_date, e.created_at, l.id) ledger_rows;
end;
$$;

grant execute on function public.trial_balance(date, date) to authenticated;
grant execute on function public.income_statement(date, date) to authenticated;
grant execute on function public.balance_sheet(date) to authenticated;
grant execute on function public.account_ledger(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.accounts        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines   enable row level security;
alter table public.expenses        enable row level security;
alter table public.donations       enable row level security;

drop policy if exists "accounts: finance read" on public.accounts;
create policy "accounts: finance read" on public.accounts for select to authenticated
  using (public.is_finance_viewer() or (public.is_employee() and type = 'expense'));
drop policy if exists "accounts: accountant write" on public.accounts;
create policy "accounts: accountant write" on public.accounts for insert to authenticated
  with check (public.is_accountant());
drop policy if exists "accounts: accountant update" on public.accounts;
create policy "accounts: accountant update" on public.accounts for update to authenticated
  using (public.is_accountant() and not is_system) with check (public.is_accountant());

drop policy if exists "journal_entries: finance read" on public.journal_entries;
create policy "journal_entries: finance read" on public.journal_entries for select to authenticated
  using (public.is_finance_viewer());
drop policy if exists "journal_lines: finance read" on public.journal_lines;
create policy "journal_lines: finance read" on public.journal_lines for select to authenticated
  using (public.is_finance_viewer());
-- drafts may be edited by accountants (posted rows are protected by triggers)
drop policy if exists "journal_entries: accountant drafts" on public.journal_entries;
create policy "journal_entries: accountant drafts" on public.journal_entries for all to authenticated
  using (public.is_accountant() and status = 'draft') with check (public.is_accountant() and status = 'draft');
drop policy if exists "journal_lines: accountant drafts" on public.journal_lines;
create policy "journal_lines: accountant drafts" on public.journal_lines for all to authenticated
  using (public.is_accountant()) with check (public.is_accountant());

drop policy if exists "expenses: read" on public.expenses;
create policy "expenses: read" on public.expenses for select to authenticated
  using (submitted_by = auth.uid() or public.is_finance_viewer());
drop policy if exists "expenses: employee submit" on public.expenses;
create policy "expenses: employee submit" on public.expenses for insert to authenticated
  with check (public.is_employee());
drop policy if exists "expenses: owner edit pending" on public.expenses;
create policy "expenses: owner edit pending" on public.expenses for update to authenticated
  using ((submitted_by = auth.uid() or public.is_finance_staff()) and status in ('draft', 'submitted'))
  with check (submitted_by = auth.uid() or public.is_finance_staff());

drop policy if exists "donations: finance read" on public.donations;
create policy "donations: finance read" on public.donations for select to authenticated
  using (public.is_finance_viewer());

select public.attach_audit(t) from unnest(array['accounts', 'journal_entries', 'expenses', 'donations']) t;
