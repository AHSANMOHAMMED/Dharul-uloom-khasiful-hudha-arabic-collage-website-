-- Volume fixture for latency tests (scratch DB only): one college with
-- 2,000 students, 1,500 parents, 60 staff, 60 days of attendance.
\set QUIET on
set search_path = public, extensions;
insert into public.valid_index_numbers (index_number, student_name, class_number)
select 'P-' || g, 'Perf Student ' || g, 1 + (g % 7) from generate_series(1, 2000) g on conflict do nothing;

insert into auth.users (id, email, raw_user_meta_data)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'ps' || g || '@perf.lk',
       jsonb_build_object('account_type', 'student', 'index_number', 'P-' || g, 'full_name', 'Perf Student ' || g)
from generate_series(1, 2000) g on conflict do nothing;
insert into auth.users (id, email, raw_user_meta_data)
select ('20000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'pp' || g || '@perf.lk',
       jsonb_build_object('account_type', 'parent', 'full_name', 'Perf Parent ' || g, 'phone', '07' || lpad(g::text, 8, '0'))
from generate_series(1, 1500) g on conflict do nothing;
insert into auth.users (id, email, raw_user_meta_data)
select ('30000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'pt' || g || '@perf.lk',
       jsonb_build_object('account_type', 'tutor', 'full_name', 'Perf Tutor ' || g)
from generate_series(1, 60) g on conflict do nothing;

update public.profiles set is_approved = true where email like '%@perf.lk';
update public.profiles set assigned_tutor_role = 'accountant' where email = 'pt1@perf.lk';
update public.profiles set assigned_tutor_role = 'treasurer' where email = 'pt2@perf.lk';

insert into public.parent_children (parent_id, child_id)
select ('20000000-0000-0000-0000-' || lpad((1 + (g % 1500))::text, 12, '0'))::uuid,
       ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid
from generate_series(1, 2000) g on conflict do nothing;

insert into public.attendance (student_id, date, status)
select ('10000000-0000-0000-0000-' || lpad(s::text, 12, '0'))::uuid, current_date - d,
       (array['present', 'present', 'present', 'late', 'absent'])[1 + ((s + d) % 5)]
from generate_series(1, 2000) s, generate_series(1, 60) d on conflict do nothing;

insert into public.notifications (user_id, title, message)
select ('20000000-0000-0000-0000-' || lpad((1 + (g % 1500))::text, 12, '0'))::uuid, 'Notice ' || g, 'Perf notification body ' || g
from generate_series(1, 20000) g;
analyze;
