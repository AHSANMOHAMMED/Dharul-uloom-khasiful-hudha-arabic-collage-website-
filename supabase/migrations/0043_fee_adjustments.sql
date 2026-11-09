-- Fee credits / write-offs as audited adjustments (do not rewrite issued line history).
set search_path = public, extensions, pg_temp;

create table if not exists public.fee_adjustments (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  fee_id        uuid not null references public.student_fees (id) on delete restrict,
  student_id    uuid not null references public.profiles (id) on delete restrict,
  kind          text not null check (kind in ('credit', 'debit', 'write_off')),
  amount        numeric(12,2) not null check (amount > 0),
  reason        text not null,
  line_id       uuid references public.fee_invoice_lines (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_fee_adjustments_fee on public.fee_adjustments (fee_id, created_at desc);

alter table public.fee_adjustments enable row level security;
drop policy if exists "fee_adjustments: read" on public.fee_adjustments;
create policy "fee_adjustments: read" on public.fee_adjustments for select to authenticated
  using (org_id = (select public.current_org_id()) and (public.is_finance_viewer() or student_id = auth.uid() or public.is_parent_of(student_id)));
drop policy if exists "fee_adjustments: no direct write" on public.fee_adjustments;
create policy "fee_adjustments: no direct write" on public.fee_adjustments for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('fee_adjustments', 'fee_id', 'student_fees');
select public.apply_mfa_policy('fee_adjustments'::regclass);
select public.attach_audit('fee_adjustments');

create or replace function public._assert_books_open_for_fee(p_fee uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_lock date;
  v_due date;
  v_org uuid;
begin
  select org_id, due_date into v_org, v_due from public.student_fees where id = p_fee;
  select books_locked_until into v_lock from public.organizations where id = v_org;
  if v_lock is not null and coalesce(v_due, current_date) <= v_lock then
    raise exception 'Accounting period is closed up to %', v_lock;
  end if;
end;
$$;

create or replace function public.credit_fee_invoice(p_fee uuid, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_amt numeric;
  v_line uuid;
  v_adj uuid;
begin
  if not (public.is_accountant() or public.is_treasurer() or public.has_staff_role(array['principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into f from public.student_fees where id = p_fee and org_id = public.current_org_id() for update;
  if not found or f.cancelled_at is not null then
    raise exception 'Open invoice not found';
  end if;
  perform public._assert_books_open_for_fee(f.id);
  v_amt := least(abs(p_amount), greatest(f.total_due - f.paid_amount, 0));
  if v_amt <= 0 then
    raise exception 'Nothing to credit';
  end if;

  insert into public.fee_invoice_lines (org_id, fee_id, kind, description, amount)
  values (f.org_id, f.id, 'adjustment', format('Credit: %s', p_reason), -v_amt)
  returning id into v_line;

  insert into public.fee_adjustments (org_id, fee_id, student_id, kind, amount, reason, line_id, approved_by)
  values (f.org_id, f.id, f.student_id, 'credit', v_amt, p_reason, v_line, auth.uid())
  returning id into v_adj;

  perform public._fee_recalc(f.id);
  return v_adj;
end;
$$;

create or replace function public.write_off_fee_invoice(p_fee uuid, p_reason text, p_amount numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_amt numeric;
  v_line uuid;
  v_adj uuid;
begin
  if not (public.is_accountant() or public.has_staff_role(array['principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into f from public.student_fees where id = p_fee and org_id = public.current_org_id() for update;
  if not found or f.cancelled_at is not null then
    raise exception 'Open invoice not found';
  end if;
  perform public._assert_books_open_for_fee(f.id);
  v_amt := least(coalesce(p_amount, f.total_due - f.paid_amount), greatest(f.total_due - f.paid_amount, 0));
  if v_amt <= 0 then
    raise exception 'Nothing to write off';
  end if;

  insert into public.fee_invoice_lines (org_id, fee_id, kind, description, amount)
  values (f.org_id, f.id, 'waiver', format('Write-off: %s', p_reason), -v_amt)
  returning id into v_line;

  insert into public.fee_adjustments (org_id, fee_id, student_id, kind, amount, reason, line_id, approved_by)
  values (f.org_id, f.id, f.student_id, 'write_off', v_amt, p_reason, v_line, auth.uid())
  returning id into v_adj;

  perform public._fee_recalc(f.id);
  return v_adj;
end;
$$;

grant execute on function public.credit_fee_invoice(uuid, numeric, text) to authenticated;
grant execute on function public.write_off_fee_invoice(uuid, text, numeric) to authenticated;
revoke all on function public._assert_books_open_for_fee(uuid) from public, anon, authenticated;
