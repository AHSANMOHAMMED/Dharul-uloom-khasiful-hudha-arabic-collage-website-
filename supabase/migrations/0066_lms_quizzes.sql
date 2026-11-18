-- LMS quiz lifecycle: publish, attempts, due, result release. Answer keys staff-only.
set search_path = public, extensions, pg_temp;

create table if not exists public.lms_quizzes (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  tutor_id      uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  class_number  int not null check (class_number between 1 and 7),
  subject       text not null default 'General',
  title         text not null,
  instructions  text,
  due_at        timestamptz,
  published_at  timestamptz,
  results_released_at timestamptz,
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.lms_quiz_questions (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  quiz_id       uuid not null references public.lms_quizzes (id) on delete cascade,
  sort_order    int not null default 0,
  prompt        text not null,
  choices       jsonb not null default '[]'::jsonb,
  -- answer_key: staff-only via RLS (never exposed to students)
  answer_key    text not null,
  points        numeric(6,2) not null default 1,
  created_at    timestamptz not null default now()
);

create table if not exists public.lms_quiz_attempts (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  quiz_id       uuid not null references public.lms_quizzes (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete restrict,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  answers       jsonb not null default '{}'::jsonb,
  score         numeric(8,2),
  max_score     numeric(8,2),
  status        text not null default 'in_progress'
                check (status in ('in_progress', 'submitted', 'graded')),
  unique (quiz_id, student_id)
);

create trigger trg_lms_quizzes_updated_at
  before update on public.lms_quizzes
  for each row execute function public.set_updated_at();

alter table public.lms_quizzes enable row level security;
alter table public.lms_quiz_questions enable row level security;
alter table public.lms_quiz_attempts enable row level security;

drop policy if exists "lms_quizzes: read" on public.lms_quizzes;
create policy "lms_quizzes: read" on public.lms_quizzes for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      public.is_employee()
      or (status = 'published' and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.class_number = lms_quizzes.class_number
      ))
      or public.is_parent_of_student_in_class(class_number)
    )
  );
drop policy if exists "lms_quizzes: no direct write" on public.lms_quizzes;
create policy "lms_quizzes: no direct write" on public.lms_quizzes for all to authenticated
  using (false) with check (false);

-- Questions visible without answer_key to students via view; table: staff see all, students see prompt/choices only via RPC
drop policy if exists "lms_quiz_q: staff read" on public.lms_quiz_questions;
create policy "lms_quiz_q: staff read" on public.lms_quiz_questions for select to authenticated
  using (org_id = (select public.current_org_id()) and public.is_employee());
drop policy if exists "lms_quiz_q: no direct write" on public.lms_quiz_questions;
create policy "lms_quiz_q: no direct write" on public.lms_quiz_questions for all to authenticated
  using (false) with check (false);

drop policy if exists "lms_quiz_attempts: read" on public.lms_quiz_attempts;
create policy "lms_quiz_attempts: read" on public.lms_quiz_attempts for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_employee())
  );
drop policy if exists "lms_quiz_attempts: no direct write" on public.lms_quiz_attempts;
create policy "lms_quiz_attempts: no direct write" on public.lms_quiz_attempts for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('lms_quizzes');
select public.apply_tenant_scope('lms_quiz_questions');
select public.apply_tenant_scope('lms_quiz_attempts');
select public.attach_audit('lms_quizzes');

create or replace function public.create_lms_quiz(
  p_class int, p_subject text, p_title text, p_instructions text default null, p_due timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_org uuid := public.current_org_id();
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.lms_quizzes (org_id, tutor_id, class_number, subject, title, instructions, due_at)
  values (v_org, auth.uid(), p_class, coalesce(nullif(trim(p_subject), ''), 'General'),
          trim(p_title), p_instructions, p_due)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.add_lms_quiz_question(
  p_quiz uuid, p_prompt text, p_choices jsonb, p_answer_key text, p_points numeric default 1, p_sort int default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; q record;
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into q from public.lms_quizzes where id = p_quiz and org_id = public.current_org_id();
  if not found then raise exception 'Quiz not found'; end if;
  if q.status <> 'draft' then raise exception 'Quiz is not draft'; end if;
  insert into public.lms_quiz_questions (org_id, quiz_id, sort_order, prompt, choices, answer_key, points)
  values (q.org_id, p_quiz, coalesce(p_sort, 0), trim(p_prompt), coalesce(p_choices, '[]'::jsonb),
          trim(p_answer_key), coalesce(p_points, 1))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.publish_lms_quiz(p_quiz uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.lms_quizzes set status = 'published', published_at = now()
  where id = p_quiz and org_id = public.current_org_id() and status = 'draft';
  if not found then raise exception 'Draft quiz not found'; end if;
end;
$$;

create or replace function public.student_quiz_questions(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q record;
begin
  select * into q from public.lms_quizzes where id = p_quiz and org_id = public.current_org_id();
  if not found or q.status <> 'published' then raise exception 'Quiz not available'; end if;
  if q.due_at is not null and now() > q.due_at then raise exception 'Quiz is past due'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', qq.id, 'sort_order', qq.sort_order, 'prompt', qq.prompt,
      'choices', qq.choices, 'points', qq.points
    ) order by qq.sort_order)
    from public.lms_quiz_questions qq where qq.quiz_id = p_quiz
  ), '[]'::jsonb);
end;
$$;

create or replace function public.start_or_resume_quiz(p_quiz uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_id uuid;
begin
  select * into q from public.lms_quizzes where id = p_quiz and org_id = public.current_org_id() and status = 'published';
  if not found then raise exception 'Quiz not available'; end if;
  if q.due_at is not null and now() > q.due_at then raise exception 'Quiz is past due'; end if;

  insert into public.lms_quiz_attempts (org_id, quiz_id, student_id)
  values (q.org_id, p_quiz, auth.uid())
  on conflict (quiz_id, student_id) do update set started_at = public.lms_quiz_attempts.started_at
  returning id into v_id;

  select id into v_id from public.lms_quiz_attempts where quiz_id = p_quiz and student_id = auth.uid();
  if exists (select 1 from public.lms_quiz_attempts where id = v_id and status <> 'in_progress') then
    raise exception 'Attempt already submitted';
  end if;
  return v_id;
end;
$$;

create or replace function public.submit_quiz_attempt(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  q record;
  qq record;
  v_score numeric := 0;
  v_max numeric := 0;
  v_ans text;
begin
  select * into a from public.lms_quiz_attempts
  where id = p_attempt and student_id = auth.uid() and status = 'in_progress' for update;
  if not found then raise exception 'In-progress attempt not found'; end if;
  select * into q from public.lms_quizzes where id = a.quiz_id;
  if q.due_at is not null and now() > q.due_at then raise exception 'Quiz is past due'; end if;

  for qq in select * from public.lms_quiz_questions where quiz_id = a.quiz_id loop
    v_max := v_max + qq.points;
    v_ans := p_answers ->> qq.id::text;
    if v_ans is not null and lower(trim(v_ans)) = lower(trim(qq.answer_key)) then
      v_score := v_score + qq.points;
    end if;
  end loop;

  update public.lms_quiz_attempts set
    answers = coalesce(p_answers, '{}'::jsonb),
    submitted_at = now(),
    score = v_score,
    max_score = v_max,
    status = 'graded'
  where id = p_attempt;

  -- Hide score until results released unless staff
  if q.results_released_at is null then
    return jsonb_build_object('status', 'submitted', 'released', false);
  end if;
  return jsonb_build_object('status', 'graded', 'score', v_score, 'max_score', v_max, 'released', true);
end;
$$;

create or replace function public.release_quiz_results(p_quiz uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.lms_quizzes set results_released_at = now(), status = 'closed'
  where id = p_quiz and org_id = public.current_org_id();
  if not found then raise exception 'Quiz not found'; end if;
end;
$$;

revoke all on function public.create_lms_quiz(int, text, text, text, timestamptz) from public, anon;
revoke all on function public.add_lms_quiz_question(uuid, text, jsonb, text, numeric, int) from public, anon;
revoke all on function public.publish_lms_quiz(uuid) from public, anon;
revoke all on function public.student_quiz_questions(uuid) from public, anon;
revoke all on function public.start_or_resume_quiz(uuid) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public, anon;
revoke all on function public.release_quiz_results(uuid) from public, anon;
grant execute on function public.create_lms_quiz(int, text, text, text, timestamptz) to authenticated;
grant execute on function public.add_lms_quiz_question(uuid, text, jsonb, text, numeric, int) to authenticated;
grant execute on function public.publish_lms_quiz(uuid) to authenticated;
grant execute on function public.student_quiz_questions(uuid) to authenticated;
grant execute on function public.start_or_resume_quiz(uuid) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
grant execute on function public.release_quiz_results(uuid) to authenticated;

select public.apply_mfa_policy('lms_quizzes'::regclass);
select public.apply_mfa_policy('lms_quiz_questions'::regclass);
select public.apply_mfa_policy('lms_quiz_attempts'::regclass);
