-- Production logic hardening:
--   * remove zero-value invoices created before fee configuration is complete
--   * keep provider-blocked notifications retryable

set search_path = public, extensions, pg_temp;

alter function public.generate_monthly_invoices(text, uuid, numeric, int)
  rename to _generate_monthly_invoices_legacy;

create or replace function public.generate_monthly_invoices(
  p_month text default to_char(now(), 'YYYY-MM'),
  p_org uuid default null,
  p_default_tuition numeric default null,
  p_limit int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_result jsonb;
  v_removed int := 0;
  v_removed_amount numeric := 0;
  v_fee record;
begin
  -- The legacy function retains all authorization, tenant, batching, and
  -- invoice calculation rules. This wrapper removes only invoices that have
  -- no charge lines, so an incomplete fee setup cannot block future billing.
  v_result := public._generate_monthly_invoices_legacy(
    p_month, p_org, p_default_tuition, p_limit
  );
  v_org := case
    when public.is_privileged_caller() then coalesce(p_org, public.default_org_id())
    else public.current_org_id()
  end;

  for v_fee in
    select f.id, f.total_due
    from public.student_fees f
    where f.org_id = v_org
      and f.month = p_month
      and f.cancelled_at is null
      and f.status = 'unpaid'
      and coalesce(f.total_due, 0) <= 0
      and coalesce(f.paid_amount, 0) = 0
      and not exists (select 1 from public.fee_payments p where p.fee_id = f.id)
  loop
    delete from public.fee_invoice_lines where fee_id = v_fee.id;
    perform set_config('app.fee_internal', 'on', true);
    delete from public.student_fees where id = v_fee.id;
    perform set_config('app.fee_internal', 'off', true);
    v_removed := v_removed + 1;
    v_removed_amount := v_removed_amount + coalesce(v_fee.total_due, 0);
  end loop;

  return v_result
    || jsonb_build_object(
      'generated', greatest(0, coalesce((v_result ->> 'generated')::int, 0) - v_removed),
      'skipped', coalesce((v_result ->> 'skipped')::int, 0) + v_removed,
      'zero_value_removed', v_removed,
      'zero_value_amount_removed', v_removed_amount
    );
end;
$$;

revoke all on function public.generate_monthly_invoices(text, uuid, numeric, int)
  from public, anon, authenticated;
grant execute on function public.generate_monthly_invoices(text, uuid, numeric, int)
  to authenticated, service_role;

alter table public.message_outbox drop constraint if exists message_outbox_status_check;
alter table public.message_outbox add constraint message_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'blocked', 'skipped'));

create or replace function public.claim_outbox_batch(p_limit int default 50)
returns setof public.message_outbox language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  update public.message_outbox m
  set status = 'sending',
      claimed_at = now(),
      attempts = case when m.status = 'blocked' then m.attempts else m.attempts + 1 end
  where m.id in (
    select id from public.message_outbox
    where status = 'pending'
       or status = 'blocked'
       or (status = 'sending' and claimed_at < now() - interval '5 minutes')
      and attempts < 5
    order by created_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked)
  returning m.*;
end;
$$;

revoke all on function public.claim_outbox_batch(int) from public, anon, authenticated;
grant execute on function public.claim_outbox_batch(int) to service_role;
