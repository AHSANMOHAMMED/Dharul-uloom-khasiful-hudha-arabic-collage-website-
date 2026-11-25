import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getSiteOrgSlug } from '../lib/siteOrg';
import { tx } from '../lib/tx';
import { getAssurance, getMfaStatus } from '../lib/mfaApi';

const NO_MFA = { currentLevel: 'aal1', nextLevel: 'aal1', required: false, hasFactor: false };

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
  const [mfa, setMfa] = useState(NO_MFA);

  // 2FA state: whether this session still owes a code, or must enrol first.
  const loadMfa = useCallback(async (authUser) => {
    if (!authUser || !isSupabaseConfigured) return NO_MFA;
    try {
      const [aal, status] = await Promise.all([getAssurance(), getMfaStatus().catch(() => null)]);
      return {
        currentLevel: aal?.currentLevel || 'aal1',
        nextLevel: aal?.nextLevel || 'aal1',
        required: Boolean(status?.required),
        hasFactor: Boolean(status?.has_factor) || aal?.nextLevel === 'aal2',
      };
    } catch {
      return NO_MFA;
    }
  }, []);

  // Merge the auth user with its profile row into the shape the UI expects.
  const buildUser = useCallback(async (authUser) => {
    if (!authUser) return null;
    let profile = null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    profile = data;
    let activeDutyCodes = [];
    if (profile?.is_approved && (profile?.account_type === 'tutor' || profile?.account_type === 'staff')) {
      const { data: dutyRows } = await supabase
        .from('duty_assignments')
        .select('duty:duty_roles(code)')
        .eq('assignee_id', authUser.id)
        .eq('status', 'active');
      activeDutyCodes = (dutyRows || []).map((d) => d.duty?.code).filter(Boolean);
    }
    const staffRoles = [...new Set([
      ...(profile?.assigned_tutor_role && profile.assigned_tutor_role !== 'none' ? [profile.assigned_tutor_role] : []),
      ...(profile?.extra_roles || []),
      ...activeDutyCodes,
    ])];
    return {
      id: authUser.id,
      email: authUser.email ?? profile?.email ?? '',
      username: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
      role: profile?.role || 'user',
      accountType: profile?.account_type || 'guest',
      isVerified: Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
      // No profile row means the account is not provisioned yet: never treat it as approved.
      isApproved: profile ? profile.is_approved : false,
      indexNumber: profile?.index_number || '',
      assignedTutorRole: profile?.assigned_tutor_role || 'none',
      staffRoles,
      classNumber: profile?.class_number || null,
      orgId: profile?.org_id || null,
      phone: profile?.phone || '',
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    let profileChannel = null;

    const subscribeProfile = (authUser) => {
      if (!authUser) return;
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
        profileChannel = null;
      }
      profileChannel = supabase.channel(`profile:${authUser.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${authUser.id}`,
        }, async () => {
          if (!active) return;
          const [u, m] = await Promise.all([buildUser(authUser), loadMfa(authUser)]);
          if (!active) return;
          setUser(u);
          setMfa(m);
        })
        .subscribe();
    };

    // Hydrate from any persisted session on first load.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      const authUser = session?.user ?? null;
      if (authUser) {
        subscribeProfile(authUser);
      }
      const [u, m] = await Promise.all([buildUser(authUser), loadMfa(authUser)]);
      if (!active) return;
      setUser(u);
      setMfa(m);
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
        const authUser = session?.user ?? null;
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
          profileChannel = null;
        }
        if (authUser) {
          subscribeProfile(authUser);
        }
        const [u, m] = await Promise.all([buildUser(authUser), loadMfa(authUser)]);
        if (!active) return;
        setUser(u);
        setMfa(m);
        setLoading(false);
      }, 0);
    });

    return () => {
      active = false;
      if (profileChannel) supabase.removeChannel(profileChannel);
      sub?.subscription?.unsubscribe();
    };
  }, [buildUser, loadMfa]);

  const login = async (email, password) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: tx('المصادقة غير مهيأة', 'Authentication is not configured') };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }
    const [mapped, m] = await Promise.all([buildUser(data.user), loadMfa(data.user)]);
    setUser(mapped);
    setMfa(m);
    // The caller must collect a 6-digit code before the session is privileged.
    return { success: true, user: mapped, mfaRequired: m.nextLevel === 'aal2' && m.currentLevel !== 'aal2' };
  };

  const register = async (username, email, password, accountType = 'guest', indexNumber = '', phone = '') => {
    if (!isSupabaseConfigured) {
      return { success: false, error: tx('المصادقة غير مهيأة', 'Authentication is not configured') };
    }
    
    // Verify index number if registration is for a student
    if (accountType === 'student') {
      if (!indexNumber) {
        return { success: false, error: tx('رقم القيد مطلوب للطلاب', 'Index number is required for students') };
      }
      const { data: verifyData, error: verifyErr } = await supabase
        .rpc('verify_student_index', { p_index_number: indexNumber });
      
      if (verifyErr) {
        return { success: false, error: verifyErr.message };
      }
      if (!verifyData || !verifyData.valid) {
        return { success: false, error: verifyData?.error || tx('رقم القيد غير صالح', 'Invalid index number') };
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: username,
          account_type: accountType,
          index_number: indexNumber || null,
          phone: phone || null,
          // SaaS tenant: ?org=<slug> on the sign-up link, else the deployment default.
          // The DB validates it (and invitations/index records take precedence).
          org_slug: await getSiteOrgSlug(),
          // ?invite=<token> on an invitation link proves the invite reached this
          // person; without it the invitation applies only after e-mail confirmation.
          invite_token: (typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).get('invite')) || null,
        }
      },
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
      user: { username, email, role: 'user', accountType, indexNumber },
    };
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setMfa(NO_MFA);
  };

  // Mirrors the SQL helpers in 0015_security_tenancy.sql. UI gating only —
  // authorization is enforced by RLS / RPC checks in the database.
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isEmployeeType = user?.accountType === 'tutor' || user?.accountType === 'staff';
  const hasRole = (...roles) =>
    Boolean(user && user.isApproved && isEmployeeType && roles.some((r) => user.staffRoles?.includes(r)));
  const isTreasurer = hasRole('treasurer');
  const isAccountant = isAdmin || hasRole('accountant');
  const isFinanceStaff = isAdmin || hasRole('treasurer', 'accountant');
  const isPrincipal = hasRole('principal');
  const isVP = hasRole('vice_principal');

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin,
    isAdmin,
    isLibrarian: (user?.role === 'librarian' && Boolean(user?.isApproved)) || hasRole('librarian'),
    // "staff" = organization administrator (librarians use isLibrarian)
    isStaff: isAdmin,
    isStudent: user?.accountType === 'student',
    isParent: user?.accountType === 'parent',
    isTutor: user?.accountType === 'tutor',
    isNonTeachingStaff: user?.accountType === 'staff',
    isEmployee: isAdmin || (isEmployeeType && Boolean(user?.isApproved)),
    hasRole,
    isTreasurer,
    isPrincipal,
    isVP,
    isAccountant,
    isFinanceStaff,
    isFinanceViewer: isFinanceStaff || isPrincipal || isVP,
    isHrStaff: isAdmin || hasRole('hr_manager'),
    isAcademicAdmin: isAdmin || hasRole('principal', 'vice_principal', 'exam_officer'),
    isItOfficer: hasRole('it_officer'),
    // Mirrors public.is_document_admin(): manages letterheads, sees all non-exam documents.
    isDocumentAdmin: isAdmin || hasRole('principal', 'vice_principal', 'it_officer'),
    isAdmissionsStaff: isAdmin || hasRole('admissions_officer', 'principal', 'vice_principal'),
    isWelfareStaff: isAdmin || hasRole('principal', 'vice_principal', 'counselor', 'warden'),
    isHostelStaff: isAdmin || hasRole('warden', 'principal', 'vice_principal'),
    isStoreManager: hasRole('store_manager'),
    isStoreStaff: isAdmin || isFinanceStaff || hasRole('store_manager', 'warden', 'principal', 'vice_principal'),
    isApproved: user?.isApproved ?? false,
    mfa,
    // Signed in with a password but the account has 2FA: ask for the code.
    mfaChallengeNeeded: Boolean(user) && mfa.nextLevel === 'aal2' && mfa.currentLevel !== 'aal2',
    // The organisation requires 2FA for this role and none is set up yet.
    mfaSetupNeeded: Boolean(user) && mfa.required && !mfa.hasFactor,
    refreshUser: async () => {
      if (!isSupabaseConfigured) return;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const [u, m] = await Promise.all([buildUser(authUser ?? null), loadMfa(authUser ?? null)]);
      setUser(u);
      setMfa(m);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
