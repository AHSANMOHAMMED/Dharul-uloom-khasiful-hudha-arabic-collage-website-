import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isConfigured } from './supabase';
import { getCaps } from './roles';

const PROFILE_COLUMNS =
  'id, email, full_name, phone, role, account_type, is_approved, index_number, class_number, assigned_tutor_role, extra_roles, org_id';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isConfigured);
  const [profileError, setProfileError] = useState(null);
  const profileIdRef = useRef(null);
  // Two-step verification: the session owes a code when nextLevel is aal2.
  const [aal, setAal] = useState({ currentLevel: 'aal1', nextLevel: 'aal1' });

  const loadAal = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!error && data) setAal({ currentLevel: data.currentLevel, nextLevel: data.nextLevel });
  }, []);

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
    if (error) setProfileError(error.message);
    else setProfileError(null);
    setProfile(data || null);
    profileIdRef.current = data?.id || null;
    return data || null;
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await Promise.all([loadProfile(data.session.user.id), loadAal()]);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT' || !s) {
        setAal({ currentLevel: 'aal1', nextLevel: 'aal1' });
        setProfile(null);
        profileIdRef.current = null;
        return;
      }
      if (event === 'MFA_CHALLENGE_VERIFIED' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => {
          loadAal();
          if (event === 'MFA_CHALLENGE_VERIFIED') loadProfile(s.user.id);
        }, 0);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Defer DB calls out of the auth callback (supabase-js recommendation).
        // Only show the global loader when the user actually changed; a
        // re-emitted SIGNED_IN for the same user refreshes silently.
        const sameUser = profileIdRef.current === s.user.id;
        setTimeout(() => {
          if (!sameUser) setLoading(true);
          Promise.all([loadProfile(s.user.id), loadAal()]).finally(() => setLoading(false));
        }, 0);
      }
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, [loadProfile, loadAal]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      profileError,
      loading,
      caps: getCaps(profile),
      aal,
      mfaPending: Boolean(session) && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2',
      refreshAal: loadAal,
      refreshProfile: () => loadProfile(session?.user?.id),
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
      },
    }),
    [session, profile, profileError, loading, loadProfile, aal, loadAal],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
