-- ============================================================================
-- 0083_profile_avatars.sql
-- Profile photo storage bucket ('avatars'), preferred_language column,
-- and update_my_profile() RPC for all authenticated users.
-- ============================================================================

alter table public.profiles
  add column if not exists preferred_language text not null default 'en'
  check (preferred_language in ('en', 'ar', 'ta'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars: user upload own folder" on storage.objects;
create policy "avatars: user upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: user update own folder" on storage.objects;
create policy "avatars: user update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: user delete own folder" on storage.objects;
create policy "avatars: user delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.update_my_profile(
  p_full_name text default null,
  p_phone text default null,
  p_avatar_url text default null,
  p_preferred_language text default null,
  p_notify_email boolean default null,
  p_notify_whatsapp boolean default null,
  p_notify_push boolean default null
)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_row public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.profiles
     set full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
         phone = case when p_phone is null then phone else nullif(btrim(p_phone), '') end,
         avatar_url = case when p_avatar_url is null then avatar_url else nullif(btrim(p_avatar_url), '') end,
         preferred_language = case when p_preferred_language in ('en', 'ar', 'ta') then p_preferred_language else preferred_language end,
         notify_email = coalesce(p_notify_email, notify_email),
         notify_whatsapp = coalesce(p_notify_whatsapp, notify_whatsapp),
         notify_push = coalesce(p_notify_push, notify_push),
         updated_at = now()
   where id = auth.uid()
   returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, boolean, boolean, boolean) to authenticated;
