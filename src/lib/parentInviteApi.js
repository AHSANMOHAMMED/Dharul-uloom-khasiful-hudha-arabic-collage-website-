import { supabase, isSupabaseConfigured } from './supabaseClient';

export async function claimParentInvite(token) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data, error } = await supabase.rpc('claim_parent_invite', { p_token: token });
  if (error) throw error;
  return data;
}
