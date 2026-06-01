import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Auth is backed by Supabase Auth (replacing the previous Express + MongoDB
 * JWT flow). The signed-in identity comes from supabase.auth; the application
 * role / display name come from the public.profiles row that the
 * handle_new_user() trigger creates on sign-up.
 *
 * The public API (user, login, register, logout, isAuthenticated, isAdmin, ...)
 * is preserved so existing pages/components keep working unchanged.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Merge the auth user with its profile row into the shape the UI expects.
  const buildUser = useCallback(async (authUser) => {
    if (!authUser) return null;
    let profile = null;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role, account_type, email')
      .eq('id', authUser.id)
      .maybeSingle();
    profile = data;
    return {
      id: authUser.id,
      email: authUser.email ?? profile?.email ?? '',
      username: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
      role: profile?.role || 'user',
      accountType: profile?.account_type || authUser.user_metadata?.account_type || 'guest',
      isVerified: Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;

    // Hydrate from any persisted session on first load.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setUser(await buildUser(session?.user ?? null));
      setLoading(false);
    });

    // Keep context in sync with sign-in / sign-out / token refresh events.
    // NOTE: supabase-js holds an internal auth lock for the duration of this
    // callback, so calling another supabase method here (buildUser awaits
    // supabase.from('profiles'), which itself needs the session) would
    // deadlock. Defer the profile lookup to a macrotask so the lock is
    // released before we touch supabase again.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        if (!active) return;
        setUser(await buildUser(session?.user ?? null));
        setLoading(false);
      }, 0);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, [buildUser]);

  const login = async (email, password) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Authentication is not configured' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }
    const mapped = await buildUser(data.user);
    setUser(mapped);
    return { success: true, user: mapped };
  };

  const register = async (username, email, password, accountType = 'guest') => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Authentication is not configured' };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: username, account_type: accountType } },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    // When email confirmation is disabled, signUp returns an active session.
    if (data.session?.user) {
      const mapped = await buildUser(data.session.user);
      setUser(mapped);
      return { success: true, user: mapped };
    }
    // Otherwise the user must confirm their email before signing in.
    return {
      success: true,
      needsConfirmation: true,
      user: { username, email, role: 'user', accountType },
    };
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'admin' || user?.role === 'librarian',
    isStudent: user?.accountType === 'student',
    isParent: user?.accountType === 'parent',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
