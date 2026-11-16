-- Regression tests for 0047_fees_logic.sql. Run AFTER scripts/testDatabase.sh
-- (needs the tst.* helpers and fixtures). Everything runs in one transaction
-- and is rolled back; the summary is printed before the rollback.
\set ON_ERROR_STOP on
\pset pager off
\o /dev/null
begin;
truncate tst.results;

-- fixtures: two fresh class-3 students without arrears + one class-7 student with no fee
insert into public.valid_index_numbers (index_number, student_name, class_number) values
  ('FX-1', 'Fees One', 3), ('FX-2', 'Fees Two', 3), ('FX-7', 'No Fee', 7);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000701', 'fx1@t.lk', '{"account_type":"student","full_name":"Fees One","index_number":"FX-1"}'),
  ('00000000-0000-0000-0000-000000000702', 'fx2@t.lk', '{"account_type":"student","full_name":"Fees Two","index_number":"FX-2"}'),
  ('00000000-0000-0000-0000-000000000707', 'fx7@t.lk', '{"account_type":"student","full_name":"No Fee","index_number":"FX-7"}');
update public.profiles set is_approved = true where id in
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000707');
update public.profiles set class_number = 7 where id = '00000000-0000-0000-0000-000000000707';
update public.fee_categories set default_amount = 0 where code = 'TUITION';   -- class 7 has no structure → no fee
create temp table r (k text primary key, v jsonb);
grant all on r to authenticated, service_role;

-- 1. concessions never exceed charges (class 3 tuition 2500; 50 % + fixed 2000)
select tst.login('00000000-0000-0000-0000-000000000004');
insert into public.student_fee_concessions (student_id, kind, value, reason) values
  ('00000000-0000-0000-0000-000000000701', 'percent', 50, 'Orphan'),
  ('00000000-0000-0000-0000-000000000701', 'fixed', 2000, 'Sibling');
select tst.login('00000000-0000-0000-0000-000000000003');
select public.generate_monthly_invoices('2031-01');
select tst.ok((select total_due = 0 and (select sum(amount) from public.fee_invoice_lines l where l.fee_id = f.id) = 0
               from public.student_fees f where student_id = '00000000-0000-0000-0000-000000000701' and month = '2031-01'),
              'stacked concessions stop at the charge (lines net 0, not negative)');
select tst.ok((select coalesce(sum(jl.debit - jl.credit), 0) = 0
               from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
               join public.accounts a on a.id = jl.account_id and a.code = '1200'
               where jl.party_id = '00000000-0000-0000-0000-000000000701' and je.source = 'fee_invoice'),
              'receivable not credited beyond the invoice');

-- 2. no empty invoice for a student without any fee; does not consume the batch
select tst.ok((select count(*) = 0 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000707' and month = '2031-01'),
              'no LKR 0 empty invoice for a student without fees');
-- a legacy empty invoice (created before setup was complete) is removed and the student re-billed
insert into public.fee_structures (fee_category_id, class_number, amount)
select id, 7, 900 from public.fee_categories where code = 'TUITION';
reset role;
select set_config('app.fee_internal', 'on', false);
insert into public.student_fees (org_id, student_id, month, total_due, paid_amount, status)
select org_id, id, '2031-02', 0, 0, 'completed' from public.profiles where id = '00000000-0000-0000-0000-000000000707';
select set_config('app.fee_internal', 'off', false);
select tst.login('00000000-0000-0000-0000-000000000003');
select public.generate_monthly_invoices('2031-02', null, null, 1);
select public.generate_monthly_invoices('2031-02', null, null, 1);
select public.generate_monthly_invoices('2031-02', null, null, 1);
select public.generate_monthly_invoices('2031-02', null, null, 1);
select public.generate_monthly_invoices('2031-02', null, null, 1);
select public.generate_monthly_invoices('2031-02', null, null, 1);
select tst.ok((select total_due = 900 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000707'
                 and month = '2031-02' and cancelled_at is null),
              'stale empty invoice removed and student billed after fee setup fixed');

-- 3. a discount larger than the unpaid balance is rejected
select public.add_fee_charges('00000000-0000-0000-0000-000000000702', '2031-03', '[{"category":"TUITION","kind":"charge","amount":1000}]');
select public.record_fee_payment((select id from public.student_fees where student_id = '00000000-0000-0000-0000-000000000702' and month = '2031-03'), 600, 'cash');
select tst.fails($$select public.add_fee_charges('00000000-0000-0000-0000-000000000702', '2031-03', '[{"category":"OTHER","kind":"discount","amount":900}]')$$,
                 'discount above the unpaid balance rejected');
select tst.succeeds($$select public.add_fee_charges('00000000-0000-0000-0000-000000000702', '2031-03', '[{"category":"OTHER","kind":"discount","amount":400}]')$$,
                    'discount up to the unpaid balance allowed');
select tst.fails($$update public.student_fees set total_due = 100 where student_id = '00000000-0000-0000-0000-000000000702' and month = '2031-03'$$,
                 'invoice total cannot be edited below the amount paid');

-- 4. journal date is the local (Colombo) date of the payment
select public.add_fee_charges('00000000-0000-0000-0000-000000000702', '2031-04', '[{"category":"TUITION","kind":"charge","amount":1000}]');
select public.receive_student_payment('00000000-0000-0000-0000-000000000702', 100, 'cash', null, null, '2031-12-01T02:00:00+05:30');
select tst.ok((select je.entry_date = '2031-12-01' from public.journal_entries je join public.fee_payments p on p.journal_entry_id = je.id
               where p.paid_at = '2031-12-01T02:00:00+05:30'),
              'receipt at 02:00 on 1 Dec (Colombo) is booked on 1 Dec, not 30 Nov');
-- clear FX-2 arrears for the gateway test
select public.receive_student_payment('00000000-0000-0000-0000-000000000702',
  (select sum(total_due - paid_amount) from public.student_fees where student_id = '00000000-0000-0000-0000-000000000702' and status in ('unpaid','partial')), 'cash');

-- 5. gateway payment for an invoice cancelled after checkout started
select public.add_fee_charges('00000000-0000-0000-0000-000000000702', '2031-05', '[{"category":"TUITION","kind":"charge","amount":1000}]');
select public.add_fee_charges('00000000-0000-0000-0000-000000000702', '2031-06', '[{"category":"TUITION","kind":"charge","amount":700}]');
reset role;
insert into public.payment_transactions (student_id, fee_id, payer_id, amount, gateway_order_id)
select student_id, id, student_id, 1000, 'ORD-FX-CXL' from public.student_fees
where student_id = '00000000-0000-0000-0000-000000000702' and month = '2031-05';
select tst.login('00000000-0000-0000-0000-000000000003');
select public.cancel_fee_invoice((select id from public.student_fees where student_id = '00000000-0000-0000-0000-000000000702' and month = '2031-05'), 'billing error');
select tst.as_service();
select tst.succeeds($$insert into r values ('gw', public.apply_gateway_payment('ORD-FX-CXL', 'PH-FX', 1000, 'LKR', '2'))$$,
                    'gateway payment on a cancelled invoice is still settled');
reset role;
select tst.ok((select status = 'completed' from public.student_fees where student_id = '00000000-0000-0000-0000-000000000702' and month = '2031-06'),
              'gateway money goes to the open month');
select tst.ok((select coalesce(sum(amount), 0) = 1000 from public.fee_payments where receipt_id = (select (v ->> 'receipt_id')::uuid from r where k = 'gw') and status = 'posted'),
              'full gateway amount recorded (rest held as advance)');
select tst.ok((select status = 'paid' from public.payment_transactions where gateway_order_id = 'ORD-FX-CXL'), 'gateway transaction marked paid');
select tst.as_service();
select tst.succeeds($q$do $b$ begin if not coalesce((public.apply_gateway_payment('ORD-FX-CXL', 'PH-FX', 1000, 'LKR', '2') ->> 'duplicate')::boolean, false) then raise exception 'not idempotent'; end if; end $b$ $q$,
                    'gateway retry is idempotent');

-- 6 + 7. reports
select tst.login('00000000-0000-0000-0000-000000000003');
select public.add_fee_charges('00000000-0000-0000-0000-000000000701', '2031-07', '[{"category":"TUITION","kind":"charge","amount":1000}]');
select public.add_fee_charges('00000000-0000-0000-0000-000000000701', '2031-08', '[{"category":"TUITION","kind":"charge","amount":1000}]');
insert into r select 'before', public.finance_today();
select public.receive_student_payment('00000000-0000-0000-0000-000000000701', 2000, 'cash');
select tst.login('00000000-0000-0000-0000-000000000004');
select public.reverse_fee_payment((select p.id from public.fee_payments p join public.student_fees f on f.id = p.fee_id
  where f.month = '2031-08' and p.status = 'posted' and p.student_id = '00000000-0000-0000-0000-000000000701'), 'bounced');
select tst.ok((select (public.finance_today() ->> 'collected')::numeric = (select (v ->> 'collected')::numeric + 1000 from r where k = 'before')),
              'today''s collection excludes the reversed allocation');
select public.receive_student_payment('00000000-0000-0000-0000-000000000701', 50, 'cash', null, null, '2031-12-02T01:00:00+05:30');
select tst.ok((select (public.fee_collection_report('2031-12-02', '2031-12-02') ->> 'total_collected')::numeric = 50),
              'collection report buckets by Colombo date');

reset role;
select tst.ok((select bool_and(f.total_due = greatest(coalesce((select sum(amount) from public.fee_invoice_lines l where l.fee_id = f.id), 0), 0))
               from public.student_fees f), 'invoice totals equal their lines');
select tst.ok((select bool_and(f.paid_amount = coalesce((select sum(amount) from public.fee_payments p where p.fee_id = f.id and p.status = 'posted'), 0))
               from public.student_fees f), 'invoice paid amounts equal posted receipts');

\o
select name, ok, left(detail, 90) detail from tst.results order by id;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tst.results;
rollback;
