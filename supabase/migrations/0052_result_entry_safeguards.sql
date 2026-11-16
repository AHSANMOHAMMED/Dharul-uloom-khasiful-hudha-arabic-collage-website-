-- 0052 Restore result-entry safeguards lost in 0042_result_corrections.
--
-- 0042 rebuilt tg_student_results_prepare from the old 0016 body, dropping the
-- 0028 checks: same-institution student/exam, exam-class enrolment, subject
-- must be a paper of the exam, max_marks taken from exam_subjects, and the
-- tutor subject-assignment check. This restores the 0028 body and keeps 0042's
-- rule that marks on a published exam change only via apply_result_correction.

create or replace function public.tg_student_results_prepare()
returns trigger language plpgsql set search_path = public as $$
declare
  v_exam record;
  v_student record;
  v_paper record;
  v_class int;
  v_has_subject_assignments boolean;
begin
  select id, org_id, status, class_number, academic_year_id
    into v_exam from public.exams where id = new.exam_id;
  if new.exam_id is not null and not found then
    raise exception 'Exam not found';
  end if;

  select id, org_id, account_type, class_number
    into v_student from public.profiles where id = new.student_id;
  if not found or v_student.account_type <> 'student' then
    raise exception 'Student not found';
  end if;
  if new.org_id is null then new.org_id := v_student.org_id; end if;
  if new.org_id is distinct from v_student.org_id
     or (new.exam_id is not null and v_exam.org_id is distinct from v_student.org_id) then
    raise exception 'Student, exam, and result must belong to the same institution';
  end if;

  if new.exam_id is not null then
  v_class := v_student.class_number;
  if new.exam_id is not null and v_exam.academic_year_id is not null then
    select e.class_number into v_class from public.student_enrollments e
    where e.student_id = new.student_id and e.academic_year_id = v_exam.academic_year_id;
    if not found then v_class := v_student.class_number; end if;
  end if;
  if new.exam_id is not null and v_exam.class_number is not null and v_class is distinct from v_exam.class_number then
      raise exception 'Student is not enrolled in the exam class';
    end if;
    if v_exam.status = 'published' and current_user in ('anon', 'authenticated')
       and coalesce(current_setting('app.result_correction', true), '') <> 'on' then
      -- 0042: changing marks on a published exam must go through the audited
      -- request/apply_result_correction workflow, even for academic admins.
      if tg_op = 'UPDATE'
         and (new.marks_obtained is distinct from old.marks_obtained
              or new.max_marks is distinct from old.max_marks) then
        raise exception 'Published results require apply_result_correction' using errcode = '42501';
      end if;
      if not public.is_academic_admin() then
        raise exception 'Published results can only be corrected by an academic administrator'
          using errcode = '42501';
      end if;
    end if;
    if new.subject_id is null then
      raise exception 'An exam subject is required';
    end if;
    select max_marks into v_paper from public.exam_subjects
    where exam_id = new.exam_id and subject_id = new.subject_id and org_id = v_exam.org_id;
    if not found then
      raise exception 'Subject is not part of this exam';
    end if;
    new.max_marks := v_paper.max_marks;
    select name_en into new.subject from public.subjects where id = new.subject_id and org_id = v_exam.org_id;
    if tg_op = 'INSERT' or new.marks_obtained is distinct from old.marks_obtained then
      new.grade := public.compute_grade(new.org_id, round(new.marks_obtained * 100.0 / new.max_marks, 2));
    end if;
  end if;

  if new.marks_obtained is null or new.max_marks is null
     or new.marks_obtained < 0 or new.max_marks <= 0 or new.marks_obtained > new.max_marks then
    raise exception 'Marks must be between 0 and %', new.max_marks;
  end if;

  if new.exam_id is not null and new.subject_id is not null
     and current_user = 'authenticated' and not public.is_academic_admin() then
    select exists (
      select 1 from public.class_subjects cs
      where cs.org_id = new.org_id and cs.class_number = v_class
        and (cs.academic_year_id is null or cs.academic_year_id = v_exam.academic_year_id)
    ) into v_has_subject_assignments;
    if v_has_subject_assignments and not exists (
      select 1 from public.class_subjects cs
      where cs.org_id = new.org_id and cs.class_number = v_class
        and cs.subject_id = new.subject_id and cs.tutor_id = auth.uid()
        and (cs.academic_year_id is null or cs.academic_year_id = v_exam.academic_year_id)
    ) then
      raise exception 'Tutor is not assigned to this subject and class' using errcode = '42501';
    elsif not v_has_subject_assignments
       and not public.tutor_can_teach_student(new.student_id) then
      raise exception 'Tutor is not assigned to this class' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' or new.marks_obtained is distinct from old.marks_obtained then
    new.grade := public.compute_grade(new.org_id, round(new.marks_obtained * 100.0 / new.max_marks, 2));
  end if;
  if new.subject_id is not null and coalesce(new.subject, '') = '' then
    select name_en into new.subject from public.subjects where id = new.subject_id;
  end if;
  if new.exam_id is not null then
    select name into new.exam_name from public.exams where id = new.exam_id;
  end if;
  new.entered_by := coalesce(new.entered_by, auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
