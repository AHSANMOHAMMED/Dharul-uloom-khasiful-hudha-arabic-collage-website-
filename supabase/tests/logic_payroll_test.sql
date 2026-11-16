-- Payroll logic regression tests for 0048_payroll_logic.sql.
-- Run AFTER supabase/tests/rls_erp_test.sql (reuses its tst.* helpers and
-- fixtures). Everything runs in one transaction and is rolled back.
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f test_payroll.sql
\set QUIET on
set client_min_messages = notice;
begin;
truncate tst.results;

-- Personas from rls_erp_test.sql
--   ...04 accountant (approver), ...05 HR (preparer), ...06 Tutor One

-- ---------------------------------------------------------------------------
-- 1. Day-shift adjustment keeps the run balanced and approvable
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000005');
select public.generate_payroll('2027-01');
select public.adjust_payslip((select id from public.payslips where period = '2027-01' and staff_id = '00000000-0000-0000-0000-000000000006'),
                             'DAY_SHIFT', 5000, 'Day shift x5');
select tst.ok((select total_employer = (select sum(employer_total) from public.payslips p where p.run_id = r.id)
                      and total_gross = (select sum(gross) from public.payslips p where p.run_id = r.id)
               from public.payroll_runs r where period = '2027-01' and status = 'draft'),
              'adjust_payslip keeps run employer total in sync with payslips');
select tst.ok((select employer_total = round((40000 + 3000 + 5000) * 0.15, 2)
               from public.payslips where period = '2027-01' and staff_id = '00000000-0000-0000-0000-000000000006'),
              'day shift is EPF 12% + ETF 3% eligible on the payslip');
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.succeeds($$select public.approve_payroll((select id from public.payroll_runs where period = '2027-01' and status = 'draft'))$$,
                    'run with a day-shift adjustment can be approved (balanced journal)');

-- ---------------------------------------------------------------------------
-- 2. Advance recovery is capped using the real EPF base
-- ---------------------------------------------------------------------------
select tst.logout();
update public.staff_salary_profiles set basic_salary = 10000, components = '[{"code":"COLA","amount":10000}]'
where profile_id = '00000000-0000-0000-0000-000000000006';
update public.staff_advances set status = 'settled' where profile_id = '00000000-0000-0000-0000-000000000006';
insert into public.staff_advances (org_id, profile_id, amount, monthly_recovery, reason)
select org_id, profile_id, 19000, 19000, 'probe' from public.staff_salary_profiles
where profile_id = '00000000-0000-0000-0000-000000000006';
select tst.login('00000000-0000-0000-0000-000000000005');
select tst.succeeds($$select public.generate_payroll('2027-02')$$,
                    'generation succeeds when an advance meets EPF-eligible allowances');
select tst.ok((select net = 0 and (deductions @> '[{"code":"EPF_EE","amount":1600.00}]') and
                      (deductions @> '[{"code":"ADVANCE","amount":18400.00}]')
               from public.payslips where period = '2027-02' and staff_id = '00000000-0000-0000-0000-000000000006'),
              'advance recovery limited to pay left after EPF on basic+COLA');

-- ---------------------------------------------------------------------------
-- 3. Approving a draft whose advance was recovered elsewhere gives a clear error
-- ---------------------------------------------------------------------------
select tst.logout();
update public.staff_advances set recovered_amount = 10000 where reason = 'probe';
select tst.login('00000000-0000-0000-0000-000000000004');
do $$
begin
  perform public.approve_payroll((select id from public.payroll_runs where period = '2027-02' and status = 'draft'));
  perform tst.ok(false, 'over-recovering advance blocks approval with a regenerate hint', 'approved');
exception when others then
  perform tst.ok(sqlerrm ilike '%regenerate%', 'over-recovering advance blocks approval with a regenerate hint', sqlerrm);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Absences on approved-leave days are not docked again
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000006');
insert into public.staff_leave_requests (leave_type_id, start_date, end_date, days, reason)
values ((select id from public.staff_leave_types where code = 'NOPAY'), '2027-03-02', '2027-03-02', 1, 'nopay probe'),
       ((select id from public.staff_leave_types where code = 'CASUAL'), '2027-03-03', '2027-03-03', 1, 'casual probe');
select tst.login('00000000-0000-0000-0000-000000000005');
select public.review_staff_leave(id, true) from public.staff_leave_requests where reason in ('nopay probe', 'casual probe');
insert into public.staff_attendance (profile_id, date, status) values
  ('00000000-0000-0000-0000-000000000006', '2027-03-02', 'absent'),
  ('00000000-0000-0000-0000-000000000006', '2027-03-03', 'absent'),
  ('00000000-0000-0000-0000-000000000006', '2027-03-04', 'absent')
on conflict (profile_id, date) do update set status = excluded.status;
select public.generate_payroll('2027-03');
select tst.ok((select unpaid_days = 2 from public.payslips where period = '2027-03' and staff_id = '00000000-0000-0000-0000-000000000006'),
              'no-pay day + unexcused absence = 2 unpaid days (leave days marked absent not double-counted)',
              (select unpaid_days::text from public.payslips where period = '2027-03' and staff_id = '00000000-0000-0000-0000-000000000006'));

-- ---------------------------------------------------------------------------
-- 5. Leave days cannot exceed the date range
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.fails($$insert into public.staff_leave_requests (leave_type_id, start_date, end_date, days, reason)
  values ((select id from public.staff_leave_types where code = 'NOPAY'), '2027-04-01', '2027-04-01', 5, 'too many')$$,
  'leave request with more days than its date range is rejected');

-- ---------------------------------------------------------------------------
-- 6. Paid leave cannot exceed the annual entitlement (0053); unpaid is uncapped
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000006');
insert into public.staff_leave_requests (leave_type_id, start_date, end_date, days, reason)
values ((select id from public.staff_leave_types where code = 'CASUAL'), '2028-01-03', '2028-01-07', 5, 'casual 5'),
       ((select id from public.staff_leave_types where code = 'CASUAL'), '2028-02-01', '2028-02-03', 3, 'casual 3'),
       ((select id from public.staff_leave_types where code = 'NOPAY'),  '2028-03-01', '2028-03-10', 10, 'nopay 10');
select tst.login('00000000-0000-0000-0000-000000000005'); -- HR
select tst.succeeds($$select public.review_staff_leave((select id from public.staff_leave_requests where reason = 'casual 5'), true)$$,
                    'paid leave within the annual balance is approved');
do $$ begin
  perform public.review_staff_leave((select id from public.staff_leave_requests where reason = 'casual 3'), true);
  perform tst.ok(false, 'paid leave beyond the annual balance is refused', 'approved');
exception when others then
  perform tst.ok(sqlerrm ilike '%balance exceeded%', 'paid leave beyond the annual balance is refused', sqlerrm);
end $$;
select tst.ok((select status = 'pending' from public.staff_leave_requests where reason = 'casual 3'),
              'refused approval leaves the request pending');
select tst.succeeds($$select public.review_staff_leave((select id from public.staff_leave_requests where reason = 'nopay 10'), true)$$,
                    'unpaid leave is not capped by the balance');

-- ---------------------------------------------------------------------------
select tst.logout();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tst.results;
select name, detail from tst.results where not ok;
do $$ begin
  if exists (select 1 from tst.results where not ok) then
    raise exception 'payroll logic tests failed';
  end if;
end $$;
rollback;
