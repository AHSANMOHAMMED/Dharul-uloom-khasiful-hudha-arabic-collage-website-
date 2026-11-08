import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Two-factor authentication (TOTP authenticator apps) on Supabase Auth.
 * Enforcement lives in the database (0026_security_mfa.sql); these helpers
 * only drive enrolment and the sign-in code step.
 */

function client() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Authentication is not configured');
  return supabase;
}

async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

/** { currentLevel: 'aal1'|'aal2', nextLevel: 'aal1'|'aal2' } */
export async function getAssurance() {
  if (!isSupabaseConfigured) return { currentLevel: 'aal1', nextLevel: 'aal1' };
  return unwrap(client().auth.mfa.getAuthenticatorAssuranceLevel());
}

/** Server-side view: { aal, has_factor, required, ok } */
export async function getMfaStatus() {
  if (!isSupabaseConfigured) return { aal: 'aal1', has_factor: false, required: false, ok: true };
  return unwrap(client().rpc('my_mfa_status'));
}

export async function listTotpFactors() {
  const data = await unwrap(client().auth.mfa.listFactors());
  return data?.totp ?? [];
}

/** Starts enrolment; returns { id, qrCode (svg data URI), secret, uri }. */
export async function startTotpEnrollment(friendlyName) {
  const c = client();
  // Drop abandoned (unverified) attempts so they do not pile up.
  const all = await unwrap(c.auth.mfa.listFactors());
  for (const f of all?.all ?? []) {
    if (f.status !== 'verified') await c.auth.mfa.unenroll({ factorId: f.id });
  }
  const data = await unwrap(
    c.auth.mfa.enroll({ factorType: 'totp', friendlyName: friendlyName || `Authenticator ${new Date().toISOString().slice(0, 10)}` })
  );
  return { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

/** Verifies a 6-digit code for a factor (enrolment or sign-in step-up). */
export async function verifyTotp(factorId, code) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) throw new Error('Enter the 6-digit code from your authenticator app');
  return unwrap(client().auth.mfa.challengeAndVerify({ factorId, code: clean }));
}

/** Verifies against the first verified factor (sign-in step). */
export async function verifySignInCode(code) {
  const factors = (await listTotpFactors()).filter((f) => f.status === 'verified');
  if (!factors.length) throw new Error('No authenticator is set up for this account');
  let lastError = null;
  // Users may have a backup device: accept a code from any of their factors.
  for (const f of factors) {
    try {
      return await verifyTotp(f.id, code);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/** Removing a verified factor needs an aal2 session (Supabase enforces it). */
export async function removeFactor(factorId) {
  return unwrap(client().auth.mfa.unenroll({ factorId }));
}

export async function setOrgRequiresMfa(orgId, required) {
  const { error } = await client()
    .from('organizations')
    .update({ require_mfa_for_staff: Boolean(required) })
    .eq('id', orgId);
  if (error) throw error;
}

export async function getOrgSecurity(orgId) {
  if (!orgId) return null;
  return unwrap(
    client().from('organizations').select('id, name_en, require_mfa_for_staff').eq('id', orgId).maybeSingle()
  );
}
