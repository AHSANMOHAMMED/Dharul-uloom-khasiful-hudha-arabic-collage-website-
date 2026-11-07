import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Which institution does this public website belong to? (SaaS tenancy)
 *
 * One deployment can serve every institution. Resolution order:
 *   1. `?org=<slug>` (remembered for the browser session — sign-up links)
 *   2. custom domain   — organizations.custom_domain = window.location.hostname
 *   3. sub-domain      — <slug>.<VITE_PLATFORM_DOMAIN>
 *   4. VITE_ORG_SLUG   — per-deployment default
 *   5. 'kashiful-hudha'
 * Only active/trial organizations are used.
 */

const SESSION_KEY = 'kh_site_org';

export function siteOrgHint() {
  const hint = { slug: null, domain: null };
  if (typeof window === 'undefined') return hint;
  try {
    const q = new URLSearchParams(window.location.search).get('org');
    if (q) sessionStorage.setItem(SESSION_KEY, q);
    hint.slug = q || sessionStorage.getItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
  const host = window.location.hostname.toLowerCase();
  const platform = (import.meta.env.VITE_PLATFORM_DOMAIN || '').toLowerCase();
  if (!hint.slug && platform && host.endsWith(`.${platform}`)) {
    const sub = host.slice(0, -(platform.length + 1));
    if (sub && !sub.includes('.') && sub !== 'www') hint.slug = sub;
  }
  if (host && host !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) hint.domain = host;
  return hint;
}

const FIELDS = 'id, slug, code, name_en, name_ar, branding, status';
let promise = null;

async function lookup(column, value) {
  const { data } = await supabase
    .from('organizations')
    .select(FIELDS)
    .eq(column, value)
    .in('status', ['trial', 'active'])
    .maybeSingle();
  return data || null;
}

/** Resolve the site's organization row (cached). Never throws. */
export function getSiteOrg() {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!promise) {
    promise = (async () => {
      try {
        const { slug, domain } = siteOrgHint();
        return (
          (slug && (await lookup('slug', slug))) ||
          (domain && (await lookup('custom_domain', domain))) ||
          (await lookup('slug', import.meta.env.VITE_ORG_SLUG || 'kashiful-hudha')) ||
          null
        );
      } catch {
        return null;
      }
    })();
  }
  return promise;
}

export async function getSiteOrgId() {
  return (await getSiteOrg())?.id ?? null;
}

export async function getSiteOrgSlug() {
  return (await getSiteOrg())?.slug ?? (import.meta.env.VITE_ORG_SLUG || null);
}

/** Test helper: forget the cached organization. */
export function resetSiteOrgCache() {
  promise = null;
}
