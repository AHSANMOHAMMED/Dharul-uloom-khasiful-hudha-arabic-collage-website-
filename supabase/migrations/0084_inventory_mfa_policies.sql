-- ============================================================================
-- 0084_inventory_mfa_policies.sql
-- Attach the mandatory mfa: enforced policy to inventory & meal tables
-- (required by rls_erp_test.sql check on all public RLS tables).
-- ============================================================================

select public.apply_mfa_policy('public.inventory_items'::regclass);
select public.apply_mfa_policy('public.inventory_movements'::regclass);
select public.apply_mfa_policy('public.daily_meals'::regclass);
