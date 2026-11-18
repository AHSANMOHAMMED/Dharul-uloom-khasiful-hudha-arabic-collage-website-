-- Fee bank reconciliation MVP (manual statement lines + match to fee_payments / gateway txns).
set search_path = public, extensions, pg_temp;

create table if not exists public.bank_statement_lines (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  statement_date  date not null,
  amount          numeric(14,2) not null,
  currency        text not null default 'LKR',
  reference       text,
  description     text,
  status          text not null default 'unmatched'
                  check (status in ('unmatched', 'matched', 'ignored')),
  matched_payment uuid references public.fee_payments (id) on delete set null,
  matched_txn     uuid references public.payment_transactions (id) on delete set null,
  matched_at      timestamptz,
  matched_by      uuid references public.profiles (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  check (matched_payment is null or matched_txn is null or true)
);
create index if not exists idx_bank_stmt_org_status on public.bank_statement_lines (org_id, status, statement_date desc);

alter table public.bank_statement_lines enable row level security;
drop policy if exists "bank_stmt: finance read" on public.bank_statement_lines;
create policy "bank_stmt: finance read" on public.bank_statement_lines for select to authenticated
  using (org_id = (select public.current_org_id()) and public.is_finance_staff());
drop policy if exists "bank_stmt: no direct write" on public.bank_statement_lines;
create policy "bank_stmt: no direct write" on public.bank_statement_lines for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('bank_statement_lines');
select public.attach_audit('bank_statement_lines');

create or replace function public.add_bank_statement_line(
  p_date date,
  p_amount numeric,
  p_reference text default null,
  p_description text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_org uuid := public.current_org_id();
begin
  if not public.is_finance_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_date is null or coalesce(p_amount, 0) = 0 then
    raise exception 'Date and non-zero amount required';
  end if;
  insert into public.bank_statement_lines (org_id, statement_date, amount, reference, description)
  values (v_org, p_date, round(p_amount, 2), nullif(trim(coalesce(p_reference, '')), ''),
          nullif(trim(coalesce(p_description, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.match_bank_statement_line(
  p_line uuid,
  p_payment uuid default null,
  p_txn uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l record;
  p record;
  t record;
begin
  if not public.is_finance_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_payment is null and p_txn is null then
    raise exception 'Provide a fee payment or gateway transaction';
  end if;

  select * into l from public.bank_statement_lines
  where id = p_line and org_id = public.current_org_id() for update;
  if not found then raise exception 'Statement line not found'; end if;
  if l.status <> 'unmatched' then raise exception 'Line is not unmatched'; end if;

  if p_payment is not null then
    select * into p from public.fee_payments
    where id = p_payment and org_id = public.current_org_id() and status = 'posted';
    if not found then raise exception 'Fee payment not found'; end if;
    if abs(p.amount - abs(l.amount)) > 0.01 then
      raise exception 'Amount mismatch (payment % vs line %)', p.amount, l.amount;
    end if;
  end if;

  if p_txn is not null then
    select * into t from public.payment_transactions
    where id = p_txn and org_id = public.current_org_id();
    if not found then raise exception 'Gateway transaction not found'; end if;
  end if;

  update public.bank_statement_lines set
    status = 'matched',
    matched_payment = p_payment,
    matched_txn = p_txn,
    matched_at = now(),
    matched_by = auth.uid()
  where id = p_line;

  return jsonb_build_object('id', p_line, 'status', 'matched');
end;
$$;

create or replace function public.ignore_bank_statement_line(p_line uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_finance_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.bank_statement_lines set
    status = 'ignored',
    description = case when coalesce(trim(p_reason), '') = '' then description
                       else coalesce(description || ' | ', '') || 'ignored: ' || trim(p_reason) end,
    matched_at = now(),
    matched_by = auth.uid()
  where id = p_line and org_id = public.current_org_id() and status = 'unmatched';
  if not found then raise exception 'Unmatched line not found'; end if;
end;
$$;

revoke all on function public.add_bank_statement_line(date, numeric, text, text) from public, anon;
revoke all on function public.match_bank_statement_line(uuid, uuid, uuid) from public, anon;
revoke all on function public.ignore_bank_statement_line(uuid, text) from public, anon;
grant execute on function public.add_bank_statement_line(date, numeric, text, text) to authenticated;
grant execute on function public.match_bank_statement_line(uuid, uuid, uuid) to authenticated;
grant execute on function public.ignore_bank_statement_line(uuid, text) to authenticated;

select public.apply_mfa_policy('bank_statement_lines'::regclass);
