-- =============================================================================
-- supabase/tests/rls_erp_test.sql
-- End-to-end security + ERP workflow tests. Run against a scratch database
-- AFTER all migrations (never production):
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_erp_test.sql
-- Prints PASS/FAIL lines; the final block raises if any test failed.
-- =============================================================================

\set QUIET on
set client_min_messages = notice;

create schema if not exists tst;
grant usage on schema tst to anon, authenticated, service_role;
create table if not exists tst.results (id serial, ok boolean, name text, detail text);
truncate tst.results;
grant all on tst.results to anon, authenticated, service_role;
grant usage, select on all sequences in schema tst to anon, authenticated, service_role;

create or replace function tst.login(p uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', p)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function tst.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;
create or replace function tst.as_service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  execute 'set role service_role';
end $$;
create or replace function tst.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
create or replace function tst.ok(c boolean, n text, d text default null) returns void language plpgsql as $$
begin
  insert into tst.results (ok, name, detail) values (coalesce(c, false), n, d);
  raise notice '% %', case when coalesce(c, false) then 'PASS' else 'FAIL' end, n;
end $$;
create or replace function tst.fails(p_sql text, n text) returns void language plpgsql as $$
begin
  execute p_sql;
  perform tst.ok(false, n, 'expected an error');
exception when others then
  perform tst.ok(true, n, sqlerrm);
end $$;
create or replace function tst.succeeds(p_sql text, n text) returns void language plpgsql as $$
begin
  execute p_sql;
  perform tst.ok(true, n);
exception when others then
  perform tst.ok(false, n, sqlerrm);
  raise notice '   -> %', sqlerrm;
end $$;
grant execute on all functions in schema tst to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
select tst.logout();
insert into public.organizations (id, slug, name_en, code) values
  ('0b000000-0000-0000-0000-000000000000', 'other-college', 'Other College', 'OC') on conflict do nothing;

insert into public.valid_index_numbers (index_number, student_name, class_number) values
  ('T-S1', 'Student One', 3), ('T-S2', 'Student Two', 3), ('T-S3', 'Student Three', 4)
on conflict do nothing;
insert into public.valid_index_numbers (index_number, student_name, class_number, org_id) values
  ('OC-S1', 'Other Student', 1, '0b000000-0000-0000-0000-000000000000') on conflict do nothing;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@t.lk',     '{"account_type":"staff","full_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'principal@t.lk', '{"account_type":"tutor","full_name":"Principal"}'),
  ('00000000-0000-0000-0000-000000000003', 'treasurer@t.lk', '{"account_type":"tutor","full_name":"Treasurer"}'),
  ('00000000-0000-0000-0000-000000000004', 'accountant@t.lk','{"account_type":"staff","full_name":"Accountant"}'),
  ('00000000-0000-0000-0000-000000000005', 'hr@t.lk',        '{"account_type":"staff","full_name":"HR"}'),
  ('00000000-0000-0000-0000-000000000006', 'tutor1@t.lk',    '{"account_type":"tutor","full_name":"Tutor One"}'),
  ('00000000-0000-0000-0000-000000000007', 'tutor2@t.lk',    '{"account_type":"tutor","full_name":"Tutor Unapproved","role":"admin"}'),
  ('00000000-0000-0000-0000-000000000008', 's1@t.lk',        '{"account_type":"student","index_number":"T-S1","full_name":"Student One"}'),
  ('00000000-0000-0000-0000-000000000009', 's2@t.lk',        '{"account_type":"student","index_number":"T-S2","full_name":"Student Two"}'),
  ('00000000-0000-0000-0000-000000000010', 'p1@t.lk',        '{"account_type":"parent","full_name":"Parent One","phone":"0771234567"}'),
  ('00000000-0000-0000-0000-000000000011', 'p2@t.lk',        '{"account_type":"parent","full_name":"Parent Two"}'),
  ('00000000-0000-0000-0000-000000000012', 'lib@t.lk',       '{"account_type":"staff","full_name":"Librarian"}'),
  ('00000000-0000-0000-0000-000000000013', 'ocadmin@t.lk',   '{"account_type":"staff","org_slug":"other-college"}'),
  ('00000000-0000-0000-0000-000000000014', 'ocs1@t.lk',      '{"account_type":"student","index_number":"OC-S1"}'),
  ('00000000-0000-0000-0000-000000000015', 'hacker@t.lk',    '{"account_type":"super_admin"}'),
  ('00000000-0000-0000-0000-000000000016', 'warden@t.lk',    '{"account_type":"staff","full_name":"Warden"}'),
  ('00000000-0000-0000-0000-000000000099', 'root@t.lk',      '{"account_type":"staff","full_name":"Platform Root"}')
on conflict do nothing;

update public.profiles set role = 'admin', is_approved = true where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013');
update public.profiles set role = 'super_admin', is_approved = true where id = '00000000-0000-0000-0000-000000000099';
update public.profiles set role = 'librarian', is_approved = true where id = '00000000-0000-0000-0000-000000000012';
update public.profiles set is_approved = true, assigned_tutor_role = 'principal' where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set is_approved = true, assigned_tutor_role = 'treasurer' where id = '00000000-0000-0000-0000-000000000003';
update public.profiles set is_approved = true, assigned_tutor_role = 'accountant' where id = '00000000-0000-0000-0000-000000000004';
update public.profiles set is_approved = true, assigned_tutor_role = 'hr_manager' where id = '00000000-0000-0000-0000-000000000005';
update public.profiles set is_approved = true, assigned_tutor_role = 'warden' where id = '00000000-0000-0000-0000-000000000016';
update public.profiles set is_approved = true where id in ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000014');
insert into public.parent_children (parent_id, child_id) values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000008');
insert into public.attendance (student_id, date, status) values ('00000000-0000-0000-0000-000000000008', current_date, 'present');

-- ---------------------------------------------------------------------------
-- 1. Signup hardening
-- ---------------------------------------------------------------------------
select tst.ok((select role = 'user' and not is_approved from public.profiles where id = '00000000-0000-0000-0000-000000000007'),
              'signup ignores role=admin metadata; tutor unapproved');
select tst.ok((select account_type = 'guest' and role = 'user' from public.profiles where id = '00000000-0000-0000-0000-000000000015'),
              'signup with account_type=super_admin becomes guest');
select tst.ok((select class_number = 3 and index_number = 'T-S1' from public.profiles where id = '00000000-0000-0000-0000-000000000008'),
              'student class taken from index record');
select tst.ok((select org_id = '0b000000-0000-0000-0000-000000000000' from public.profiles where id = '00000000-0000-0000-0000-000000000014'),
              'student org taken from index record');
select tst.fails($$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'bad@t.lk', '{"account_type":"student","index_number":"NOPE"}')$$,
                 'student signup with unknown index rejected');
select tst.fails($$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'dup@t.lk', '{"account_type":"student","index_number":"T-S1"}')$$,
                 'student signup with already-registered index rejected');

-- invitation onboarding
insert into public.org_invitations (org_id, email, account_type, role, assigned_tutor_role)
values (public.default_org_id(), 'invited@t.lk', 'staff', 'user', 'accountant');
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000020', 'Invited@t.lk', '{"account_type":"guest"}');
select tst.ok((select account_type = 'staff' and assigned_tutor_role = 'accountant' and is_approved from public.profiles where id = '00000000-0000-0000-0000-000000000020'),
              'org invitation applies role + approval on signup');

-- ---------------------------------------------------------------------------
-- 2. Privilege escalation
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000008');
select tst.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'student cannot self-promote to admin');
select tst.fails($$update public.profiles set is_approved = true, class_number = 7 where id = auth.uid()$$, 'student cannot change class');
select tst.succeeds($$update public.profiles set full_name = 'Student One A', phone = '0770000000' where id = auth.uid()$$, 'student can edit own name/phone');
select tst.fails($$select public.enqueue_user_messages(auth.uid(), 'x', 'spam')$$, 'student cannot call enqueue_user_messages');
select tst.fails($$select public.notify_payment_received('00000000-0000-0000-0000-000000000009', 1)$$, 'student cannot forge payment notifications');
select tst.fails($$select public._notify_profile_activated(auth.uid())$$, 'internal notify function not exposed');
select tst.fails($$select public.post_journal(public.current_org_id(), current_date, 'x', 'manual', null, '[]')$$, 'post_journal not exposed');

select tst.login('00000000-0000-0000-0000-000000000012'); -- librarian
select tst.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'librarian cannot self-promote');
select tst.ok((select count(*) = 0 from public.student_fees), 'librarian cannot read fees');
select tst.succeeds($$insert into public.authors (name_ar) values ('مؤلف')$$, 'librarian can still write catalog');

select tst.login('00000000-0000-0000-0000-000000000001'); -- admin
select tst.fails($$update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-000000000006'$$, 'admin cannot grant super_admin');
select tst.succeeds($$update public.profiles set extra_roles = array['counselor'] where id = '00000000-0000-0000-0000-000000000006'$$, 'admin can assign staff roles');
select tst.fails($$update public.organizations set plan = 'enterprise' where id = public.current_org_id()$$, 'admin cannot change own subscription plan');
select tst.succeeds($$update public.organizations set name_ar = 'دار العلوم' where id = public.current_org_id()$$, 'admin can edit own org branding');
update public.organizations set name_en = 'hijack' where slug = 'other-college';
select tst.logout();
select tst.ok((select name_en <> 'hijack' from public.organizations where slug = 'other-college'), 'admin cannot edit another org');

-- ---------------------------------------------------------------------------
-- 3. Unapproved staff & tenant isolation
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000007'); -- unapproved tutor
select tst.ok((select count(*) = 0 from public.attendance), 'unapproved tutor cannot read attendance');
select tst.fails($$insert into public.attendance (student_id, status) values ('00000000-0000-0000-0000-000000000009', 'absent')$$, 'unapproved tutor cannot mark attendance');

select tst.login('00000000-0000-0000-0000-000000000006'); -- approved tutor
select tst.ok((select count(*) >= 1 from public.attendance), 'approved tutor reads attendance');
select tst.ok((select count(*) >= 2 from public.profiles where account_type = 'student'), 'tutor can read student directory');
select tst.ok((select count(*) = 0 from public.profiles where org_id = '0b000000-0000-0000-0000-000000000000'), 'tutor cannot see other org profiles');

select tst.login('00000000-0000-0000-0000-000000000013'); -- other-org admin
select tst.ok((select count(*) = 0 from public.attendance), 'other org admin sees no attendance of college A');
select tst.ok((select count(*) = 0 from public.profiles where org_id = public.default_org_id()), 'other org admin sees no college A profiles');
select tst.fails($$insert into public.student_fees (student_id, month, total_due) values ('00000000-0000-0000-0000-000000000008', '2026-01', 10)$$,
                 'other org admin cannot bill college A student');
select tst.ok((select count(*) = 0 from public.accounts where org_id = public.default_org_id()), 'other org cannot read college A chart of accounts');
select tst.ok((select count(*) > 10 from public.accounts), 'new org got its own seeded chart of accounts');

-- ---------------------------------------------------------------------------
-- 4. Parent linking
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000011'); -- parent 2
select tst.fails($$insert into public.parent_children (parent_id, child_id) values (auth.uid(), '00000000-0000-0000-0000-000000000009')$$,
                 'parent cannot self-link arbitrary student');
select tst.ok((select count(*) = 0 from public.student_results), 'unlinked parent sees no results');
select tst.ok((select (public.request_child_link('T-S2') ->> 'status') = 'pending'), 'unverified link request is queued');
select tst.login('00000000-0000-0000-0000-000000000002'); -- principal (admissions staff)
select tst.succeeds($$select public.review_child_link((select id from public.parent_link_requests where child_index = 'T-S2'), true)$$,
                    'principal approves parent link');
select tst.login('00000000-0000-0000-0000-000000000011');
select tst.ok((select count(*) = 1 from public.parent_children where parent_id = auth.uid()), 'parent linked after approval');

-- auto-verified link via admission contact
select tst.logout();
insert into public.admissions (student_name, age, parent_name, phone, address, course, enrolled_index, pipeline_stage, status)
values ('Student One', 10, 'Parent One', '077-123-4567', 'Kalpitiya', 'quran', 'T-S1', 'enrolled', 'enrolled');
delete from public.parent_children where parent_id = '00000000-0000-0000-0000-000000000010';
select tst.login('00000000-0000-0000-0000-000000000010');
select tst.ok((select (public.request_child_link('T-S1') ->> 'status') = 'linked'), 'parent with matching admission phone is auto-linked');

-- ---------------------------------------------------------------------------
-- 5. LMS grading guard
-- ---------------------------------------------------------------------------
select tst.logout();
insert into public.lms_assignments (id, tutor_id, class_number, title) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 3, 'Homework');
select tst.login('00000000-0000-0000-0000-000000000008');
select tst.succeeds($$insert into public.lms_submissions (assignment_id, student_id, content, grade) values ('a0000000-0000-0000-0000-000000000001', auth.uid(), 'my work', 'A+')$$,
                    'student submits work');
select tst.ok((select grade is null from public.lms_submissions where student_id = auth.uid()), 'self-assigned grade stripped on insert');
select tst.fails($$update public.lms_submissions set grade = 'A+' where student_id = auth.uid()$$, 'student cannot grade own submission');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.succeeds($$update public.lms_submissions set grade = 'B', feedback = 'Good' where assignment_id = 'a0000000-0000-0000-0000-000000000001'$$, 'tutor grades submission');

-- ---------------------------------------------------------------------------
-- 6. Student finance
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000004'); -- accountant
insert into public.fee_structures (fee_category_id, class_number, amount)
select id, 3, 2500 from public.fee_categories where code = 'TUITION';
insert into public.student_fee_concessions (student_id, kind, value, reason)
values ('00000000-0000-0000-0000-000000000009', 'percent', 50, 'Orphan scholarship');

select tst.login('00000000-0000-0000-0000-000000000003'); -- treasurer
select tst.ok((select (public.generate_monthly_invoices('2026-11') ->> 'generated')::int >= 2), 'treasurer generates monthly invoices');
select tst.ok((select (public.generate_monthly_invoices('2026-11') ->> 'generated')::int = 0), 'invoice generation is idempotent');
select tst.ok((select total_due = 2500 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-11'),
              'class fee structure applied');
select tst.ok((select total_due = 1250 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000009' and month = '2026-11'),
              '50% concession applied');
select tst.fails($$update public.student_fees set paid_amount = 2500, status = 'completed' where student_id = '00000000-0000-0000-0000-000000000008'$$,
                 'direct paid_amount edit blocked');
select tst.ok((select (public.record_fee_payment((select id from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-11'), 1000, 'cash') ->> 'status') = 'partial'),
              'partial cash payment recorded');
select tst.fails($$select public.record_fee_payment((select id from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-11'), 99999, 'cash')$$,
                 'overpayment rejected');
select tst.fails($$select public.reverse_fee_payment((select id from public.fee_payments limit 1), 'oops')$$, 'treasurer cannot reverse receipts');
delete from public.fee_payments;
select tst.ok((select count(*) >= 1 from public.fee_payments), 'payments cannot be deleted (RLS filters delete)');
select tst.fails($$insert into public.fee_payments (fee_id, student_id, amount, receipt_no) select id, student_id, 5, 'X' from public.student_fees limit 1$$,
                 'payments cannot be inserted directly');
select tst.succeeds($$update public.student_fees set total_due = 3000 where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-11'$$,
                    'treasurer adjusts invoice total (creates adjustment line)');
select tst.ok((select count(*) = 2 from public.fee_invoice_lines l join public.student_fees f on f.id = l.fee_id
               where f.student_id = '00000000-0000-0000-0000-000000000008' and f.month = '2026-11'), 'adjustment line created');

select tst.login('00000000-0000-0000-0000-000000000008'); -- student
select tst.ok((select count(*) = 1 from public.fee_payments), 'student sees own receipts only');
select tst.ok((select (public.student_fee_statement(auth.uid()) ->> 'total_outstanding')::numeric = 2000), 'student statement outstanding = 2000');
select tst.fails($$select public.student_fee_statement('00000000-0000-0000-0000-000000000009')$$, 'student cannot read classmate statement');
select tst.login('00000000-0000-0000-0000-000000000010'); -- parent of S1
select tst.ok((select count(*) >= 1 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008'), 'parent sees child invoice');

select tst.login('00000000-0000-0000-0000-000000000004'); -- accountant reverses
select tst.succeeds($$select public.reverse_fee_payment((select id from public.fee_payments where student_id = '00000000-0000-0000-0000-000000000008' and status = 'posted' and amount = 1000 order by created_at desc limit 1), 'Bounced cheque')$$,
                    'accountant reverses receipt');
select tst.ok((select status = 'unpaid' and paid_amount = 0 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-11'),
              'invoice back to unpaid after reversal');

-- PayHere settlement (service role, idempotent)
select tst.logout();
insert into public.payment_transactions (student_id, fee_id, payer_id, amount, gateway_order_id)
select student_id, id, '00000000-0000-0000-0000-000000000010', total_due - paid_amount, 'KH-TEST-ORDER-1'
from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-11';
insert into public.payment_transactions (student_id, fee_id, payer_id, amount, gateway_order_id)
select student_id, id, '00000000-0000-0000-0000-000000000009', 1250, 'KH-TEST-ORDER-2'
from public.student_fees where student_id = '00000000-0000-0000-0000-000000000009' and month = '2026-11';
select tst.login('00000000-0000-0000-0000-000000000010');
select tst.fails($$select public.apply_gateway_payment('KH-TEST-ORDER-1', 'P1', 3000, 'LKR', '2')$$, 'end users cannot settle gateway payments');
select tst.as_service();
select tst.ok((select (public.apply_gateway_payment('KH-TEST-ORDER-1', 'PH-1', 3000, 'LKR', '2') ->> 'ok')::boolean), 'gateway settlement applied');
select tst.ok((select (public.apply_gateway_payment('KH-TEST-ORDER-1', 'PH-1', 3000, 'LKR', '2') ->> 'duplicate')::boolean), 'duplicate webhook is a no-op');
select tst.ok((select (public.apply_gateway_payment('KH-TEST-ORDER-2', 'PH-2', 1.00, 'LKR', '2') ->> 'error') = 'amount_mismatch'), 'tampered amount rejected');
select tst.logout();
select tst.ok((select status = 'completed' and paid_amount = 3000 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-11'),
              'invoice completed once (no double credit)');
select tst.ok((select count(*) = 1 from public.fee_payments where method = 'payhere' and student_id = '00000000-0000-0000-0000-000000000008'), 'exactly one gateway receipt');

-- ---------------------------------------------------------------------------
-- 7. Accounting
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.fails($$select public.create_journal_entry(current_date, 'unbalanced', '[{"code":"1000","debit":100},{"code":"3000","credit":90}]')$$,
                 'unbalanced journal rejected');
select tst.succeeds($$select public.create_journal_entry(current_date, 'Opening cash', '[{"code":"1000","debit":50000},{"code":"3000","credit":50000}]')$$,
                    'balanced opening journal posted');
select tst.fails($$update public.journal_lines set debit = 1 where entry_id = (select id from public.journal_entries where description = 'Opening cash')$$,
                 'posted journal lines immutable');
delete from public.journal_entries where description = 'Opening cash';
select tst.ok((select count(*) = 1 from public.journal_entries where description = 'Opening cash'), 'posted journal cannot be deleted');
select tst.logout();
select tst.fails($$delete from public.journal_entries where description = 'Opening cash'$$, 'posted journal delete blocked even for service role');
select tst.login('00000000-0000-0000-0000-000000000004');

select tst.login('00000000-0000-0000-0000-000000000006'); -- tutor submits expense claim
select tst.succeeds($$insert into public.expenses (account_id, payee, description, amount) values ((select id from public.accounts where code = '5500'), 'Book shop', 'Arabic readers', 4500)$$,
                    'employee submits expense');
select tst.fails($$update public.expenses set status = 'approved' where payee = 'Book shop'$$, 'employee cannot self-approve via update');
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.succeeds($$select public.approve_expense((select id from public.expenses where payee = 'Book shop'), true)$$, 'accountant approves expense');
select tst.login('00000000-0000-0000-0000-000000000003');
select tst.succeeds($$select public.pay_expense((select id from public.expenses where payee = 'Book shop'), '1000', 'Cash voucher 1')$$, 'treasurer pays expense');
select tst.ok((select (public.record_donation(10000, 'zakat', 'cash', 'Brother A') ->> 'receipt_no') like 'KH-DON-%'), 'zakat donation recorded');
select tst.ok((select (public.balance_sheet() ->> 'balanced')::boolean), 'balance sheet balances');
select tst.ok((select (public.income_statement('2000-01-01', '2100-01-01') ->> 'total_income')::numeric > 0), 'income statement has income');

-- ---------------------------------------------------------------------------
-- 8. Payroll & HR
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000005'); -- HR
select tst.succeeds($$insert into public.staff_salary_profiles (profile_id, basic_salary, components) values
  ('00000000-0000-0000-0000-000000000006', 40000, '[{"code":"TRAVEL","amount":3000},{"code":"WELFARE","amount":500}]'),
  ('00000000-0000-0000-0000-000000000002', 60000, '[]')$$, 'HR creates salary profiles');
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.succeeds($$select public.issue_staff_advance('00000000-0000-0000-0000-000000000006', 6000, 2000, 'Medical', '1000')$$, 'accountant issues advance');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.succeeds($$insert into public.staff_leave_requests (leave_type_id, start_date, end_date, days, reason)
  values ((select id from public.staff_leave_types where code = 'NOPAY'), '2026-11-10', '2026-11-11', 2, 'Personal')$$, 'tutor requests no-pay leave');
select tst.fails($$select public.review_staff_leave((select id from public.staff_leave_requests limit 1), true)$$, 'tutor cannot approve own leave');
select tst.login('00000000-0000-0000-0000-000000000005');
select tst.succeeds($$select public.review_staff_leave((select id from public.staff_leave_requests limit 1), true)$$, 'HR approves leave');
select tst.ok((select (public.generate_payroll('2026-11') ->> 'staff_count')::int = 2), 'payroll generated for 2 staff');
select tst.ok((select net = 40000 + 3000 - round(40000/26.0*2, 2) - 500 - round((40000 - round(40000/26.0*2, 2)) * 0.08, 2) - 2000
               from public.payslips where staff_id = '00000000-0000-0000-0000-000000000006'), 'tutor net pay = basic+allow-unpaid-EPF-welfare-advance');
select tst.fails($$select public.approve_payroll((select id from public.payroll_runs where period = '2026-11'))$$, 'HR (preparer) cannot approve payroll');
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.succeeds($$select public.approve_payroll((select id from public.payroll_runs where period = '2026-11'))$$, 'accountant approves payroll');
select tst.login('00000000-0000-0000-0000-000000000003');
select tst.succeeds($$select public.pay_payroll((select id from public.payroll_runs where period = '2026-11'), '1000', 'Cash salaries')$$, 'treasurer pays payroll');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.ok((select count(*) = 1 from public.payslips), 'tutor sees only own payslip');
select tst.ok((select status = 'paid' from public.tutor_salaries where month = '2026-11'), 'legacy tutor_salaries synced');
select tst.ok((select recovered_amount = 2000 from public.staff_advances), 'advance recovery applied');
select tst.ok((select count(*) = 0 from public.staff_salary_profiles where profile_id <> auth.uid()), 'tutor cannot see colleague salaries');

-- ---------------------------------------------------------------------------
-- 9. Academics
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000002'); -- principal
select tst.succeeds($$insert into public.subjects (code, name_en, category) values ('ARB', 'Arabic Grammar', 'arabic'), ('QRN', 'Quran', 'quran')$$, 'principal creates subjects');
select tst.succeeds($$insert into public.exams (id, name, class_number, status) values ('e0000000-0000-0000-0000-000000000001', 'Term 1', 3, 'marking')$$, 'principal creates exam');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.succeeds($$insert into public.student_results (student_id, exam_id, subject_id, marks_obtained, max_marks)
  select s.id, 'e0000000-0000-0000-0000-000000000001', sub.id, case when sub.code = 'ARB' then 88 else 52 end, 100
  from public.profiles s, public.subjects sub where s.account_type = 'student' and s.class_number = 3 and s.org_id = public.current_org_id()$$, 'tutor enters marks');
select tst.fails($$insert into public.student_results (student_id, exam_id, subject_id, marks_obtained, max_marks) values ('00000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', null, 120, 100)$$,
                 'marks above maximum rejected');
select tst.login('00000000-0000-0000-0000-000000000008');
select tst.ok((select count(*) = 0 from public.student_results where exam_id is not null), 'student cannot see unpublished results');
select tst.login('00000000-0000-0000-0000-000000000002');
update public.exams set status = 'published', published_at = now() where id = 'e0000000-0000-0000-0000-000000000001';
select tst.login('00000000-0000-0000-0000-000000000008');
select tst.ok((select count(*) = 2 from public.student_results where exam_id is not null), 'student sees published results');
select tst.ok((select grade = 'A+' from public.student_results where marks_obtained = 88 and student_id = auth.uid()), 'grade computed from scale');
select tst.ok((select (public.student_report_card(auth.uid(), 'e0000000-0000-0000-0000-000000000001') ->> 'rank') is not null), 'report card with rank');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.fails($$update public.student_results set marks_obtained = 99 where exam_id = 'e0000000-0000-0000-0000-000000000001'$$, 'tutor cannot change published marks');

-- ---------------------------------------------------------------------------
-- 10. Certificates, hostel, discipline
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.succeeds($$select public.issue_certificate('00000000-0000-0000-0000-000000000008', 'character', 'Character Certificate')$$, 'principal issues certificate');
select tst.logout();
create table if not exists tst.kv (k text primary key, v text);
grant all on tst.kv to anon;
insert into tst.kv values ('cert', (select verification_code from public.certificates limit 1)) on conflict (k) do update set v = excluded.v;
select tst.as_anon();
select tst.ok((select count(*) = 0 from public.certificates), 'anon cannot read certificates table');
select tst.ok((select (public.verify_certificate((select v from tst.kv where k = 'cert')) ->> 'valid')::boolean), 'anon verifies certificate by code');
select tst.ok((select (public.verify_certificate('NOT-A-CODE') ->> 'valid')::boolean = false), 'unknown certificate code invalid');

select tst.login('00000000-0000-0000-0000-000000000016'); -- warden
select tst.succeeds($$insert into public.hostels (id, name) values ('b0000000-0000-0000-0000-000000000001', 'Boys Hostel')$$, 'warden creates hostel');
select tst.succeeds($$insert into public.hostel_rooms (id, hostel_id, room_no, capacity, monthly_fee) values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '101', 1, 3000)$$, 'warden creates room');
select tst.succeeds($$insert into public.hostel_allocations (student_id, room_id, start_date) values ('00000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', '2026-11-01')$$, 'student allocated');
select tst.fails($$insert into public.hostel_allocations (student_id, room_id) values ('00000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001')$$, 'room capacity enforced');
select tst.login('00000000-0000-0000-0000-000000000003');
select public.generate_monthly_invoices('2026-12');
select tst.ok((select total_due = 5500 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000008' and month = '2026-12'), 'hostel fee billed with tuition');

select tst.login('00000000-0000-0000-0000-000000000006');
select tst.succeeds($$insert into public.discipline_incidents (student_id, severity, description) values ('00000000-0000-0000-0000-000000000008', 'major', 'Fight')$$, 'tutor reports incident');
select tst.login('00000000-0000-0000-0000-000000000010');
select tst.ok((select count(*) >= 1 from public.notifications where title like 'Important%'), 'parent notified of major incident');

-- ---------------------------------------------------------------------------
-- 11. SaaS platform
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000001');
select tst.fails($$select public.create_organization('new-school', 'New School', 'NS', 'ns@t.lk')$$, 'org admin cannot create tenants');
select tst.login('00000000-0000-0000-0000-000000000099');
select tst.ok((select public.create_organization('new-school', 'New School', 'NS', 'ns@t.lk', null, 'standard', 1) ->> 'admin_invite_token') is not null,
              'super admin creates tenant with admin invite');
select tst.ok((select count(*) >= 3 from public.platform_overview()), 'platform overview lists tenants');
select tst.login('00000000-0000-0000-0000-000000000001');
select tst.ok((select (public.org_dashboard_stats() ->> 'students')::int >= 2), 'admin dashboard KPIs');

-- suspension locks tenant data
select tst.login('00000000-0000-0000-0000-000000000099');
select public.set_organization_status('0b000000-0000-0000-0000-000000000000', 'suspended');
select tst.login('00000000-0000-0000-0000-000000000014');
select tst.ok((select count(*) = 1 from public.profiles), 'suspended-org user sees only own profile');
select tst.ok((select count(*) = 0 from public.notifications), 'suspended-org data locked');

-- ---------------------------------------------------------------------------
-- 11b. Finance hardening (review findings)
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000004'); -- accountant
select tst.fails($$select public.reverse_journal_entry((select id from public.journal_entries where source = 'fee_payment' and reversed_by is null limit 1), 'tamper')$$,
                 'sub-ledger journal cannot be reversed manually');
select tst.fails($$select public.reverse_donation((select id from public.donations limit 1), '')$$, 'donation reversal requires a reason');
select tst.fails($$select public.issue_staff_advance('00000000-0000-0000-0000-000000000006', 100, 50, 'x', '5100')$$, 'advance must be paid from cash/bank');
select tst.ok((select count(*) >= 1 and bool_or(description = 'Opening balance')
               from public.account_ledger((select id from public.accounts where code = '1000'), current_date + 1, null)), 'ledger shows opening balance row');
select tst.ok((select running_balance from public.account_ledger((select id from public.accounts where code = '1000'), current_date + 1, null) limit 1)
              = (select balance from public.trial_balance(null, current_date) where code = '1000'), 'ledger opening = balance to date');
select tst.login('00000000-0000-0000-0000-000000000003'); -- treasurer
select tst.succeeds($$select public.cancel_fee_invoice((select id from public.student_fees where student_id = '00000000-0000-0000-0000-000000000009' and month = '2026-12'), 'billing error')$$,
                    'cancel unpaid invoice');
select tst.ok((select (public.generate_monthly_invoices('2026-12') ->> 'generated')::int = 1), 'cancelled month can be re-billed');
select tst.ok((select count(*) = 2 from public.student_fees where student_id = '00000000-0000-0000-0000-000000000009' and month = '2026-12'), 'cancelled + new invoice coexist');

select tst.login('00000000-0000-0000-0000-000000000011'); -- parent 2 (linked to S2 only)
select tst.fails($$insert into public.leave_requests (student_id, parent_id, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000000008', auth.uid(), current_date, current_date, 'x')$$,
                 'parent cannot file leave for an unlinked student');
select tst.succeeds($$insert into public.leave_requests (student_id, parent_id, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000000009', auth.uid(), current_date, current_date, 'Fever')$$,
                    'parent files leave for linked child');
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.ok((select public.org_today() between current_date - 1 and current_date + 1), 'org_today resolves in org timezone');
select tst.login('00000000-0000-0000-0000-000000000002'); -- principal
select tst.fails($$select public.enroll_admission((select id from public.admissions limit 1), 'T-S1', 3)$$, 'enrol rejects an already-registered index');

-- tutors limited to their classes once teachers are assigned
select tst.login('00000000-0000-0000-0000-000000000002'); -- principal assigns class 3 Arabic to themself
insert into public.class_subjects (class_number, subject_id, tutor_id)
values (3, (select id from public.subjects where code = 'ARB'), '00000000-0000-0000-0000-000000000002');
select tst.login('00000000-0000-0000-0000-000000000006'); -- tutor 1, not assigned to class 3
select tst.fails($$insert into public.attendance (student_id, date, status) values ('00000000-0000-0000-0000-000000000009', current_date - 3, 'present')$$,
                 'unassigned tutor cannot mark attendance once class has teachers');
select tst.ok((select count(*) >= 1 from public.attendance), 'unassigned tutor can still read attendance');
select tst.login('00000000-0000-0000-0000-000000000002');
insert into public.class_subjects (class_number, subject_id, tutor_id)
values (3, (select id from public.subjects where code = 'QRN'), '00000000-0000-0000-0000-000000000006');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.succeeds($$insert into public.attendance (student_id, date, status) values ('00000000-0000-0000-0000-000000000009', current_date - 3, 'present')$$,
                    'assigned tutor marks attendance');

-- native push fan-out
select tst.login('00000000-0000-0000-0000-000000000008');
select tst.succeeds($$select public.register_push_token('ExponentPushToken[test-device-1]', 'android')$$, 'student registers device for push');
select tst.fails($$select public.register_push_token('not-a-token', 'android')$$, 'invalid push token rejected');
select tst.login('00000000-0000-0000-0000-000000000006');
insert into public.notifications (user_id, title, message) values ('00000000-0000-0000-0000-000000000008', 'Test push', 'Hello');
select tst.logout();
select tst.ok((select count(*) = 1 from public.message_outbox where channel = 'push' and to_address = 'ExponentPushToken[test-device-1]' and subject = 'Test push'),
              'notification fanned out to device push');

-- ---------------------------------------------------------------------------
-- 11c. Receipts, arrears (oldest month first), notifications, dictionary
-- ---------------------------------------------------------------------------
select tst.logout();
update public.student_details set guardian_phone = '0779998888' where profile_id = '00000000-0000-0000-0000-000000000009';
insert into public.student_details (profile_id, guardian_phone) values ('00000000-0000-0000-0000-000000000009', '0779998888')
  on conflict (profile_id) do update set guardian_phone = excluded.guardian_phone;
create table if not exists tst.r (k text primary key, v jsonb);
grant all on tst.r to authenticated, anon;
select tst.login('00000000-0000-0000-0000-000000000003'); -- treasurer
select tst.ok((select (public.student_arrears('00000000-0000-0000-0000-000000000009') ->> 'total')::numeric = 2500), 'student arrears = 2 open months (2,500)');
select tst.fails($$select public.receive_student_payment('00000000-0000-0000-0000-000000000009', 9999, 'cash')$$, 'payment above total arrears rejected');
insert into tst.r values ('rcpt', public.receive_student_payment('00000000-0000-0000-0000-000000000009', 1500, 'cash', null, 'Counter payment', now(), null, 'Mother'));
select tst.ok((select jsonb_array_length(v -> 'allocations') = 2 from tst.r where k = 'rcpt'), 'one receipt split over two months');
select tst.ok((select (v -> 'allocations' -> 0 ->> 'month') = '2026-11' and (v -> 'allocations' -> 0 ->> 'balance_after')::numeric = 0 from tst.r where k = 'rcpt'),
              'oldest month (Nov) settled first');
select tst.ok((select (v -> 'allocations' -> 1 ->> 'balance_after')::numeric = 1000 from tst.r where k = 'rcpt'), 'Dec balance 1,000 carried as arrears');
select tst.ok((select (v ->> 'arrears_after')::numeric = 1000 from tst.r where k = 'rcpt'), 'receipt snapshots total arrears');
select tst.ok((select count(*) = 1 from public.fee_receipts where receipt_no = (select v ->> 'receipt_no' from tst.r where k = 'rcpt')), 'single receipt number');
select tst.login('00000000-0000-0000-0000-000000000011'); -- parent of S2
select tst.ok((select count(*) >= 1 from public.notifications where data ->> 'type' = 'fee_receipt' and message like '%Student Two%' and message like '%November 2026%' and message like '%arrears%'),
              'parent notified with student name, month and arrears');
select tst.logout();
select tst.ok((select count(*) >= 1 from public.message_outbox where channel = 'email' and metadata ->> 'attach_receipt' = 'true'), 'e-mail queued with receipt PDF flag');
select tst.ok((select count(*) = 1 from public.message_outbox where channel = 'sms' and to_address = '0779998888' and body like '%Student Two%'),
              'guardian phone SMS when parent account has no phone');
select tst.as_anon();
select tst.ok((select (public.fee_receipt_by_token((select v ->> 'public_token' from tst.r where k = 'rcpt')) ->> 'receipt_no') is not null), 'receipt opens by secret link');
select tst.ok((select public.fee_receipt_by_token('short') is null), 'invalid receipt token returns nothing');
select tst.ok((select count(*) = 0 from public.fee_receipts), 'anon cannot list receipts');
select tst.login('00000000-0000-0000-0000-000000000003');
insert into tst.r values ('idem1', public.receive_student_payment('00000000-0000-0000-0000-000000000009', 100, 'cash', null, null, now(), null, null, 'counter-req-42'));
insert into tst.r values ('idem2', public.receive_student_payment('00000000-0000-0000-0000-000000000009', 100, 'cash', null, null, now(), null, null, 'counter-req-42'));
select tst.ok((select (a.v ->> 'receipt_no') = (b.v ->> 'receipt_no') and (b.v ->> 'duplicate')::boolean
               from tst.r a, tst.r b where a.k = 'idem1' and b.k = 'idem2'), 'retried payment returns the same receipt (no double charge)');
select tst.ok((select (v ->> 'payer_name') = 'Mother' from tst.r where k = 'rcpt'), 'receipt JSON includes payer name');
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.succeeds($$select public.reverse_fee_receipt((select (v ->> 'id')::uuid from tst.r where k = 'idem1'), 'test cleanup')$$, 'reverse idempotency test receipt');
select tst.login('00000000-0000-0000-0000-000000000004');
select tst.succeeds($$select public.reverse_fee_receipt((select (v ->> 'id')::uuid from tst.r where k = 'rcpt'), 'Wrong student')$$, 'accountant reverses whole receipt');
select tst.ok((select status = 'reversed' from public.fee_receipts where id = (select (v ->> 'id')::uuid from tst.r where k = 'rcpt')), 'receipt marked reversed');
select tst.ok((select (public.student_arrears('00000000-0000-0000-0000-000000000009') ->> 'total')::numeric = 2500), 'arrears restored after reversal');

-- dictionary
select tst.as_anon();
select tst.ok((select public.arabic_normalize('أَكْتُبُ') = 'اكتب'), 'Arabic normalisation strips tashkeel, unifies alef');
select tst.ok((select (public.lookup_arabic_word('وَالْكِتَابِ') -> 'results' -> 0 ->> 'tamil') like '%நூல்%'), 'clitic+article stripped: والكتاب → كتاب');
select tst.ok((select (public.lookup_arabic_word('بالمدرسة') -> 'results' -> 0 ->> 'english') = 'school'), 'بالمدرسة → مدرسة');
select tst.ok((select (public.lookup_arabic_word('الصلاة') -> 'results' -> 0 ->> 'match') in ('exact', 'stem')), 'الصلاة found');
select tst.login('00000000-0000-0000-0000-000000000012'); -- librarian
select tst.succeeds($$insert into public.dictionary_entries (arabic, tamil, english, root, part_of_speech, verified) values ('مُحَدِّث', 'ஹதீஸ் கலை அறிஞர்', 'hadith scholar', 'حدث', 'noun', true)$$, 'librarian adds verified entry');
select tst.fails($$insert into public.dictionary_entries (arabic, tamil, source) values ('تجربة', 'சோதனை', 'ai')$$, 'clients cannot forge AI entries');
select tst.login('00000000-0000-0000-0000-000000000008');
select tst.fails($$insert into public.dictionary_entries (arabic, tamil) values ('x', 'y')$$, 'students cannot edit dictionary');
select tst.logout();
select tst.ok((select setconfig::text like '%statement_timeout=8s%' from pg_db_role_setting where setrole = 'authenticated'::regrole), 'authenticated statement_timeout 8s');

select tst.as_service();
select tst.ok((select count(*) > 0 from public.claim_outbox_batch(500)), 'worker claims pending outbox rows');
select tst.ok((select count(*) = 0 from public.claim_outbox_batch(500)), 'claimed rows are not handed to a second worker');
select tst.login('00000000-0000-0000-0000-000000000001');
select tst.fails($$select * from public.claim_outbox_batch(5)$$, 'end users cannot claim the outbox');

-- ---------------------------------------------------------------------------
-- 11d. Governance: duties per year, petty cash, mashoora tasks, admissions DOB
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-000000000002'); -- principal
select tst.succeeds($$insert into public.mashoora_meetings (id, title, meeting_type, meeting_date) values ('f0000000-0000-0000-0000-000000000001', 'Annual mashoora 2026', 'annual', '2026-01-05')$$,
                    'principal records annual mashoora');
select tst.succeeds($$select public.assign_duty((select id from public.duty_roles where code = 'FOOD'), '00000000-0000-0000-0000-000000000006', '2026-01-06', 'f0000000-0000-0000-0000-000000000001')$$,
                    'mashoora assigns FOOD duty to tutor 1');
select tst.ok((select count(*) = 1 from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id where r.code = 'FOOD'), 'petty cash fund opened for the duty');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.fails($$select public.assign_duty((select id from public.duty_roles where code = 'CLEANING'), auth.uid())$$, 'lecturer cannot assign duties');
select tst.fails($$insert into public.duty_assignments (duty_role_id, assignee_id) values ((select id from public.duty_roles where code = 'CLEANING'), auth.uid())$$, 'duty assignments only via RPC');
select tst.ok((select public.has_duty('FOOD')), 'tutor 1 holds FOOD duty');

select tst.login('00000000-0000-0000-0000-000000000003'); -- treasurer tops up
select tst.succeeds($$select public.petty_cash_topup((select f.id from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id where r.code = 'FOOD'), 8000, '1000', 'January float')$$,
                    'treasurer tops up FOOD petty cash');
select tst.fails($$select public.petty_cash_topup((select f.id from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id where r.code = 'FOOD'), 5000, '1000')$$,
                 'top-up above fund limit rejected');
select tst.login('00000000-0000-0000-0000-000000000006'); -- holder spends
select tst.succeeds($$select public.petty_cash_spend((select f.id from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id where r.code = 'FOOD'), 3500,
  (select id from public.accounts where code = '5400'), 'Rice and vegetables', 'Kalpitiya market')$$, 'duty holder records petty cash spend');
select tst.fails($$select public.petty_cash_spend((select f.id from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id where r.code = 'FOOD'), 99999,
  (select id from public.accounts where code = '5400'), 'Too much')$$, 'spend above available petty cash rejected');
select tst.login('00000000-0000-0000-0000-000000000009');
select tst.fails($$select public.petty_cash_spend((select f.id from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id where r.code = 'FOOD'), 10,
  (select id from public.accounts where code = '5400'), 'x')$$, 'non-holder cannot spend petty cash');
select tst.login('00000000-0000-0000-0000-000000000004'); -- accountant approves
select tst.succeeds($$select public.review_petty_cash((select id from public.petty_cash_entries where entry_type = 'expense' and status = 'submitted' limit 1), true)$$, 'accountant approves spend');
select tst.ok((select (public.petty_cash_balance(f.id) ->> 'posted_balance')::numeric = 4500
               from public.petty_cash_funds f join public.duty_roles r on r.id = f.duty_role_id where r.code = 'FOOD'), 'petty cash balance 8,000 - 3,500 = 4,500');

select tst.login('00000000-0000-0000-0000-000000000009');
select tst.ok((select public.petty_cash_balance(f.id) is null from public.petty_cash_funds f limit 1) is not false, 'students cannot read petty cash balances');
-- year end: duty moves to the principal, history keeps tutor 1's spending
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.succeeds($$select public.assign_duty((select id from public.duty_roles where code = 'FOOD'), '00000000-0000-0000-0000-000000000002', '2027-01-04')$$, 'next year duty handed over');
insert into tst.r values ('hist', public.duty_history((select id from public.duty_roles where code = 'FOOD')));
select tst.ok((select jsonb_array_length(v -> 'assignments') = 2 from tst.r where k = 'hist'), 'duty history keeps both holders');
select tst.ok((select (a ->> 'petty_spent')::numeric = 3500 and a ->> 'status' = 'ended' and a ->> 'meeting' = 'Annual mashoora 2026'
               from tst.r, jsonb_array_elements(v -> 'assignments') a where k = 'hist' and a ->> 'assignee_id' = '00000000-0000-0000-0000-000000000006'),
              'previous holder''s petty cash spending and mashoora decision preserved');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.ok((select not public.has_duty('FOOD')), 'old holder lost the duty');

-- task board
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.ok((select public.create_meeting_tasks('f0000000-0000-0000-0000-000000000001',
  '[{"title":"Fix hall lights","assignee_id":"00000000-0000-0000-0000-000000000006","priority":"high","due_date":"2026-01-12"}]') = 1), 'mashoora creates weekly task');
select tst.login('00000000-0000-0000-0000-000000000006');
select tst.succeeds($$update public.tasks set status = 'in_progress' where title = 'Fix hall lights'$$, 'assignee moves card to in progress');
select tst.fails($$update public.tasks set status = 'done' where title = 'Fix hall lights'$$, 'assignee cannot self-close a task');
select tst.fails($$update public.tasks set title = 'Something else' where title = 'Fix hall lights'$$, 'assignee cannot rewrite task');
select tst.succeeds($$update public.tasks set status = 'review' where title = 'Fix hall lights'$$, 'assignee sends task to review');
select tst.fails($$insert into public.tasks (title, assignee_id) values ('x', '00000000-0000-0000-0000-000000000002')$$, 'lecturer cannot assign tasks to others');
select tst.succeeds($$insert into public.tasks (title, assignee_id) values ('My own note', auth.uid())$$, 'lecturer adds own task');
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.ok((select count(*) >= 1 from public.notifications where title = 'Task ready for review'), 'assigner notified for review');
select tst.succeeds($$update public.tasks set status = 'done' where title = 'Fix hall lights'$$, 'principal marks task done');
select tst.ok((select completed_at is not null from public.tasks where title = 'Fix hall lights'), 'completion time recorded');
select tst.ok((select count(*) >= 4 from public.task_events where task_id = (select id from public.tasks where title = 'Fix hall lights')), 'task history recorded');

-- admissions: date of birth → age, limits, guest applications into CRM
select tst.as_anon();
select tst.ok((select (public.submit_public_admission('Yusuf Rahman', (current_date - interval '12 years 2 months')::date, 'Rahman Ali', '077 123 4568', 'Kalpitiya', 'quran') ->> 'age')::int = 12),
              'guest application: age computed from DOB');
select tst.fails($$select public.submit_public_admission('Yusuf Rahman', (current_date - interval '12 years')::date, 'Rahman Ali', '0771234568', 'Kalpitiya', 'quran')$$, 'duplicate guest application blocked');
select tst.fails($$select public.submit_public_admission('Tiny Tot', (current_date - interval '2 years')::date, 'Parent', '0771112223', 'x', 'quran')$$, 'too young rejected');
select tst.fails($$select public.submit_public_admission('Future Kid', (current_date + 10)::date, 'Parent', '0771112224', 'x', 'quran')$$, 'future DOB rejected');
select tst.fails($$select public.submit_public_admission('Bad Phone', (current_date - interval '10 years')::date, 'Parent', '12345', 'x', 'quran')$$, 'invalid phone rejected');
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.ok((select count(*) = 1 from public.admissions where student_name = 'Yusuf Rahman' and pipeline_stage = 'submitted' and source = 'website'), 'guest application in CRM pipeline');
select tst.ok((select count(*) >= 1 from public.notifications where title = 'New admission application'), 'admissions staff notified');

-- super admin acts inside another institution
select tst.login('00000000-0000-0000-0000-000000000099');
select public.set_acting_org('0b000000-0000-0000-0000-000000000000');
select tst.ok((select public.current_org_id() = '0b000000-0000-0000-0000-000000000000'), 'super admin acts as another institution');
select tst.ok((select count(*) >= 10 from public.duty_roles), 'super admin manages that institution''s duties');
select public.set_acting_org(null);
select tst.login('00000000-0000-0000-0000-000000000001');
select tst.fails($$select public.set_acting_org('0b000000-0000-0000-0000-000000000000')$$, 'org admin cannot switch institutions');
select tst.fails($$update public.profiles set acting_org_id = '0b000000-0000-0000-0000-000000000000' where id = auth.uid()$$, 'acting org only via RPC');

-- ---------------------------------------------------------------------------
-- 12. Global ledger integrity
-- ---------------------------------------------------------------------------
select tst.logout();
select tst.ok((select bool_and(d = c) from (select e.id, sum(l.debit) d, sum(l.credit) c from public.journal_entries e
               join public.journal_lines l on l.entry_id = e.id where e.status = 'posted' group by e.id) x), 'every posted entry is balanced');
select tst.ok((select sum(debit) = sum(credit) from public.journal_lines), 'ledger debits = credits');
select tst.ok((select bool_and(f.total_due = coalesce((select sum(amount) from public.fee_invoice_lines l where l.fee_id = f.id), 0))
               from public.student_fees f), 'invoice totals equal their lines');
select tst.ok((select bool_and(f.paid_amount = coalesce((select sum(amount) from public.fee_payments p where p.fee_id = f.id and p.status = 'posted'), 0))
               from public.student_fees f), 'invoice paid amounts equal posted receipts');
select tst.ok((select count(*) > 0 from public.audit_logs where table_name = 'fee_payments'), 'audit log captures financial changes');

-- ---------------------------------------------------------------------------
select tst.logout();
\echo '-----------------------------------------------'
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tst.results;
select name, detail from tst.results where not ok;
do $$ begin
  if exists (select 1 from tst.results where not ok) then
    raise exception 'RLS/ERP tests failed';
  end if;
end $$;
