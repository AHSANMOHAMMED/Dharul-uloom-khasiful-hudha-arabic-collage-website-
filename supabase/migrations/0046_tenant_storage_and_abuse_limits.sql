-- 0046 Tenant-scoped storage + abuse limits (audit 2026-11, follow-up to 0045)
--
-- 1. Storage policies are scoped to the caller's organization. Private files
--    (staff-docs, petty-cash) live under "<profile id>/..." so the folder owner's
--    org is checked. Public-asset buckets (gallery, content, covers, books) keep
--    public read, but update/delete is limited to objects uploaded by someone in
--    the same organization. No object paths change, so existing files keep working.
-- 2. verify_student_index (callable before sign-up) no longer reveals the
--    student's name/class to anonymous callers.
-- 3. claim_chat_outbox is callable only by the outbound worker (service role),
--    which has already verified the sender from their JWT.
-- 4. Per-user quota for the paid AI translator (translate-word).

-- ---------------------------------------------------------------------------
-- 1. Storage helpers
-- ---------------------------------------------------------------------------
create or replace function public.storage_folder_in_my_org(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.profiles p
    where p.id::text = (storage.foldername(p_name))[1]
      and p.org_id = public.current_org_id()
  );
$$;

create or replace function public.storage_owner_in_my_org(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.profiles p
    where p.id = p_owner and p.org_id = public.current_org_id()
  );
$$;
revoke all on function public.storage_folder_in_my_org(text) from public, anon;
revoke all on function public.storage_owner_in_my_org(uuid) from public, anon;
grant execute on function public.storage_folder_in_my_org(text) to authenticated, service_role;
grant execute on function public.storage_owner_in_my_org(uuid) to authenticated, service_role;

-- staff-docs: staff only see/manage documents of people in their own org
drop policy if exists "staff_docs: staff read write" on storage.objects;
create policy "staff_docs: staff read write"
  on storage.objects for all
  using (bucket_id = 'staff-docs' and public.is_staff() and public.storage_folder_in_my_org(name))
  with check (bucket_id = 'staff-docs' and public.is_staff() and public.storage_folder_in_my_org(name));

-- petty-cash receipts: uploader, or finance/governance of the uploader's org
drop policy if exists "petty_cash files: read" on storage.objects;
create policy "petty_cash files: read" on storage.objects for select to authenticated
  using (bucket_id = 'petty-cash' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or ((public.is_finance_viewer() or public.is_governance_admin()) and public.storage_folder_in_my_org(name))
  ));

-- public-asset buckets: modify/delete only your own org's uploads
drop policy if exists "covers: staff update" on storage.objects;
create policy "covers: staff update" on storage.objects for update
  using (bucket_id = 'covers' and public.is_staff() and public.storage_owner_in_my_org(owner));
drop policy if exists "covers: staff delete" on storage.objects;
create policy "covers: staff delete" on storage.objects for delete
  using (bucket_id = 'covers' and public.is_staff() and public.storage_owner_in_my_org(owner));

drop policy if exists "books: staff update" on storage.objects;
create policy "books: staff update" on storage.objects for update
  using (bucket_id = 'books' and public.is_staff() and public.storage_owner_in_my_org(owner));
drop policy if exists "books: staff delete" on storage.objects;
create policy "books: staff delete" on storage.objects for delete
  using (bucket_id = 'books' and public.is_staff() and public.storage_owner_in_my_org(owner));

drop policy if exists "gallery bucket: staff update" on storage.objects;
create policy "gallery bucket: staff update" on storage.objects for update
  using (bucket_id = 'gallery' and public.is_staff() and public.storage_owner_in_my_org(owner));
drop policy if exists "gallery bucket: staff delete" on storage.objects;
create policy "gallery bucket: staff delete" on storage.objects for delete
  using (bucket_id = 'gallery' and public.is_staff() and public.storage_owner_in_my_org(owner));

drop policy if exists "content bucket: staff update" on storage.objects;
create policy "content bucket: staff update" on storage.objects for update
  using (bucket_id = 'content' and public.is_staff() and public.storage_owner_in_my_org(owner));
drop policy if exists "content bucket: staff delete" on storage.objects;
create policy "content bucket: staff delete" on storage.objects for delete
  using (bucket_id = 'content' and public.is_staff() and public.storage_owner_in_my_org(owner));

-- ---------------------------------------------------------------------------
-- 2. Index check before sign-up: yes/no only
-- ---------------------------------------------------------------------------
create or replace function public.verify_student_index(p_index_number text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_registered boolean;
begin
  select is_registered into v_registered
  from public.valid_index_numbers
  where index_number = trim(coalesce(p_index_number, ''));

  -- One message for "unknown" and "taken" so the endpoint cannot be used to
  -- map which index numbers exist or are still unclaimed.
  if not found or v_registered then
    return jsonb_build_object('valid', false, 'error', 'Index number is not available for registration');
  end if;
  return jsonb_build_object('valid', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Chat outbox claim: service role only
-- ---------------------------------------------------------------------------
create or replace function public.claim_chat_outbox(p_message_id uuid, p_sender_id uuid)
returns setof public.message_outbox language plpgsql security definer set search_path = public as $$
begin
  -- The send-outbound worker resolves p_sender_id from the caller's JWT before
  -- calling this with the service key; end users cannot call it directly.
  if p_sender_id is null then
    raise exception 'A verified sender is required' using errcode = '42501';
  end if;
  return query
  update public.message_outbox o
  set status = 'sending', claimed_at = now(), attempts = attempts + 1
  from public.chat_messages m
  join public.chat_conversations c on c.id = m.conversation_id
  where m.id = p_message_id and m.sender_id = p_sender_id
    and p_sender_id in (c.participant_low, c.participant_high)
    and o.channel in ('whatsapp', 'push') and o.status = 'pending'
    and o.attempts < 5
    and o.user_id = case when c.participant_low = p_sender_id then c.participant_high else c.participant_low end
    and (o.metadata ->> 'message_id' = m.id::text or o.metadata -> 'data' ->> 'message_id' = m.id::text)
  returning o.*;
end;
$$;
revoke all on function public.claim_chat_outbox(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_chat_outbox(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. AI translator quota
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  feature    text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_feature_time on public.ai_usage (user_id, feature, created_at desc);
alter table public.ai_usage enable row level security;
-- no policies: only service role / security definer functions touch it
select public.apply_mfa_policy('public.ai_usage'::regclass);

-- Returns true and records one use when the user is approved and under quota.
create or replace function public.consume_ai_quota(
  p_user uuid, p_feature text, p_per_hour int default 30, p_per_day int default 150)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hour int;
  v_day  int;
begin
  if p_user is null or not exists (
    select 1 from public.profiles where id = p_user and (is_approved or role = 'super_admin')
  ) then
    return false;
  end if;
  -- serialize per user so parallel requests cannot overshoot the quota
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || p_user::text || ':' || p_feature));
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*)
    into v_hour, v_day
  from public.ai_usage
  where user_id = p_user and feature = p_feature and created_at > now() - interval '1 day';
  if v_hour >= p_per_hour or v_day >= p_per_day then
    return false;
  end if;
  insert into public.ai_usage (user_id, feature) values (p_user, p_feature);
  delete from public.ai_usage where created_at < now() - interval '7 days';
  return true;
end;
$$;
revoke all on function public.consume_ai_quota(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, int, int) to service_role;
