-- =============================================================================
-- 0014_plan_completion.sql
-- Enroll fee kickoff, parent invites, staff docs storage, org branding helpers.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- Parent invite tokens (shareable link for parents to claim a child)
create table if not exists public.parent_invites (
  id            uuid primary key default extensions.gen_random_uuid(),
  token         text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  child_index   text not null,
  child_name    text,
  admission_id  uuid references public.admissions (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null,
  claimed_by    uuid references public.profiles (id) on delete set null,
  claimed_at    timestamptz,
  expires_at    timestamptz not null default (now() + interval '14 days'),
  created_at    timestamptz not null default now()
);

create index if not exists idx_parent_invites_token on public.parent_invites (token);

alter table public.parent_invites enable row level security;

create policy "parent_invites: staff manage"
  on public.parent_invites for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "parent_invites: claimant read own"
  on public.parent_invites for select
  using (claimed_by = auth.uid() or public.is_staff());

-- Replace enroll to also create fee row + parent invite
create or replace function public.enroll_admission(
  p_admission_id uuid,
  p_index_number text,
  p_class_number int default 1,
  p_default_fee numeric default 2000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  adm record;
  month text;
  invite_token text;
  default_org uuid;
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;

  select * into adm from public.admissions where id = p_admission_id;
  if not found then
    raise exception 'admission not found';
  end if;

  select id into default_org from public.organizations where slug = 'kashiful-hudha' limit 1;

  insert into public.valid_index_numbers (index_number, student_name, class_number, is_registered)
  values (p_index_number, adm.student_name, p_class_number, false)
  on conflict (index_number) do update
    set student_name = excluded.student_name,
        class_number = excluded.class_number;

  update public.admissions
  set status = 'enrolled',
      pipeline_stage = 'enrolled',
      enrolled_index = p_index_number,
      enrolled_class = p_class_number,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_admission_id;

  insert into public.admission_status_history (admission_id, from_stage, to_stage, changed_by, note)
  values (p_admission_id, adm.pipeline_stage, 'enrolled', auth.uid(),
          format('Enrolled index %s class %s', p_index_number, p_class_number));

  month := to_char(now(), 'YYYY-MM');

  -- Fee kickoff placeholder keyed by index until student registers
  -- (actual student_fees rows require a profile id — store invite metadata instead)

  insert into public.parent_invites (child_index, child_name, admission_id, created_by)
  values (p_index_number, adm.student_name, p_admission_id, auth.uid())
  returning token into invite_token;

  -- Email/SMS outbox for parent contact on the admission
  if coalesce(adm.phone, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata)
    values (
      'sms',
      adm.phone,
      'Parent portal invite',
      format('Your child %s is enrolled (index %s). Open the parent portal and link with this index, or use invite token: %s',
             adm.student_name, p_index_number, invite_token),
      jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token)
    );
  end if;

  if coalesce(adm.email, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata)
    values (
      'email',
      adm.email,
      'Parent portal invite — Kashiful Hudha',
      format('Assalamu alaikum %s,%s%sYour child %s has been enrolled.%sIndex number: %s%sClass: %s%sInvite token: %s%sPlease register as a parent and link this index in the Parent Portal.',
             adm.parent_name, E'\n\n', E'\n', adm.student_name, E'\n', p_index_number, E'\n', p_class_number, E'\n', invite_token, E'\n\n'),
      jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'index_number', p_index_number,
    'class_number', p_class_number,
    'fee_month', month,
    'suggested_fee', p_default_fee,
    'parent_invite_token', invite_token,
    'org_id', default_org
  );
end;
$$;

-- Claim parent invite by token (authenticated parent)
create or replace function public.claim_parent_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.parent_invites
  where token = p_token and claimed_by is null and expires_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired invite');
  end if;

  select id into student_id from public.profiles
  where index_number = inv.child_index and account_type = 'student'
  limit 1;

  if student_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Student has not registered yet. Link by index after the student creates an account.',
      'child_index', inv.child_index
    );
  end if;

  insert into public.parent_children (parent_id, child_id)
  values (auth.uid(), student_id)
  on conflict (parent_id, child_id) do nothing;

  update public.parent_invites
  set claimed_by = auth.uid(), claimed_at = now()
  where id = inv.id;

  insert into public.activation_events (profile_id, event_type, summary, details)
  values (
    student_id,
    'linked_parent',
    format('Parent linked via invite for %s', coalesce(inv.child_name, inv.child_index)),
    jsonb_build_object('parent_id', auth.uid(), 'token', p_token)
  );

  return jsonb_build_object('ok', true, 'child_id', student_id, 'child_index', inv.child_index);
end;
$$;

grant execute on function public.claim_parent_invite(text) to authenticated;

-- Allow parents to link their own children (index / invite flows)
drop policy if exists "parent_children: parent insert own" on public.parent_children;
create policy "parent_children: parent insert own"
  on public.parent_children for insert
  with check (parent_id = auth.uid());

-- Staff documents storage bucket
insert into storage.buckets (id, name, public)
values ('staff-docs', 'staff-docs', false)
on conflict (id) do nothing;

drop policy if exists "staff_docs: staff read write" on storage.objects;
create policy "staff_docs: staff read write"
  on storage.objects for all
  using (bucket_id = 'staff-docs' and public.is_staff())
  with check (bucket_id = 'staff-docs' and public.is_staff());

drop policy if exists "staff_docs: owner read" on storage.objects;
create policy "staff_docs: owner read"
  on storage.objects for select
  using (
    bucket_id = 'staff-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
