-- Library circulation: loans / returns / overdue.
set search_path = public, extensions, pg_temp;

create table if not exists public.library_loans (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  book_id       uuid not null references public.books (id) on delete restrict,
  borrower_id   uuid not null references public.profiles (id) on delete restrict,
  loaned_at     timestamptz not null default now(),
  due_at        date not null,
  returned_at   timestamptz,
  status        text not null default 'out'
                check (status in ('out', 'returned', 'overdue', 'lost')),
  loaned_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  returned_by   uuid references public.profiles (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_library_loans_org on public.library_loans (org_id, status, due_at);
create index if not exists idx_library_loans_book on public.library_loans (book_id) where status = 'out';
create index if not exists idx_library_loans_borrower on public.library_loans (borrower_id, status);

alter table public.library_loans enable row level security;
drop policy if exists "library_loans: read" on public.library_loans;
create policy "library_loans: read" on public.library_loans for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      borrower_id = auth.uid()
      or public.is_parent_of(borrower_id)
      or public.is_employee()
    )
  );
drop policy if exists "library_loans: no direct write" on public.library_loans;
create policy "library_loans: no direct write" on public.library_loans for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('library_loans');
select public.attach_audit('library_loans');

create or replace function public.checkout_library_book(
  p_book uuid,
  p_borrower uuid,
  p_due date default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_due date := coalesce(p_due, (public.org_today() + 14));
begin
  if not (public.is_employee() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.library_loans where book_id = p_book and status = 'out') then
    raise exception 'Book already on loan';
  end if;
  if not exists (select 1 from public.books where id = p_book and org_id = v_org) then
    raise exception 'Book not found';
  end if;

  insert into public.library_loans (org_id, book_id, borrower_id, due_at, notes)
  values (v_org, p_book, p_borrower, v_due, nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.return_library_book(p_loan uuid, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_employee() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.library_loans set
    status = 'returned',
    returned_at = now(),
    returned_by = auth.uid(),
    notes = case when coalesce(trim(p_notes), '') = '' then notes
                 else coalesce(notes || ' | ', '') || trim(p_notes) end
  where id = p_loan and org_id = public.current_org_id() and status in ('out', 'overdue');
  if not found then raise exception 'Open loan not found'; end if;
end;
$$;

create or replace function public.mark_overdue_library_loans()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.library_loans set status = 'overdue'
  where status = 'out' and due_at < public.org_today();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.checkout_library_book(uuid, uuid, date, text) from public, anon;
revoke all on function public.return_library_book(uuid, text) from public, anon;
revoke all on function public.mark_overdue_library_loans() from public, anon;
grant execute on function public.checkout_library_book(uuid, uuid, date, text) to authenticated;
grant execute on function public.return_library_book(uuid, text) to authenticated;
grant execute on function public.mark_overdue_library_loans() to authenticated;

select public.apply_mfa_policy('library_loans'::regclass);
