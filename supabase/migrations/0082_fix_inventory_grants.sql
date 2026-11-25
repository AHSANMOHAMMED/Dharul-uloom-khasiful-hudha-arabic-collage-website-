-- ============================================================================
-- 0082_fix_inventory_grants.sql
-- Ensure authenticated role has explicit table privileges on inventory & meals.
-- ============================================================================

grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.daily_meals to authenticated;
grant select on public.inventory_movements to authenticated;
