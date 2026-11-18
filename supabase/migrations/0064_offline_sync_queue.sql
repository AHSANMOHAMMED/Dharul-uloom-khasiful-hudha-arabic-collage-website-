-- Offline attendance draft sync contract (idempotent server apply). No money/results/welfare offline.
set search_path = public, extensions, pg_temp;

create table if not exists public.offline_sync_queue (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  device_id       text not null,
  idempotency_key text not null,
  kind            text not null default 'attendance_draft'
                  check (kind in ('attendance_draft')),
  payload         jsonb not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'applied', 'rejected', 'duplicate')),
  result          jsonb,
  error           text,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  applied_at      timestamptz,
  unique (org_id, device_id, idempotency_key)
);
create index if not exists idx_offline_sync_status on public.offline_sync_queue (org_id, status, created_at);

alter table public.offline_sync_queue enable row level security;
drop policy if exists "offline_sync: own read" on public.offline_sync_queue;
create policy "offline_sync: own read" on public.offline_sync_queue for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (created_by = auth.uid() or public.is_admin())
  );
drop policy if exists "offline_sync: no direct write" on public.offline_sync_queue;
create policy "offline_sync: no direct write" on public.offline_sync_queue for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('offline_sync_queue');

-- payload: { "student_id": uuid, "date": "YYYY-MM-DD", "status": "...", "excuse_note": "..." }
create or replace function public.apply_offline_attendance_draft(
  p_device_id text,
  p_idempotency_key text,
  p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_existing record;
  v_qid uuid;
  v_student uuid;
  v_date date;
  v_status text;
  v_note text;
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(trim(p_device_id), '') = '' or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'device_id and idempotency_key required';
  end if;

  select * into v_existing from public.offline_sync_queue
  where org_id = v_org and device_id = trim(p_device_id) and idempotency_key = trim(p_idempotency_key);
  if found then
    return jsonb_build_object('status', 'duplicate', 'queue_id', v_existing.id, 'result', v_existing.result);
  end if;

  v_student := (p_payload->>'student_id')::uuid;
  v_date := (p_payload->>'date')::date;
  v_status := p_payload->>'status';
  v_note := nullif(trim(coalesce(p_payload->>'excuse_note', '')), '');
  if v_student is null or v_date is null or v_status not in ('present', 'absent', 'late', 'excused') then
    raise exception 'Invalid attendance draft payload';
  end if;

  insert into public.offline_sync_queue (org_id, device_id, idempotency_key, kind, payload, status)
  values (v_org, trim(p_device_id), trim(p_idempotency_key), 'attendance_draft', p_payload, 'pending')
  returning id into v_qid;

  begin
    insert into public.attendance (student_id, date, status, excuse_note, marked_by, org_id)
    values (v_student, v_date, v_status, v_note, auth.uid(), v_org)
    on conflict (student_id, date) do update set
      status = excluded.status,
      excuse_note = coalesce(excluded.excuse_note, public.attendance.excuse_note),
      marked_by = auth.uid();

    update public.offline_sync_queue set
      status = 'applied',
      applied_at = now(),
      result = jsonb_build_object('student_id', v_student, 'date', v_date, 'status', v_status)
    where id = v_qid;

    return jsonb_build_object('status', 'applied', 'queue_id', v_qid);
  exception when others then
    update public.offline_sync_queue set
      status = 'rejected', error = SQLERRM, applied_at = now()
    where id = v_qid;
    return jsonb_build_object('status', 'rejected', 'queue_id', v_qid, 'error', SQLERRM);
  end;
end;
$$;

revoke all on function public.apply_offline_attendance_draft(text, text, jsonb) from public, anon;
grant execute on function public.apply_offline_attendance_draft(text, text, jsonb) to authenticated;

select public.apply_mfa_policy('offline_sync_queue'::regclass);
