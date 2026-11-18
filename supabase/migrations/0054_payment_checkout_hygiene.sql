-- PayHere checkout hygiene on top of 0047_fees_logic:
-- pending index, stale-pending expiry, and overpay/realloc audit metadata.
-- Does not regress 0047's multi-invoice reallocation settlement path.

set search_path = public, extensions, pg_temp;

create index if not exists idx_payment_transactions_fee_pending
  on public.payment_transactions (fee_id, created_at desc)
  where status = 'pending' and fee_id is not null;

-- Cancel pending gateway checkouts older than p_hours (default 6).
-- create-payment also supersedes prior pending rows for the same fee.
create or replace function public.expire_stale_payment_checkouts(p_hours int default 6)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with upd as (
    update public.payment_transactions
    set status = 'cancelled',
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object('expired', true, 'expired_at', now(), 'ttl_hours', greatest(coalesce(p_hours, 6), 1))
    where status = 'pending'
      and created_at < now() - make_interval(hours => greatest(coalesce(p_hours, 6), 1))
    returning 1
  )
  select count(*)::int into v_n from upd;
  return coalesce(v_n, 0);
end;
$$;
revoke all on function public.expire_stale_payment_checkouts(int) from public, anon, authenticated;
grant execute on function public.expire_stale_payment_checkouts(int) to service_role;

-- Settlement = 0047 path + audit stamp when target invoice cannot cover the
-- full amount alone (counter race / cancel → realloc or advance).
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
  v_balance numeric;
  v_realloc boolean := false;
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
  v_balance := round(coalesce(tf.total_due, 0) - coalesce(tf.paid_amount, 0), 2);
  if tf.cancelled_at is null and v_balance >= t.amount then
    v_pid := public._post_fee_payment(t.fee_id, t.amount, 'payhere', p_payment_id, format('PayHere %s', p_payment_id),
                                      v_now, t.id, true);
    select receipt_no, receipt_id into v_receipt, v_rid from public.fee_payments where id = v_pid;
  else
    v_realloc := true;
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
  set status = 'paid',
      gateway_payment_id = p_payment_id,
      receipt_no = v_receipt,
      metadata = metadata || case when v_realloc then
        jsonb_build_object(
          'overpay', true,
          'realloc', true,
          'balance_at_settle', v_balance
        )
      else '{}'::jsonb end
  where id = t.id;
  perform public._notify_fee_receipt(v_rid);
  return jsonb_build_object(
    'ok', true,
    'receipt_no', v_receipt,
    'payment_id', v_pid,
    'receipt_id', v_rid,
    'overpay', v_realloc
  );
end;
$$;
revoke all on function public.apply_gateway_payment(text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.apply_gateway_payment(text, text, numeric, text, text) to service_role;
