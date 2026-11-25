-- ============================================================================
-- 0081_mess_kitchen_inventory.sql
-- College Daily Meals (Breakfast, Lunch, Dinner), Store Inventory Stock
-- Management (kg, g, L, ml, pcs, etc.), Kitchen Issues, Kitchen Expenses,
-- Low Stock Alerts & Assigned Store Manager role.
-- ============================================================================

-- 1. Seed 'store_manager' duty role for all existing organizations
insert into public.duty_roles (org_id, code, name_en, name_ar, name_ta, category, default_petty_cash, grants_leave_review)
select o.id, 'store_manager', 'Store & Kitchen Manager', 'مسؤول المخزن والمطبخ', 'களஞ்சியம் மற்றும் சமையலறை பொறுப்பாளர்', 'facilities', 0, false
from public.organizations o
where not exists (
  select 1 from public.duty_roles d where d.org_id = o.id and d.code = 'store_manager'
);

-- 2. Access helper for store/mess/kitchen staff
create or replace function public.is_store_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.is_finance_viewer()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.org_id = public.current_org_id()
          and p.is_approved
          and (
            p.assigned_tutor_role in ('principal', 'vice_principal', 'warden', 'treasurer', 'store_manager')
            or 'store_manager' = any(coalesce(p.extra_roles, '{}'::text[]))
            or 'warden' = any(coalesce(p.extra_roles, '{}'::text[]))
          )
      )
      or exists (
        select 1 from public.duty_assignments da
        join public.duty_roles dr on dr.id = da.duty_role_id
        where da.assignee_id = auth.uid()
          and da.status = 'active'
          and dr.org_id = public.current_org_id()
          and dr.code in ('store_manager', 'warden', 'principal', 'vice_principal')
      );
$$;

-- 3. Inventory Items
create table if not exists public.inventory_items (
  id                  uuid primary key default extensions.gen_random_uuid(),
  org_id              uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name                text not null check (length(trim(name)) > 0),
  name_ar             text,
  category            text not null default 'grains'
                      check (category in ('grains', 'spices', 'vegetables', 'meat_dairy', 'oil_ghee', 'beverages', 'fuel_gas', 'cleaning', 'equipment', 'other')),
  unit                text not null default 'kg'
                      check (unit in ('kg', 'g', 'L', 'ml', 'pcs', 'pkt', 'box', 'bag', 'bottle', 'dozen')),
  current_stock       numeric(14,3) not null default 0 check (current_stock >= 0),
  min_stock_level     numeric(14,3) not null default 5 check (min_stock_level >= 0),
  unit_cost           numeric(14,2) not null default 0 check (unit_cost >= 0),
  storage_location    text,
  assigned_manager_id uuid references public.profiles(id) on delete set null,
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, name, unit)
);
create index if not exists idx_inventory_items_org_active on public.inventory_items (org_id, is_active);

-- 4. Inventory Movements (Purchases, Kitchen Issues, Adjustments)
create table if not exists public.inventory_movements (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  item_id         uuid not null references public.inventory_items(id) on delete cascade,
  movement_type   text not null check (movement_type in ('purchase', 'kitchen_issue', 'adjustment')),
  quantity        numeric(14,3) not null,
  unit            text not null check (unit in ('kg', 'g', 'L', 'ml', 'pcs', 'pkt', 'box', 'bag', 'bottle', 'dozen')),
  base_quantity   numeric(14,3) not null,
  unit_cost       numeric(14,2) not null default 0,
  total_cost      numeric(14,2) not null default 0,
  supplier_name   text,
  invoice_no      text,
  payment_method  text default 'cash',
  expense_id      uuid references public.expenses(id) on delete set null,
  meal_date       date,
  meal_type       text check (meal_type in ('breakfast', 'lunch', 'dinner', 'general')),
  issued_to       text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_inventory_movements_org_date on public.inventory_movements (org_id, created_at desc);

-- 5. Daily Meals (Breakfast, Lunch, Dinner)
create table if not exists public.daily_meals (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  meal_date       date not null default current_date,
  meal_type       text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  menu_items      text not null check (length(trim(menu_items)) > 0),
  expected_count  int not null default 0 check (expected_count >= 0),
  served_count    int not null default 0 check (served_count >= 0),
  estimated_cost  numeric(14,2) not null default 0 check (estimated_cost >= 0),
  status          text not null default 'planned' check (status in ('planned', 'prepared', 'served')),
  notes           text,
  managed_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, meal_date, meal_type)
);
create index if not exists idx_daily_meals_org_date on public.daily_meals (org_id, meal_date desc);

-- 6. RLS
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.daily_meals enable row level security;

drop policy if exists "inventory_items: store staff all" on public.inventory_items;
create policy "inventory_items: store staff all" on public.inventory_items
  for all to authenticated
  using (org_id = public.current_org_id() and public.is_store_staff())
  with check (org_id = public.current_org_id() and public.is_store_staff());

drop policy if exists "inventory_movements: store staff read" on public.inventory_movements;
create policy "inventory_movements: store staff read" on public.inventory_movements
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_store_staff());

drop policy if exists "daily_meals: store staff all" on public.daily_meals;
create policy "daily_meals: store staff all" on public.daily_meals
  for all to authenticated
  using (org_id = public.current_org_id() and public.is_store_staff())
  with check (org_id = public.current_org_id() and public.is_store_staff());

-- 7. Unit conversion helper
create or replace function public.inventory_convert_qty(p_qty numeric, p_from_unit text, p_to_unit text)
returns numeric language plpgsql immutable as $$
begin
  if p_from_unit = p_to_unit then
    return p_qty;
  elsif p_from_unit = 'g' and p_to_unit = 'kg' then
    return round(p_qty / 1000.0, 3);
  elsif p_from_unit = 'kg' and p_to_unit = 'g' then
    return round(p_qty * 1000.0, 3);
  elsif p_from_unit = 'ml' and p_to_unit = 'L' then
    return round(p_qty / 1000.0, 3);
  elsif p_from_unit = 'L' and p_to_unit = 'ml' then
    return round(p_qty * 1000.0, 3);
  else
    raise exception 'Cannot convert from unit % to %', p_from_unit, p_to_unit;
  end if;
end;
$$;

-- 8. Record Inventory Purchase (+ optional Kitchen Expense)
create or replace function public.record_inventory_purchase(
  p_item_id uuid,
  p_quantity numeric,
  p_unit text,
  p_unit_cost numeric default 0,
  p_total_cost numeric default 0,
  p_supplier_name text default null,
  p_invoice_no text default null,
  p_payment_method text default 'cash',
  p_record_expense boolean default true,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_item public.inventory_items;
  v_base_qty numeric;
  v_total numeric := coalesce(p_total_cost, 0);
  v_exp_id uuid := null;
  v_exp_acct uuid := null;
  v_mov_id uuid;
begin
  if not public.is_store_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_item from public.inventory_items where id = p_item_id and org_id = v_org for update;
  if not found then
    raise exception 'Inventory item not found';
  end if;

  v_base_qty := public.inventory_convert_qty(p_quantity, coalesce(p_unit, v_item.unit), v_item.unit);
  if v_total <= 0 and coalesce(p_unit_cost, 0) > 0 then
    v_total := round(p_quantity * p_unit_cost, 2);
  end if;

  if coalesce(p_record_expense, true) and v_total > 0 then
    select id into v_exp_acct
    from public.accounts
    where org_id = v_org and type = 'expense' and is_active
    order by (case when name ilike '%kitchen%' or name ilike '%food%' or name ilike '%mess%' then 0 else 1 end), code asc
    limit 1;

    if v_exp_acct is not null then
      insert into public.expenses (org_id, expense_date, account_id, payee, description, amount, payment_method, reference, status, submitted_by)
      values (
        v_org,
        public.org_today(),
        v_exp_acct,
        coalesce(nullif(btrim(p_supplier_name), ''), 'Kitchen Supplier'),
        'Kitchen Store Purchase: ' || v_item.name || ' (' || p_quantity || ' ' || coalesce(p_unit, v_item.unit) || ')',
        v_total,
        case when p_payment_method in ('cash', 'bank_transfer', 'cheque', 'online', 'other') then p_payment_method else 'cash' end,
        nullif(btrim(p_invoice_no), ''),
        'submitted',
        auth.uid()
      )
      returning id into v_exp_id;
    end if;
  end if;

  update public.inventory_items
     set current_stock = current_stock + v_base_qty,
         unit_cost = case when coalesce(p_unit_cost, 0) > 0 then p_unit_cost when v_total > 0 and v_base_qty > 0 then round(v_total / v_base_qty, 2) else unit_cost end,
         updated_at = now()
   where id = v_item.id;

  insert into public.inventory_movements (
    org_id, item_id, movement_type, quantity, unit, base_quantity,
    unit_cost, total_cost, supplier_name, invoice_no, payment_method, expense_id, notes, created_by
  ) values (
    v_org, v_item.id, 'purchase', p_quantity, coalesce(p_unit, v_item.unit), v_base_qty,
    coalesce(p_unit_cost, 0), v_total, nullif(btrim(p_supplier_name), ''), nullif(btrim(p_invoice_no), ''),
    p_payment_method, v_exp_id, nullif(btrim(p_notes), ''), auth.uid()
  )
  returning id into v_mov_id;

  return jsonb_build_object('movement_id', v_mov_id, 'expense_id', v_exp_id, 'added_base_qty', v_base_qty);
end;
$$;

-- 9. Issue Stock to Kitchen
create or replace function public.issue_inventory_to_kitchen(
  p_item_id uuid,
  p_quantity numeric,
  p_unit text,
  p_meal_date date default null,
  p_meal_type text default 'general',
  p_issued_to text default null,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_item public.inventory_items;
  v_base_qty numeric;
  v_mov_id uuid;
  v_new_stock numeric;
begin
  if not public.is_store_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_item from public.inventory_items where id = p_item_id and org_id = v_org for update;
  if not found then
    raise exception 'Inventory item not found';
  end if;

  v_base_qty := public.inventory_convert_qty(p_quantity, coalesce(p_unit, v_item.unit), v_item.unit);
  if v_item.current_stock < v_base_qty then
    raise exception 'Insufficient stock in store (available: % %)', v_item.current_stock, v_item.unit;
  end if;

  v_new_stock := v_item.current_stock - v_base_qty;

  update public.inventory_items
     set current_stock = v_new_stock,
         updated_at = now()
   where id = v_item.id;

  insert into public.inventory_movements (
    org_id, item_id, movement_type, quantity, unit, base_quantity,
    unit_cost, total_cost, meal_date, meal_type, issued_to, notes, created_by
  ) values (
    v_org, v_item.id, 'kitchen_issue', p_quantity, coalesce(p_unit, v_item.unit), v_base_qty,
    v_item.unit_cost, round(v_base_qty * v_item.unit_cost, 2), coalesce(p_meal_date, public.org_today()),
    case when p_meal_type in ('breakfast', 'lunch', 'dinner', 'general') then p_meal_type else 'general' end,
    nullif(btrim(p_issued_to), ''), nullif(btrim(p_notes), ''), auth.uid()
  )
  returning id into v_mov_id;

  return jsonb_build_object(
    'movement_id', v_mov_id,
    'remaining_stock', v_new_stock,
    'low_stock', v_new_stock <= v_item.min_stock_level
  );
end;
$$;

-- 10. Low Stock Alert Notifications
create or replace function public.notify_low_stock_items()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_items text;
  v_low_count int;
  v_sent int := 0;
begin
  if not public.is_store_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*), string_agg(name || ' (' || current_stock || ' ' || unit || ')', ', ' order by name)
    into v_low_count, v_items
  from public.inventory_items
  where org_id = v_org and is_active and current_stock <= min_stock_level;

  if coalesce(v_low_count, 0) = 0 then
    return 0;
  end if;

  insert into public.notifications (user_id, title, message, link, org_id)
  select distinct p.id,
         'Low Store Stock Alert (' || v_low_count || ' items)',
         left('Restock needed: ' || coalesce(v_items, ''), 900),
         '/erp?module=inventory',
         v_org
  from public.profiles p
  left join public.duty_assignments da on da.assignee_id = p.id and da.status = 'active'
  left join public.duty_roles dr on dr.id = da.duty_role_id
  where p.org_id = v_org
    and p.is_approved
    and (
      p.role = 'admin'
      or p.assigned_tutor_role in ('principal', 'treasurer', 'store_manager', 'warden')
      or 'store_manager' = any(coalesce(p.extra_roles, '{}'::text[]))
      or dr.code in ('store_manager', 'treasurer', 'warden')
    );

  get diagnostics v_sent = row_count;
  return v_sent;
end;
$$;

-- 11. Mess & Inventory Summary for Overview
create or replace function public.mess_inventory_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_today date := public.org_today();
  v_month text := to_char(v_today, 'YYYY-MM');
begin
  if not public.is_store_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_items', (select count(*) from public.inventory_items where org_id = v_org and is_active),
    'low_stock_count', (select count(*) from public.inventory_items where org_id = v_org and is_active and current_stock <= min_stock_level),
    'low_stock_items', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'unit', unit, 'current_stock', current_stock, 'min_stock_level', min_stock_level) order by current_stock asc)
      from public.inventory_items
      where org_id = v_org and is_active and current_stock <= min_stock_level
    ), '[]'::jsonb),
    'purchases_month', coalesce((
      select sum(total_cost) from public.inventory_movements
      where org_id = v_org and movement_type = 'purchase' and to_char(created_at, 'YYYY-MM') = v_month
    ), 0),
    'issues_month_count', (
      select count(*) from public.inventory_movements
      where org_id = v_org and movement_type = 'kitchen_issue' and to_char(coalesce(meal_date, created_at::date), 'YYYY-MM') = v_month
    ),
    'today_meals', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'meal_type', meal_type, 'menu_items', menu_items, 'status', status, 'expected_count', expected_count, 'served_count', served_count) order by case meal_type when 'breakfast' then 1 when 'lunch' then 2 else 3 end)
      from public.daily_meals
      where org_id = v_org and meal_date = v_today
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.is_store_staff() from public, anon;
grant execute on function public.is_store_staff() to authenticated;

revoke all on function public.record_inventory_purchase(uuid, numeric, text, numeric, numeric, text, text, text, boolean, text) from public, anon;
grant execute on function public.record_inventory_purchase(uuid, numeric, text, numeric, numeric, text, text, text, boolean, text) to authenticated;

revoke all on function public.issue_inventory_to_kitchen(uuid, numeric, text, date, text, text, text) from public, anon;
grant execute on function public.issue_inventory_to_kitchen(uuid, numeric, text, date, text, text, text) to authenticated;

revoke all on function public.notify_low_stock_items() from public, anon;
grant execute on function public.notify_low_stock_items() to authenticated;

revoke all on function public.mess_inventory_summary() from public, anon;
grant execute on function public.mess_inventory_summary() to authenticated;
