-- ERP Finance Hub: billing jobs, unified finance documents, quotations,
-- amend-with-reason, public share tokens.

-- ---------------------------------------------------------------------------
-- Billing jobs
-- ---------------------------------------------------------------------------
create table if not exists public.billing_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in (
    'monthly_fees','custom_fee_batch','donation_drive','misc_items','quotation_batch'
  )),
  period_month text,
  status text not null default 'queued' check (status in ('queued','running','done','failed','cancelled')),
  created_by uuid references public.profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_jobs_org on public.billing_jobs (org_id, created_at desc);
alter table public.billing_jobs enable row level security;

drop policy if exists "billing_jobs: finance" on public.billing_jobs;
create policy "billing_jobs: finance" on public.billing_jobs for all to authenticated
  using (
    public.is_super_admin()
    or (org_id = public.current_org_id() and (public.is_admin() or public.is_finance_staff() or public.has_staff_role(array['principal','vice_principal'])))
  )
  with check (
    public.is_super_admin()
    or (org_id = public.current_org_id() and (public.is_admin() or public.is_finance_staff() or public.has_staff_role(array['principal','vice_principal'])))
  );

create or replace function public.create_billing_job(
  p_kind text,
  p_month text default null,
  p_default_tuition numeric default null
) returns public.billing_jobs language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  job public.billing_jobs;
  gen jsonb;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()
          or public.has_staff_role(array['principal','vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_org is null then raise exception 'Organization context required' using errcode = '42501'; end if;

  insert into public.billing_jobs (org_id, kind, period_month, status, created_by, started_at)
  values (v_org, p_kind, p_month, 'running', auth.uid(), now())
  returning * into job;

  begin
    if p_kind = 'monthly_fees' then
      if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
        raise exception 'Valid period_month YYYY-MM required' using errcode = '22023';
      end if;
      select public.generate_monthly_invoices(p_month, null, p_default_tuition, 200) into gen;
      update public.billing_jobs
        set status = 'done', finished_at = now(), summary = coalesce(gen, '{}'::jsonb)
      where id = job.id
      returning * into job;
    else
      update public.billing_jobs
        set status = 'done', finished_at = now(),
            summary = jsonb_build_object('message', 'Job recorded; process documents in Finance Hub')
      where id = job.id
      returning * into job;
    end if;
  exception when others then
    update public.billing_jobs
      set status = 'failed', finished_at = now(), error = SQLERRM
    where id = job.id
    returning * into job;
  end;

  return job;
end;
$$;

grant execute on function public.create_billing_job(text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Unified finance documents
-- ---------------------------------------------------------------------------
create table if not exists public.finance_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'fee_invoice','donation','sadaqah','sale','bill','quotation','receipt'
  )),
  status text not null default 'draft' check (status in ('draft','issued','paid','void','amended')),
  doc_number text,
  party_type text not null default 'external' check (party_type in (
    'student','parent','donor','external','staff'
  )),
  party_id uuid references public.profiles(id) on delete set null,
  party_name text,
  party_phone text,
  currency text not null default 'LKR',
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  public_token text unique default encode(extensions.gen_random_bytes(16), 'hex'),
  letterhead_id uuid,
  notes text,
  amend_reason text,
  converted_from uuid references public.finance_documents(id) on delete set null,
  created_by uuid references public.profiles(id),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_document_lines (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.finance_documents(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  line_type text not null default 'other' check (line_type in (
    'tuition','hostel','donation','sadaqah','food','item','other'
  )),
  description text not null,
  qty numeric(12,3) not null default 1,
  unit_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) generated always as (round(qty * unit_amount, 2)) stored,
  account_id uuid,
  fee_category_id uuid,
  meta jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

create index if not exists idx_finance_docs_org on public.finance_documents (org_id, doc_type, status, created_at desc);
create index if not exists idx_finance_docs_token on public.finance_documents (public_token);
create index if not exists idx_finance_lines_doc on public.finance_document_lines (doc_id);

alter table public.finance_documents enable row level security;
alter table public.finance_document_lines enable row level security;

drop policy if exists "finance_documents: finance" on public.finance_documents;
create policy "finance_documents: finance" on public.finance_documents for all to authenticated
  using (
    public.is_super_admin()
    or (org_id = public.current_org_id() and (public.is_admin() or public.is_finance_staff()
        or public.has_staff_role(array['principal','vice_principal'])))
  )
  with check (
    public.is_super_admin()
    or (org_id = public.current_org_id() and (public.is_admin() or public.is_finance_staff()
        or public.has_staff_role(array['principal','vice_principal'])))
  );

drop policy if exists "finance_document_lines: finance" on public.finance_document_lines;
create policy "finance_document_lines: finance" on public.finance_document_lines for all to authenticated
  using (
    public.is_super_admin()
    or (org_id = public.current_org_id() and (public.is_admin() or public.is_finance_staff()
        or public.has_staff_role(array['principal','vice_principal'])))
  )
  with check (
    public.is_super_admin()
    or (org_id = public.current_org_id() and (public.is_admin() or public.is_finance_staff()
        or public.has_staff_role(array['principal','vice_principal'])))
  );

-- Public read by token (anon + authenticated) via security definer RPCs only
create or replace function public.finance_document_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d public.finance_documents;
  lines jsonb;
begin
  select * into d from public.finance_documents
  where public_token = p_token and status in ('issued','paid','amended');
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'line_type', l.line_type, 'description', l.description,
    'qty', l.qty, 'unit_amount', l.unit_amount, 'line_total', l.line_total
  ) order by l.sort_order, l.description), '[]'::jsonb)
  into lines from public.finance_document_lines l where l.doc_id = d.id;
  return jsonb_build_object(
    'id', d.id, 'doc_type', d.doc_type, 'status', d.status, 'doc_number', d.doc_number,
    'party_name', d.party_name, 'currency', d.currency, 'subtotal', d.subtotal,
    'total', d.total, 'notes', d.notes, 'issued_at', d.issued_at, 'lines', lines,
    'public_token', d.public_token
  );
end;
$$;

grant execute on function public.finance_document_by_token(text) to anon, authenticated;

create or replace function public.create_finance_document(
  p_doc_type text,
  p_party_type text default 'external',
  p_party_id uuid default null,
  p_party_name text default null,
  p_party_phone text default null,
  p_notes text default null,
  p_letterhead_id uuid default null,
  p_lines jsonb default '[]'::jsonb
) returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  d public.finance_documents;
  line jsonb;
  i int := 0;
  v_sub numeric := 0;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()
          or public.has_staff_role(array['principal','vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_org is null then raise exception 'Organization context required' using errcode = '42501'; end if;

  insert into public.finance_documents (
    org_id, doc_type, status, party_type, party_id, party_name, party_phone,
    notes, letterhead_id, created_by
  ) values (
    v_org, p_doc_type, 'draft', coalesce(p_party_type, 'external'), p_party_id,
    nullif(btrim(p_party_name), ''), nullif(btrim(p_party_phone), ''),
    p_notes, p_letterhead_id, auth.uid()
  ) returning * into d;

  for line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    i := i + 1;
    insert into public.finance_document_lines (
      doc_id, org_id, line_type, description, qty, unit_amount, sort_order, meta
    ) values (
      d.id, v_org,
      coalesce(line->>'line_type', 'other'),
      coalesce(nullif(btrim(line->>'description'), ''), 'Item'),
      coalesce((line->>'qty')::numeric, 1),
      coalesce((line->>'unit_amount')::numeric, 0),
      i,
      coalesce(line->'meta', '{}'::jsonb)
    );
    v_sub := v_sub + round(coalesce((line->>'qty')::numeric, 1) * coalesce((line->>'unit_amount')::numeric, 0), 2);
  end loop;

  update public.finance_documents set subtotal = v_sub, total = v_sub, updated_at = now()
  where id = d.id returning * into d;
  return d;
end;
$$;

create or replace function public.issue_finance_document(p_id uuid)
returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  seq int;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()
          or public.has_staff_role(array['principal','vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into d from public.finance_documents where id = p_id and org_id = public.current_org_id();
  if not found and public.is_super_admin() then
    select * into d from public.finance_documents where id = p_id;
  end if;
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if d.status <> 'draft' then raise exception 'Only drafts can be issued' using errcode = '22023'; end if;

  select count(*) + 1 into seq from public.finance_documents
  where org_id = d.org_id and doc_type = d.doc_type and status <> 'draft';

  update public.finance_documents
  set status = 'issued',
      issued_at = now(),
      doc_number = coalesce(doc_number, upper(left(d.doc_type, 3)) || '-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 5, '0')),
      updated_at = now()
  where id = d.id
  returning * into d;

  -- Bridge donations / sadaqah into existing donations ledger when applicable
  if d.doc_type in ('donation', 'sadaqah') and d.total > 0 then
    begin
      perform public.record_donation(
        d.total,
        case when d.doc_type = 'sadaqah' then 'sadaqah' else 'general' end,
        'cash',
        d.party_name,
        d.party_phone,
        null,
        false,
        d.doc_number,
        d.notes,
        null,
        current_date
      );
    exception when others then
      null;
    end;
  end if;

  return d;
end;
$$;

create or replace function public.amend_finance_document(
  p_id uuid,
  p_party_name text default null,
  p_notes text default null,
  p_lines jsonb default null,
  p_reason text default null
) returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  old jsonb;
  line jsonb;
  i int := 0;
  v_sub numeric := 0;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()
          or public.has_staff_role(array['principal','vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Amendment reason is required' using errcode = '22023';
  end if;

  select * into d from public.finance_documents
  where id = p_id and (org_id = public.current_org_id() or public.is_super_admin());
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  old := to_jsonb(d);

  if p_lines is not null then
    delete from public.finance_document_lines where doc_id = d.id;
    for line in select * from jsonb_array_elements(p_lines)
    loop
      i := i + 1;
      insert into public.finance_document_lines (
        doc_id, org_id, line_type, description, qty, unit_amount, sort_order, meta
      ) values (
        d.id, d.org_id,
        coalesce(line->>'line_type', 'other'),
        coalesce(nullif(btrim(line->>'description'), ''), 'Item'),
        coalesce((line->>'qty')::numeric, 1),
        coalesce((line->>'unit_amount')::numeric, 0),
        i,
        coalesce(line->'meta', '{}'::jsonb)
      );
      v_sub := v_sub + round(coalesce((line->>'qty')::numeric, 1) * coalesce((line->>'unit_amount')::numeric, 0), 2);
    end loop;
  else
    select coalesce(sum(line_total), 0) into v_sub from public.finance_document_lines where doc_id = d.id;
  end if;

  update public.finance_documents set
    party_name = coalesce(nullif(btrim(p_party_name), ''), party_name),
    notes = coalesce(p_notes, notes),
    subtotal = v_sub,
    total = v_sub,
    status = case when status = 'draft' then 'draft' else 'amended' end,
    amend_reason = btrim(p_reason),
    updated_at = now()
  where id = d.id
  returning * into d;

  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, old_data, new_data)
  values (d.org_id, 'finance_documents', d.id::text, 'UPDATE', auth.uid(),
    case when public.is_super_admin() then 'super_admin' else 'finance' end,
    old, to_jsonb(d) || jsonb_build_object('amend_reason', p_reason));

  return d;
end;
$$;

create or replace function public.void_finance_document(p_id uuid, p_reason text)
returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Void reason is required' using errcode = '22023';
  end if;
  update public.finance_documents
  set status = 'void', amend_reason = btrim(p_reason), updated_at = now()
  where id = p_id and (org_id = public.current_org_id() or public.is_super_admin())
  returning * into d;
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  return d;
end;
$$;

create or replace function public.convert_quotation_to_bill(p_id uuid)
returns public.finance_documents language plpgsql security definer set search_path = public as $$
declare
  q public.finance_documents;
  lines jsonb;
  bill public.finance_documents;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into q from public.finance_documents
  where id = p_id and doc_type = 'quotation' and (org_id = public.current_org_id() or public.is_super_admin());
  if not found then raise exception 'Quotation not found' using errcode = 'P0002'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'line_type', l.line_type, 'description', l.description,
    'qty', l.qty, 'unit_amount', l.unit_amount
  ) order by l.sort_order), '[]'::jsonb)
  into lines from public.finance_document_lines l where l.doc_id = q.id;

  bill := public.create_finance_document(
    'bill', q.party_type, q.party_id, q.party_name, q.party_phone,
    coalesce(q.notes, '') || ' (from quotation ' || coalesce(q.doc_number, q.id::text) || ')',
    q.letterhead_id, lines
  );
  update public.finance_documents set converted_from = q.id where id = bill.id returning * into bill;
  return bill;
end;
$$;

create or replace function public.hard_delete_finance_document(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
begin
  if not public.platform_can_hard_delete() then
    raise exception 'Only super admin may hard-delete' using errcode = '42501';
  end if;
  select * into d from public.finance_documents where id = p_id;
  if not found then return; end if;
  if d.status <> 'void' then
    raise exception 'Hard delete allowed only for voided documents' using errcode = '22023';
  end if;
  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, old_data)
  values (d.org_id, 'finance_documents', d.id::text, 'DELETE', auth.uid(), 'super_admin', to_jsonb(d));
  delete from public.finance_documents where id = p_id;
end;
$$;

create or replace function public.queue_finance_doc_share(
  p_id uuid,
  p_channel text,
  p_to text,
  p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  d public.finance_documents;
  v_id uuid;
  body text;
  link text;
begin
  if not (public.is_super_admin() or public.is_admin() or public.is_finance_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_channel not in ('sms','whatsapp') then
    raise exception 'channel must be sms or whatsapp' using errcode = '22023';
  end if;
  select * into d from public.finance_documents
  where id = p_id and (org_id = public.current_org_id() or public.is_super_admin());
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if d.status = 'draft' then raise exception 'Issue the document before sharing' using errcode = '22023'; end if;

  link := case
    when d.doc_type = 'quotation' then '/q/' || d.public_token
    when d.doc_type = 'receipt' then '/r/' || d.public_token
    else '/b/' || d.public_token
  end;
  body := coalesce(nullif(btrim(p_message), ''),
    'Kashiful Hudha ' || d.doc_type || ' ' || coalesce(d.doc_number, '') || ' — open: ' || link);

  insert into public.message_outbox (user_id, channel, to_address, body, status, metadata)
  values (
    auth.uid(), p_channel, p_to, body, 'pending',
    jsonb_build_object(
      'org_id', d.org_id,
      'finance_document_id', d.id,
      'public_token', d.public_token,
      'path', link
    )
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.create_finance_document(text, text, uuid, text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.issue_finance_document(uuid) to authenticated;
grant execute on function public.amend_finance_document(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.void_finance_document(uuid, text) to authenticated;
grant execute on function public.convert_quotation_to_bill(uuid) to authenticated;
grant execute on function public.hard_delete_finance_document(uuid) to authenticated;
grant execute on function public.queue_finance_doc_share(uuid, text, text, text) to authenticated;
