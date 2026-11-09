// Authorization checks that run AS THE CALLER (their JWT), so the database's
// own rules apply — including the two-factor gate from 0026_security_mfa.sql.
// Never decide "is admin" from a service-role profile lookup: that bypasses 2FA.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function callerClient(token: string) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

async function rpcBool(token: string, fn: string): Promise<boolean> {
  if (!token) return false;
  const { data, error } = await callerClient(token).rpc(fn);
  return !error && data === true;
}

/** Platform super admin whose session satisfies 2FA. */
export const callerIsSuperAdmin = (token: string) => rpcBool(token, 'is_super_admin');

/** Admin (or super admin) whose session satisfies 2FA. */
export const callerIsAdmin = (token: string) => rpcBool(token, 'is_admin');
/** Approved employee, with the database's MFA policy enforced. */
export const callerIsEmployee = (token: string) => rpcBool(token, 'is_employee');

/** The caller's session satisfies their 2FA obligations. */
export const callerMfaOk = (token: string) => rpcBool(token, 'mfa_ok');

export const bearerOf = (req: Request) => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
