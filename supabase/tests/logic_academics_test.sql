-- Regression tests for 0051_academics_logic.sql. Run AFTER scripts/testDatabase.sh
-- (needs its tst.* helpers and fixtures). Everything runs in a transaction that
-- is rolled back, so it can be run repeatedly, before and after the migration.
--   psql "$DB" -v ON_ERROR_STOP=1 -f test_academics.sql
\set QUIET on
set client_min_messages = notice;
begin;
truncate tst.results;

select tst.logout();
-- ---------------------------------------------------------------- fixtures
-- principal (…02) is an academic admin; tutor1 (…06); students s1 (…08), s2 (…09) in class 3
insert into public.valid_index_numbers (index_number, student_name, class_number) values
  ('AC-S3', 'Acad Three', 3), ('AC-S4', 'Acad Grad', 3), ('AC-S5', 'Acad Class4', 4), ('AC-S6', 'Acad Final', 7);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-00ac-000000000003', 'acs3@t.lk', '{"account_type":"student","index_number":"AC-S3","full_name":"Acad Three"}'),
  ('00000000-0000-0000-00ac-000000000004', 'acs4@t.lk', '{"account_type":"student","index_number":"AC-S4","full_name":"Acad Grad"}'),
  ('00000000-0000-0000-00ac-000000000005', 'acs5@t.lk', '{"account_type":"student","index_number":"AC-S5","full_name":"Acad Class4"}'),
  ('00000000-0000-0000-00ac-000000000006', 'acs6@t.lk', '{"account_type":"student","index_number":"AC-S6","full_name":"Acad Final"}');
update public.profiles set is_approved = true where id::text like '00000000-0000-0000-00ac-%';
insert into public.student_details (profile_id, org_id, status)
values ('00000000-0000-0000-00ac-000000000004', public.default_org_id(), 'graduated')
on conflict (profile_id) do update set status = 'graduated';

insert into public.academic_years (id, org_id, name, start_date, end_date) values
  ('00000000-0000-0000-00ac-0000000000a1', public.default_org_id(), 'AC-2030', '2030-01-01', '2030-12-31'),
  ('00000000-0000-0000-00ac-0000000000a2', public.default_org_id(), 'AC-2031', '2031-01-01', '2031-12-31');
insert into public.subjects (id, org_id, code, name_en) values
  ('00000000-0000-0000-00ac-0000000000b1', public.default_org_id(), 'ACX1', 'Acad Paper');
insert into public.exams (id, org_id, name, status, class_number) values
  ('00000000-0000-0000-00ac-0000000000e1', public.default_org_id(), 'AC school-wide exam', 'marking', null);
insert into public.exam_subjects (org_id, exam_id, subject_id, max_marks, pass_marks) values
  (public.default_org_id(), '00000000-0000-0000-00ac-0000000000e1', '00000000-0000-0000-00ac-0000000000b1', 100, 55);
insert into public.student_results (student_id, exam_id, subject_id, exam_name, subject, marks_obtained, max_marks) values
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-00ac-0000000000e1', '00000000-0000-0000-00ac-0000000000b1', '', '', 60, 100),
  ('00000000-0000-0000-00ac-000000000003', '00000000-0000-0000-00ac-0000000000e1', '00000000-0000-0000-00ac-0000000000b1', '', '', 50, 100),
  ('00000000-0000-0000-00ac-000000000005', '00000000-0000-0000-00ac-0000000000e1', '00000000-0000-0000-00ac-0000000000b1', '', '', 90, 100);

-- ---------------------------------------------------------------- 1 grade gaps
delete from public.grade_scales where org_id = '0b000000-0000-0000-0000-000000000000';
insert into public.grade_scales (org_id, min_percent, max_percent, grade) values
  ('0b000000-0000-0000-0000-000000000000', 80, 100, 'Distinction'),
  ('0b000000-0000-0000-0000-000000000000', 60, 79, 'Credit'),
  ('0b000000-0000-0000-0000-000000000000', 50, 59, 'Pass'),
  ('0b000000-0000-0000-0000-000000000000', 0, 49, 'Fail');
select tst.ok(public.compute_grade('0b000000-0000-0000-0000-000000000000', 79.5) = 'Credit',
              'grade: 79.5% between bands 60-79 / 80-100 is Credit (not hard-coded A)',
              public.compute_grade('0b000000-0000-0000-0000-000000000000', 79.5));
select tst.ok(public.compute_grade('0b000000-0000-0000-0000-000000000000', 49.5) = 'Fail',
              'grade: 49.5% is Fail in the org scale (not hard-coded S)',
              public.compute_grade('0b000000-0000-0000-0000-000000000000', 49.5));
select tst.ok(public.compute_grade(public.default_org_id(), 85) = 'A+' and public.compute_grade(public.default_org_id(), 84.99) = 'A'
              and public.compute_grade(public.default_org_id(), 40) = 'S' and public.compute_grade(public.default_org_id(), 39.99) = 'F',
              'grade: default scale boundaries unchanged');

-- ---------------------------------------------------------------- 2 class rank
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.ok((select (rc ->> 'rank')::int = 1 and (rc ->> 'class_size')::int = 2
               from (select public.student_report_card('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-00ac-0000000000e1') rc) x),
              'report card: rank/class_size computed within the student''s class only',
              (select public.student_report_card('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-00ac-0000000000e1')::text));
select tst.ok((select (rc ->> 'rank')::int = 1 and (rc ->> 'class_size')::int = 1
               from (select public.student_report_card('00000000-0000-0000-00ac-000000000005', '00000000-0000-0000-00ac-0000000000e1') rc) x),
              'report card: class-4 student ranked among class 4 only');

-- ---------------------------------------------------------------- 3 attendance register
select tst.ok(not exists (select 1 from public.class_attendance_sheet(3, public.org_today())
                          where student_id = '00000000-0000-0000-00ac-000000000004'),
              'attendance sheet: graduated student no longer on the class register');
select tst.ok(exists (select 1 from public.class_attendance_sheet(3, public.org_today())
                      where student_id = '00000000-0000-0000-00ac-000000000003'),
              'attendance sheet: active student still listed');

-- ---------------------------------------------------------------- 4 enrol all
select public.enroll_active_students('00000000-0000-0000-00ac-0000000000a1');
select tst.ok(not exists (select 1 from public.student_enrollments
                          where student_id = '00000000-0000-0000-00ac-000000000004'
                            and academic_year_id = '00000000-0000-0000-00ac-0000000000a1'),
              'enroll_active_students: graduated student not re-enrolled');
select tst.ok(exists (select 1 from public.student_enrollments
                      where student_id = '00000000-0000-0000-00ac-000000000006'
                        and academic_year_id = '00000000-0000-0000-00ac-0000000000a1'),
              'enroll_active_students: active student enrolled');

-- ---------------------------------------------------------------- 5 promotion
select tst.fails($$select public.promote_students('00000000-0000-0000-00ac-0000000000a1', '00000000-0000-0000-00ac-0000000000a1', 3)$$,
                 'promotion: from-year = to-year is rejected');
select public.promote_students('00000000-0000-0000-00ac-0000000000a1', '00000000-0000-0000-00ac-0000000000a2', 7, '{}', 7);
select tst.logout();
select tst.ok((select status = 'graduated' from public.student_details where profile_id = '00000000-0000-0000-00ac-000000000006'),
              'promotion: final-class student without a details row is marked graduated');
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.ok(not exists (select 1 from public.class_attendance_sheet(7, public.org_today())
                          where student_id = '00000000-0000-0000-00ac-000000000006'),
              'promotion: graduate leaves the class-7 register');

-- ---------------------------------------------------------------- 6 analytics pass rate
select tst.logout();
update public.exams set status = 'published', published_at = now() + interval '1 day'
where id = '00000000-0000-0000-00ac-0000000000e1';
select tst.login('00000000-0000-0000-0000-000000000002');
select tst.ok((select (s ->> 'pass_rate')::numeric = 66.7
               from jsonb_array_elements(public.academic_analytics(180) -> 'latest_exam' -> 'subjects') s
               where s ->> 'subject' = 'Acad Paper'),
              'analytics: pass rate uses the paper pass mark (55), not 40%',
              (public.academic_analytics(180) -> 'latest_exam')::text);

-- ---------------------------------------------------------------- 7 timetable clashes
select tst.logout();
insert into public.class_schedules (org_id, tutor_id, class_number, subject, day_of_week, start_time, end_time, room, academic_year)
values (public.default_org_id(), '00000000-0000-0000-0000-000000000006', 3, 'AC Fiqh', 'Monday', '08:00', '08:45', 'Hall A', 2099);
select tst.fails($$insert into public.class_schedules (org_id, tutor_id, class_number, subject, day_of_week, start_time, end_time, academic_year)
  values (public.default_org_id(), '00000000-0000-0000-0000-000000000002', 3, 'AC Hadith', 'Monday', '08:30', '09:15', 2099)$$,
  'timetable: same class double-booked is rejected');
select tst.fails($$insert into public.class_schedules (org_id, tutor_id, class_number, subject, day_of_week, start_time, end_time, academic_year)
  values (public.default_org_id(), '00000000-0000-0000-0000-000000000006', 4, 'AC Arabic', 'Monday', '08:15', '09:00', 2099)$$,
  'timetable: same teacher in two classes at once is rejected');
select tst.fails($$insert into public.class_schedules (org_id, tutor_id, class_number, subject, day_of_week, start_time, end_time, room, academic_year)
  values (public.default_org_id(), '00000000-0000-0000-0000-000000000002', 5, 'AC Tajweed', 'Monday', '08:40', '09:20', 'hall a', 2099)$$,
  'timetable: same room double-booked is rejected');
select tst.succeeds($$insert into public.class_schedules (org_id, tutor_id, class_number, subject, day_of_week, start_time, end_time, room, academic_year)
  values (public.default_org_id(), '00000000-0000-0000-0000-000000000006', 3, 'AC Seerah', 'Monday', '08:45', '09:30', 'Hall A', 2099)$$,
  'timetable: back-to-back period (08:45 start) is allowed');

-- ---------------------------------------------------------------- 8 leave dates
select tst.fails($$insert into public.leave_requests (student_id, start_date, end_date, reason)
  values ('00000000-0000-0000-0000-000000000008', '2030-05-10', '2030-05-08', 'reversed')$$,
  'leave: end date before start date is rejected');
select tst.succeeds($$insert into public.leave_requests (student_id, start_date, end_date, reason)
  values ('00000000-0000-0000-0000-000000000008', '2030-05-08', '2030-05-08', 'one day')$$,
  'leave: single-day leave accepted');

-- ---------------------------------------------------------------- 9 double enrolment
insert into public.admissions (id, student_name, age, parent_name, phone, address, course, org_id, date_of_birth)
values ('00000000-0000-0000-00ac-0000000000d1', 'AC Applicant', 12, 'AC Parent', '0771111111', 'Addr', 'quran',
        public.default_org_id(), (public.org_today() - interval '12 years 2 months')::date);
select tst.login('00000000-0000-0000-0000-000000000001');
select public.enroll_admission('00000000-0000-0000-00ac-0000000000d1', 'AC-NEW-1', 1);
select tst.fails($$select public.enroll_admission('00000000-0000-0000-00ac-0000000000d1', 'AC-NEW-2', 1)$$,
                 'admissions: an enrolled application cannot be enrolled a second time');
select tst.logout();
select tst.ok((select count(*) = 1 from public.parent_invites where admission_id = '00000000-0000-0000-00ac-0000000000d1'),
              'admissions: only one parent invite issued');

-- ---------------------------------------------------------------- 10 graded LMS submission
insert into public.lms_assignments (id, tutor_id, class_number, title)
values ('00000000-0000-0000-00ac-0000000000f1', '00000000-0000-0000-0000-000000000006', 3, 'AC homework');
select tst.login('00000000-0000-0000-0000-000000000008');
insert into public.lms_submissions (assignment_id, student_id, content)
values ('00000000-0000-0000-00ac-0000000000f1', '00000000-0000-0000-0000-000000000008', 'first answer');
select tst.login('00000000-0000-0000-0000-000000000006');
update public.lms_submissions set grade = 'A', feedback = 'good'
where assignment_id = '00000000-0000-0000-00ac-0000000000f1';
select tst.login('00000000-0000-0000-0000-000000000008');
select tst.fails($$update public.lms_submissions set content = 'rewritten after grading'
  where assignment_id = '00000000-0000-0000-00ac-0000000000f1' and student_id = '00000000-0000-0000-0000-000000000008'$$,
  'lms: student cannot rewrite a graded submission');

-- ---------------------------------------------------------------- summary
select tst.logout();
\echo '--- academics logic tests ---'
select case when ok then 'PASS ' else 'FAIL ' end || name || coalesce('  [' || left(detail, 160) || ']', '') from tst.results order by id;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tst.results;
rollback;
