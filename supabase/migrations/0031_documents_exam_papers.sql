-- =============================================================================
-- 0031_documents_exam_papers.sql
-- Letterheads, a shared document library (letters, notices, minutes, …) with
-- version history, and a secure exam-paper workflow:
--
--   assigned → drafting → submitted → it_review → approved → printed → released
--                 ↑______ returned with notes ______|
--
--   * Exam papers are never visible through ordinary sharing. Only the
--     examiner (author), academic administrators (exam officer, principal,
--     VP, admin) and IT officers can open them; IT only once submitted.
--   * Approval locks the paper; only academic administrators can change a
--     locked paper (every change is kept in document_versions).
--   * Every open / print / download of an exam paper is logged.
-- =============================================================================

-- New staff role for the IT / examination-printing department.
alter table public.profiles drop constraint if exists profiles_assigned_tutor_role_check;
alter table public.profiles add constraint profiles_assigned_tutor_role_check
  check (assigned_tutor_role in (
    'none', 'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
    'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer', 'it_officer'));
alter table public.profiles drop constraint if exists profiles_extra_roles_check;
alter table public.profiles add constraint profiles_extra_roles_check
  check (extra_roles <@ array['principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
    'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer', 'it_officer']::text[]);

create or replace function public.is_it_officer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_staff_role(array['it_officer']);
$$;

-- Who may manage letterheads and see every non-exam document of the org.
create or replace function public.is_document_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_staff_role(array['principal', 'vice_principal', 'it_officer']);
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files under <org_id>/…
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-documents', 'org-documents', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

drop policy if exists "org-documents: org staff read" on storage.objects;
create policy "org-documents: org staff read" on storage.objects for select to authenticated
  using (bucket_id = 'org-documents' and public.is_employee()
         and (storage.foldername(name))[1] = public.current_org_id()::text);
drop policy if exists "org-documents: org staff write" on storage.objects;
create policy "org-documents: org staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'org-documents' and public.is_employee()
              and (storage.foldername(name))[1] = public.current_org_id()::text);
drop policy if exists "org-documents: admin delete" on storage.objects;
create policy "org-documents: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'org-documents' and public.is_document_admin()
         and (storage.foldername(name))[1] = public.current_org_id()::text);

-- ---------------------------------------------------------------------------
-- Letterheads: an A4 background image + the writable area margins.
-- ---------------------------------------------------------------------------
create table if not exists public.letterheads (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  storage_path     text,
  orientation      text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  margin_top_mm    numeric(5,1) not null default 45 check (margin_top_mm between 0 and 150),
  margin_bottom_mm numeric(5,1) not null default 30 check (margin_bottom_mm between 0 and 150),
  margin_left_mm   numeric(5,1) not null default 20 check (margin_left_mm between 0 and 80),
  margin_right_mm  numeric(5,1) not null default 20 check (margin_right_mm between 0 and 80),
  is_default       boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
create unique index if not exists idx_letterheads_default on public.letterheads (org_id) where is_default;

alter table public.letterheads enable row level security;
drop policy if exists "letterheads: org staff read" on public.letterheads;
create policy "letterheads: org staff read" on public.letterheads for select to authenticated
  using (org_id = public.current_org_id() and public.is_employee());
drop policy if exists "letterheads: document admin write" on public.letterheads;
create policy "letterheads: document admin write" on public.letterheads for all to authenticated
  using (org_id = public.current_org_id() and public.is_document_admin())
  with check (org_id = public.current_org_id() and public.is_document_admin());
select public.apply_mfa_policy('public.letterheads'::regclass);

-- Only one default letterhead per institution.
create or replace function public.tg_letterhead_single_default()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update public.letterheads set is_default = false where org_id = new.org_id and id <> new.id and is_default;
  end if;
  return new;
end $$;
drop trigger if exists trg_letterhead_single_default on public.letterheads;
create trigger trg_letterhead_single_default before insert or update of is_default on public.letterheads
  for each row when (new.is_default) execute function public.tg_letterhead_single_default();

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  kind          text not null default 'letter'
                check (kind in ('letter', 'notice', 'circular', 'certificate', 'minutes', 'report', 'exam_paper', 'other')),
  body_html     text not null default '',
  letterhead_id uuid references public.letterheads (id) on delete set null,
  status        text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  owner_id      uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Sharing (ignored for exam papers): staff roles, 'all_staff', or specific users.
  share_roles   text[] not null default '{}',
  share_users   uuid[] not null default '{}',
  ref_no        text,
  version       int not null default 1,
  locked        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (length(body_html) <= 2000000)
);
create index if not exists idx_documents_org_updated on public.documents (org_id, updated_at desc);
create index if not exists idx_documents_owner on public.documents (owner_id);

create table if not exists public.document_versions (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  version     int not null,
  title       text not null,
  body_html   text not null,
  saved_by    uuid references public.profiles (id) on delete set null,
  saved_at    timestamptz not null default now(),
  unique (document_id, version)
);

create table if not exists public.exam_papers (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  exam_id          uuid not null references public.exams (id) on delete cascade,
  subject_id       uuid not null references public.subjects (id) on delete cascade,
  document_id      uuid not null unique references public.documents (id) on delete cascade,
  examiner_id      uuid not null references public.profiles (id),
  status           text not null default 'assigned'
                   check (status in ('assigned', 'drafting', 'submitted', 'it_review', 'approved', 'printed', 'released')),
  due_date         date,
  instructions     text,
  duration_minutes int check (duration_minutes between 1 and 600),
  total_marks      numeric(6,2),
  submitted_at     timestamptz,
  approved_at      timestamptz,
  approved_by      uuid references public.profiles (id) on delete set null,
  printed_count    int not null default 0,
  released_at      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (exam_id, subject_id)
);

create table if not exists public.exam_paper_events (
  id         uuid primary key default extensions.gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  paper_id   uuid not null references public.exam_papers (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  action     text not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_exam_paper_events_paper on public.exam_paper_events (paper_id, created_at desc);

-- Read rule, in one place (RLS + RPCs use it).
create or replace function public.can_read_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    left join public.exam_papers p on p.document_id = d.id
    where d.id = p_doc and d.org_id = public.current_org_id() and public.mfa_ok()
      and case
        when d.kind = 'exam_paper' then
          d.owner_id = auth.uid()
          or public.is_academic_admin()
          or (public.is_it_officer() and p.status in ('submitted', 'it_review', 'approved', 'printed', 'released'))
          -- after release (exam is over) the paper may be read by all staff
          or (p.status = 'released' and public.is_employee())
        else
          d.owner_id = auth.uid()
          or public.is_document_admin()
          or (public.is_employee() and 'all_staff' = any (d.share_roles))
          or (cardinality(d.share_roles) > 0 and public.has_staff_role(d.share_roles))
          or auth.uid() = any (d.share_users)
      end
  );
$$;

create or replace function public.can_edit_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    left join public.exam_papers p on p.document_id = d.id
    where d.id = p_doc and d.org_id = public.current_org_id() and public.mfa_ok()
      and case
        when d.kind = 'exam_paper' then
          public.is_academic_admin()
          or (not d.locked and d.owner_id = auth.uid() and p.status in ('assigned', 'drafting'))
          or (not d.locked and public.is_it_officer() and p.status = 'it_review')
        else
          public.is_document_admin() or (not d.locked and d.owner_id = auth.uid())
      end
  );
$$;

alter table public.documents enable row level security;
drop policy if exists "documents: read" on public.documents;
create policy "documents: read" on public.documents for select to authenticated
  using (public.can_read_document(id));
drop policy if exists "documents: create" on public.documents;
create policy "documents: create" on public.documents for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_employee() and owner_id = auth.uid()
              and kind <> 'exam_paper');  -- exam papers are created by assign_exam_paper()
drop policy if exists "documents: edit" on public.documents;
create policy "documents: edit" on public.documents for update to authenticated
  using (public.can_edit_document(id))
  with check (org_id = public.current_org_id());
drop policy if exists "documents: delete" on public.documents;
create policy "documents: delete" on public.documents for delete to authenticated
  using (org_id = public.current_org_id() and kind <> 'exam_paper'
         and (public.is_document_admin() or (owner_id = auth.uid() and not locked)));
select public.apply_mfa_policy('public.documents'::regclass);

alter table public.document_versions enable row level security;
drop policy if exists "document_versions: read" on public.document_versions;
create policy "document_versions: read" on public.document_versions for select to authenticated
  using (public.can_read_document(document_id));
select public.apply_mfa_policy('public.document_versions'::regclass);

alter table public.exam_papers enable row level security;
drop policy if exists "exam_papers: read" on public.exam_papers;
create policy "exam_papers: read" on public.exam_papers for select to authenticated
  using (org_id = public.current_org_id() and public.can_read_document(document_id));
select public.apply_mfa_policy('public.exam_papers'::regclass);
-- No direct writes: state changes go through the RPCs below.

alter table public.exam_paper_events enable row level security;
drop policy if exists "exam_paper_events: read" on public.exam_paper_events;
create policy "exam_paper_events: read" on public.exam_paper_events for select to authenticated
  using (org_id = public.current_org_id()
         and (public.is_academic_admin()
              or exists (select 1 from public.exam_papers p where p.id = paper_id and p.examiner_id = auth.uid())));
select public.apply_mfa_policy('public.exam_paper_events'::regclass);

-- Server-managed fields + version history -----------------------------------
create or replace function public.tg_documents_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seq int;
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.locked := coalesce(new.locked, false) and new.kind = 'exam_paper';
    if new.ref_no is null and new.kind not in ('exam_paper') then
      select count(*) + 1 into v_seq from public.documents
      where org_id = new.org_id and created_at >= date_trunc('year', now());
      new.ref_no := format('DUKH/%s/%s', to_char(now(), 'YYYY'), lpad(v_seq::text, 4, '0'));
    end if;
    return new;
  end if;

  -- Ownership, kind, org and lock state are not editable by API callers.
  -- (This function is SECURITY DEFINER, so current_user is the owner: check
  -- the JWT role instead.) exam_paper_transition sets app.doc_lock_change to
  -- change the lock legitimately within its own transaction.
  if not public.is_privileged_caller() then
    new.org_id := old.org_id;
    new.kind := old.kind;
    new.owner_id := old.owner_id;
    if coalesce(current_setting('app.doc_lock_change', true), '') <> 'on' then
      new.locked := old.locked;
    end if;
    if old.kind = 'exam_paper' then
      new.share_roles := '{}';
      new.share_users := '{}';
    end if;
  end if;

  if new.body_html is distinct from old.body_html or new.title is distinct from old.title then
    insert into public.document_versions (org_id, document_id, version, title, body_html, saved_by)
    values (old.org_id, old.id, old.version, old.title, old.body_html, auth.uid())
    on conflict (document_id, version) do nothing;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_documents_guard on public.documents;
create trigger trg_documents_guard before insert or update on public.documents
  for each row execute function public.tg_documents_guard();

-- First save by the examiner moves the paper to "drafting".
create or replace function public.tg_documents_exam_drafting()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'exam_paper' and new.body_html is distinct from old.body_html then
    update public.exam_papers set status = 'drafting', updated_at = now()
    where document_id = new.id and status = 'assigned';
  end if;
  return null;
end $$;
drop trigger if exists trg_documents_exam_drafting on public.documents;
create trigger trg_documents_exam_drafting after update on public.documents
  for each row execute function public.tg_documents_exam_drafting();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.notify_users(p_users uuid[], p_title text, p_message text, p_link text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, title, message, data, link, org_id)
  select u, p_title, p_message, coalesce(p_data, '{}'::jsonb), p_link, public.current_org_id()
  from unnest(p_users) as u
  where u is not null and u <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
end $$;
revoke execute on function public.notify_users(uuid[], text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.academic_admin_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles
  where org_id = public.current_org_id() and is_approved
    and (role in ('admin', 'super_admin') or assigned_tutor_role in ('exam_officer', 'principal', 'vice_principal')
         or extra_roles && array['exam_officer', 'principal', 'vice_principal']);
$$;

create or replace function public.it_officer_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles
  where org_id = public.current_org_id() and is_approved
    and (assigned_tutor_role = 'it_officer' or 'it_officer' = any (extra_roles));
$$;

-- Exam officer assigns a paper to an examiner; creates the working document.
create or replace function public.assign_exam_paper(
  p_exam uuid, p_subject uuid, p_examiner uuid, p_due date default null,
  p_instructions text default null, p_duration int default null, p_total_marks numeric default null,
  p_letterhead uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid := public.current_org_id();
  ex     record;
  sub    record;
  v_doc  uuid;
  v_paper uuid;
  v_body text;
begin
  if not public.is_academic_admin() then
    raise exception 'Only the exam officer, principal or an administrator can assign exam papers' using errcode = '42501';
  end if;
  select * into ex from public.exams where id = p_exam and org_id = v_org;
  if not found then raise exception 'Exam not found'; end if;
  select * into sub from public.subjects where id = p_subject and org_id = v_org;
  if not found then raise exception 'Subject not found'; end if;
  if not exists (select 1 from public.exam_subjects where exam_id = p_exam and subject_id = p_subject) then
    raise exception 'Add this subject to the exam before assigning its paper';
  end if;
  if not exists (select 1 from public.profiles where id = p_examiner and org_id = v_org and is_approved
                 and account_type in ('tutor', 'staff')) then
    raise exception 'The examiner must be an approved lecturer of this institution';
  end if;
  if exists (select 1 from public.exam_papers where exam_id = p_exam and subject_id = p_subject) then
    raise exception 'A paper is already assigned for this exam and subject';
  end if;

  v_body := format(
    '<table style="width:100%%;border-collapse:collapse"><tbody>'
    || '<tr><td><b>Examination</b></td><td>%s</td><td><b>Class</b></td><td>%s</td></tr>'
    || '<tr><td><b>Subject</b></td><td>%s</td><td><b>Time</b></td><td>%s</td></tr>'
    || '<tr><td><b>Total marks</b></td><td>%s</td><td><b>Index no.</b></td><td>&nbsp;</td></tr>'
    || '</tbody></table><p><b>Instructions:</b> %s</p><hr><h3>Part A</h3><ol><li>&nbsp;</li></ol><h3>Part B</h3><ol><li>&nbsp;</li></ol>',
    ex.name, coalesce(ex.class_number::text, '—'), coalesce(sub.name_en, sub.code),
    coalesce(p_duration::text || ' minutes', '—'), coalesce(p_total_marks::text, '—'),
    coalesce(nullif(trim(p_instructions), ''), 'Answer all questions.'));

  insert into public.documents (org_id, title, kind, body_html, owner_id, letterhead_id, status)
  values (v_org, format('%s — %s', ex.name, coalesce(sub.name_en, sub.code)), 'exam_paper', v_body, p_examiner,
          coalesce(p_letterhead, (select id from public.letterheads where org_id = v_org and is_default)), 'draft')
  returning id into v_doc;

  insert into public.exam_papers (org_id, exam_id, subject_id, document_id, examiner_id, due_date, instructions,
                                  duration_minutes, total_marks)
  values (v_org, p_exam, p_subject, v_doc, p_examiner, p_due, p_instructions, p_duration, p_total_marks)
  returning id into v_paper;

  insert into public.exam_paper_events (org_id, paper_id, action, note)
  values (v_org, v_paper, 'assigned', p_instructions);
  perform public.notify_users(array[p_examiner], 'Exam paper assigned',
    format('Please prepare the %s paper for %s%s.', coalesce(sub.name_en, sub.code), ex.name,
           coalesce(' by ' || to_char(p_due, 'DD Mon YYYY'), '')),
    '/erp?module=documents&doc=' || v_doc, jsonb_build_object('type', 'exam_paper', 'paper_id', v_paper));
  return v_paper;
end $$;

-- Workflow transitions.
create or replace function public.exam_paper_transition(p_paper uuid, p_action text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  p      record;
  v_next text;
  v_is_examiner boolean;
  v_admin boolean := public.is_academic_admin();
  v_it    boolean := public.is_it_officer();
  v_link  text;
begin
  select * into p from public.exam_papers where id = p_paper and org_id = public.current_org_id() for update;
  if not found then raise exception 'Exam paper not found'; end if;
  perform set_config('app.doc_lock_change', 'on', true);
  v_is_examiner := p.examiner_id = auth.uid() and public.mfa_ok();
  v_link := '/erp?module=documents&doc=' || p.document_id;

  case p_action
    when 'submit' then
      if not (v_is_examiner or v_admin) then raise exception 'Only the examiner can submit this paper' using errcode = '42501'; end if;
      if p.status not in ('assigned', 'drafting') then raise exception 'This paper cannot be submitted from status %', p.status; end if;
      v_next := 'submitted';
      update public.exam_papers set status = v_next, submitted_at = now(), updated_at = now() where id = p.id;
      perform public.notify_users(public.academic_admin_ids() || public.it_officer_ids(), 'Exam paper submitted',
        'An exam paper is ready for review and formatting.', v_link, jsonb_build_object('type', 'exam_paper', 'paper_id', p.id));
    when 'start_review' then
      if not (v_it or v_admin) then raise exception 'Only IT or the exam office can review papers' using errcode = '42501'; end if;
      if p.status <> 'submitted' then raise exception 'Only submitted papers can be taken for review'; end if;
      v_next := 'it_review';
      update public.exam_papers set status = v_next, updated_at = now() where id = p.id;
    when 'return' then
      if not (v_it or v_admin) then raise exception 'Only IT or the exam office can return papers' using errcode = '42501'; end if;
      if p.status not in ('submitted', 'it_review') then raise exception 'This paper cannot be returned from status %', p.status; end if;
      if coalesce(trim(p_note), '') = '' then raise exception 'Say what needs to change when returning a paper'; end if;
      v_next := 'drafting';
      update public.exam_papers set status = v_next, updated_at = now() where id = p.id;
      perform public.notify_users(array[p.examiner_id], 'Exam paper returned for changes', p_note, v_link,
        jsonb_build_object('type', 'exam_paper', 'paper_id', p.id));
    when 'approve' then
      if not v_admin then raise exception 'Only the exam officer or principal can approve papers' using errcode = '42501'; end if;
      if p.status not in ('submitted', 'it_review') then raise exception 'Only submitted papers can be approved'; end if;
      v_next := 'approved';
      update public.exam_papers set status = v_next, approved_at = now(), approved_by = auth.uid(), updated_at = now() where id = p.id;
      update public.documents set locked = true, status = 'final' where id = p.document_id;
      perform public.notify_users(array[p.examiner_id] || public.it_officer_ids(), 'Exam paper approved',
        'The paper is approved and locked for printing.', v_link, jsonb_build_object('type', 'exam_paper', 'paper_id', p.id));
    when 'printed' then
      if not (v_it or v_admin) then raise exception 'Only IT or the exam office can record printing' using errcode = '42501'; end if;
      if p.status not in ('approved', 'printed') then raise exception 'Only approved papers can be printed'; end if;
      v_next := 'printed';
      update public.exam_papers set status = v_next, printed_count = printed_count + 1, updated_at = now() where id = p.id;
    when 'release' then
      if not v_admin then raise exception 'Only the exam office can release papers' using errcode = '42501'; end if;
      if p.status not in ('approved', 'printed') then raise exception 'Only approved papers can be released'; end if;
      v_next := 'released';
      update public.exam_papers set status = v_next, released_at = now(), updated_at = now() where id = p.id;
    when 'unlock' then
      if not v_admin then raise exception 'Only the exam office can reopen an approved paper' using errcode = '42501'; end if;
      if p.status not in ('approved', 'printed') then raise exception 'Only approved papers can be reopened'; end if;
      if coalesce(trim(p_note), '') = '' then raise exception 'A reason is required to reopen an approved paper'; end if;
      v_next := 'it_review';
      update public.exam_papers set status = v_next, approved_at = null, approved_by = null, updated_at = now() where id = p.id;
      update public.documents set locked = false, status = 'draft' where id = p.document_id;
    else
      raise exception 'Unknown action %', p_action;
  end case;

  insert into public.exam_paper_events (org_id, paper_id, action, note)
  values (p.org_id, p.id, p_action, nullif(trim(coalesce(p_note, '')), ''));
  return v_next;
end $$;

-- Open a document (and log access to exam papers). Returns the row as JSON.
create or replace function public.open_document(p_doc uuid, p_action text default 'viewed')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
  v_paper uuid;
begin
  if p_action not in ('viewed', 'printed', 'downloaded', 'shared') then
    raise exception 'Unknown access action';
  end if;
  if not public.can_read_document(p_doc) then
    raise exception 'Document not found or you do not have access' using errcode = '42501';
  end if;
  select to_jsonb(x) into d from public.documents x where id = p_doc;
  select id into v_paper from public.exam_papers where document_id = p_doc;
  if v_paper is not null then
    insert into public.exam_paper_events (org_id, paper_id, action) values (public.current_org_id(), v_paper, p_action);
  end if;
  return d;
end $$;

grant execute on function public.assign_exam_paper(uuid, uuid, uuid, date, text, int, numeric, uuid),
  public.exam_paper_transition(uuid, text, text), public.open_document(uuid, text),
  public.can_read_document(uuid), public.can_edit_document(uuid), public.is_it_officer(), public.is_document_admin()
to authenticated;
