-- =============================================================================
-- 0009_payments.sql
-- Online payment transactions (PayHere gateway).
-- =============================================================================

set search_path = public, extensions, pg_temp;

create table if not exists public.payment_transactions (
  id                  uuid primary key default extensions.gen_random_uuid(),
  student_id          uuid not null references public.profiles (id) on delete cascade,
  fee_id              uuid references public.student_fees (id) on delete set null,
  payer_id            uuid references auth.users (id) on delete set null,
  amount              numeric(10,2) not null check (amount > 0),
  currency            text not null default 'LKR',
  gateway             text not null default 'payhere',
  status              text not null default 'pending'
                      check (status in ('pending', 'paid', 'failed', 'cancelled')),
  gateway_order_id    text not null unique,
  gateway_payment_id  text,
  receipt_url         text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_payment_transactions_student
  on public.payment_transactions (student_id, created_at desc);

create index if not exists idx_payment_transactions_status
  on public.payment_transactions (status, created_at desc);

create trigger trg_payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_updated_at();

alter table public.payment_transactions enable row level security;

-- Students and linked parents can view their payment rows
create policy "payments: view own or child"
  on public.payment_transactions for select
  using (
    payer_id = auth.uid()
    or student_id = auth.uid()
    or public.is_parent_of(student_id)
    or public.is_staff()
  );

-- Inserts/updates via Edge Functions (service role) only — no direct client writes