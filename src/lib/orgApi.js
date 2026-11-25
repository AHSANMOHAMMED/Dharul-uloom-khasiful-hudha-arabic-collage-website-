import { supabase, isSupabaseConfigured } from './supabaseClient';
import { TtlCache, withRetry } from './resilience';

const orgCache = new TtlCache({ maxEntries: 20, defaultTtlMs: 120_000 });

/** Single-college default org; foundation for multi-tenant SaaS. */
export async function getDefaultOrganization() {
  if (!isSupabaseConfigured) return null;
  return orgCache.getOrLoad('default_org', async () => {
    const { data, error } = await withRetry(() =>
      supabase.from('organizations').select('*').eq('slug', 'kashiful-hudha').maybeSingle(),
    );
    if (error) {
      console.error('[orgApi] getDefaultOrganization', error);
      return null;
    }
    return data;
  });
}

export async function listOrganizations() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('organizations').select('*').order('name_en');
  if (error) return [];
  return data ?? [];
}

export async function updateOrganizationBranding(id, branding) {
  const { data, error } = await supabase
    .from('organizations')
    .update({ branding })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  orgCache.clear();
  return data;
}
