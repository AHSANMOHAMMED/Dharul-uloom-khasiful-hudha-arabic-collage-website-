-- Platform job / cron run monitoring.
set search_path = public, extensions, pg_temp;

create table if not exists public.platform_job_runs (
  id          uuid primary key default extensions.gen_random_uuid(),
  job_name    text not null,
  status      text not null default 'running'
              check (status in ('running', 'success', 'failed', 'partial')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  message     text,
  error       text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_platform_job_runs_job on public.platform_job_runs (job_name, started_at desc);

alter table public.platform_job_runs enable row level security;
drop policy if exists "job_runs: super admin read" on public.platform_job_runs;
create policy "job_runs: super admin read" on public.platform_job_runs for select to authenticated
  using (public.is_super_admin());
drop policy if exists "job_runs: no client write" on public.platform_job_runs;
create policy "job_runs: no client write" on public.platform_job_runs for all to authenticated
  using (false) with check (false);

-- Service role (Edge) inserts/updates freely; helpers for workers:
create or replace function public.begin_job_run(p_job text, p_meta jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.platform_job_runs (job_name, status, meta)
  values (coalesce(nullif(trim(p_job), ''), 'unknown'), 'running', coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_job_run(
  p_id uuid,
  p_status text,
  p_message text default null,
  p_error text default null,
  p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('success', 'failed', 'partial') then
    raise exception 'Invalid job status';
  end if;
  update public.platform_job_runs set
    status = p_status,
    finished_at = now(),
    message = p_message,
    error = p_error,
    meta = case when p_meta is null then meta else meta || p_meta end
  where id = p_id;
end;
$$;

revoke all on function public.begin_job_run(text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_job_run(uuid, text, text, text, jsonb) from public, anon, authenticated;
-- Edge uses service_role which bypasses revoke on table; grant execute to service path via postgres owner.
grant execute on function public.begin_job_run(text, jsonb) to service_role;
grant execute on function public.finish_job_run(uuid, text, text, text, jsonb) to service_role;
select public.apply_mfa_policy('platform_job_runs'::regclass);
