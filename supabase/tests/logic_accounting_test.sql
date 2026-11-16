-- Regression tests for 0049_accounting_logic.sql.
-- Run after supabase/tests/rls_erp_test.sql (needs its tst.* helpers and fixtures):
--   psql "$TEST_DATABASE_URL" -X -f test_accounting.sql
-- Everything runs inside one transaction that is rolled back; no statement can
-- abort the run (errors are recorded as failures). Last line: passed | failed.
\set QUIET on
set client_min_messages = warning;
begin;
\o /dev/null
create temp table acct_results (id serial, ok boolean, name text, detail text) on commit drop;
grant all on acct_results to authenticated;
grant all on sequence acct_results_id_seq to authenticated;
-- chk(sql, name): evaluates a boolean SQL expression; an error is a failure
create or replace function pg_temp.chk(p_sql text, n text) returns void language plpgsql as $$
declare v boolean;
begin
  execute 'select (' || p_sql || ')::boolean' into v;
  insert into acct_results (ok, name) values (coalesce(v, false), n);
exception when others then
  insert into acct_results (ok, name, detail) values (false, n, sqlerrm);
end $$;
-- must_fail(sql, name, pattern): passes only if the statement raises a matching error
create or replace function pg_temp.must_fail(p_sql text, n text, p_like text default null) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into acct_results (ok, name, detail) values (false, n, 'expected an error');
exception when others then
  insert into acct_results (ok, name, detail) values (p_like is null or sqlerrm ilike p_like, n, sqlerrm);
end $$;
-- run(sql): setup step; an error is recorded as a failure
create or replace function pg_temp.run(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  insert into acct_results (ok, name, detail) values (false, 'setup: ' || left(p_sql, 70), sqlerrm);
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Petty cash GL (1050) stays equal to the petty-cash funds
-- ---------------------------------------------------------------------------
select tst.logout();
insert into public.expenses (org_id, account_id, payee, description, amount, status)
values (public.default_org_id(), (select id from public.accounts where code = '5900' and org_id = public.default_org_id()),
        'Shop', 'acct-test petty', 700, 'approved'),
       (public.default_org_id(), (select id from public.accounts where code = '1010' and org_id = public.default_org_id()),
        'Bank', 'acct-test cash-as-expense', 50, 'approved');
select tst.login('00000000-0000-0000-0000-000000000004'); -- accountant
select pg_temp.must_fail($$select public.pay_expense((select id from public.expenses where description = 'acct-test petty'), '1050')$$,
  'expense cannot be paid from the petty cash GL account', '%petty cash%');
select pg_temp.chk($$(select balance from public.trial_balance(null, null) where code = '1050')
                   = (select sum((public.petty_cash_balance(id) ->> 'posted_balance')::numeric) from public.petty_cash_funds)$$,
  'GL 1050 equals the sum of petty cash fund balances');
select pg_temp.chk($$(select public.pay_expense((select id from public.expenses where description = 'acct-test petty'), '1000') is not null)$$,
  'expense still payable from main cash');
select pg_temp.chk($$(select e.entry_date = public.org_today() from public.journal_entries e
                    where e.id = (select journal_entry_id from public.expenses where description = 'acct-test petty'))$$,
  'expense payment dated in local (Asia/Colombo) time');
select pg_temp.must_fail($$select public.pay_expense((select id from public.expenses where description = 'acct-test cash-as-expense'), '1000')$$,
  'cash/bank account cannot be the expense account', '%cannot be a cash or bank%');

-- ---------------------------------------------------------------------------
-- 2. Bounced cheque with reversed receipts cannot be re-presented / cleared
-- ---------------------------------------------------------------------------
select pg_temp.chk($$(select status = 'bounced' from public.cheques where cheque_no = 'CHQ-555')$$, 'fixture: CHQ-555 bounced, receipts reversed');
select pg_temp.must_fail($$select public.update_cheque_status((select id from public.cheques where cheque_no = 'CHQ-555'), 'deposited', public.org_today() + 1)$$,
  'bounced cheque with reversed fee receipts cannot be re-presented', '%were reversed%');
select pg_temp.run($$select public.update_cheque_status((select id from public.cheques where cheque_no = 'CHQ-555'), 'cleared', public.org_today() + 1)$$);
select pg_temp.chk($$(select count(*) = 0 from public.cheques c join public.fee_payments p on p.id = any (c.fee_payment_ids)
                    where c.status in ('deposited', 'cleared') and p.status = 'reversed')$$,
  'no deposited/cleared cheque stands behind a reversed fee receipt');
-- the failed 'cleared' above may have logged a setup failure; drop it (it is expected to fail after the fix)
delete from acct_results where name like 'setup: select public.update_cheque_status%';
select pg_temp.chk($$(select (public.update_cheque_status((select id from public.cheques where cheque_no = 'CHQ-555' and status = 'bounced'),
                                'cancelled', null, 'Drawer paid cash instead') ->> 'status') = 'cancelled')$$,
  'bounced cheque can be cancelled (written off)');

-- ---------------------------------------------------------------------------
-- 3. Finance Hub donation: reverse from the document, not the donations list
-- ---------------------------------------------------------------------------
create temp table acct_d on commit drop as
  select (public.create_finance_document('donation', 'donor', null, 'Donor X', null, null, null,
          '[{"line_type":"donation","description":"Gift","qty":1,"unit_amount":1000}]')).id;
select pg_temp.run($$select public.issue_finance_document((select id from acct_d), 'cash')$$);
select pg_temp.must_fail($$select public.reverse_donation((select donation_id from public.finance_documents where id = (select id from acct_d)), 'mistake')$$,
  'Finance Hub donation cannot be reversed behind the document''s back', '%void that document%');
select pg_temp.chk($$(select f.status = 'paid' and dn.status = 'recorded' from public.finance_documents f
                    join public.donations dn on dn.id = f.donation_id where f.id = (select id from acct_d))$$,
  'document and donation stay consistent');
select pg_temp.run($$select public.void_finance_document((select id from acct_d), 'duplicate')$$);
select pg_temp.chk($$(select f.status = 'void' and dn.status = 'reversed' from public.finance_documents f
                    join public.donations dn on dn.id = f.donation_id where f.id = (select id from acct_d))$$,
  'voiding the document reverses the donation');
select pg_temp.run($$select public.record_donation(250, 'general', 'cash', 'Walk-in')$$);
select pg_temp.run($$select public.reverse_donation((select id from public.donations where donor_name = 'Walk-in'), 'typo')$$);
select pg_temp.chk($$(select status = 'reversed' from public.donations where donor_name = 'Walk-in')$$, 'plain donation still reversible');
select pg_temp.chk($$(select e.entry_date = public.org_today() from public.journal_entries e
                    join public.donations d on e.reversal_of = d.journal_entry_id where d.donor_name = 'Walk-in')$$,
  'reversal dated in local time');

-- ---------------------------------------------------------------------------
-- 4. Local dates for petty cash and defaults
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000003'); -- treasurer
select pg_temp.run($$select public.petty_cash_return((select f.id from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id
                                                     where r.code = 'FOOD'), 100, '1000', 'acct-test return')$$);
select pg_temp.chk($$(select e.entry_date = public.org_today() and j.entry_date = public.org_today()
                    from public.petty_cash_entries e join public.journal_entries j on j.id = e.journal_entry_id
                    where e.description = 'acct-test return')$$, 'petty cash return dated in local time (entry and journal)');
select tst.logout();
select pg_temp.chk($$(select bool_and(pg_get_expr(d.adbin, d.adrelid) like '%org_today%') from pg_attrdef d
                    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
                    where (d.adrelid, a.attname) in (('public.journal_entries'::regclass, 'entry_date'), ('public.expenses'::regclass, 'expense_date'),
                                                     ('public.donations'::regclass, 'donation_date'), ('public.petty_cash_entries'::regclass, 'entry_date'),
                                                     ('public.finance_document_payments'::regclass, 'paid_on')))$$,
  'document/journal dates default to the local date');
select pg_temp.chk($$(select pg_get_function_arguments('public._reverse_journal(uuid, text, date)'::regprocedure) like '%DEFAULT NULL%')$$,
  'reversal date no longer defaults to the UTC current_date');

-- ---------------------------------------------------------------------------
-- 5. Period lock cannot be set beyond today
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000004');
select pg_temp.must_fail($$select public.set_books_lock_date(public.org_today() + 365)$$, 'books cannot be locked into the future', '%cannot be locked beyond today%');
select pg_temp.run($$select public.set_books_lock_date(null)$$);
select pg_temp.run($$select public.set_books_lock_date(public.org_today() - 1)$$);
select pg_temp.must_fail($$select public.create_journal_entry(public.org_today() - 1, 'in locked period', '[{"code":"1000","debit":10},{"code":"3000","credit":10}]')$$,
  'posting into a locked period rejected', '%closed%');
select pg_temp.chk($$(select public.create_journal_entry(public.org_today(), 'after lock', '[{"code":"1000","debit":10},{"code":"3000","credit":10}]') is not null)$$,
  'posting today still allowed after a lock up to yesterday');
select pg_temp.run($$select public.set_books_lock_date(null)$$);

-- ---------------------------------------------------------------------------
-- Ledger integrity after all of the above
-- ---------------------------------------------------------------------------
select pg_temp.chk($$(select sum(debit) = sum(credit) from public.trial_balance(null, null))$$, 'trial balance debits = credits');
select pg_temp.chk($$(select (public.balance_sheet(public.org_today() + 1000) ->> 'balanced')::boolean)$$, 'balance sheet balances');
select tst.logout();

\o
\echo '----- accounting regression tests -----'
select case when ok then 'PASS' else 'FAIL' end as result, name, left(detail, 110) as detail from acct_results order by id;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from acct_results;
rollback;
