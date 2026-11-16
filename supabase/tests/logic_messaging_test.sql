-- Regression tests for 0050_messaging_logic.sql.
-- Run AFTER scripts/testDatabase.sh (needs the tst.* helpers and fixtures).
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f test_messaging.sql
-- Scratch database only: it parks every open outbox row as 'skipped'.
\set QUIET on
begin;
truncate tst.results;
select org_id as org from public.profiles where id = '00000000-0000-0000-0000-000000000001' \gset

select tst.logout();
update public.message_outbox set status = 'skipped' where status in ('pending', 'blocked', 'sending');

-- 1. Blocked rows (provider not configured) must not starve new pending rows.
insert into public.message_outbox (channel, to_address, body, status, attempts, created_at, claimed_at, org_id)
select 'whatsapp', '07700000' || g, 'blocked ' || g, 'blocked', 1, now() - interval '1 day' + g * interval '1 second',
       now() - interval '2 hours', :'org'
from generate_series(10, 14) g;
insert into public.message_outbox (channel, to_address, body, status, org_id)
values ('sms', '0771112222', 'fresh receipt', 'pending', :'org');
select tst.as_service();
create temp table c1 as select * from public.claim_outbox_batch(2);
select tst.ok((select count(*) = 1 from c1 where body = 'fresh receipt'),
              'pending message is claimed ahead of older blocked rows');

-- 2. Blocked rows back off: recently tried ones are not re-claimed every run.
select tst.logout();
update public.message_outbox set status = 'skipped' where status in ('pending', 'blocked', 'sending');
insert into public.message_outbox (channel, to_address, body, status, attempts, claimed_at, org_id) values
  ('whatsapp', '0770000020', 'blocked recent', 'blocked', 1, now() - interval '1 minute', :'org'),
  ('whatsapp', '0770000021', 'blocked old', 'blocked', 1, now() - interval '2 hours', :'org');
select tst.as_service();
create temp table c2 as select * from public.claim_outbox_batch(50);
select tst.ok((select count(*) = 0 from c2 where body = 'blocked recent'), 'recently blocked row waits before retry');
select tst.ok((select count(*) = 1 from c2 where body = 'blocked old'), 'blocked row retried after back-off');

-- 3. Failed rows back off by attempt count; fresh rows go immediately.
select tst.logout();
update public.message_outbox set status = 'skipped' where status in ('pending', 'blocked', 'sending');
insert into public.message_outbox (channel, to_address, body, status, attempts, claimed_at, org_id) values
  ('sms', '0770000030', 'retry soon', 'pending', 2, now() - interval '20 seconds', :'org'),
  ('sms', '0770000031', 'first try', 'pending', 0, null, :'org');
select tst.as_service();
create temp table c3 as select * from public.claim_outbox_batch(50);
select tst.ok((select count(*) = 0 from c3 where body = 'retry soon'), 'failed send is not retried within seconds');
select tst.ok((select count(*) = 1 from c3 where body = 'first try'), 'new message claimed immediately');

-- 4. Rows that can never be claimed again are closed instead of hanging.
select tst.logout();
update public.message_outbox set status = 'skipped' where status in ('pending', 'blocked', 'sending');
insert into public.message_outbox (channel, to_address, body, status, attempts, claimed_at, created_at, org_id) values
  ('sms', '0770000040', 'stuck last attempt', 'sending', 5, now() - interval '1 hour', now() - interval '1 hour', :'org'),
  ('email', 'x@example.com', 'blocked forever', 'blocked', 0, now() - interval '2 hours', now() - interval '8 days', :'org');
select tst.as_service();
select count(*) from public.claim_outbox_batch(50);
select tst.logout();
select tst.ok((select status = 'failed' from public.message_outbox where body = 'stuck last attempt'),
              'stuck sending row on its last attempt is marked failed');
select tst.ok((select status = 'failed' from public.message_outbox where body = 'blocked forever'),
              'week-old blocked row expires as failed');

-- 5. Org-scoped (staff flush) claim has the same ordering.
update public.message_outbox set status = 'skipped' where status in ('pending', 'blocked', 'sending');
insert into public.message_outbox (channel, to_address, body, status, attempts, created_at, claimed_at, org_id)
select 'whatsapp', '07700001' || g, 'org blocked ' || g, 'blocked', 1, now() - interval '1 day', now() - interval '2 hours',
       :'org'
from generate_series(10, 14) g;
insert into public.message_outbox (channel, to_address, body, status, org_id)
values ('sms', '0771113333', 'org fresh', 'pending', :'org');
select tst.as_service();
create temp table c5 as select * from public.claim_org_outbox_batch('00000000-0000-0000-0000-000000000001', 2);
select tst.ok((select count(*) = 1 from c5 where body = 'org fresh'), 'staff flush claims pending ahead of blocked');

-- 6. Fee reminder: linked parent without a phone → guardian phone gets the SMS.
select tst.logout();
delete from public.message_outbox where metadata ->> 'type' = 'fee_reminder' and metadata ->> 'student_id' = '00000000-0000-0000-0000-000000000009';
delete from public.notifications where data ->> 'type' = 'fee_reminder' and data ->> 'student_id' = '00000000-0000-0000-0000-000000000009';
select tst.login('00000000-0000-0000-0000-000000000003'); -- treasurer
select public.send_fee_reminder('00000000-0000-0000-0000-000000000009');
select tst.logout();
select tst.ok((select count(*) = 1 from public.message_outbox
               where metadata ->> 'type' = 'fee_reminder' and channel = 'sms' and to_address = '0779998888'),
              'fee reminder SMS reaches guardian phone when the linked parent has no phone');

-- 7. 20-hour guard holds even when no external message was queued.
delete from public.message_outbox where metadata ->> 'type' = 'fee_reminder' and metadata ->> 'student_id' = '00000000-0000-0000-0000-000000000009';
select tst.login('00000000-0000-0000-0000-000000000003');
select tst.fails($$select public.send_fee_reminder('00000000-0000-0000-0000-000000000009')$$,
                 'repeat reminder blocked even without outbox rows');
select tst.logout();

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tst.results;
select name, detail from tst.results where not ok;
rollback;
