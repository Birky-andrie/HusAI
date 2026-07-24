import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, arrivedViaAuthRedirect } from '../lib/supabase.js';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

/** Map a Supabase user to the app's user shape (what the UI consumes). */
function toAppUser(sUser) {
  if (!sUser) return null;
  const meta = sUser.user_metadata || {};
  return {
    id: sUser.id,
    email: sUser.email || '',
    displayName: meta.full_name || meta.name || null,
    emailVerified: Boolean(sUser.email_confirmed_at),
  };
}

const PUBLIC_HASH_PATHS = new Set(['', '/', '/login', '/register', '/verify-email', '/forgot-password', '/oauth-complete']);
/** True only on landing/auth-flow pages — never while already deep in the app (e.g. an active call). */
function onPublicPath() {
  const hash = window.location.hash.replace(/^#/, '').split('?')[0];
  return PUBLIC_HASH_PATHS.has(hash);
}

/** Turn a Supabase auth error into a friendly Error (keeps `.code` for callers). */
function friendly(error) {
  const code = error?.code || '';
  const map = {
    invalid_credentials: 'Incorrect email or password.',
    email_not_confirmed: 'Please confirm your email first — check your inbox for the link.',
    user_already_exists: 'An account with this email already exists.',
    weak_password: 'Password is too weak — use at least 8 characters.',
    over_email_send_rate_limit: 'Too many emails sent — please wait a minute and try again.',
    same_password: 'Your new password must be different from your current one.',
  };
  const e = new Error(map[code] || error?.message || 'Something went wrong. Please try again.');
  e.code = code;
  return e;
}

/**
 * App-wide auth, backed by Supabase Auth. The Supabase session (persisted in
 * localStorage, so it survives Electron's file:// origin) is the source of
 * truth; `account` holds the app-side profile/settings from our own backend.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null); // { settings, identities, hasPassword }
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const user = useMemo(() => toAppUser(session?.user), [session]);

  // Pull the app-side profile (settings + avatar + linked identities) for the user.
  const loadAccount = useCallback(async (sUser) => {
    let settings = null;
    let avatarUrl = null;
    try {
      const data = await api.get('/api/me');
      settings = data.settings;
      avatarUrl = data.user?.avatarUrl ?? null;
    } catch {
      /* backend unreachable — leave settings null, the UI degrades gracefully */
    }
    const identities = sUser.identities || [];
    setAccount({ settings, avatarUrl, identities, hasPassword: identities.some((i) => i.provider === 'email') });
  }, []);

  // Restore the session and subscribe to auth changes.
  useEffect(() => {
    let active = true;
    let handledRedirect = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      } else if (event === 'SIGNED_IN' && arrivedViaAuthRedirect && !handledRedirect && onPublicPath()) {
        // Tail of an OAuth / email-confirmation redirect — land them in the app.
        // Gated to public/pre-auth paths only: a backgrounded tab regaining
        // visibility can make Supabase re-validate the session and re-emit
        // SIGNED_IN, which must NOT yank the user out of e.g. an active call.
        handledRedirect = true;
        navigate('/dashboard', { replace: true });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // Load account data whenever the signed-in user changes.
  useEffect(() => {
    const sUser = session?.user;
    if (!sUser) {
      setAccount(null);
      return;
    }
    loadAccount(sUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loadAccount]);

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw friendly(error);
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: displayName?.trim() || null },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw friendly(error);
    // With email confirmation required, signUp returns no session.
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw friendly(error);
  }, []);

  const resetPasswordForEmail = useCallback(async (email) => {
    // Always resolves — never reveal whether the address has an account.
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw friendly(error);
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw friendly(error);
  }, []);

  const refreshMe = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setSession((s) => (s ? { ...s, user: data.user } : s));
      await loadAccount(data.user);
    }
  }, [loadAccount]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      account,
      loading,
      login,
      register,
      signInWithGoogle,
      resetPasswordForEmail,
      updatePassword,
      resendConfirmation,
      logout,
      refreshMe,
    }),
    [user, account, loading, login, register, signInWithGoogle, resetPasswordForEmail, updatePassword, resendConfirmation, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
