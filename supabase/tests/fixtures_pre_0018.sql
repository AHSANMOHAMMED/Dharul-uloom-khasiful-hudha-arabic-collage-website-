-- Legacy-format rows inserted BEFORE 0018 runs, to test the ledger backfill.
-- Legacy-format data present before 0018 (students + fees with jsonb payments)
insert into public.valid_index_numbers (index_number, student_name, class_number) values ('LEG-001','Legacy One',3);
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','legacy1@test.lk','{"account_type":"student","index_number":"LEG-001","full_name":"Legacy One"}');
update public.profiles set is_approved = true where id = '00000000-0000-0000-0000-0000000000a1';
-- simulate pre-0018 rows written by old UI (bypass: before 0018 there is no guard)
insert into public.student_fees (student_id, month, total_due, paid_amount, payments, status)
values ('00000000-0000-0000-0000-0000000000a1','2026-09',2000,1500,'[{"amount":1000,"date":"2026-09-05","note":"cash"},{"amount":500,"date":"garbage","note":"PayHere 123","gateway":"payhere","receipt_no":"REC-202609-1"}]','partial'),
       ('00000000-0000-0000-0000-0000000000a1','2026-10',2000,2000,'[]','completed');
